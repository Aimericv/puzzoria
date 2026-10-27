import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcileValidationReservations,validationReservation,validationBudgetAvailable} from './release-budget.mjs';
import {rememberReleaseCandidate,validationCandidates,pendingDeployment,ensureReleaseQueue,deploymentBlocksNewRuntime,recordDeploymentFailure} from './release-queue.mjs';
import {selectReleaseCandidate} from './release-selection.mjs';
import {classifyRelease} from './release-policy.mjs';
const now=Date.parse('2026-10-27T12:00:00Z');
const row=()=>({at:'2026-10-27T10:00:00Z',runId:'7',sha:'a'.repeat(40),minutes:90});
const run=()=>({status:'completed',repository:{full_name:'Aimericv/puzzoria'},head_branch:'main',path:'.github/workflows/autonomy-agent.yml',run_attempt:1});
const job=()=>({id:11,run_id:7,name:'release-validation',status:'completed',conclusion:'failure',started_at:'2026-10-27T10:00:00Z',completed_at:'2026-10-27T10:20:00Z'});
const accounting=(r=run(),j=[job()])=>async path=>path.includes('/jobs?')?{jobs:j}:r;
test('completed jobs release unused reservation only with pinned GitHub metadata and a billing margin',async()=>{
 const history=await reconcileValidationReservations(accounting(),[row()],now);
 assert.equal(history[0].minutes,22);assert.equal(history[0].reservedMinutes,90);assert.equal(history[0].accounting.marginMinutes,2);
 assert.equal(validationReservation('editorial-copy',90),92);assert.equal(validationReservation('documentation',90),7);
 assert.equal(validationBudgetAvailable(history,92,180),true);
 assert.equal(validationBudgetAvailable([{minutes:90},{minutes:90}],92,180),false);
 assert.equal(validationBudgetAvailable([{minutes:-1}],92,180),false);
});
test('running, retried, foreign, ambiguous and malformed accounting never frees minutes',async()=>{
 for(const change of [r=>r.status='in_progress',r=>r.run_attempt=2,r=>r.path='.github/workflows/other.yml',r=>r.repository.full_name='other/repo']){
  const r=run();change(r);assert.equal((await reconcileValidationReservations(accounting(r),[row()],now))[0].minutes,90);
 }
 for(const change of [j=>j.run_id=8,j=>j.status='in_progress',j=>j.completed_at='invalid',j=>j.completed_at='2026-10-28T10:00:00Z',j=>j.completed_at='2026-10-27T09:59:00Z']){
  const j=job();change(j);assert.equal((await reconcileValidationReservations(accounting(run(),[j]),[row()],now))[0].minutes,90);
 }
 assert.equal((await reconcileValidationReservations(accounting(run(),[job(),job()]),[row()],now))[0].minutes,90);
 assert.equal((await reconcileValidationReservations(async()=>{throw Error('unavailable');},[row()],now))[0].minutes,90);
 const invalid=[{...row(),at:'invalid',minutes:'unknown'}];assert.equal((await reconcileValidationReservations(accounting(),invalid,now)).length,1);assert.equal(validationBudgetAvailable(invalid,92,180),false);
});
const receipt=(pr=1)=>({sha:'a'.repeat(40),base:'b'.repeat(40),prNumber:pr,experimentId:`experiment-${pr}`,verified:true,runId:'7',status:'proposed'});
test('new work preserves older proposals and the exact merged version awaiting deployment',()=>{
 const original={...receipt(),status:'awaiting_activation',mergeSha:'c'.repeat(40)};
 const state={growth:{releaseCandidate:original,experiments:[]}};
 rememberReleaseCandidate(state,receipt(2));rememberReleaseCandidate(state,receipt(3));
 assert.deepEqual(state.growth.releaseQueue.map(r=>r.prNumber),[1,2,3]);assert.equal(pendingDeployment(state).mergeSha,'c'.repeat(40));
 assert.equal(state.growth.releaseCandidate.prNumber,3);assert.deepEqual(validationCandidates(state).map(r=>r.prNumber),[2,3]);
 assert.throws(()=>rememberReleaseCandidate(state,{...receipt(4),verified:false}));
 const before=JSON.stringify(state);assert.deepEqual(validationCandidates(state).map(r=>r.prNumber),[2,3]);assert.equal(JSON.stringify(state),before);
});
test('translated product documentation is ordinary; sensitive documents and traversal stay manual',()=>{
 for(const path of ['docs/FIRST-PLAY-BROWSER.fr.md','docs/research/ENTRY.en.md'])assert.equal(classifyRelease([{path,mode:'100644',after:'Product measurement protocol'}]).risk,'low');
 for(const path of ['docs/SECURITY.fr.md','docs/AUTONOMY-GROWTH.fr.md','docs/RETENTION.fr.md','docs/../AGENTS.md','docs/.hidden.md','docs/PRODUCT.fr.md/other'])assert.equal(classifyRelease([{path,mode:'100644',after:'Change'}]).risk,'manual');
});
function selectionFixture({unsafeRebase=false,changedHead=false,conflict=false}={}) {
 const original=receipt(),main='d'.repeat(40),next='c'.repeat(40);let head=changedHead?'e'.repeat(40):original.sha;
 const before='const content={fr:{title:"Old"}};export const get=()=>content;',after=before.replace('Old','New title');
 const state={growth:{releaseCandidate:original,releaseQueue:[original],experiments:[{id:original.experimentId,prNumber:original.prNumber,candidateSha:original.sha}]}};
 const calls=[];
 const api=async(path,method='GET',body)=>{
  calls.push({path,method,body});
  if(path==='/pulls/1')return {state:'open',merged:false,head:{sha:head,ref:'codex/experiments/experiment-1',repo:{full_name:'Aimericv/puzzoria'}},base:{ref:'main'}};
  if(path==='/pulls/1/update-branch'){assert.equal(body.expected_head_sha,original.sha);if(conflict){const e=Error('conflict');e.status=422;throw e;}head=next;return {};}
  if(path.startsWith('/compare/'))return {status:'ahead',behind_by:0,files:[{filename:'src/lib/seo-content.ts',status:'modified'}]};
  if(path.startsWith('/git/trees/'))return {tree:[{path:'src/lib/seo-content.ts',mode:'100644'}]};
  if(path.startsWith('/contents/')){const ref=path.split('ref=')[1];const text=[original.base,main].includes(ref)?before:after+(unsafeRebase&&ref===next?'\nprocess.exit(0)':'');return {encoding:'base64',size:text.length,content:Buffer.from(text).toString('base64')};}
  if(path.startsWith('/git/commits/'))return {parents:[{sha:original.sha},{sha:main}]};
  throw Error(path);
 };
 return {api,state,main,calls};
}
test('a stale ordinary proposal is automatically rebased, then its complete delta is classified again',async()=>{
 const f=selectionFixture(),selected=await selectReleaseCandidate(f.api,f.state,f.main,{wait:async()=>{}});
 assert.equal(selected.base,f.main);assert.equal(selected.sha,'c'.repeat(40));assert.equal(selected.nativeVerifiedSha,'a'.repeat(40));assert.equal(selected.risk.risk,'low');
 assert.equal(f.state.growth.experiments[0].candidateSha,selected.sha);assert.ok(f.calls.some(c=>c.path.includes(f.main+'...')));
});
test('unexpected heads, conflict and executable changes introduced on rebase never become automatic',async()=>{
 for(const options of [{changedHead:true},{conflict:true},{unsafeRebase:true}]){
  const f=selectionFixture(options);assert.equal(await selectReleaseCandidate(f.api,f.state,f.main,{wait:async()=>{}}),null);assert.equal(f.state.growth.releaseQueue[0].status,'manual_review');
 }
});
test('a later manual proposal cannot hide an older verified queued proposal',()=>{
 const old=receipt(),manual={...receipt(2),status:'manual_review'};
 const state={growth:{releaseCandidate:manual,releaseQueue:[old,manual]}};ensureReleaseQueue(state);
 assert.deepEqual(validationCandidates(state).map(r=>r.prNumber),[1]);
});

