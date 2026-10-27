import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),target='40584978293';
const r=await api('/actions/runs/'+target),{jobs}=await api('/actions/runs/'+target+'/jobs?per_page=100');
if(r.head_branch!=='main'||r.path!=='.github/workflows/autonomy-agent.yml'||r.head_sha!=='69e4198f063fb499c45efdd4f0fdedc6a31b78a7')throw Error('Observe only the exact owner-dispatched first rollout');
const f=await api('/contents/agent/autonomy/state.json?ref=codex/agent-state'),state=JSON.parse(Buffer.from(f.content,'base64'));
const issue=await api('/issues/3'),lastPage=Math.max(1,Math.ceil(issue.comments/100));
const comments=(await Promise.all([...new Set([Math.max(1,lastPage-1),lastPage])].map(page=>api('/issues/3/comments?per_page=100&page='+page)))).flat().sort((a,b)=>a.id-b.id).slice(-100);
const owner=(await api('')).owner.id;
const out={observedAt:new Date().toISOString(),run:{id:r.id,url:r.html_url,event:r.event,status:r.status,conclusion:r.conclusion,source:r.head_sha,createdAt:r.created_at,updatedAt:r.updated_at,jobs:jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,startedAt:j.started_at,completedAt:j.completed_at,steps:j.steps?.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}))},activation:{agent:process.env.AGENT_FLAG==='true',production:process.env.PRODUCTION_FLAG==='true',noPaymentMethodDeclaration:process.env.FREE_FLAG==='true'},state:{generation:state.generation,status:state.status,nextEligibleAt:state.nextEligibleAt,lastMessageId:state.lastMessageId,issueNumber:state.issueNumber,completedSessions:state.completedSessions,lastDeployedCommit:state.growth?.lastDeployedCommit??null,pendingDeployment:state.growth?.pendingDeployment?Object.fromEntries(['sha','mergeSha','prNumber','status','deploymentAttempts','nextDeploymentAttemptAt','lastDeploymentAttemptAt'].map(k=>[k,state.growth.pendingDeployment[k]??null])):null,experimentCount:state.growth?.experiments?.length??0,validationReservedMinutes:state.releaseValidationHistory?.reduce((n,row)=>n+row.minutes,0)},communication:{url:'https://github.com/Aimericv/puzzoria/issues/3',recentOwnerMessages:comments.filter(c=>c.user.id===owner&&c.user.type==='User').map(c=>({id:c.id,createdAt:c.created_at,url:c.html_url,processed:c.id<=state.lastMessageId})),recentReports:comments.filter(c=>c.user.type==='Bot').slice(-8).map(c=>({id:c.id,createdAt:c.created_at,url:c.html_url,rolloutHealthy:c.body.includes(' : deployed. Sauvegarde vérifiée'),rolloutRolledBack:c.body.includes(' : rolled_back. Sauvegarde vérifiée'),rolloutUnconfirmed:c.body.includes('aucun reçu de déploiement confirmé')}))},productionAccessedByObserver:false,protectedStateChanged:false};
const gateJob=jobs.find(j=>j.name==='production-gate'&&j.status==='completed'&&j.conclusion==='success');
if(r.status==='completed'&&gateJob){
 const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/jobs/${gateJob.id}/logs`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Completed gate result unavailable');
 const data=await response.text(),match=data.match(/\{"productionAllowed":(true|false),"policyHash":"([a-f0-9]{64})"\}/);
 if(!match)throw Error('Structured gate result absent');
 out.gate={productionAllowed:match[1]==='true',policyHash:match[2]};
}
if(r.status==='completed'&&r.conclusion!=='success'){
 out.completedJobErrorCategories=[];
 const patterns=[['ssh_timeout',/Connection timed out/i],['ssh_refused',/Connection refused/i],['ssh_authentication',/Permission denied \(publickey/],['invalid_host_receipt',/Deployment did not return a valid private host receipt/],['invalid_rollout_receipt',/Deployment receipt does not identify a verified rollout/],['ssh_unconfirmed_completion',/SSH did not confirm successful rollout completion/],['unapproved_policy',/Production activation is not approved/],['owner_control',/owner-control|new-owner-directive/],['quota',/quota|spending limit/i]];
 for(const job of jobs.filter(j=>j.status==='completed'&&j.conclusion==='failure')){
  const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/jobs/${job.id}/logs`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Completed log categorization unavailable');
  const data=await response.text();
  out.completedJobErrorCategories.push({job:job.name,categories:patterns.filter(([,p])=>p.test(data)).map(([name])=>name)});
 }
}
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'first-production-observation.json',mode:'100644',type:'blob',content:JSON.stringify(out,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Observe exact owner first rollout, activation and issue delivery; no secrets or production access',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/first-production-observation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(out));
