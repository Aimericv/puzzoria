import {readFileSync,writeFileSync,statSync,realpathSync,openSync,closeSync,fsyncSync,renameSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const zero='0'.repeat(40),sha=value=>/^[a-f0-9]{40}$/.test(value??''),hash=value=>/^[a-f0-9]{64}$/.test(value??'');
export const MAINTENANCE_PATHS=new Set(['.github/actions/puzzoria-agent/action.yml','agent/autonomy/control.json','deploy/release-reviewed-maintenance.mjs','deploy/update-reviewed-maintenance.ps1','deploy/setup-release-from-windows.ps1','docs/AUTONOMY-GROWTH.fr.md','scripts/autonomy-agent/package-controller.mjs','scripts/autonomy-agent/release-client.mjs','scripts/autonomy-agent/release-receipt.mjs','scripts/autonomy-agent/release-receipt.test.mjs','scripts/autonomy-agent/reviewed-maintenance.test.mjs','scripts/autonomy-agent/test-windows-host-key.ps1']);
export function validateMaintenance({approval,manifest,currentPolicy,state,changes}) {
  if(approval.kind!=='reviewed-controller-maintenance'||approval.ownerAuthorized!==true||!Number.isFinite(Date.parse(approval.approvedAt))||!sha(approval.sha)||!sha(approval.previousCommit)||!sha(approval.validatedSource)||!hash(approval.policyHash)||!hash(approval.previousPolicyHash)||manifest.source!==approval.validatedSource||manifest.policyHash!==approval.policyHash||![approval.previousPolicyHash,approval.policyHash].includes(currentPolicy))throw Error('Exact reviewed maintenance and installed policy required');
  if(state?.phase!=='healthy'||![approval.previousCommit,approval.sha].includes(state.currentCommit)||state.currentCommit===approval.sha&&state.sha!==approval.sha)throw Error('A healthy known production baseline is required');
  if(!Array.isArray(changes)||!changes.length||changes.some(row=>!['A','M'].includes(row.status)||row.mode!=='100644'||!MAINTENANCE_PATHS.has(row.path)))throw Error('Maintenance cannot change application code, data, dependencies or installed host modules');
}
export async function publishReviewedMaintenance({approval,driver,builder,store,transaction,persistPolicy}) {
  const reviewedDriver={...driver,prepare:async(approved,expected)=>{
    if(approved!==approval.sha||expected!==approval.previousCommit)throw Error('Root maintenance is limited to the exact owner-reviewed source and previous commit');
    // Only this root operator calls the existing exact-source builder exception.
    // The transaction retains the real previous commit and all backup/rollback checks.
    return builder.prepare(approved,zero);
  }};
  const receipt=await transaction({driver:reviewedDriver,store,sha:approval.sha,expected:approval.previousCommit});
  if(receipt.phase==='healthy'&&receipt.sha===approval.sha&&receipt.currentCommit===approval.sha&&receipt.backup?.verified===true){await persistPolicy(approval.policyHash);return {...receipt,policyUpdated:true};}
  return {...receipt,policyUpdated:false};
}
async function main(){
  if(process.getuid()!==0||process.argv.length!==5)throw Error('Explicit root-reviewed maintenance required');
  const [approvalPath,bundle,packageDirectory]=process.argv.slice(2),approval=JSON.parse(readFileSync(approvalPath,'utf8')),manifest=JSON.parse(readFileSync(join(packageDirectory,'VALIDATION.json'),'utf8'));
  if(!sha(approval.sha)||!sha(approval.previousCommit)||!sha(approval.validatedSource)||!hash(approval.policyHash)||!hash(approval.previousPolicyHash)||!hash(approval.bundleSha256))throw Error('Exact reviewed maintenance identifiers required');
  const configPath='/etc/puzzoria-release/config.json',installed='/usr/local/lib/puzzoria-release',metadata=statSync(configPath);
  if(metadata.uid!==0||(metadata.mode&0o077)!==0||realpathSync(configPath)!==configPath||statSync(bundle).size>32*1024*1024||createHash('sha256').update(readFileSync(bundle)).digest('hex')!==approval.bundleSha256)throw Error('Private root config and exact bounded reviewed bundle required');
  for(const name of ['release-host.mjs','deployment-transaction.mjs','release-policy.mjs','public-probe.mjs'])if(!readFileSync(join(installed,name)).equals(readFileSync(join(packageDirectory,name))))throw Error('Installed backup and rollback controller must remain unchanged');
  const {hostDriver,durableStore,validateHostConfig}=await import(pathToFileURL(join(installed,'release-host.mjs'))),{deployTransaction}=await import(pathToFileURL(join(installed,'deployment-transaction.mjs')));
  const config=validateHostConfig(JSON.parse(readFileSync(configPath,'utf8'))),store=durableStore(config.stateDirectory),state=await store.read(),driver=hostDriver(config,bundle);
  if(await driver.currentImage()!==state.currentImage||await driver.schema()!==state.schema)throw Error('Production image and schema must match the observed healthy journal');
  const env={...process.env};for(const key of ['GIT_CONFIG','GIT_CONFIG_GLOBAL','GIT_CONFIG_SYSTEM','GIT_SSH_COMMAND','GIT_DIR','GIT_WORK_TREE'])delete env[key];
  const git=args=>execFileSync('git',['-c','core.hooksPath=/dev/null','-c',`safe.directory=${config.repository}`,'--git-dir',config.repository,...args],{env,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000,maxBuffer:4*1024*1024}).trim();
  if(git(['bundle','list-heads',bundle])!==`${approval.sha} refs/puzzoria-release/verified`)throw Error('Bundle must advertise only the approved maintenance source');
  git(['bundle','verify',bundle]);git(['fetch','--no-tags',bundle,'refs/puzzoria-release/verified:refs/puzzoria-release/maintenance']);
  if(git(['rev-parse',approval.sha+'^{tree}'])!==git(['rev-parse',approval.validatedSource+'^{tree}']))throw Error('Merged maintenance tree differs from the validated source');
  git(['merge-base','--is-ancestor',approval.previousCommit,approval.sha]);
  const changes=git(['diff','--name-status',approval.previousCommit,approval.sha]).split('\n').filter(Boolean).map(line=>{const [status,path]=line.split('\t');return {status,path,mode:git(['ls-tree',approval.sha,'--',path]).split(/\s+/)[0]};});
  validateMaintenance({approval,manifest,currentPolicy:config.policyHash,state,changes});
  const persistPolicy=async value=>{
    if(config.policyHash===value)return;
    const backup=configPath+'.before-'+config.policyHash;
    try{writeFileSync(backup,readFileSync(configPath),{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST'||!readFileSync(backup).equals(readFileSync(configPath)))throw error;}
    const backupFd=openSync(backup,'r');try{fsyncSync(backupFd);}finally{closeSync(backupFd);}
    const temporary=configPath+'.maintenance-new';writeFileSync(temporary,JSON.stringify({...config,policyHash:value},null,2)+'\n',{mode:0o600,flag:'wx'});
    const fd=openSync(temporary,'r');try{fsyncSync(fd);}finally{closeSync(fd);}renameSync(temporary,configPath);
    const folder=openSync(dirname(configPath),'r');try{fsyncSync(folder);}finally{closeSync(folder);}
  };
  return publishReviewedMaintenance({approval,driver,builder:hostDriver({...config,bootstrapApprovedCommit:approval.sha},bundle),store,transaction:deployTransaction,persistPolicy});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(receipt=>{console.log(JSON.stringify(receipt));if(receipt.phase!=='healthy'||!receipt.policyUpdated)process.exitCode=1;}).catch(error=>{console.error(error.message);process.exitCode=1;});
