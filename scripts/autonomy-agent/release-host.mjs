import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,renameSync,openSync,closeSync,fsyncSync,mkdirSync,statSync,statfsSync,realpathSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {classifyRelease} from './release-policy.mjs';
import {deployTransaction,recoverDeployment} from './deployment-transaction.mjs';
import {probePublicSite} from './public-probe.mjs';

export function validateHostConfig(c) {
  if(c?.schemaVersion!==1||c.origin!=='https://puzzoria.com'||!/^[a-z0-9][a-z0-9_-]{2,62}$/.test(c.composeProject??'')||c.appService!=='app'||
    !['appDirectory','composeFile','environmentFile','repository','stateDirectory'].every(key=>typeof c[key]==='string'&&c[key].startsWith('/')&&!c[key].includes('\n')&&!c[key].includes('\0'))||
    !c.composeFile.startsWith(c.appDirectory+'/')||!c.environmentFile.startsWith(c.appDirectory+'/')||
    c.stateDirectory==='/data'||c.stateDirectory===c.appDirectory||!/^[a-f0-9]{40}$/.test(c.initialCommit??'')||
    (c.initialCommit==='0'.repeat(40)&&!/^[a-f0-9]{40}$/.test(c.bootstrapApprovedCommit??'')))throw Error('Explicit project paths and baseline or exact initial approval are required');
  return c;
}
export function durableStore(directory) {
  mkdirSync(directory,{recursive:true,mode:0o700});const path=join(directory,'state.json');
  return {read:async()=>{try{return JSON.parse(readFileSync(path,'utf8'));}catch(error){if(error.code==='ENOENT')return null;throw error;}},write:async value=>{
    const temporary=path+'.new';writeFileSync(temporary,JSON.stringify(value,null,2)+'\n',{mode:0o600});const fd=openSync(temporary,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,path);const folder=openSync(directory,'r');try{fsyncSync(folder);}finally{closeSync(folder);}
  }};
}
export function hostDriver(config,bundle,{publicProbe=probePublicSite}={}) {
  const c=validateHostConfig(config),env={...process.env};
  for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','GIT_CONFIG','GIT_CONFIG_GLOBAL','GIT_CONFIG_SYSTEM','GIT_SSH_COMMAND','GIT_DIR','GIT_WORK_TREE'])delete env[key];
  const call=(program,args,timeout=60000)=>{
    const result=spawnSync(program,args,{env,encoding:'utf8',timeout,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
    if(result.status!==0)throw Error(`Host operation failed: ${program} (exit ${result.status??'timeout'})`);
    return result.stdout.trim();
  };
  const git=args=>call('git',['-c','core.hooksPath=/dev/null','-c',`safe.directory=${c.repository}`,'--git-dir',c.repository,...args]);
  const docker=args=>call('docker',['--host=unix:///var/run/docker.sock',...args]);
  const override=join(c.stateDirectory,'image-override.json');
  const compose=args=>docker(['compose','--project-name',c.composeProject,'--env-file',c.environmentFile,'--file',c.composeFile,...(exists(override)?['--file',override]:[]),...args]);
  const container=()=>{const value=compose(['ps','--all','--quiet',c.appService]);if(!/^[a-f0-9]{12,64}$/.test(value))throw Error('Exactly one existing application container is required');return value;};
  const schemaScript="const {DatabaseSync}=require('node:sqlite'),{createHash}=require('node:crypto');const db=new DatabaseSync(process.env.DAILYGRID_DB_PATH,{readOnly:true});try{console.log(createHash('sha256').update(JSON.stringify(db.prepare(\"SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name\").all())).digest('hex'))}finally{db.close()}";
  return {
    haltWrites:async()=>{compose(['stop','app','operations']);},
    currentImage:async()=>{const image=docker(['inspect','--format','{{.Image}}',container()]);if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('An immutable running image is required');return image;},
    schema:async()=>{
      const mounts=JSON.parse(docker(['inspect','--format','{{json .Mounts}}',container()]));
      const data=mounts.find(mount=>mount.Destination==='/data');
      if(data?.Type!=='volume'||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/.test(data.Name??''))throw Error('An existing named private data volume is required');
      // This independent, pinned runtime can inspect the database even if the
      // replacement app has exited. SQLite itself is opened read-only; a
      // writable mount permits only its normal WAL lock/index coordination.
      const value=docker(['run','--rm','--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user','1000:1000','--mount',`type=volume,src=${data.Name},dst=/data`,'--env','DAILYGRID_DB_PATH=/data/dailygrid.sqlite','--entrypoint','node','node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d','-e',schemaScript]);
      if(!/^[a-f0-9]{64}$/.test(value))throw Error('Database schema fingerprint unavailable');return value;
    },
    prepare:async(sha,expected)=>{
      if(!bundle)throw Error('A bounded Git bundle is required');
      const filesystem=statfsSync(docker(['info','--format','{{.DockerRootDir}}']));
      if(filesystem.bavail*filesystem.bsize<(c.minimumFreeBytes??4*1024**3))throw Error('Insufficient free Docker storage; no automatic cache or volume deletion is permitted');
      if(git(['bundle','list-heads',bundle])!==`${sha} refs/puzzoria-release/verified`)throw Error('Bundle does not advertise exactly the approved commit');
      git(['bundle','verify',bundle]);git(['fetch','--no-tags',bundle,'refs/puzzoria-release/verified:refs/puzzoria-release/received']);
      const bootstrap=expected==='0'.repeat(40)&&c.bootstrapApprovedCommit===sha;
      if(expected==='0'.repeat(40)&&!bootstrap)throw Error('Only the explicitly approved initial source may replace a legacy image');
      const rows=bootstrap?[]:git(['diff','--name-status',expected,sha]).split('\n').filter(Boolean),files=[];
      for(const row of rows){const [status,path]=row.split('\t');if(!['M','A'].includes(status)||!path)throw Error('Automatic rollout cannot delete, rename or replace files');const mode=git(['ls-tree',sha,'--',path]).split(/\s/)[0];files.push({path,mode,before:status==='M'?git(['show',`${expected}:${path}`]):undefined,after:git(['show',`${sha}:${path}`])});}
      if(!bootstrap&&classifyRelease(files).risk!=='low')throw Error('Host independently requires owner review of this production delta');
      const work=join(c.stateDirectory,'build-'+sha);mkdirSync(work,{recursive:true,mode:0o700});
      try {
        const archive=execFileSync('git',['-c','core.hooksPath=/dev/null','--git-dir',c.repository,'archive',sha],{env,maxBuffer:32*1024*1024});execFileSync('tar',['-x','--no-same-owner','-C',work],{input:archive});
        const image=`dailygrid:agent-${sha}`;
        call('docker',['--host=unix:///var/run/docker.sock','build','--label',`org.opencontainers.image.revision=${sha}`,'--label','org.puzzoria.managed-release=1','--build-arg',`NEXT_PUBLIC_SITE_URL=${c.origin}`,'--tag',image,work],20*60000);
        return docker(['image','inspect','--format','{{.Id}}',image]);
      } finally {rmSync(work,{recursive:true,force:true});}
    },
    backupAndVerify:async()=>{
      const id=container();
      const output=docker(['exec',id,'node','--input-type=module','-e',"import {backupSqlite} from './scripts/backup-sqlite.mjs';console.log(JSON.stringify({file:await backupSqlite(process.env.DAILYGRID_DB_PATH,process.env.BACKUP_DIR)}))"]);
      const backup=JSON.parse(output.slice(output.lastIndexOf('\n')+1)).file;
      if(!/^\/backups\/dailygrid-[A-Za-z0-9.-]+\.sqlite$/.test(backup))throw Error('Unexpected backup path');
      const result=JSON.parse(docker(['exec',id,'node','scripts/verify-restore.mjs',backup]));
      if(result.integrity!=='ok')throw Error('Backup restore test failed');return {verified:true,file:backup,erasuresReapplied:result.erasuresReapplied};
    },
    preview:async(image,backup,expectedSchema)=>{
      const suffix=Date.now()+'-'+process.pid,name='puzzoria-release-preview-'+suffix,volume=name+'-data',id=container();
      docker(['volume','create',volume]);
      try {
        // Original volumes stay read-only; only the disposable copy is opened
        // by the new application before any production image is switched.
        docker(['run','--rm','--network=none','--user','0','--volumes-from',id+':ro','--mount',`type=volume,src=${volume},dst=/preview`,'--entrypoint','node',image,'-e',`const fs=require('fs');fs.copyFileSync(${JSON.stringify(backup.file)},'/preview/dailygrid.sqlite');fs.copyFileSync('/backups/account-deletions.jsonl','/preview/account-deletions.jsonl');for(const p of ['/preview','/preview/dailygrid.sqlite','/preview/account-deletions.jsonl'])fs.chownSync(p,1000,1000);`]);
        docker(['run','--detach','--name',name,'--network=none','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=1g','--pids-limit=256','--user','1000:1000','--mount',`type=volume,src=${volume},dst=/data`,'--mount',`type=volume,src=${volume},dst=/backups`,'--env',`NEXT_PUBLIC_SITE_URL=${c.origin}`,'--env',`AUTH_ORIGIN=${c.origin}`,'--env','TRUST_PROXY=true',image]);
        let ready=false;
        for(let attempt=0;attempt<30;attempt++){try{docker(['exec',name,'node','scripts/container-health.mjs']);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,2000));}}
        if(!ready)throw Error('Private preview did not become healthy');
        if(docker(['exec',name,'node','-e',schemaScript])!==expectedSchema)throw Error('Schema-changing releases require separate owner approval');
      } finally {try{docker(['rm','--force',name]);}catch{/* Preview may not have started. */}docker(['volume','rm',volume]);}
    },
    switchImage:async image=>{
      if(!/^sha256:[a-f0-9]{64}$/.test(image))throw Error('Only immutable local images may be selected');
      const temporary=override+'.new';writeFileSync(temporary,JSON.stringify({services:{app:{image}}})+'\n',{mode:0o600});renameSync(temporary,override);
      compose(['up','--detach','--no-build','--pull','never','--no-deps','--force-recreate','--wait','--wait-timeout','90',c.appService]);
    },
    pruneManagedImages:async keep=>{
      const used=new Set(docker(['ps','--all','--quiet']).split('\n').filter(Boolean).map(id=>docker(['inspect','--format','{{.Image}}',id])));
      const images=docker(['image','ls','--filter','label=org.puzzoria.managed-release=1','--no-trunc','--quiet']).split('\n').filter(Boolean);
      for(const image of new Set(images))if(!keep.includes(image)&&!used.has(image)){try{docker(['image','rm',image]);}catch{/* Never force-remove an image, cache or volume. */}}
    },
    probe:async image=>{
      for(let i=0;i<3;i++) {
        if(docker(['inspect','--format','{{.Image}}',container()])!==image)throw Error('Running image differs from the selected release');
        docker(['exec',container(),'node','scripts/container-health.mjs']);await publicProbe(c.origin);
        if(i<2)await new Promise(resolve=>setTimeout(resolve,5000));
      }
    }
  };
}
function exists(path){try{statSync(path);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
export async function main(args=process.argv.slice(2)) {
  if(process.getuid()!==0)throw Error('The installed root-owned helper is required');
  const configPath='/etc/puzzoria-release/config.json',metadata=statSync(configPath);
  if(metadata.uid!==0||(metadata.mode&0o022)!==0||realpathSync(configPath)!==configPath)throw Error('Release configuration must be root-owned and immutable to the deploy user');
  const config=validateHostConfig(JSON.parse(readFileSync(configPath,'utf8'))),store=durableStore(config.stateDirectory);
  if(args[0]==='recover'&&args.length===1)return recoverDeployment({driver:hostDriver(config),store});
  if(args[0]==='check'&&args.length===1)return {image:await hostDriver(config).currentImage(),schema:await hostDriver(config).schema(),state:await store.read(),productionChanged:false};
  if(args.length!==4||args[0]!=='release'||!args.slice(1,3).every(v=>/^[a-f0-9]{40}$/.test(v))||!/^[a-f0-9]{64}$/.test(args[3])||args[3]!==config.policyHash)throw Error('Release source, previous commit and installed policy must match');
  const bundle=join(config.stateDirectory,'incoming.bundle');let bytes=0;const fd=openSync(bundle,'w',0o600);
  try{for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>32*1024*1024)throw Error('Release bundle too large');writeFileSync(fd,chunk);}fsyncSync(fd);}finally{closeSync(fd);}
  try{const driver=hostDriver(config,bundle),result=await deployTransaction({driver,store,sha:args[1],expected:args[2]});await driver.pruneManagedImages([result.currentImage,result.previousImage]);return result;}finally{rmSync(bundle,{force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(result=>{console.log(JSON.stringify(result));if(result?.phase==='manual_intervention'||(process.argv[2]==='release'&&result?.phase==='rolled_back'))process.exitCode=1;}).catch(()=>{console.error('Release refused or failed; inspect the private host release journal. No secret or database content is logged.');process.exitCode=1;});
