import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {github} from '../autonomy-pilot/github.mjs';
import {StateStore} from './store.mjs';
import {assertFunding,pendingReleaseReady,REPOSITORY} from './policy.mjs';
import {mergeSafeCandidate} from './release-controller.mjs';
import {validateRelease} from './release-validation.mjs';
import {loadReleaseFiles,selectReleaseCandidate} from './release-selection.mjs';
import {reconcileValidationReservations,validationReservation} from './release-budget.mjs';
import {extendUsage} from './actions-budget-runtime.mjs';
import {ensureReleaseQueue,deploymentBlocksNewRuntime} from './release-queue.mjs';

const mode=process.argv[2],control=JSON.parse(readFileSync('agent/autonomy/control.json','utf8'));assertFunding(control);
if(process.env.GITHUB_REPOSITORY!==REPOSITORY)throw Error('Unexpected repository');
const api=github(process.env.GITHUB_TOKEN,REPOSITORY),store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
const output=(key,value)=>{if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`,{flag:'a'});};
const report=body=>api('/issues/3/comments','POST',{body});
if(mode==='prepare') {
  output('eligible','false');
  if(control.release?.safeMergeEnabled!==true||process.env.PUZZORIA_AGENT_ENABLED!=='true'||state.paused||!['ready','waiting_quota'].includes(state.status)||state.pendingMessages?.length)process.exit(0);
  const main=(await api('/git/ref/heads/main')).object.sha;
  state.releaseValidationHistory=await reconcileValidationReservations(api,state.releaseValidationHistory);
  const receipt=await selectReleaseCandidate(api,state,main);
  if(!receipt){await store.save('Preserve queued proposals and require review of sensitive or changed publications');process.exit(0);}
  if(receipt.risk.requiresDeployment&&deploymentBlocksNewRuntime(state)){receipt.status='waiting_deployment_confirmation';await store.save('Preserve the initially approved or unconfirmed host rollout before merging newer runtime work');process.exit(0);}
  const reservation=validationReservation(receipt.risk.kind,control.release.maximumValidationMinutes);
  if(!await extendUsage(api,{'release-validation':receipt.risk.kind==='documentation'?5:control.release.maximumValidationMinutes,'release-finalize':4})){
    const changed=receipt.status!=='waiting_validation_budget';receipt.status='waiting_validation_budget';
    await store.save('Preserve the candidate until the global monthly Actions envelope admits its complete validation');
    if(changed)await report(`[PR #${receipt.prNumber}](https://github.com/${REPOSITORY}/pull/${receipt.prNumber}) : validation conservée en attente du budget mensuel Actions. Aucune fusion sans tous les contrôles, aucun repli payant.`);
    process.exit(0);
  }
  state.releaseValidationHistory.push({at:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT??1),sha:receipt.sha,minutes:reservation});
  receipt.status='validating';await store.save('Reserve bounded validation time; finished jobs retain their observed duration and safety margin');
  mkdirSync('.release',{recursive:true});writeFileSync('.release/request.json',JSON.stringify(receipt,null,2)+'\n');
  output('eligible','true');output('head',receipt.sha);output('base',receipt.base);output('kind',receipt.risk.kind);
} else if(mode==='validate') {
  const receipt=JSON.parse(readFileSync('.release/request.json','utf8')),commit=await api(`/git/commits/${receipt.sha}`);
  if(receipt.risk.kind==='documentation'){mkdirSync('.release',{recursive:true});writeFileSync('.release/proof.json',JSON.stringify({head:receipt.sha,base:receipt.base,tree:commit.tree.sha,status:'passed',documentationOnly:true})+'\n');}
  else validateRelease({head:receipt.sha,base:receipt.base,tree:commit.tree.sha});
} else if(mode==='finalize') {
  const receipt=JSON.parse(readFileSync('.release/request.json','utf8'));ensureReleaseQueue(state);
  const record=state.growth.releaseQueue.find(row=>row.prNumber===receipt.prNumber);
  output('deploy','false');if(!record||record.sha!==receipt.sha)throw Error('The queued release receipt changed');
  state.releaseValidationHistory=await reconcileValidationReservations(api,state.releaseValidationHistory);
  const validation=existsSync('.release/proof.json')?JSON.parse(readFileSync('.release/proof.json','utf8')):null;
  if(validation?.status!=='passed'){
    record.status='validation_failed';state.growth.releaseCandidate=record;
    await store.save('Preserve failed validation and its completed-job accounting without merging');
    await report(`[PR #${record.prNumber}](https://github.com/${REPOSITORY}/pull/${record.prNumber}) : validation complète en échec. Aucune fusion ni production. [Exécution](https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}).`);
    process.exit(0);
  }
  const experiment=state.growth.experiments.find(row=>row.id===receipt.experimentId&&row.prNumber===receipt.prNumber&&row.candidateSha===receipt.sha);
  if(!experiment)throw Error('The experiment changed before finalization');
  const result=await mergeSafeCandidate({api,receipt,validation,files:await loadReleaseFiles(api,receipt),policy:control.release,agentEnabled:process.env.PUZZORIA_AGENT_ENABLED});
  record.status=result.status;record.result=result;state.growth.releaseCandidate=record;
  experiment.status=result.status;
  if(result.status==='merged'){
    experiment.mergeSha=result.sha;record.mergeSha=result.sha;record.status=result.risk.requiresDeployment?'awaiting_activation':'merged_documentation';
    if(result.risk.requiresDeployment)state.growth.pendingDeployment=structuredClone(record);
    output('deploy',String(result.risk.requiresDeployment));output('sha',result.sha);output('candidate',receipt.sha);
  }
  await store.save('Record tested merge without replacing pending deployment with a newer development proposal');
  await report(`[Expérience ${experiment.id}](${experiment.prUrl}) : ${record.status}. ${result.status==='merged'?'Fusion après vérification indépendante de la révision exacte.':'Aucune fusion automatique effectuée.'} Aucun effet de production attribué sans reçu de déploiement.`);
  // At most one continuation after a successful merge; failures and budget waits stop the chain.
  if(result.status==='merged'&&pendingReleaseReady(state,result.sha))await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'validate-pending':true,'deploy-pending':false,'check-search-console':false}});
} else throw Error('Use prepare, validate or finalize');
