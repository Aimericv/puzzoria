import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const branch=process.env.CONDITIONAL_PROOF_BRANCH;
if(!/^codex\/ci-conditional-final\/\d+$/.test(branch??''))throw Error('Expected conditional validation proof branch');
const file=await api(`/contents/conditional-final.json?ref=${encodeURIComponent(branch)}`);
const conditional=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
const source='5ece3ee5f72a6eefd592a1b5c6a20a87f5a97151',expectedMain='37aa7654be9393173c4d5c7d3446cc0832bb9818';
const pr=await api('/pulls/4'),main=(await api('/git/ref/heads/main')).object.sha;
if(conditional.source!==source||pr.head.sha!==source||pr.merged||main!==expectedMain)throw Error('Repository changed after validation');
const run=await api('/actions/runs/39632711143');
if(run.conclusion!=='success'||run.head_sha!==source)throw Error('Expected full CI result');
const browser=conditional.allConditionalTestsPassed
 ?'Playwright : 82 parcours standard par configuration et les 2 parcours conditionnels supplémentaires sur chacun des 4 projets (desktop, mobile Chromium, Android, iPhone WebKit), sans échec ni instabilité.'
 :'Playwright : 82 parcours standard réussis sur chacun des 4 projets. Le complément conditionnel reste incomplet : voir son rapport, sans compter les parcours manquants comme validés.';
const body=[
 'Puzzoria peut choisir ses missions de développement, tester ses contributions, publier des PR brouillon et conserver son code, sa mémoire et sa connexion Plus chiffrée entre runners indépendants. Le ticket #3 reçoit les consignes du propriétaire et les rapports ; les conversations Codex Cloud restent indépendantes.',
 'Les réveils prévus toutes les six heures restent désactivés par deux verrous. Les quotas Plus contrôlent l’admission et la reprise ; aucun repli API payant, accès au VPS, déploiement ou fusion automatique des futures PR n’est prévu. L’absence de moyen de paiement GitHub est une déclaration du propriétaire ; le budget Actions à 0 $ n’a pas été créé ni vérifié.',
 `Validation du code \`${source}\` : [CI principale réussie](${run.html_url}), 21 tests du superviseur, 345 tests unitaires, lint, typage, contenus, SEO, build et traces de build réussis. ${browser}`,
 `[Rapport du complément navigateur](${conditional.communication.reportUrl}) — [reprise ciblée WebKit](${conditional.retryRun}). Les arrêts et reprises sur quota sont testés avec des réponses contrôlées, sans épuisement volontaire des quotas réels.`,
 'Fusion et activation suspendues : aucun déploiement GitHub ni environnement n’est observé, mais la lecture des webhooks et des variables du dépôt est refusée (HTTP 403). Un déploiement externe surveillant main ne peut pas être exclu. Aucun accès au VPS n’a été effectué. L’autorisation conditionnelle du propriétaire est acquise ; cette vérification technique reste à obtenir avant la fusion.',
 'La réception réelle d’un commentaire du propriétaire reste à vérifier après activation ; les filtres d’auteur, la pagination et la conservation des messages sont couverts par les tests.'
].join('\n\n');
await api('/pulls/4','PATCH',{body});
const issue=await api('/issues/3');
const start='<!-- activation-gate-status -->',end='<!-- /activation-gate-status -->';
const previous=issue.body??'';
const preserved=previous.includes(start)&&previous.includes(end)?previous.slice(previous.indexOf(end)+end.length).trimStart():previous;
await api('/issues/3','PATCH',{body:`${start}\n## Réveils permanents désactivés\n\nLa CI principale a réussi. ${browser}\n\nLa PR #4 reste non fusionnée : l’absence de déploiement externe sur main reste à établir. Aucun premier réveil après activation n’a eu lieu.\n\n[Dernier rapport de validation](${conditional.communication.reportUrl})\n${end}\n\n${preserved}`});
const proof={source,main,pr:{url:pr.html_url,merged:false,draft:pr.draft,autoMergeEnabled:Boolean(pr.auto_merge)},fullCI:{url:run.html_url,conclusion:run.conclusion},conditional:{passed:conditional.allConditionalTestsPassed,url:conditional.retryRun,counts:conditional.counts},communication:{url:'https://github.com/Aimericv/puzzoria/issues/3',reportUrl:conditional.communication.reportUrl,dashboardUpdated:true},activation:false,reason:'External deployment absence unverified; hooks and variables inaccessible (HTTP 403); VPS access prohibited'};
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'activation-delivery.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record validation delivery without merging or activating',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/activation-delivery/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