test('archived or changed experiments cannot reach a mutation or validation allocation',async()=>{
 const f=selectionFixture();f.state.growth.experiments=[];
 assert.equal(await selectReleaseCandidate(f.api,f.state,f.main),null);assert.equal(f.calls.length,0);
 assert.equal(f.state.growth.releaseQueue[0].reason,'unknown_or_changed_experiment');
});

test('an initial approved or unconfirmed rollout blocks newer runtime merges until confirmation',()=>{
 const state={growth:{pendingDeployment:{status:'awaiting_activation',ownerApprovedBootstrap:true,mergeSha:'a'.repeat(40)}}};
 assert.equal(deploymentBlocksNewRuntime(state),true);
 state.growth.lastDeployedCommit='b'.repeat(40);assert.equal(deploymentBlocksNewRuntime(state),false);
 state.growth.pendingDeployment.deploymentFailures=1;assert.equal(deploymentBlocksNewRuntime(state),true);
 state.growth.pendingDeployment.status='deployed';assert.equal(deploymentBlocksNewRuntime(state),false);
 state.growth.pendingDeployment.status='manual_intervention';assert.equal(deploymentBlocksNewRuntime(state),true);
});
test('unconfirmed deployments get bounded delayed retries rather than invented success',()=>{
 const candidate={status:'awaiting_activation'},now=Date.parse('2026-10-27T12:00:00Z');
 recordDeploymentFailure(candidate,now);assert.equal(candidate.status,'awaiting_activation');assert.equal(candidate.nextDeploymentAttemptAt,'2026-10-27T18:00:00.000Z');
 recordDeploymentFailure(candidate,now);recordDeploymentFailure(candidate,now);assert.equal(candidate.status,'manual_intervention');assert.equal(candidate.deploymentFailures,3);
});
test('production credentials appear only in the gated production job, without a paid private-environment prerequisite',()=>{
 const source=readFileSync(new URL('../../.github/workflows/autonomy-agent.yml',import.meta.url),'utf8');
 const before=source.slice(0,source.indexOf('\n  production:\n')),production=source.slice(source.indexOf('\n  production:\n'),source.indexOf('\n  second:\n'));
 assert.ok(!before.includes('secrets.PUZZORIA_DEPLOY_KEY'));assert.ok(production.includes("github.ref == 'refs/heads/main'"));assert.ok(production.includes("needs.production-gate.outputs.allowed == 'true'"));assert.ok(!production.includes('environment:'));assert.ok(production.includes('secrets.PUZZORIA_DEPLOY_KEY'));
});
