import test from 'node:test';
import assert from 'node:assert/strict';
import {validateMaintenance,publishReviewedMaintenance} from '../../deploy/release-reviewed-maintenance.mjs';
import {deployTransaction} from './deployment-transaction.mjs';
const previous='a'.repeat(40),next='b'.repeat(40),oldPolicy='c'.repeat(64),newPolicy='d'.repeat(64);
function fixture(){
 const approval={kind:'reviewed-controller-maintenance',ownerAuthorized:true,approvedAt:'2026-10-28T12:00:00Z',sha:next,previousCommit:previous,validatedSource:'e'.repeat(40),previousPolicyHash:oldPolicy,policyHash:newPolicy};
 const state={phase:'healthy',currentCommit:previous,currentImage:'old',schema:'schema'},records=[],events=[];
 const store={read:async()=>structuredClone(state),write:async value=>{for(const key of Object.keys(state))delete state[key];Object.assign(state,value);records.push(structuredClone(value));}};
 let image='old';
 const driver={currentImage:async()=>image,schema:async()=>'schema',backupAndVerify:async()=>{events.push('backup');return {verified:true};},preview:async()=>{events.push('preview');},switchImage:async value=>{events.push('switch:'+value);image=value;},probe:async()=>{events.push('probe');}};
 const builder={prepare:async(sha,expected)=>{events.push('prepare');assert.equal(sha,next);assert.equal(expected,'0'.repeat(40));return 'new';}};
 const persistPolicy=async value=>{assert.equal(value,newPolicy);events.push('persist-policy');};
 return {approval,state,store,driver,builder,persistPolicy,transaction:deployTransaction,events,records};
}
function valid(f){return {approval:f.approval,manifest:{source:f.approval.validatedSource,policyHash:newPolicy},currentPolicy:oldPolicy,state:f.state,changes:[{status:'M',mode:'100644',path:'.github/actions/puzzoria-agent/action.yml'}]};}
test('reviewed maintenance keeps the real previous commit and all backup, preview and public checks',async()=>{
 const f=fixture();validateMaintenance(valid(f));const receipt=await publishReviewedMaintenance(f);
 assert.equal(receipt.phase,'healthy');assert.equal(receipt.currentCommit,next);assert.equal(receipt.previousCommit,previous);assert.equal(receipt.policyUpdated,true);
 assert.deepEqual(f.events,['prepare','backup','preview','switch:new','probe','persist-policy']);
});
test('failed public checks roll back the image and do not activate the new policy',async()=>{
 const f=fixture();let probes=0;f.driver.probe=async()=>{if(probes++===0)throw Error('regression');};
 const receipt=await publishReviewedMaintenance(f);
 assert.equal(receipt.phase,'rolled_back');assert.equal(receipt.currentCommit,previous);assert.equal(receipt.policyUpdated,false);assert.equal(f.events.includes('persist-policy'),false);assert.equal(f.state.currentImage,'old');
});
test('an identical completed owner maintenance retries policy confirmation without rebuilding',async()=>{
 const f=fixture();await publishReviewedMaintenance(f);f.events.length=0;
 validateMaintenance({...valid(f),currentPolicy:newPolicy});const receipt=await publishReviewedMaintenance(f);
 assert.equal(receipt.policyUpdated,true);assert.deepEqual(f.events,['persist-policy']);
});
test('maintenance cannot expand to application code, dependency changes, deletes, links or host modules',()=>{
 const f=fixture();
 for(const row of [{path:'src/app/page.tsx',status:'M',mode:'100644'},{path:'package-lock.json',status:'M',mode:'100644'},{path:'scripts/autonomy-agent/release-host.mjs',status:'M',mode:'100644'},{path:'.github/actions/puzzoria-agent/action.yml',status:'D',mode:'100644'},{path:'.github/actions/puzzoria-agent/action.yml',status:'M',mode:'120000'}])assert.throws(()=>validateMaintenance({...valid(f),changes:[row]}));
});

test('budget maintenance remains an exact root review with application and host code excluded',()=>{
 const f=fixture();
 for(const path of ['.github/workflows/actions-budget.yml','scripts/autonomy-agent/actions-budget-runtime.mjs','docs/ACTIONS-BUDGET.fr.md'])validateMaintenance({...valid(f),changes:[{path,status:'A',mode:'100644'}]});
 for(const path of ['src/lib/server/db.ts','.github/workflows/unreviewed.yml','scripts/autonomy-agent/release-host.mjs','content/new-game.json'])assert.throws(()=>validateMaintenance({...valid(f),changes:[{path,status:'M',mode:'100644'}]}));
});
test('maintenance refuses missing owner consent, stale sources and interrupted production',()=>{
 for(const mutate of [v=>v.approval.ownerAuthorized=false,v=>v.approval.approvedAt='bad',v=>v.approval.kind='automatic',v=>v.manifest.source='f'.repeat(40),v=>v.currentPolicy='f'.repeat(64),v=>v.state.phase='checking',v=>v.state.currentCommit='f'.repeat(40)]){
  const f=fixture(),value=valid(f);mutate(value);assert.throws(()=>validateMaintenance(value));
 }
});
test('only the exact reviewed build source can use the root maintenance builder',async()=>{
 const f=fixture();f.transaction=async({driver})=>driver.prepare('f'.repeat(40),previous);
 await assert.rejects(publishReviewedMaintenance(f));assert.deepEqual(f.events,[]);
});
