import {github} from './autonomy-pilot/github.mjs';
import {assertFunding} from './autonomy-agent/policy.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const main=(await api('/git/ref/heads/main')).object.sha;
if(main!=='94d4d40b2476b4755f0df233edf7ae4c4d4e53d3')throw Error('Unexpected activation configuration on main');
const file=await api('/contents/agent/autonomy/control.json?ref=main');
const control=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));assertFunding(control);
if(control.permanentActivationApproved!==true||control.activationAuthorization?.productionDeploymentAllowed!==false||control.activationAuthorization?.futureAutomaticMergesAllowed!==false)throw Error('Owner authorization or safety restrictions are missing');
const pr=await api('/pulls/4');if(!pr.merged)throw Error('Infrastructure PR 4 is not merged');
const proof={main,prMerged:pr.merged,mergeCommit:pr.merge_commit_sha,authorizationRecorded:true,scheduleUtc:control.activationAuthorization.scheduleUtc,permanentSwitch:process.env.AGENT_FLAG==='true',observedFlag:['true','false',''].includes(process.env.AGENT_FLAG??'')?(process.env.AGENT_FLAG??''):'unexpected',configuredAt:new Date().toISOString(),productionDeployment:false,automaticDevelopmentMerges:false};
if(!proof.permanentSwitch) {
 try {
  try {await api('/actions/variables/PUZZORIA_AGENT_ENABLED','PATCH',{name:'PUZZORIA_AGENT_ENABLED',value:'true'});}
  catch(error){if(error.status!==404)throw error;await api('/actions/variables','POST',{name:'PUZZORIA_AGENT_ENABLED',value:'true'});}
  const variable=await api('/actions/variables/PUZZORIA_AGENT_ENABLED');
  proof.permanentSwitch=variable.value==='true';proof.variableWriteConfirmed=proof.permanentSwitch;
 } catch(error){proof.variableError={httpStatus:error.status??null,message:error.message};}
}
if(proof.permanentSwitch) {
 const list=async()=>{const {workflow_runs:runs}=await api('/actions/workflows/autonomy-agent.yml/runs?per_page=30');return runs.filter(run=>run.head_sha===main&&['workflow_dispatch','issue_comment','schedule'].includes(run.event));};
 let runs=await list();
 if(!runs.length){await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main'});proof.dispatched=true;await new Promise(resolve=>setTimeout(resolve,1500));runs=await list();}
 proof.runs=runs.map(run=>({id:run.id,url:run.html_url,event:run.event,status:run.status,conclusion:run.conclusion}));
}
const text=proof.permanentSwitch
 ?'Les deux verrous d’activation sont confirmés. Les réveils toutes les six heures sont activés sur main ; le premier réveil a été demandé ou repéré. Son résultat réel reste à contrôler.'
 :'PR #4 fusionnée et autorisation permanente enregistrée sur main. Le jeton technique ne peut pas modifier la variable de dépôt PUZZORIA_AGENT_ENABLED (voir le statut HTTP dans la preuve). Le verrou est conservé : les réveils ne sont pas encore activés. Le propriétaire doit créer cette variable non secrète avec la valeur true dans Settings → Secrets and variables → Actions → Variables.';
const comment=await api('/issues/3/comments','POST',{body:`${text}\n\nAucun déploiement en production, accès au VPS, achat ou fusion de PR de développement. La déclaration d’absence de moyen de paiement reste en vigueur ; le budget Actions à 0 $ reste non vérifié.\n\nÉcrivez vos consignes ici une fois l’interrupteur configuré. Seuls les commentaires du propriétaire déclenchent la réception ; un rapport du bot ne la prouve pas.\n\nConfiguration : ${main}.`});proof.reportUrl=comment.html_url;
const issue=await api('/issues/3');
const end='<!-- /activation-gate-status -->';const old=issue.body??'';const rest=old.includes(end)?old.slice(old.indexOf(end)+end.length).trimStart():old;
await api('/issues/3','PATCH',{body:`<!-- activation-gate-status -->\n## Mise en service\n\n${text}\n\n[Compte rendu](${comment.html_url})\n<!-- /activation-gate-status -->\n\n${rest}`});
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'activation-result.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record permanent activation switch and first wake request',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/activation-result/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
