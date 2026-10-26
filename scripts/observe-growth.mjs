import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const {workflow_runs:runs}=await api('/actions/runs?branch=codex%2Fgrowth-autonomy&per_page=10');
const selected=runs.filter(r=>r.head_sha==='78f028830caae969499bb03c716958660aee7fad');
const reports=[];


for(const run of selected.slice(0,2)){
 const {jobs}=await api(`/actions/runs/${run.id}/jobs?per_page=100`);
 const details=[];
 for(const job of jobs){
  const notes=await api(`/check-runs/${job.check_run_url.split('/').at(-1)}/annotations`).catch(()=>[]);
  let log=null;
  if(job.conclusion==='failure'||job.conclusion==='timed_out'||(run.path==='.github/workflows/growth-check.yml'&&job.status==='in_progress')){
   const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/jobs/${job.id}/logs`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
   if(response.ok)log=(await response.text()).split('\n').slice(-180).join('\n');else log=`HTTP ${response.status}`;
  }
  details.push({id:job.id,name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps,annotations:notes,log});
 }
 reports.push({id:run.id,url:run.html_url,status:run.status,conclusion:run.conclusion,head:run.head_sha,createdAt:run.created_at,jobs:details});
}
const branch=await api('/branches/main');
const proof={observedAt:new Date().toISOString(),main:{sha:branch.commit.sha,protected:branch.protected},reports,otherRuns:runs.filter(r=>r.path!=='.github/workflows/growth-check.yml').map(r=>({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,head:r.head_sha}))};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'growth-progress.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Observe growth CI results and sanitized disposable test diagnostics',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/growth-progress/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
