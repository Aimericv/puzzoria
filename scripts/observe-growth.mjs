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
  const log=null;
  details.push({id:job.id,name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps,annotations:notes,log});
 }
 reports.push({id:run.id,url:run.html_url,status:run.status,conclusion:run.conclusion,head:run.head_sha,createdAt:run.created_at,jobs:details});
}
const branch=await api('/branches/main');
const nativeWorkflow=await api('/actions/workflows/autonomy-agent.yml');
const nativeRuns=await api('/actions/workflows/autonomy-agent.yml/runs?per_page=5');
const latestNative=nativeRuns.workflow_runs[0];
const nativeJobs=latestNative?(await api(`/actions/runs/${latestNative.id}/jobs?per_page=100`)).jobs:[];
const stateFile=await api('/contents/agent/autonomy/state.json?ref=codex%2Fagent-state');
const state=JSON.parse(Buffer.from(stateFile.content,'base64').toString('utf8'));
const session=state.lastSession;
const plan=JSON.parse(state.memory['PLAN.json']);
const actualState={generation:state.generation,status:state.status,completedSessions:state.completedSessions,nextEligibleAt:state.nextEligibleAt,lastRun:state.lastRun,
 lastSession:session?{runId:session.runId,status:session.status,error:session.error,sourceCommit:session.sourceCommit,threadId:session.threadId,tests:session.tests,publication:session.publication,analysisOnly:session.analysisOnly,experiment:session.experiment,growth:session.growth,analytics:session.analytics,searchConsole:session.searchConsole,quotaBefore:session.quotaBefore,quotaAfter:session.quotaAfter}:null,
 growth:state.growth?{legacyWork:state.growth.legacyWork,releaseCandidate:state.growth.releaseCandidate,experiments:state.growth.experiments.map(e=>({id:e.id,objective:e.objective,metric:e.metric,decision:e.decision,status:e.status,hypothesis:e.hypothesis,expectedImpact:e.expectedImpact}))}:null,
 plan:{summary:plan.summary,nextMission:plan.nextMission,experiment:plan.experiment}};
const proof={actualState,native:{enabled:process.env.AGENT_FLAG==='true',workflowState:nativeWorkflow.state,jobs:nativeJobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion})),runs:nativeRuns.workflow_runs.map(r=>({id:r.id,status:r.status,conclusion:r.conclusion,event:r.event,sha:r.head_sha}))},observedAt:new Date().toISOString(),main:{sha:branch.commit.sha,protected:branch.protected},reports,otherRuns:runs.filter(r=>r.path!=='.github/workflows/growth-check.yml').map(r=>({id:r.id,name:r.name,status:r.status,conclusion:r.conclusion,head:r.head_sha}))};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'growth-progress.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Observe growth CI results and sanitized disposable test diagnostics',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/growth-progress/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
