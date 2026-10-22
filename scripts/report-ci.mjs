import {github} from "./autonomy-pilot/github.mjs";
import {existsSync,readdirSync,readFileSync} from "node:fs";
const api=github(process.env.GITHUB_TOKEN,"Aimericv/puzzoria");
const runId="39632711143",expectedHead="5ece3ee5f72a6eefd592a1b5c6a20a87f5a97151";
const run=await api(`/actions/runs/${runId}`);
if(run.status!=="completed"||run.head_sha!==expectedHead)throw Error("Expected CI has not finished on the approved source");
const content=await api(`/contents/agent/autonomy/ci-evidence.json?ref=${encodeURIComponent(`codex/ci-evidence/${runId}`)}`);
const proof=JSON.parse(Buffer.from(content.content,"base64").toString("utf8"));
if(proof.pr.head!==expectedHead)throw Error("CI proof does not match the expected PR head");
const {jobs}=await api(`/actions/runs/${runId}/jobs?per_page=100`);
const expected=["checks","E2E (desktop)","E2E (mobile)","E2E (android)","E2E (iphone-webkit)"];
const results=expected.map(name=>{
 const job=jobs.find(row=>row.name===name);
 if(!job||job.status!=="completed")throw Error(`Missing completed job ${name}`);
 return `${name} : ${job.conclusion}`;
});
const counts=proof.reports.flatMap(project=>project.reports.map(report=>report.name==="unit"
 ? `${project.project} : ${report.passed} tests unitaires réussis, ${report.failed} échecs, ${report.skipped} ignorés.`
 : `${project.project} / ${report.name} : ${report.stats.expected} réussis, ${report.stats.unexpected} échecs, ${report.stats.skipped} ignorés, ${report.stats.flaky} instables.`));
const {jobs:complementJobs}=await api(`/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`);
const complementReports=[];
if(existsSync('.ci-evidence'))for(const directory of readdirSync('.ci-evidence')) {
 const file=`.ci-evidence/${directory}/summary.json`;
 if(existsSync(file))complementReports.push(JSON.parse(readFileSync(file,'utf8')));
}
const complement={runId:process.env.GITHUB_RUN_ID,url:`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`,source:expectedHead,jobs:complementJobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion})),reports:complementReports};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'ci-complement.json',mode:'100644',type:'blob',content:JSON.stringify({mainRun:{id:runId,conclusion:run.conclusion},...complement},null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record conditional browser coverage and final CI status',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/ci-complement/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
const complementCounts=complementReports.flatMap(project=>project.reports.map(report=>`${project.project} / COMMUNITY_STARTER_STATS=true : ${report.stats.expected} réussis, ${report.stats.unexpected} échecs, ${report.stats.skipped} ignorés, ${report.stats.flaky} instables.`));
const marker=`<!-- activation-validation-${runId} -->`;
const body=[marker,"Validation avant activation",`CI complète : ${run.html_url}`,`Complément des deux tests conditionnels par navigateur : ${complement.url}`,`Source de la PR #4 : ${expectedHead}.`,...results,...counts,...complementCounts,
 "Les tests de contrôle du superviseur couvrent l'arrêt avant inférence sur quota épuisé, la conservation des consignes et la reprise après remise à zéro. Aucun quota réel n'a été volontairement épuisé.",
 "Activation permanente suspendue : l'absence de déploiement externe sur main reste inconnue. Aucun déploiement, environnement ou contrôle externe n'est enregistré dans les données GitHub accessibles ; la lecture des webhooks renvoie HTTP 403. Cette absence d'historique ne prouve pas l'absence d'un déploiement externe. Aucun accès au VPS n'a été effectué.",
 "La PR #4 reste non fusionnée et les réveils permanents désactivés. Aucun premier réveil après activation n'a donc eu lieu. L'autorisation conditionnelle du propriétaire reste acquise ; aucune nouvelle validation de principe n'est demandée.",
 "Aucun moyen de paiement n'a été ajouté, aucune API payante utilisée, aucune fusion ou publication en production effectuée. L'absence de moyen de paiement est une déclaration du propriétaire ; le budget GitHub à 0 $ et l'épuisement réel du quota Actions ne sont pas techniquement vérifiés.",
 "Ce rapport est publié par le système : il ne constitue pas un test d'entrée d'une consigne du propriétaire. Les messages Codex Cloud ne sont pas automatiquement transmis aux sessions autonomes."
].join("\n\n");
const comments=await api("/issues/3/comments?per_page=100");
const existing=comments.find(row=>row.body?.includes(marker));
const comment=existing?existing:await api("/issues/3/comments","POST",{body});
console.log(JSON.stringify({commentUrl:comment.html_url,runUrl:run.html_url,conclusion:run.conclusion,results,counts,activation:false}));
