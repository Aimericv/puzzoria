import {deploymentStateAdmissible,deploymentOwnerControl} from "./deployment-owner-control.mjs";
import {pendingDeployment,recordDeploymentFailure} from "./release-queue.mjs";
import {readFileSync,writeFileSync,mkdtempSync,rmSync,openSync,closeSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {deploymentAllowed} from './release-policy.mjs';
import {github} from '../autonomy-pilot/github.mjs';
import {StateStore} from './store.mjs';
import {assertFunding,REPOSITORY} from './policy.mjs';
export function releasePolicyHash() {
  const files=['scripts/autonomy-agent/release-policy.mjs','scripts/autonomy-agent/release-controller.mjs','scripts/autonomy-agent/release-host.mjs','scripts/autonomy-agent/deployment-transaction.mjs','scripts/autonomy-agent/public-probe.mjs','scripts/autonomy-agent/release-client.mjs','scripts/autonomy-agent/release-check.mjs','scripts/autonomy-agent/release-validation.mjs','.github/containers/release-verifier.Dockerfile','.github/workflows/autonomy-agent.yml','.github/actions/puzzoria-agent/action.yml','deploy/puzzoria-release-entry.sh','deploy/install-release-controller.sh','deploy/setup-release-from-windows.ps1','deploy/puzzoria-release-recover.service','deploy/puzzoria-release-recover.timer','package-lock.json'];
  files.push('scripts/autonomy-pilot/github.mjs','scripts/autonomy-agent/pending-release.mjs','scripts/autonomy-agent/policy.mjs','scripts/autonomy-agent/release-budget.mjs','scripts/autonomy-agent/release-queue.mjs','scripts/autonomy-agent/release-selection.mjs','scripts/autonomy-agent/deployment-owner-control.mjs');
  return createHash('sha256').update(files.map(file=>file+'\n'+readFileSync(file,'utf8')).join('\n')).digest('hex');
}
export function pendingDeploymentAllowed(control,state,now=Date.now()) {
  const pending=pendingDeployment(state);
  const previous=state?.growth?.lastDeployedCommit??control.release.target.initialCommit;
  const approval=state?.growth?.productionBootstrapApproval;
  return deploymentStateAdmissible(state)&&/^[a-f0-9]{40}$/.test(previous??'')&&pending?.status==='awaiting_activation'&&
    !(pending.nextDeploymentAttemptAt&&(!Number.isFinite(Date.parse(pending.nextDeploymentAttemptAt))||Date.parse(pending.nextDeploymentAttemptAt)>now))&&
    /^[a-f0-9]{40}$/.test(pending?.mergeSha??'')&&
    (previous!=='0'.repeat(40)||(pending.ownerApprovedBootstrap===true&&approval?.sha===pending.mergeSha&&
      approval.policyHash===control.release.productionAuthorization?.policyHash&&Number.isFinite(Date.parse(approval.approvedAt))));
}
export async function run(mode=process.argv[2]) {
  if(mode==='policy-hash'){console.log(releasePolicyHash());return;}
  const control=JSON.parse(readFileSync('agent/autonomy/control.json','utf8'));assertFunding(control);
  const allowed=deploymentAllowed(control,process.env.PUZZORIA_AUTODEPLOY_ENABLED,releasePolicyHash());
  if(mode==='gate'){
    let state;
    if(allowed){const api=github(process.env.GITHUB_TOKEN,REPOSITORY);state=await new StateStore(api,control,process.env.GITHUB_SHA).load();}
    const pending=pendingDeployment(state);
    const admitted=allowed&&pendingDeploymentAllowed(control,state)&&await deploymentOwnerControl(github(process.env.GITHUB_TOKEN,REPOSITORY),state);
    if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`allowed=${Boolean(admitted)}\nsha=${admitted?pending.mergeSha:''}\n`,{flag:'a'});console.log(JSON.stringify({productionAllowed:Boolean(admitted),policyHash:releasePolicyHash()}));return;
  }
  if(mode!=='deploy'||!allowed)throw Error('Production activation is not approved for this policy and target');
  if(process.env.GITHUB_REPOSITORY!==REPOSITORY||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Production requires trusted main context');
  const api=github(process.env.GITHUB_TOKEN,REPOSITORY),store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
  const candidate=pendingDeployment(state),sha=process.env.RELEASE_SHA;
  if(!candidate||candidate.mergeSha!==sha||candidate.status!=='awaiting_activation'||!/^[a-f0-9]{40}$/.test(sha??''))throw Error('No exact tested merge is waiting for deployment');
  const expected=state.growth.lastDeployedCommit??control.release.target.initialCommit;
  if(!/^[a-f0-9]{40}$/.test(expected))throw Error('An attested previous production commit is required');
  if(!pendingDeploymentAllowed(control,state))throw Error('The first rollout needs an exact trusted source approval');
  if(!await deploymentOwnerControl(api,state)){console.log(JSON.stringify({productionDeferred:'owner-control',productionChanged:false}));return;}
  const experiment=state.growth.experiments.find(row=>row.id===candidate.experimentId);
  if(!experiment&&candidate.ownerApprovedBootstrap!==true)throw Error('Unknown experiment without an operator-approved bootstrap receipt');
  const directory=mkdtempSync(join(tmpdir(),'puzzoria-ssh-'));let receipt,confirmed=false;
  try {
    if(!process.env.PUZZORIA_DEPLOY_KEY)throw Error('The separate restricted SSH deployment key is not configured');
    const key=join(directory,'key'),known=join(directory,'known_hosts'),bundle=join(directory,'release.bundle');
    writeFileSync(key,process.env.PUZZORIA_DEPLOY_KEY.trim()+'\n',{mode:0o600});
    const publicKeys=process.env.PUZZORIA_DEPLOY_KNOWN_HOSTS||execFileSync('ssh-keyscan',['-T','10','-p',String(control.release.target.sshPort),'-t','ed25519',control.release.target.sshHost],{encoding:'utf8',stdio:['ignore','pipe','ignore'],timeout:15000,maxBuffer:65536});
    let pinned;
    for(const line of publicKeys.split('\n')) {
      if(line.trim().startsWith('#'))continue;
      const parts=line.trim().split(/\s+/),index=parts.indexOf('ssh-ed25519'),value=parts[index+1];
      if(index<0||!/^[A-Za-z0-9+/=]+$/.test(value??''))continue;
      const file=join(directory,'public');writeFileSync(file,`ssh-ed25519 ${value}\n`,{mode:0o600});
      const fingerprint=execFileSync('ssh-keygen',['-l','-E','sha256','-f',file],{encoding:'utf8'}).trim().split(/\s+/)[1];
      if(fingerprint===control.release.target.hostKeyFingerprint){pinned=value;break;}
    }
    if(!pinned)throw Error('The public SSH host key does not match the independently approved fingerprint');
    const host=control.release.target.sshPort===22?control.release.target.sshHost:`[${control.release.target.sshHost}]:${control.release.target.sshPort}`;
    writeFileSync(known,`${host} ssh-ed25519 ${pinned}\n`,{mode:0o600});
    execFileSync('git',['update-ref','refs/puzzoria-release/verified',sha]);
    execFileSync('git',['bundle','create',bundle,'refs/puzzoria-release/verified',...(expected==='0'.repeat(40)?[]:[`^${expected}`])],{stdio:'ignore'});
    // Re-read immediately before SSH: an owner directive can arrive after the gate job.
    if(!await deploymentOwnerControl(api,state)){console.log(JSON.stringify({productionDeferred:'new-owner-directive',productionChanged:false}));return;}
    const input=openSync(bundle,'r');
    let result;
    try{result=spawnSync('ssh',['-T','-i',key,'-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${known}`,'-o','PasswordAuthentication=no','-o','BatchMode=yes','-o','ConnectTimeout=15','-p',String(control.release.target.sshPort),`${control.release.target.sshUser}@${control.release.target.sshHost}`,`release ${sha} ${expected} ${releasePolicyHash()}`],{stdio:[input,'pipe','pipe'],encoding:'utf8',timeout:25*60000,maxBuffer:1048576});}finally{closeSync(input);}
    try{receipt=JSON.parse(result.stdout?.trim()??'');}catch{throw Error('Deployment did not return a valid private host receipt');}
    if(receipt.sha!==sha||!['healthy','rolled_back'].includes(receipt.phase)||receipt.backup?.verified!==true||
      (receipt.phase==='healthy'&&(receipt.currentCommit!==sha||!Number.isFinite(Date.parse(receipt.releasedAt)))))throw Error('Deployment receipt does not identify a verified rollout');
    if(receipt.phase==='healthy'&&result.status!==0)throw Error('SSH did not confirm successful rollout completion');
    candidate.status=receipt.phase==='healthy'?'deployed':'rolled_back';
    const queued=state.growth.releaseQueue?.find(row=>row.prNumber===candidate.prNumber&&row.sha===candidate.sha);if(queued)queued.status=candidate.status;
    const deployment={status:candidate.status,sha,releasedAt:receipt.releasedAt??null,finishedAt:receipt.finishedAt,previousCommit:expected};
    if(experiment)experiment.deployment=deployment;
    if(candidate.status==='deployed')for(const row of state.growth.experiments)if(row!==experiment&&row.mergeSha&&!row.deployment?.releasedAt){const comparison=await api(`/compare/${row.mergeSha}...${sha}`);if(['ahead','identical'].includes(comparison.status))row.deployment={...deployment,sharedRollout:true};}
    if(candidate.status==='deployed')state.growth.lastDeployedCommit=sha;
    await store.save('Record an observed host rollout or image rollback; never invent deployment success');confirmed=true;
    await api('/issues/3/comments','POST',{body:`${experiment?`Expérience ${experiment.id}`:'Mise en service initiale autorisée par le propriétaire'} : ${candidate.status}. Sauvegarde vérifiée, contrôles publics et image ${sha}. ${candidate.status==='rolled_back'?'Retour automatique à l’image précédente ; les données courantes sont conservées.':'Les prochaines observations mesureront les résultats sur des fenêtres complètes.'}`});
    console.log(JSON.stringify({status:candidate.status,sha,previousCommit:expected,backupVerified:receipt.backup?.verified}));
    if(candidate.status==='rolled_back')process.exitCode=1;
  } catch(error) {
    if(!confirmed){
      recordDeploymentFailure(candidate);
      try{await store.save('Preserve an unconfirmed deployment; wait before idempotent retry and require review after three failures');}catch{/* Never override a concurrently changed state. */}
      try{await api('/issues/3/comments','POST',{body:`Publication ${sha} : aucun reçu de déploiement confirmé. ${candidate.status==='manual_intervention'?'Revue nécessaire après trois échecs.':'Reprise idempotente au plus tôt dans six heures ; les nouvelles fusions applicatives attendent cette confirmation.'} Aucun succès ni effet de croissance attribué. [Exécution](https://github.com/${REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}).`});}catch{/* Preserve the original failure. */}
    }
    throw error;
  } finally {rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]?.endsWith('release-client.mjs'))run().catch(error=>{console.error(error.message);process.exitCode=1;});
