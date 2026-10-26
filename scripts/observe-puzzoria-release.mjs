import{readFileSync,writeFileSync,mkdtempSync,rmSync}from'node:fs';
import{tmpdir}from'node:os';
import{join}from'node:path';
import{execFileSync}from'node:child_process';
import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),runId='40413975908';
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
const proof={observedAt:new Date().toISOString(),run:{id:run.id,status:run.status,conclusion:run.conclusion,source:run.head_sha,url:run.html_url},jobs:jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))})),pr:{number:11,state:pr.state,merged:pr.merged,draft:pr.draft,head:pr.head.sha,base:pr.base.sha,mergeSha:pr.merge_commit_sha,url:pr.html_url},state:{generation:state.generation,status:state.status,completedSessions:state.completedSessions,releaseCandidate:receipt,validationBudget:state.releaseValidationHistory,experiments:state.growth?.experiments.map(e=>({id:e.id,status:e.status,mergeSha:e.mergeSha,deployment:e.deployment}))},validation};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'release-observation.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Observe exact PR validation and sanitized proof; no raw logs or production access',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/release-observation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});
console.log(JSON.stringify(proof));
