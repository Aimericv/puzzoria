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
  const files=['scripts/autonomy-agent/release-policy.mjs','scripts/autonomy-agent/release-controller.mjs','scripts/autonomy-agent/release-host.mjs','scripts/autonomy-agent/deployment-transaction.mjs','scripts/autonomy-agent/public-probe.mjs','scripts/autonomy-agent/release-client.mjs','scripts/autonomy-agent/release-check.mjs','scripts/autonomy-agent/release-validation.mjs','.github/containers/release-verifier.Dockerfile','.github/workflows/autonomy-agent.yml','.github/actions/puzzoria-agent/action.yml','deploy/puzzoria-release-entry.sh','deploy/install-release-controller.sh','deploy/puzzoria-release-recover.service','deploy/puzzoria-release-recover.timer','package-lock.json'];
  return createHash('sha256').update(files.map(file=>file+'\n'+readFileSync(file,'utf8')).join('\n')).digest('hex');
}
export async function run(mode=process.argv[2]) {
  if(mode==='policy-hash'){console.log(releasePolicyHash());return;}
  const control=JSON.parse(readFileSync('agent/autonomy/control.json','utf8'));assertFunding(control);
  const allowed=deploymentAllowed(control,process.env.PUZZORIA_AUTODEPLOY_ENABLED,releasePolicyHash());
  if(mode==='gate'){
    let pending;
    if(allowed){const api=github(process.env.GITHUB_TOKEN,REPOSITORY),state=await new StateStore(api,control,process.env.GITHUB_SHA).load();pending=state.growth?.releaseCandidate;}
    const firstAllowed=control.release.target.initialCommit!=='0'.repeat(40)||pending?.mergeSha===control.release.productionAuthorization?.initialApprovedCommit;
    const admitted=allowed&&firstAllowed&&pending?.status==='awaiting_activation'&&/^[a-f0-9]{40}$/.test(pending?.mergeSha??'');
    if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`allowed=${Boolean(admitted)}\nsha=${admitted?pending.mergeSha:''}\n`,{flag:'a'});console.log(JSON.stringify({productionAllowed:Boolean(admitted),policyHash:releasePolicyHash()}));return;
  }
  if(mode!=='deploy'||!allowed)throw Error('Production activation is not approved for this policy and target');
  if(process.env.GITHUB_REPOSITORY!==REPOSITORY||process.env.GITHUB_REF!=='refs/heads/main')throw Error('Production requires trusted main context');
  const api=github(process.env.GITHUB_TOKEN,REPOSITORY),store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
  const candidate=state.growth?.releaseCandidate,sha=process.env.RELEASE_SHA;
  if(!candidate||candidate.mergeSha!==sha||candidate.status!=='awaiting_activation'||!/^[a-f0-9]{40}$/.test(sha??''))throw Error('No exact tested merge is waiting for deployment');
  const expected=state.growth.lastDeployedCommit??control.release.target.initialCommit;
  if(!/^[a-f0-9]{40}$/.test(expected))throw Error('An attested previous production commit is required');
  if(expected==='0'.repeat(40)&&sha!==control.release.productionAuthorization.initialApprovedCommit)throw Error('The first rollout needs exact source approval');
  const experiment=state.growth.experiments.find(row=>row.id===candidate.experimentId);
  if(!experiment&&candidate.ownerApprovedBootstrap!==true)throw Error('Unknown experiment without an operator-approved bootstrap receipt');
  const directory=mkdtempSync(join(tmpdir(),'puzzoria-ssh-'));let receipt;
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
    const input=openSync(bundle,'r');
    let result;
    try{result=spawnSync('ssh',['-T','-i',key,'-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${known}`,'-o','PasswordAuthentication=no','-o','BatchMode=yes','-o','ConnectTimeout=15','-p',String(control.release.target.sshPort),`${control.release.target.sshUser}@${control.release.target.sshHost}`,`release ${sha} ${expected} ${releasePolicyHash()}`],{stdio:[input,'pipe','pipe'],encoding:'utf8',timeout:25*60000,maxBuffer:1048576});}finally{closeSync(input);}
    try{receipt=JSON.parse(result.stdout?.trim()??'');}catch{throw Error('Deployment did not return a valid private host receipt');}
    if(receipt.sha!==sha||!['healthy','rolled_back'].includes(receipt.phase)||receipt.backup?.verified!==true||
      (receipt.phase==='healthy'&&(receipt.currentCommit!==sha||!Number.isFinite(Date.parse(receipt.releasedAt)))))throw Error('Deployment receipt does not identify a verified rollout');
    if(receipt.phase==='healthy'&&result.status!==0)throw Error('SSH did not confirm successful rollout completion');
    candidate.status=receipt.phase==='healthy'?'deployed':'rolled_back';
    const deployment={status:candidate.status,sha,releasedAt:receipt.releasedAt??null,finishedAt:receipt.finishedAt,previousCommit:expected};
    if(experiment)experiment.deployment=deployment;
    if(candidate.status==='deployed')for(const row of state.growth.experiments)if(row!==experiment&&row.mergeSha&&!row.deployment?.releasedAt){const comparison=await api(`/compare/${row.mergeSha}...${sha}`);if(['ahead','identical'].includes(comparison.status))row.deployment={...deployment,sharedRollout:true};}
    if(candidate.status==='deployed')state.growth.lastDeployedCommit=sha;
    await store.save('Record an observed host rollout or image rollback; never invent deployment success');
    await api('/issues/3/comments','POST',{body:`${experiment?`Expérience ${experiment.id}`:'Mise en service initiale autorisée par le propriétaire'} : ${candidate.status}. Sauvegarde vérifiée, contrôles publics et image ${sha}. ${candidate.status==='rolled_back'?'Retour automatique à l’image précédente ; les données courantes sont conservées.':'Les prochaines observations mesureront les résultats sur des fenêtres complètes.'}`});
    console.log(JSON.stringify({status:candidate.status,sha,previousCommit:expected,backupVerified:receipt.backup?.verified}));
    if(candidate.status==='rolled_back')process.exitCode=1;
  } finally {rmSync(directory,{recursive:true,force:true});}
}
if(process.argv[1]?.endsWith('release-client.mjs'))run().catch(error=>{console.error(error.message);process.exitCode=1;});
