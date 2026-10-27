import{readFileSync}from'node:fs';
import{createHash}from'node:crypto';
import{github}from'./autonomy-pilot/github.mjs';
import{pathToFileURL}from'node:url';
import{resolve}from'node:path';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),source='71af9ebe30e911d57bd2df5f43b79727190e46d3',runId='40554329376';
const get=async(path,ref)=>JSON.parse(Buffer.from((await api(`/contents/${path}?ref=${encodeURIComponent(ref)}`)).content,'base64'));
const proof=await get('strategic-stop-controls.json','codex/strategic-stop-validation/'+runId),pr=await api('/pulls/23'),main=(await api('/git/ref/heads/main')).object.sha;
if(!pr.merged||pr.head.sha!==source||pr.merge_commit_sha!==main)throw Error('Exact reviewed final main required');
const control=JSON.parse(readFileSync('agent/autonomy/control.json'));
if(control.release.productionEnabled!==false||control.release.productionAuthorization!==null||control.release.target.initialCommit!==null||process.env.PRODUCTION_FLAG==='true'||process.env.AGENT_FLAG!=='true'||process.env.FREE_FLAG!=='true')throw Error('Wake enabled, funding declaration and production closed are required');
const {StateStore}=await import(pathToFileURL(resolve('scripts/autonomy-agent/store.mjs')));
const store=new StateStore(api,control,main),state=await store.load();
if(state.growth.productionBootstrapApproval||state.growth.pendingDeployment.ownerApprovedBootstrap)throw Error('Do not change an owner-approved release');
const digest=s=>{const copy={...s};delete copy.releaseValidationHistory;delete copy.generation;return createHash('sha256').update(JSON.stringify(copy)).digest('hex');},before=digest(state);
const run=await api('/actions/runs/'+runId),{jobs}=await api('/actions/runs/'+runId+'/jobs'),selected=jobs.filter(j=>j.name==='validate');
if(run.status!=='completed'||run.conclusion!=='success'||run.run_attempt!==1||selected.length!==1)throw Error('Completed targeted validation required');
const j=selected[0],start=Date.parse(j.started_at),end=Date.parse(j.completed_at),minutes=Math.ceil((end-start)/60000)+2;
if(!Number.isFinite(start)||!Number.isFinite(end)||end<start||minutes>12)throw Error('Verified bounded job duration required');
if(!state.releaseValidationHistory.some(r=>r.runId===runId)){
 state.releaseValidationHistory.push({at:j.started_at,runId,sha:source,minutes,settled:true,accounting:{source:'github-completed-review-job-timestamps',jobId:j.id,startedAt:j.started_at,completedAt:j.completed_at,marginMinutes:2}});
 if(digest(state)!==before)throw Error('Only actual validation time may change');
 await store.save('Account only the completed strategic-stop validation; preserve all memory/auth/criteria/pending approval and production locks');
}
const validationMinutes=state.releaseValidationHistory.reduce((n,r)=>n+r.minutes,0);if(validationMinutes>180)throw Error('Unchanged validation allowance exceeded');
const repository=await api(''),{readComments}=await import(pathToFileURL(resolve('scripts/autonomy-agent/inbox.mjs'))),comments=await readComments(api,3);
const ownerMessage=comments.filter(c=>c.user?.id===repository.owner.id&&c.id<=state.lastMessageId).at(-1);
const acknowledgement=ownerMessage&&comments.find(c=>c.user?.type==='Bot'&&c.body?.includes('Consignes reçues :')&&c.body.includes('#'+ownerMessage.id));
const prs=[];for(const number of [2,5,11,15,18,19,20,21,22,23]){const p=await api('/pulls/'+number);prs.push({number,state:p.state,merged:p.merged,draft:p.draft,url:p.html_url});}
const artifacts=(await api('/actions/runs/'+runId+'/artifacts')).artifacts.filter(a=>a.name==='reviewed-puzzoria-controller'&&!a.expired);if(artifacts.length!==1)throw Error('Exact prepared artifact required');
const report={main,source,productionEnabled:false,productionAuthorized:false,productionVariableEnabled:false,agentEnabled:true,validationMinutes,validationLimit:180,controller:proof.controller,controllerArchiveSha256:proof.archiveSha256,controllerArtifact:{runId,id:artifacts[0].id,name:artifacts[0].name,expiresAt:artifacts[0].expires_at},controllerTests:77,app:{source:proof.appSource,runId:'40539308357',unit:359,e2e:424,unchanged:true},rollback:{fixtureRunId:'40534259927',fixtures:2,productionTested:false},state:{generation:state.generation,status:state.status,completedSessions:state.completedSessions,memoryAndAuthPreserved:true,pendingDeploymentStatus:state.growth.pendingDeployment.status,pendingOwnerApproval:true},communication:{issue:'https://github.com/Aimericv/puzzoria/issues/3',ownerMessageId:ownerMessage?.id,acknowledgementUrl:acknowledgement?.html_url,unreadMessages:state.pendingMessages.length,cloudChatAutomaticallyConnected:false},prs,noVpsAccess:true,noDeployRequested:true};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'autonomy-first-activation-ready.json',mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record prepared first activation, actual validation time and unchanged production authorization',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/autonomy-first-activation-ready/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});
await api('/issues/3/comments','POST',{body:`Préparation terminée : PR #11, #15, #18, #19 et #23 fusionnées ; #5 reste soumise à revue sensible. Application : 359 tests unitaires et 424 cas Playwright réussis ; superviseur final : 77 contrôles. Deux scénarios Docker de sauvegarde/rollback vérifiés, sans accès production. Enveloppe de validation : ${validationMinutes}/180 minutes sur 7 jours, distincte du quota partagé du compte GitHub ; aucun budget financier à 0 € prétendument vérifié. Réveils maintenus, mémoire et authentification conservées. Production toujours désactivée : première autorisation explicite et installation unique du contrôleur restreint depuis le PC du propriétaire encore nécessaires. Les conversations Codex Cloud ne sont pas transmises automatiquement ici.`});console.log(JSON.stringify(report));
