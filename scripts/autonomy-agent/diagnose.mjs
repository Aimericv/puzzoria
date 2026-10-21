import {github} from "../autonomy-pilot/github.mjs";
import {REPOSITORY,redact} from "./policy.mjs";

const api=github(process.env.GITHUB_TOKEN,REPOSITORY),runId=process.env.GITHUB_RUN_ID;
const {workflow_runs:runs}=await api("/actions/runs?branch=codex%2Fautonomy-agent&per_page=12");
const result=[];
for(const run of runs.filter(run=>run.path===".github/workflows/autonomy-agent.yml")) {
  const {jobs}=await api(`/actions/runs/${run.id}/jobs?per_page=100`);
  result.push({id:run.id,status:run.status,conclusion:run.conclusion,url:run.html_url,sha:run.head_sha,startedAt:run.run_started_at,jobs:jobs.map(job=>({id:job.id,name:job.name,status:job.status,conclusion:job.conclusion,startedAt:job.started_at,completedAt:job.completed_at,steps:job.steps?.map(step=>({name:step.name,status:step.status,conclusion:step.conclusion}))}))});
}
const {check_runs:checks}=await api(`/commits/${process.env.AGENT_SOURCE_SHA}/check-runs?per_page=100`);
const annotations=[];
for(const check of checks) {
  const values=await api(`/check-runs/${check.id}/annotations?per_page=100`);
  for(const value of values) annotations.push({name:check.name,path:value.path,line:value.start_line,message:redact(value.message,[process.env.GITHUB_TOKEN])});
}
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api("/git/trees","POST",{base_tree:commit.tree.sha,tree:[{path:"agent/autonomy/diagnostic.json",mode:"100644",type:"blob",content:JSON.stringify({runs:result,annotations},null,2)+"\n"}]});
const next=await api("/git/commits","POST",{message:"Record bounded autonomous workflow startup diagnostics",tree:tree.sha,parents:[parent]});
await api("/git/refs","POST",{ref:`refs/heads/codex/agent-diagnostics/${runId}`,sha:next.sha});
console.log(JSON.stringify({branch:`codex/agent-diagnostics/${runId}`}));
