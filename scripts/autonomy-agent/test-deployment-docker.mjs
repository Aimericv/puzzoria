import {execFileSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,mkdirSync,copyFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {hostDriver,durableStore} from './release-host.mjs';
import {deployTransaction} from './deployment-transaction.mjs';
import {VERIFIER_IMAGE} from './verify.mjs';

// Real containers + real private SQLite volume, on an isolated Compose project.
// Never use the production project, production network, hostname or database.
const root=mkdtempSync(join(tmpdir(),'puzzoria-rollout-')),project='puzzoria_release_test_'+Date.now();
let candidateImage;
const docker=args=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:180000});
const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
const compose=args=>docker(['compose','--project-name',project,'--env-file',join(root,'fixture.env'),'--file',join(root,'compose.yaml'),...args]);
try {
  mkdirSync(join(root,'src/lib'),{recursive:true});mkdirSync(join(root,'scripts'));
  for(const name of ['backup-sqlite.mjs','verify-restore.mjs','account-erasure.mjs','container-health.mjs'])copyFileSync(join('scripts',name),join(root,'scripts',name));
  writeFileSync(join(root,'package.json'),'{"type":"module"}\n');
  writeFileSync(join(root,'src/lib/seo-content.ts'),'const content={en:{title:"healthy"}};\n');
  writeFileSync(join(root,'server.mjs'),`import {createServer} from 'node:http';import {DatabaseSync} from 'node:sqlite';import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
const db=new DatabaseSync('/data/dailygrid.sqlite');for(const name of ['users','runs','results','sessions','measurement_sessions','credential_versions','writes'])db.exec('CREATE TABLE IF NOT EXISTS '+name+'(id TEXT)');
mkdirSync('/backups',{recursive:true});if(!existsSync('/backups/account-deletions.jsonl'))writeFileSync('/backups/account-deletions.jsonl','');
const bad=readFileSync('/app/src/lib/seo-content.ts','utf8').includes('unhealthy');if(bad)db.prepare('INSERT INTO writes VALUES (?)').run('write-after-release');
createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({status:req.url==='/marker'&&bad?'failed':'ok'}));}).listen(3000,'0.0.0.0');`);
  writeFileSync(join(root,'Dockerfile'),`FROM ${VERIFIER_IMAGE}\nWORKDIR /app\nCOPY . .\nRUN chmod -R a+rX /app && mkdir -p /data /backups && chown -R node:node /data /backups\nUSER node\nENV DAILYGRID_DB_PATH=/data/dailygrid.sqlite BACKUP_DIR=/backups ACCOUNT_DELETION_LOG=/backups/account-deletions.jsonl\nCMD ["node","server.mjs"]\n`);
  writeFileSync(join(root,'fixture.env'),'UNUSED=1\n');
  writeFileSync(join(root,'compose.yaml'),JSON.stringify({services:{app:{image:project+':baseline',ports:['127.0.0.1::3000'],volumes:['data:/data','backups:/backups'],healthcheck:{test:['CMD','node','scripts/container-health.mjs'],interval:'1s',timeout:'2s',retries:2,start_period:'1s'}}},volumes:{data:{},backups:{}}}));
  git(['init']);git(['config','user.email','fixture@example.invalid']);git(['config','user.name','Isolated release fixture']);git(['add','.']);git(['commit','-m','baseline']);const base=git(['rev-parse','HEAD']);
  docker(['build','--label',`org.opencontainers.image.revision=${base}`,'-t',project+':baseline',root]);compose(['up','-d','--wait']);
  const stateDirectory=join(root,'private-state'),repository=join(root,'mirror.git');mkdirSync(stateDirectory);execFileSync('git',['clone','--bare',root,repository],{stdio:'ignore'});
  writeFileSync(join(root,'src/lib/seo-content.ts'),'const content={en:{title:"unhealthy"}};\n');git(['add','src/lib/seo-content.ts']);git(['commit','-m','injected unhealthy editorial release']);const sha=git(['rev-parse','HEAD']);candidateImage=`dailygrid:agent-${sha}`;git(['update-ref','refs/puzzoria-release/verified',sha]);const bundle=join(root,'incoming.bundle');git(['bundle','create',bundle,'refs/puzzoria-release/verified',`^${base}`]);
  const config={schemaVersion:1,origin:'https://puzzoria.com',appDirectory:root,composeFile:join(root,'compose.yaml'),environmentFile:join(root,'fixture.env'),composeProject:project,appService:'app',repository,stateDirectory,initialCommit:base};
  const driver=hostDriver(config,bundle,{publicProbe:async()=>{const id=compose(['ps','-q','app']).trim();const result=JSON.parse(docker(['exec',id,'node','-e',"fetch('http://127.0.0.1:3000/marker').then(r=>r.json()).then(v=>console.log(JSON.stringify(v)))"]));assert.equal(result.status,'ok');}});
  const store=durableStore(stateDirectory),image=await driver.currentImage();await store.write({phase:'healthy',currentCommit:base,currentImage:image});
  if(process.argv.includes('--crash')){const probe=driver.probe;driver.probe=async selected=>{if(selected!==image)compose(['stop','app']);return probe(selected);};}
  const result=await deployTransaction({driver,store,sha,expected:base});assert.equal(result.phase,'rolled_back');assert.equal(await driver.currentImage(),image);
  const id=compose(['ps','-q','app']).trim();const rows=Number(docker(['exec',id,'node','-e',"const{DatabaseSync}=require('node:sqlite');console.log(new DatabaseSync('/data/dailygrid.sqlite').prepare('SELECT count(*) AS n FROM writes').get().n)"]));assert.equal(rows,1);
  console.log(JSON.stringify({test:process.argv.includes('--crash')?'real-docker-crashed-app-recovery':'real-docker-image-rollback',status:'passed',verifiedBackup:result.backup.verified,rollback:'previous-image',postRolloutWritesRetained:rows,productionContacted:false,project}));
} catch(error) {
  try{console.error(compose(['logs','--no-color','--tail','20','app']));}catch{/* Disposable fixture diagnostics only. */}
  throw error;
} finally {
  try{compose(['down','--volumes','--remove-orphans']);}catch{/* Only this unique disposable project is selected. */}
  try{docker(['image','rm',project+':baseline']);}catch{/* Fixture cleanup only. */}
  if(candidateImage)try{docker(['image','rm',candidateImage]);}catch{/* This fixture's candidate only. */}
  rmSync(root,{recursive:true,force:true});
}
