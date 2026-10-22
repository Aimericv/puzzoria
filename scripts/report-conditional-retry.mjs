import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const source='5ece3ee5f72a6eefd592a1b5c6a20a87f5a97151';
const mainRun=await api('/actions/runs/39632711143');
if(mainRun.status!=='completed'||mainRun.conclusion!=='success'||mainRun.head_sha!==source)throw Error('Main CI result is not the expected success');
const original=await api('/contents/ci-complement.json?ref=codex%2Fci-complement%2F39829393874');
const prior=JSON.parse(Buffer.from(original.content,'base64').toString('utf8'));
const reports=prior.reports.filter(row=>['desktop','mobile','android'].includes(row.project));
if(existsSync('.ci-evidence'))for(const dir of readdirSync('.ci-evidence')) {
 const file=`.ci-evidence/${dir}/summary.json`;
 if(existsSync(file))reports.push(JSON.parse(readFileSync(file,'utf8')));
}
const {jobs}=await api(`/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`);
const expected=['desktop','mobile','android','iphone-webkit'];
const passed=expected.every(project=>{
 const row=reports.find(row=>row.project===project),test=row?.reports.find(row=>row.name==='full');
 return row?.sha===source&&test?.stats.expected===2&&test.stats.unexpected===0&&test.stats.skipped===0&&test.stats.flaky===0;
});
const counts=expected.map(project=>{
 const test=reports.find(row=>row.project===project)?.reports.find(row=>row.name==='full');
 return test?`${project} : ${test.stats.expected} réussis, ${test.stats.unexpected} échecs, ${test.stats.skipped} ignorés.`:`${project} : aucun résultat de test disponible.`;
});
const url=`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`;
const marker=`<!-- conditional-browser-result-${process.env.GITHUB_RUN_ID} -->`;
const body=[marker,passed?'Complément Playwright terminé : les huit tests conditionnels ont réussi.':'Complément Playwright incomplet : ne pas considérer les parcours sans résultat comme validés.',...counts,`Source : ${source}.`,`CI principale réussie : ${mainRun.html_url}`,`Reprise ciblée des installations : ${url}`,
 'La PR #4 reste non fusionnée et les réveils désactivés. L’absence de déploiement externe sur main reste à vérifier ; la lecture des webhooks et des variables du dépôt est refusée avec les droits actuels. Aucun accès au VPS, achat, appel d’API payante, fusion ou déploiement n’a été effectué.',
 'Les tests du superviseur couvrent l’arrêt et la reprise sur quota avec des réponses contrôlées ; aucun quota réel n’a été épuisé. Le budget GitHub à 0 $ n’est pas vérifié. Ce rapport système ne constitue pas un test de réception d’un message du propriétaire.'
].join('\n\n');
const comments=await api('/issues/3/comments?per_page=100');
const comment=comments.find(row=>row.body?.includes(marker))??await api('/issues/3/comments','POST',{body});
const proof={source,mainRun:mainRun.html_url,priorComplement:prior.url,retryRun:url,allConditionalTestsPassed:passed,counts,reports,jobs:jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion})),communication:{reportUrl:comment.html_url},activation:false};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'conditional-final.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record conditional browser validation and communication receipt',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/ci-conditional-final/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
if(!passed)process.exitCode=1;
