import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {github} from './autonomy-pilot/github.mjs';
const source='c322fd20dd9d3188065fef48bf332fb740c0617e',base='69e4198f063fb499c45efdd4f0fdedc6a31b78a7';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),load=p=>import(pathToFileURL(resolve(p)));
const {StateStore}=await load('scripts/autonomy-agent/store.mjs');
const control=JSON.parse(readFileSync('agent/autonomy/control.json'));
if(process.env.FREE_FLAG!=='true'||process.env.AGENT_FLAG!=='true'||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source)throw Error('Exact source and free funding required');
const store=new StateStore(api,control,base),state=await store.load();
if(state.growth.lastDeployedCommit||state.growth.productionBootstrapApproval?.sha!==base||state.growth.pendingDeployment?.mergeSha!==base||!['awaiting_activation','awaiting_policy_refresh'].includes(state.growth.pendingDeployment?.status))throw Error('Preserve any newer production state');
if(process.argv[2]==='reserve'){
 for(const [id,names] of [['40584407324',['stage']],['40586884415',['reserve','gate','fixed','validate']]]){
  const run=await api('/actions/runs/'+id),{jobs}=await api('/actions/runs/'+id+'/jobs?per_page=100');
  const active=jobs.filter(j=>j.conclusion!=='skipped');
  if(run.status!=='completed'||run.conclusion!=='success'||run.run_attempt!==1||run.head_branch!=='codex/ci-inspection'||JSON.stringify(active.map(j=>j.name).sort())!==JSON.stringify([...names].sort()))throw Error('Completed exact prior validation accounting required');
  let minutes=0;
  for(const j of active){const start=Date.parse(j.started_at),end=Date.parse(j.completed_at);if(j.status!=='completed'||!Number.isFinite(start)||!Number.isFinite(end)||end<start||end-start>10*60000)throw Error('Invalid prior job timing');minutes+=Math.ceil((end-start)/60000)+2;}
  const row=state.releaseValidationHistory.find(r=>r.runId===id);if(!row)throw Error('Missing prior reservation');
  Object.assign(row,{minutes,settled:true,accounting:{source:'github-completed-review-job-timestamps',jobs:active.map(j=>({id:j.id,name:j.name,startedAt:j.started_at,completedAt:j.completed_at})),marginMinutesPerJob:2}});
 }
 const used=state.releaseValidationHistory.reduce((n,r)=>n+r.minutes,0);
 if(used+6+5>180)throw Error('Unchanged validation allowance insufficient');
 state.growth.pendingDeployment.status='awaiting_policy_refresh';
 state.releaseValidationHistory.push({at:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID,sha:source,minutes:6,settled:false,accounting:{source:'bounded-final-initial-production-review',maximumJobMinutes:4,marginMinutes:2}});
 await store.save('Reconcile completed validations and reserve final bootstrap safety guards; preserve memory and owner instructions');
 console.log(JSON.stringify({reservedMinutes:6,totalReservedMinutes:used+6,limit:180,publicationHeldForPolicyRefresh:true}));
}else if(process.argv[2]==='publish'){
 const allowed=['.github/workflows/autonomy-agent.yml','agent/autonomy/control.json','deploy/install-release-controller.sh','deploy/refresh-bootstrap-policy.mjs','deploy/setup-release-from-windows.ps1','docs/AUTONOMY-GROWTH.fr.md','scripts/autonomy-agent/bootstrap-policy.test.mjs','scripts/autonomy-agent/package-controller.mjs','scripts/autonomy-agent/release-client.mjs','scripts/autonomy-agent/release-continuity.test.mjs','scripts/autonomy-agent/release-queue.mjs','scripts/autonomy-agent/test-windows-host-key.ps1'];
 const paths=execFileSync('git',['diff','--name-only',base,source],{encoding:'utf8'}).trim().split('\n');
 if(JSON.stringify(paths)!==JSON.stringify(allowed))throw Error('Only Windows helper, policy receipt and documentation may change');
 const tap=readFileSync('.ci-results/control.tap','utf8');
 if(!/^# tests 86$/m.test(tap)||!/^# pass 86$/m.test(tap)||!/^# fail 0$/m.test(tap))throw Error('86 controls required');
 const nativeFile=await api('/contents/initial-production-review.json?ref=codex/initial-production-review/40586884415'),native=JSON.parse(Buffer.from(nativeFile.content,'base64'));
 if(native.source!=='ab8de8936b20065134f6405ca11fb405ca3d1de4'||native.reproducer.original!=='skipped'||native.reproducer.fixed!=='success'||native.reproducer.denied!=='skipped')throw Error('Actual native skipped-job regression proof required');
 const ready=JSON.parse(readFileSync('.ci-results/bootstrap-ready.json'));
 if(ready.passed!==6||ready.failed||!ready.exactBlobCompareAndSwap||!ready.memoryAndOwnerMessagesPreserved||ready.productionContacted)throw Error('Real native skipped ancestor regression and preserved owner-state CAS required');
 const windows=JSON.parse(readFileSync('.ci-results/windows-host-key.json')),manifest=JSON.parse(readFileSync('.release/controller/VALIDATION.json'));
 const {releasePolicyHash}=await load('scripts/autonomy-agent/release-client.mjs');
 if(windows.passed!==7||windows.failed||!windows.strictKnownHosts||!windows.independentFingerprint||!windows.publicKeyOnly||windows.sshKeyscanRequired||windows.productionContacted||manifest.source!==source||manifest.policyHash!==releasePolicyHash()||manifest.policyHash!==control.release.productionAuthorization.policyHash)throw Error('Strict verified SSH and exact package required');
 const oldFile=await api('/contents/windows-installer-staged.json?ref=codex/windows-installer-staged/40584407324'),old=JSON.parse(Buffer.from(oldFile.content,'base64'));
 if(old.main!==base||old.unit!==359||old.e2e!==424||old.realSshProofRun!=='40576205097'||!old.hostRollbackModulesUnchanged)throw Error('Existing transport and application proof required');
 const url=`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`;
 const existing=(await api('/pulls?state=all&head=Aimericv:codex/initial-production-job'))[0];
 const pr=existing??await api('/pulls','POST',{head:'codex/initial-production-job',base:'main',draft:true,title:'Exécuter la publication autorisée après les sessions ignorées',body:`Le premier deploy-pending a obtenu productionAllowed=true, puis GitHub a ignoré le job production à cause des ancêtres volontairement ignorés. Le job évalue désormais always() tout en exigeant un verrou réussi et allowed=true, ainsi que main et le dépôt attendu. Un véritable scénario GitHub reproduit le défaut et vérifie le démarrage corrigé et le refus négatif.\n\nLe contrôleur étant installé mais jamais publié, une procédure root distincte peut actualiser uniquement l’empreinte et le SHA initial approuvé : modules hôtes inchangés, journal sain au commit initial, image et schéma vérifiés, configuration sauvegardée puis remplacée atomiquement sous flock. Aucun code hôte, service, clé, volume ou journal n’est remplacé. GitHub garde awaiting_policy_refresh jusqu’au contrôle hôte et à une confirmation CAS qui préserve mémoire et consignes.\n\nValidation : 86 contrôles dont 9 cas de mise à jour initiale ; 7 cas PowerShell de clé hôte et 6 cas de confirmation CAS ; lint, analyse shell et PowerShell, paquet exact. Application et quatre modules sauvegarde/rollback inchangés (359 unitaires,424 Playwright et fixtures antérieures conservés). Aucun accès VPS ni publication depuis ce test. [Preuves](${url}).`});
 const report={source,base,paths,controls:86,windows,ready,reproducer:native.reproducer,reproducerRun:'40586884415',powerShellParseAndDryRun:true,lint:true,policyHash:releasePolicyHash(),archiveSha256:readFileSync('.release/puzzoria-controller.sha256','utf8').trim().split(/\s+/)[0],controllerSource:manifest.source,unit:359,e2e:424,applicationUnchanged:true,hostRollbackModulesUnchanged:true,realSshProofRun:'40576205097',externalProductionEnabled:process.env.PRODUCTION_FLAG==='true',publicationHeldForPolicyRefresh:true,vpsContacted:false,pr:{number:pr.number,url:pr.html_url},url};
 const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'initial-production-review.json',mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record verified Windows host key reader, negative security cases and unchanged production controller',tree:tree.sha,parents:[parent]});
 await api('/git/refs','POST',{ref:`refs/heads/codex/initial-production-review/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(report));
}else throw Error('Explicit review phase required');
