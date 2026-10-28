import test from 'node:test';
import assert from 'node:assert/strict';
import {commitObservedDeployment,attributeSharedRollouts} from './release-receipt.mjs';
import {pendingDeployment,recordDeploymentFailure} from './release-queue.mjs';
const sha='a'.repeat(40),expected='b'.repeat(40);
function fixture(){
 const candidate={mergeSha:sha,sha,prNumber:7,status:'awaiting_activation'},experiment={id:'current',mergeSha:sha},peer={id:'earlier',mergeSha:'c'.repeat(40)};
 const state={generation:1,memory:{STATE:'preserve'},growth:{lastDeployedCommit:expected,pendingDeployment:candidate,releaseQueue:[{sha,prNumber:7,status:'merged'}],experiments:[experiment,peer]}};
 const saved=[],store={save:async()=>{state.generation++;saved.push(structuredClone(state));}};
 const receipt={sha,phase:'healthy',currentCommit:sha,backup:{verified:true},releasedAt:'2026-10-27T21:52:23.088Z',finishedAt:'2026-10-27T21:52:23.089Z'};
 return {state,store,candidate,experiment,receipt,sha,expected,saved};
}
test('a healthy host receipt is durable before any optional comparison request',async()=>{
 const f=fixture(),deployment=await commitObservedDeployment(f);
 await attributeSharedRollouts({...f,deployment,api:async()=>{assert.equal(f.saved[0].growth.lastDeployedCommit,sha);return {status:'ahead'};}});
 assert.equal(f.state.growth.lastDeployedCommit,sha);assert.equal(f.candidate.status,'deployed');assert.equal(f.state.growth.experiments[1].deployment.sharedRollout,true);assert.equal(f.state.memory.STATE,'preserve');
});
test('a failed optional network comparison cannot erase a confirmed release or require redeployment',async()=>{
 const f=fixture(),deployment=await commitObservedDeployment(f),deferred=[];
 await attributeSharedRollouts({...f,deployment,api:async()=>{throw Error('fetch failed');},onDeferred:v=>deferred.push(v)});
 assert.equal(f.state.growth.lastDeployedCommit,sha);assert.equal(f.state.growth.pendingDeployment.status,'deployed');assert.equal(f.saved.length,1);assert.equal(f.state.growth.experiments[1].deployment,undefined);assert.deepEqual(deferred,[{sharedAttributionDeferred:true}]);
});
test('an unconfirmed primary save restores pending status and preserves bounded delayed retries',async()=>{
 const f=fixture(),before=structuredClone(f.state);f.store.save=async()=>{throw Error('network or CAS failure');};
 await assert.rejects(commitObservedDeployment(f));assert.deepEqual(f.state,before);
 const pending=pendingDeployment(f.state),now=Date.parse('2026-10-28T12:00:00Z');recordDeploymentFailure(pending,now);
 assert.equal(pending.status,'awaiting_activation');assert.equal(pending.deploymentFailures,1);assert.equal(pending.nextDeploymentAttemptAt,'2026-10-28T18:00:00.000Z');assert.equal(f.state.growth.lastDeployedCommit,expected);
 recordDeploymentFailure(pending,now);recordDeploymentFailure(pending,now);assert.equal(pending.status,'manual_intervention');
});
test('optional attribution persistence failure preserves the already durable primary receipt',async()=>{
 const f=fixture(),deployment=await commitObservedDeployment(f),confirmed=structuredClone(f.state),deferred=[];
 f.store.save=async()=>{throw Error('state changed concurrently');};
 await attributeSharedRollouts({...f,deployment,api:async()=>({status:'ahead'}),onDeferred:v=>deferred.push(v)});
 assert.deepEqual(f.state,confirmed);assert.equal(f.saved[0].growth.lastDeployedCommit,sha);assert.equal(deferred.length,1);
});
test('a confirmed image rollback never advances the deployed commit',async()=>{
 const f=fixture();f.receipt={...f.receipt,phase:'rolled_back',currentCommit:expected};
 const deployment=await commitObservedDeployment(f);let requested=false;
 await attributeSharedRollouts({...f,deployment,api:async()=>{requested=true;}});
 assert.equal(requested,false);assert.equal(f.state.growth.lastDeployedCommit,expected);assert.equal(f.candidate.status,'rolled_back');
});
test('an incomplete host receipt cannot mutate production history',async()=>{
 const f=fixture(),before=structuredClone(f.state);f.receipt.backup.verified=false;
 await assert.rejects(commitObservedDeployment(f));assert.deepEqual(f.state,before);assert.equal(f.saved.length,0);
});
