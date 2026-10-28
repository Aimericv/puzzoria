import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),target='40589012232',source='f1cc44089db87644299ea88a09fae7d9d25be18c';
const run=await api('/actions/runs/'+target),{jobs}=await api('/actions/runs/'+target+'/jobs?per_page=100'),job=jobs.find(j=>j.name==='production'&&j.status==='completed'&&j.conclusion==='failure');
if(run.status!=='completed'||run.conclusion!=='failure'||run.run_attempt!==2||run.head_sha!==source||!job||process.env.FREE_FLAG!=='true'||process.env.PRODUCTION_FLAG!=='true'||process.env.AGENT_FLAG!=='true')throw Error('Only the exact failed approved first rollout may be inspected');
const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/jobs/${job.id}/logs`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
if(!response.ok)throw Error('Completed production log unavailable');
const text=await response.text(),step=job.steps.find(s=>s.name==='Deploy through the restricted host command after policy and initial owner approval'),start=Date.parse(step.started_at),end=Date.parse(step.completed_at);
const lines=text.split('\n').flatMap(line=>{const m=line.match(/^(\d{4}-\d\d-\d\dT\S+) (.*)$/);return m&&Date.parse(m[1])>=start&&Date.parse(m[1])<=end?[m[2].trim()]:[];});
const network=lines.some(line=>/^(fetch failed|The operation was aborted due to timeout|This operation was aborted|The operation was aborted)$/.test(line));
const knownMessages=['fetch failed','The operation was aborted due to timeout','This operation was aborted','The operation was aborted','Invalid GitHub path','Deployment did not return a valid private host receipt','Deployment receipt does not identify a verified rollout','SSH did not confirm successful rollout completion'];
const report={target,source,completedProductionJob:job.id,knownErrorCategories:knownMessages.filter(value=>lines.includes(value)).map(value=>value.replaceAll(' ','_')),transientNetworkFailure:network,rerunRequested:false,productionAccessedByOperator:false};
if(network){
 const control=JSON.parse(readFileSync('agent/autonomy/control.json')),{StateStore}=await import(pathToFileURL(resolve('scripts/autonomy-agent/store.mjs'))),{deploymentOwnerControl}=await import(pathToFileURL(resolve('scripts/autonomy-agent/deployment-owner-control.mjs')));
 const store=new StateStore(api,control,source),state=await store.load(),pending=state.growth.pendingDeployment;
 if(state.growth.lastDeployedCommit||pending?.mergeSha!==source||pending.status!=='deployed'||pending.ownerApprovedBootstrap!==true||pending.deploymentFailures!==1||Date.parse(pending.nextDeploymentAttemptAt)>Date.now()||state.growth.productionBootstrapApproval?.sha!==source||state.growth.productionBootstrapApproval.policyHash!==control.release.productionAuthorization.policyHash||!await deploymentOwnerControl(api,state))throw Error('Preserve any newer receipt, owner instruction or bounded retry deadline');
 const digest=s=>{const c=structuredClone(s);delete c.generation;delete c.growth.pendingDeployment.status;return createHash('sha256').update(JSON.stringify(c)).digest('hex');},before=digest(state);
 pending.status='awaiting_activation';if(digest(state)!==before)throw Error('Only unconfirmed pending status may change');
 await store.save('Restore an unconfirmed first rollout to its existing bounded idempotent retry; never invent a deployed commit');
 await api('/actions/runs/'+target+'/rerun-failed-jobs','POST',{});
 report.rerunRequested=true;report.stateGeneration=state.generation;report.failureCountPreserved=true;report.retryDelayRespected=true;
}
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'bootstrap-retry-inspection.json',mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record only known completed error classes and a bounded unchanged-source retry if transient',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/bootstrap-retry-inspection/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(report));
