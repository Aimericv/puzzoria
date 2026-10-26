import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{execFileSync}from'node:child_process';
import{github}from'./autonomy-pilot/github.mjs';
import{readComments}from'./autonomy-agent/inbox.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),runId='40418453890';
const run=await api(`/actions/runs/${runId}`),{jobs}=await api(`/actions/runs/${runId}/jobs?per_page=100`),pr=await api('/pulls/11');
const data=await api('/contents/agent/autonomy/state.json?ref=codex%2Fagent-state'),state=JSON.parse(Buffer.from(data.content,'base64'));
const artifactList=await api(`/actions/runs/${runId}/artifacts?per_page=100`);
const artifact=artifactList.artifacts.find(a=>a.name===`release-proof-${runId}`&&!a.expired);
let validation=null;
if(artifact){
 const dir=mkdtempSync(join(tmpdir(),'puzzoria-proof-'));
 try{
  const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/artifacts/${artifact.id}/zip`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Proof unavailable');
  const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>1048576)throw Error('Unexpected proof size');
  const file=join(dir,'proof.zip');writeFileSync(file,bytes);
  const raw=execFileSync('unzip',['-p',file,'proof.json'],{encoding:'utf8',maxBuffer:1048576});
  const p=JSON.parse(raw);
  validation={head:p.head,base:p.base,tree:p.tree,status:p.status,network:p.network,credentials:p.credentials,checks:p.checks,unit:p.unit,e2e:p.e2e,sourceDigest:p.sourceDigest};
 }catch{validation={status:'proof-not-readable-yet'};}finally{rmSync(dir,{recursive:true,force:true});}
}
const receipt=state.growth?.releaseCandidate;
const issue=await api('/issues/3');
const comments=await readComments(api,3);
const lastOwner=comments.filter(c=>c.user.id===state.ownerId&&c.user.type==='User').at(-1);
const communication={issue:issue.html_url,lastOwnerMessageId:lastOwner?.id??null,recordedLastMessageId:state.lastMessageId,received:!!lastOwner&&state.lastMessageId>=lastOwner.id,pending:!!lastOwner&&(state.pendingMessages??[]).some(m=>m.id===lastOwner.id),acknowledgementFound:!!lastOwner&&comments.some(c=>c.user.type==='Bot'&&c.body.includes('Consignes reçues')&&c.body.includes(`#${lastOwner.id}`))};
const native=await api('/actions/runs/40414606922');
const nativeResult={id:native.id,event:native.event,status:native.status,conclusion:native.conclusion,url:native.html_url,completedSessions:state.completedSessions,lastSessionRunId:state.lastSession?.runId,lastSessionStatus:state.lastSession?.status,tests:state.lastSession?.tests};
const latest=(await api('/actions/workflows/autonomy-agent.yml/runs?per_page=1')).workflow_runs[0];
const budgetJobs=(await api(`/actions/runs/${latest.id}/jobs?per_page=100`)).jobs;
const budgetAdmission={runId:latest.id,status:latest.status,conclusion:latest.conclusion,reservedMinutes:(state.releaseValidationHistory??[]).reduce((n,r)=>n+r.minutes,0),candidateStatus:receipt?.status,validationJob:budgetJobs.find(j=>j.name==='release-validation')?.conclusion??null,jobs:budgetJobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion}))};
const targetedRuns=(await api('/actions/runs?branch=codex%2Fci-inspection&per_page=15')).workflow_runs.filter(r=>r.name==='Targeted isolated game modes readiness verification');
const readiness=targetedRuns.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url,jobs:[]}));
for(const r of readiness){r.jobs=(await api(`/actions/runs/${r.id}/jobs?per_page=100`)).jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}));}
const bridge=(await api('/actions/runs?branch=codex%2Fci-inspection&per_page=10')).workflow_runs.filter(r=>r.name==='Validate complete SEO rendering on current and proposed content');
const proof={readiness,budgetAdmission,communication,nativeResult,targeted:bridge.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,url:r.html_url})),observedAt:new Date().toISOString(),run:{id:run.id,status:run.status,conclusion:run.conclusion,source:run.head_sha,url:run.html_url},jobs:jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))})),pr:{number:11,state:pr.state,merged:pr.merged,draft:pr.draft,head:pr.head.sha,base:pr.base.sha,mergeSha:pr.merge_commit_sha,url:pr.html_url},state:{generation:state.generation,status:state.status,completedSessions:state.completedSessions,releaseCandidate:receipt,deferredReleaseCandidate:state.growth?.deferredReleaseCandidate,validationBudget:state.releaseValidationHistory,experiments:state.growth?.experiments.map(e=>({id:e.id,status:e.status,mergeSha:e.mergeSha,deployment:e.deployment}))},validation};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'release-observation.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Observe exact PR validation and sanitized proof; no raw logs or production access',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/release-observation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});
console.log(JSON.stringify(proof));
