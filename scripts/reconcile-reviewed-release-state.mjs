import{readFileSync}from'node:fs';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{createHash}from'node:crypto';
import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),main='45bef6497b0d6e2afc3e46e307d21e0ce0f255c0',source='bbcd110d7ee6390a3fb55ab7de16d9edb504e60b';
const load=p=>import(pathToFileURL(resolve(p))),control=JSON.parse(readFileSync('agent/autonomy/control.json'));
if((await api('/git/ref/heads/main')).object.sha!==main||control.release.productionEnabled!==false||control.release.productionAuthorization!==null||control.release.target.initialCommit!==null||control.release.validationBudgetMinutes7d!==180)throw Error('Main or production gates changed');
const {StateStore,readJSON}=await load('scripts/autonomy-agent/store.mjs'),{verifiedReceipt,ensureReleaseQueue}=await load('scripts/autonomy-agent/release-queue.mjs'),{reconcileValidationReservations}=await load('scripts/autonomy-agent/release-budget.mjs');
const data=await api('/contents/reviewed-release-ready.json?ref=codex%2Freviewed-release-ready%2F40551501926'),proof=JSON.parse(Buffer.from(data.content,'base64'));
if(proof.source!==source||proof.controllerTests.passed!==76||proof.applicationValidation.status!=='passed'||proof.resourceTotal>180)throw Error('Reviewed evidence missing');
const store=new StateStore(api,control,main),state=await store.load();
if(!['ready','waiting_quota'].includes(state.status)||state.paused||state.pendingMessages?.length||state.growth.productionBootstrapApproval||state.growth.lastDeployedCommit)throw Error('Do not override owner control or an authorized deployment');
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const invariant=s=>{const copy={...s};delete copy.growth;delete copy.releaseValidationHistory;delete copy.generation;return digest(copy);};
const experiments=s=>digest(s.growth.experiments.map(e=>{const copy={...e};for(const k of ['status','mergeSha','publicationMergeSha','requiresDeployment','validatedInBatch'])delete copy[k];return copy;}));
const untouched=invariant(state),criteria=experiments(state),beforeGeneration=state.generation;
if(state.growth.reviewedBatch?.source===source){console.log('Already reconciled; no mutation');process.exit(0);}
const targets=state.growth.experiments.filter(e=>[11,15,18,19].includes(e.prNumber)),found=new Map();
const collect=s=>{for(const r of [s.growth?.releaseCandidate,s.growth?.deferredReleaseCandidate,...(s.growth?.releaseQueue??[])])if(verifiedReceipt(r)&&targets.some(e=>e.prNumber===r.prNumber&&e.id===r.experimentId&&e.candidateSha===r.sha)&&!found.has(r.prNumber))found.set(r.prNumber,structuredClone(r));};
collect(state);
if(found.size<targets.length){const commits=await api('/commits?sha=codex%2Fagent-state&path=agent%2Fautonomy%2Fstate.json&per_page=80');for(const c of commits){if(found.size===targets.length)break;collect(await readJSON(api,'agent/autonomy/state.json',c.sha));}}
if(found.size!==4||targets.length!==4)throw Error('Four authentic original receipts required');
ensureReleaseQueue(state);
const statuses=[];
for(const e of targets){
 const pr=await api(`/pulls/${e.prNumber}`),r=found.get(e.prNumber),comparison=await api(`/compare/${r.sha}...${main}`);
 if(!pr.merged||pr.head.sha!==r.sha||!['ahead','identical'].includes(comparison.status))throw Error('Original PR is not included in reviewed main');
 const runtime=[11,15].includes(e.prNumber),status=runtime?'awaiting_activation':'merged_documentation';
 Object.assign(e,{status:runtime?'merged':'merged_documentation',requiresDeployment:runtime,validatedInBatch:{source,appSource:proof.appSource,fullRunId:'40539308357',controllerRunId:'40549513756'}});
 if(runtime)e.mergeSha=main;else e.publicationMergeSha=main;
 Object.assign(r,{status,mergeSha:main,validatedInBatch:e.validatedInBatch});
 const index=state.growth.releaseQueue.findIndex(row=>row.prNumber===r.prNumber);if(index<0)state.growth.releaseQueue.push(r);else state.growth.releaseQueue[index]=r;
 if(state.growth.releaseCandidate?.prNumber===r.prNumber)state.growth.releaseCandidate=r;
 statuses.push({prNumber:r.prNumber,status,originalHead:r.sha});
}
// Its full, verified contents now live in the permanent queue and Git history.
delete state.growth.deferredReleaseCandidate;
if(state.growth.pendingDeployment&&state.growth.pendingDeployment.mergeSha!==main)throw Error('A newer pending deployment must be preserved');
state.growth.pendingDeployment={sha:source,base:proof.base,mergeSha:main,prNumber:21,experimentId:'reviewed-growth-bootstrap',verified:true,status:'awaiting_activation',includedExperiments:targets.filter(e=>e.requiresDeployment).map(e=>e.id),validation:{appSource:proof.appSource,fullRunId:'40539308357',controllerRunId:'40549513756'},ownerAuthorizationRequired:true};
state.releaseValidationHistory=await reconcileValidationReservations(api,state.releaseValidationHistory);
const sourceByRun={'40537512719':'67309ca867c415c50889a30558d79cd848f9cfcb','40539308357':proof.appSource,'40549513756':source};
for(const row of proof.reviewJobAccounting){
 const run=await api(`/actions/runs/${row.runId}`),{jobs}=await api(`/actions/runs/${row.runId}/jobs`),selected=jobs.filter(j=>j.name==='validate');
 if(run.status!=='completed'||run.run_attempt!==1||selected.length!==1)throw Error('Review accounting not verified');
 const j=selected[0],start=Date.parse(j.started_at),end=Date.parse(j.completed_at),minutes=Math.ceil((end-start)/60000)+2;
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||minutes!==row.minutes)throw Error('Review duration changed');
 if(!state.releaseValidationHistory.some(r=>r.runId===row.runId))state.releaseValidationHistory.push({at:j.started_at,runId:row.runId,sha:sourceByRun[row.runId],minutes,settled:true,accounting:{source:'github-completed-review-job-timestamps',jobId:j.id,startedAt:j.started_at,completedAt:j.completed_at,marginMinutes:2}});
}
const total=state.releaseValidationHistory.reduce((n,r)=>n+r.minutes,0);if(total!==proof.resourceTotal||total>180)throw Error('Reconciled validation allowance differs from verified accounting');
state.growth.reviewedBatch={source,main,reconciledAt:new Date().toISOString(),prs:statuses,fullRunId:'40539308357',controllerRunId:'40549513756'};
if(invariant(state)!==untouched||experiments(state)!==criteria||state.growth.productionBootstrapApproval||state.growth.lastDeployedCommit||state.growth.pendingDeployment.ownerApprovedBootstrap)throw Error('Memory, auth, criteria or initial deployment authorization changed');
await store.save('Reconcile already-merged PR facts and completed validation duration; preserve memory/auth/criteria and require first production authorization');
const output={main,source,generationBefore:beforeGeneration,generationAfter:state.generation,preservedStateHash:untouched,preservedExperimentCriteriaHash:criteria,prs:statuses,validationMinutes:total,validationLimit:180,pendingDeployment:{mergeSha:main,status:'awaiting_activation',ownerAuthorizationRequired:true},productionEnabled:false,productionAuthorized:false};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'reviewed-release-reconciled.json',mode:'100644',type:'blob',content:JSON.stringify(output,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record factual release reconciliation with unchanged auth, memory and production lock',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/reviewed-release-reconciled/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});
await api('/issues/3/comments','POST',{body:'Les PR #11, #15, #18 et #19 sont fusionnées via le lot #21 validé (359 tests unitaires, 424 cas Playwright, 76 contrôles du superviseur). Les reçus originaux, critères et baselines sont conservés dans la file ; mémoire et authentification inchangées. Le temps de validation terminé est rapproché de GitHub : 118 minutes avec marge sur 180. Première publication préparée, toujours non autorisée et désactivée ; aucun accès VPS ni secret créé. PR #5 conservée pour revue sensible.'});
console.log(JSON.stringify(output));
