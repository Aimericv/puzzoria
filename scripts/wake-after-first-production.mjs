import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),source='f1cc44089db87644299ea88a09fae7d9d25be18c';
if(process.env.FREE_FLAG!=='true'||process.env.AGENT_FLAG!=='true'||process.env.PRODUCTION_FLAG!=='true')throw Error('Preserve free-only enabled autonomy');
const f=await api('/contents/agent/autonomy/state.json?ref=codex/agent-state'),state=JSON.parse(Buffer.from(f.content,'base64'));
if(state.growth?.lastDeployedCommit!==source||state.growth.pendingDeployment?.status!=='deployed'||state.status!=='ready'||state.nextEligibleAt&&Date.parse(state.nextEligibleAt)>Date.now())throw Error('Only wake after an observed healthy bootstrap and existing admission time');
const r=await api('/actions/runs/40589012232');if(r.status!=='completed'||r.conclusion!=='success'||r.run_attempt!==3||r.head_sha!==source)throw Error('Completed exact production confirmation required');
const before=await api('/actions/workflows/autonomy-agent.yml/runs?branch=main&per_page=30');
const latestId=Math.max(...before.workflow_runs.map(r=>r.id));
if(before.workflow_runs.some(r=>r.status!=='completed'))throw Error('An existing autonomy run should finish before another wake');
const dispatchedAt=new Date().toISOString();
await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'deploy-pending':false,'validate-pending':false,'check-search-console':false}});
let run;
for(let attempt=0;attempt<8;attempt++){
 const rows=await api('/actions/workflows/autonomy-agent.yml/runs?branch=main&event=workflow_dispatch&per_page=20');
 run=rows.workflow_runs.find(row=>row.id>latestId&&row.head_sha===source&&Date.parse(row.created_at)>=Date.parse(dispatchedAt)-1000);
 if(run)break;await new Promise(resolve=>setTimeout(resolve,3000));
}
const report={source,afterConfirmedProduction:'40589012232',dispatchedAt,run:run?{id:run.id,url:run.html_url,status:run.status}:null,ordinaryMissionWake:true,newRoadmapImposed:false,quotaGuardsUnchanged:true,paidFallbackEnabled:false,productionDeploymentRequestedByOperator:false};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'post-production-wake.json',mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record one ordinary autonomous wake after a verified healthy first rollout',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/post-production-wake/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(report));
