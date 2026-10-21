import {github} from "./autonomy-pilot/github.mjs";
import {redact} from "./autonomy-agent/policy.mjs";
const api=github(process.env.GITHUB_TOKEN,"Aimericv/puzzoria");
const {workflow_runs:runs}=await api("/actions/runs?branch=codex%2Fautonomy-agent&per_page=20");
const evidence=[];
for(const run of runs.filter(run=>run.path===".github/workflows/ci.yml").slice(0,4)) {
 const {jobs}=await api(`/actions/runs/${run.id}/jobs?per_page=100`);
 const annotations=[];
 const {check_runs:checks}=await api(`/commits/${run.head_sha}/check-runs?per_page=100`);
 for(const check of checks) for(const row of await api(`/check-runs/${check.id}/annotations?per_page=100`)) annotations.push({name:check.name,path:row.path,line:row.start_line,message:redact(row.message,[process.env.GITHUB_TOKEN])});
 evidence.push({id:run.id,url:run.html_url,status:run.status,conclusion:run.conclusion,sha:run.head_sha,jobs:jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps?.map(step=>({name:step.name,status:step.status,conclusion:step.conclusion}))})),annotations});
}
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api("/git/trees","POST",{base_tree:commit.tree.sha,tree:[{path:"ci-inspection.json",mode:"100644",type:"blob",content:JSON.stringify(evidence,null,2)+"\n"}]});
const next=await api("/git/commits","POST",{message:"Record read-only complete CI status",tree:tree.sha,parents:[parent]});
await api("/git/refs","POST",{ref:`refs/heads/codex/ci-inspection-evidence/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(evidence));
