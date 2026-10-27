import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,statSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {refreshBootstrapPolicy} from '../../deploy/refresh-bootstrap-policy.mjs';
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'puzzoria-policy-')),installedDirectory=join(root,'installed'),packageDirectory=join(root,'reviewed');
 mkdirSync(installedDirectory);mkdirSync(packageDirectory);
 for(const file of ['release-host.mjs','deployment-transaction.mjs','release-policy.mjs','public-probe.mjs'])for(const dir of [installedDirectory,packageDirectory])writeFileSync(join(dir,file),'unchanged '+file);
 const previous={schemaVersion:1,origin:'https://puzzoria.com',appDirectory:'/opt/puzzoria',composeFile:'/opt/puzzoria/compose.yaml',environmentFile:'/opt/puzzoria/.env',composeProject:'dailygrid',appService:'app',repository:'/var/lib/puzzoria-release/repository.git',stateDirectory:'/var/lib/puzzoria-release',initialCommit:'0'.repeat(40),bootstrapApprovedCommit:'1'.repeat(40),policyHash:'a'.repeat(64)};
 const next={...previous,bootstrapApprovedCommit:'2'.repeat(40),policyHash:'b'.repeat(64)},configPath=join(root,'config.json'),original=JSON.stringify(previous,null,2)+'\n';
 writeFileSync(configPath,original,{mode:0o600});writeFileSync(join(packageDirectory,'VALIDATION.json'),JSON.stringify({source:'3'.repeat(40),policyHash:next.policyHash}));
 const state={phase:'healthy',currentCommit:'0'.repeat(40),legacyBaselineUnknown:true,currentImage:'sha256:'+'4'.repeat(64)},calls=[];
 const driver={currentImage:async()=>{calls.push('read-image');return state.currentImage;},schema:async()=>{calls.push('read-schema');return '5'.repeat(64);}};
 return {root,original,previous,next,calls,args:{configPath,next,expectedPolicy:previous.policyHash,packageDirectory,installedDirectory,state,driver},close:()=>rmSync(root,{recursive:true,force:true})};
}
test('bootstrap policy refresh backs up configuration and changes only the exact source and policy',async()=>{
 const f=fixture();try{
  const before=JSON.stringify(f.args.state),r=await refreshBootstrapPolicy(f.args);
  assert.equal(r.productionChanged,false);assert.equal(r.policyRefreshed,true);
  assert.deepEqual(JSON.parse(readFileSync(f.args.configPath)),f.next);
  assert.equal(readFileSync(r.configurationBackup,'utf8'),f.original);
  assert.equal(statSync(f.args.configPath).mode&0o777,0o600);
  assert.equal(statSync(r.configurationBackup).mode&0o777,0o600);
  assert.equal(JSON.stringify(f.args.state),before);assert.deepEqual(f.calls,['read-image','read-schema']);
 }finally{f.close();}
});
test('bootstrap policy refresh can verify the same completed configuration without rewriting it',async()=>{
 const f=fixture();try{
  await refreshBootstrapPolicy(f.args);const before=readFileSync(f.args.configPath),names=readdirSync(f.root);
  const r=await refreshBootstrapPolicy(f.args);assert.equal(r.policyAlreadyCurrent,true);assert.equal(r.productionChanged,false);assert.deepEqual(readFileSync(f.args.configPath),before);assert.deepEqual(readdirSync(f.root),names);
 }finally{f.close();}
});
for(const [name,mutate] of [
 ['unexpected installed policy',f=>{f.args.expectedPolicy='c'.repeat(64);}],
 ['changed production paths',f=>{f.next.environmentFile='/opt/puzzoria/.different';}],
 ['an already published controller',f=>{f.args.state.currentCommit='6'.repeat(40);f.args.state.legacyBaselineUnknown=false;}],
 ['an active or failed transaction',f=>{f.args.state.phase='checking';}],
 ['different installed host code',f=>{writeFileSync(join(f.args.installedDirectory,'release-host.mjs'),'changed');}],
 ['an image changed outside the controller',f=>{f.args.driver.currentImage=async()=> 'sha256:'+'7'.repeat(64);}],
 ['unavailable schema observation',f=>{f.args.driver.schema=async()=> ''; }]
])test('bootstrap policy refresh rejects '+name+' without changing configuration',async()=>{
 const f=fixture();try{mutate(f);await assert.rejects(refreshBootstrapPolicy(f.args));assert.equal(readFileSync(f.args.configPath,'utf8'),f.original);assert.deepEqual(readdirSync(f.root).sort(),['config.json','installed','reviewed']);}finally{f.close();}
});
