import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const repository=await api(''),pr=await api('/pulls/4');
const main=(await api('/git/ref/heads/main')).object.sha;
const {workflow_runs:runs}=await api('/actions/workflows/autonomy-agent.yml/runs?per_page=30');
const current=runs.filter(run=>['schedule','issue_comment','workflow_dispatch'].includes(run.event)&&run.head_branch==='main');
const jobs=[];for(const run of current.slice(0,3)){const result=await api(`/actions/runs/${run.id}/jobs?per_page=100`);jobs.push({runId:run.id,jobs:result.jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps?.map(step=>({name:step.name,status:step.status,conclusion:step.conclusion}))}))});}
const content=await api('/contents/agent/autonomy/state.json?ref=codex%2Fagent-state');
const state=JSON.parse(Buffer.from(content.content,'base64').toString('utf8'));
const ownerMessages=[];for(let page=1;page<=5;page++){const rows=await api(`/issues/3/comments?per_page=100&page=${page}`);ownerMessages.push(...rows.filter(row=>row.user?.id===repository.owner.id&&row.user?.type==='User').map(row=>({id:row.id,url:row.html_url,createdAt:row.created_at})));if(rows.length<100)break;}
const proof={observedAt:new Date().toISOString(),main,pr:{merged:pr.merged,url:pr.html_url},permanentSwitch:process.env.AGENT_FLAG==='true',runs:current.map(run=>({id:run.id,url:run.html_url,event:run.event,status:run.status,conclusion:run.conclusion,sha:run.head_sha,createdAt:run.created_at})),jobs,ownerMessages,state:{generation:state.generation,status:state.status,completedSessions:state.completedSessions,codeSha:state.codeSha,permanentActivationEnabled:state.permanentActivationEnabled,lastRun:state.lastRun,lastMessageId:state.lastMessageId,pendingMessageIds:state.pendingMessages?.map(row=>row.id),nextEligibleAt:state.nextEligibleAt,lastSession:state.lastSession?{runId:state.lastSession.runId,mode:state.lastSession.mode,status:state.lastSession.status,error:state.lastSession.error,sourceCommit:state.lastSession.sourceCommit,tests:state.lastSession.tests,publication:state.lastSession.publication,quotaBefore:state.lastSession.quotaBefore,quotaAfter:state.lastSession.quotaAfter}:null}};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'activation-observation.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Observe actual permanent switch, owner inbox and autonomous wake results',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/activation-observation/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
