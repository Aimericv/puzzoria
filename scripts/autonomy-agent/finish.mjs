import {readFileSync,existsSync,writeFileSync} from "node:fs";
import {github} from "../autonomy-pilot/github.mjs";
import {StateStore} from "./store.mjs";
import {REPOSITORY} from "./policy.mjs";

const api=github(process.env.GITHUB_TOKEN,REPOSITORY);
const control=JSON.parse(readFileSync("agent/autonomy/control.json","utf8"));
const permanentActivationEnabled=control.permanentActivationApproved===true&&process.env.PUZZORIA_AGENT_ENABLED==="true";
const store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
const runId=process.env.GITHUB_RUN_ID,job=process.env.GITHUB_JOB;
const evidence=existsSync(".agent-out/run.json")?JSON.parse(readFileSync(".agent-out/run.json","utf8")):{status:"no-model-or-setup-failed",reason:state.status};
evidence.workflowOutcome=process.env.AGENT_STEP_OUTCOME;
evidence.runUrl=`https://github.com/${REPOSITORY}/actions/runs/${runId}`;
state.validation ??={};
state.validation[runId] ??={sourceSha:process.env.GITHUB_SHA,jobs:{}};
state.validation[runId].jobs[job]=evidence;
const candidate=state.growth?.releaseCandidate;
if(process.env.GITHUB_OUTPUT&&process.env.AGENT_MODE==='autonomous'&&process.env.MODEL_ADMITTED==='true'&&candidate&&['proposed','waiting_validation_budget','validation_failed','validating',undefined].includes(candidate.status)) {
  writeFileSync(process.env.GITHUB_OUTPUT,`candidate_sha=${candidate.sha}\n`,{flag:'a'});
}
for(const id of Object.keys(state.validation).sort((a,b)=>Number(b)-Number(a)).slice(5)) delete state.validation[id];
await store.save("Record actual validation outcomes without activating permanent wakes");
const head=process.env.GITHUB_HEAD_REF || process.env.AGENT_CONTROL_BRANCH;
if(head==="codex/autonomy-agent") {
  const jobs=Object.values(state.validation[runId].jobs);
  const verified=jobs.filter(result=>result.status==="verified").length;
  const body=`Puzzoria dispose d'un superviseur autonome fondé sur le pilote Plus existant : mémoire GitHub, ticket de consignes, checkpoints chiffrés immédiats, pauses de quotas et contributions testées en PR. Aucun merge ni déploiement automatique.\n\nLes réveils permanents restent doublement désactivés (configuration et variable d'activation). Le budget Actions à 0 $ n'a pas été créé : la protection enregistrée est la déclaration du propriétaire qu'aucun moyen de paiement n'est présent. Aucun moyen de paiement n'est ajouté.\n\nValidation réelle : ${verified} session(s) vérifiée(s) pour [ce run](${evidence.runUrl}). Les résultats détaillés sont conservés sur codex/agent-state et dans le ticket [#${state.issueNumber}](https://github.com/${REPOSITORY}/issues/${state.issueNumber}). Les sessions non terminées ou échouées ne sont pas comptées comme réussies.\n\nLire docs/AUTONOMY-AGENT.fr.md pour l'exploitation et les limites. Cette PR réutilise le prototype encore non fusionné et conserve ses protections, avec remplacement du verrou financier non vérifié.`;
  const existing=await api(`/pulls?state=open&head=Aimericv:${head}`);
  const pr=existing.length?await api(`/pulls/${existing[0].number}`,"PATCH",{title:"Puzzoria : agent autonome sur GitHub Actions, activation désactivée",body}):await api("/pulls","POST",{head,base:"main",title:"Puzzoria : agent autonome sur GitHub Actions, activation désactivée",body,draft:true});
  state.infrastructurePR=pr.html_url;await store.save("Record the reviewable infrastructure PR");
  console.log(JSON.stringify({infrastructurePR:pr.html_url,verifiedSessions:verified,issueNumber:state.issueNumber,permanentActivationApproved:control.permanentActivationApproved}));
}
if(process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY,`## Puzzoria\n\nÉtat : ${state.status}. Sessions vérifiées : ${state.completedSessions}.\n\n[Ticket de dialogue](https://github.com/${REPOSITORY}/issues/${state.issueNumber})\n\n[État et preuves](https://github.com/${REPOSITORY}/blob/codex/agent-state/agent/autonomy/state.json)\n\nRéveils permanents : ${permanentActivationEnabled?"activés toutes les six heures, sous réserve des quotas et de la pause":"désactivés : configuration et variable d'activation requises"}.\n`,{flag:"a"});
