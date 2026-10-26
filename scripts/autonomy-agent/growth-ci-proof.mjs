import {readFileSync,existsSync} from 'node:fs';
import {github} from '../autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const read=path=>existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
const release=read('.release/proof.json'),trends=read('.ci-results/trends.json');
const tap=existsSync('.ci-results/control.tap')?readFileSync('.ci-results/control.tap','utf8'):'';
const count=name=>Number(tap.match(new RegExp(`^# ${name} (\\d+)`,'m'))?.[1]??0);
const {jobs}=await api(`/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`);
const evidence={source:process.env.GITHUB_SHA,url:`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`,controls:{tests:count('tests'),passed:count('pass'),failed:count('fail')},release,steps:jobs.flatMap(job=>job.steps??[]).map(step=>({name:step.name,conclusion:step.conclusion,status:step.status})),trends:trends?{status:trends.status,fetchedAt:trends.fetchedAt,sources:trends.sources.map(source=>({id:source.id,status:source.status,reason:source.reason,items:source.items.length}))}:null,productionEnabled:JSON.parse(readFileSync('agent/autonomy/control.json','utf8')).release.productionEnabled,controller:read('.release/controller/VALIDATION.json')};
const body=[
 'Les sessions choisissent désormais des expériences d’acquisition, SEO ou rétention à partir des métriques réelles et des tendances publiques disponibles. Les critères et baselines sont enregistrés, les propositions restent distinctes des déploiements observés et les sessions sans changement peuvent analyser sans relancer un build.',
 'Les PR sont isolées par expérience. La fusion automatique est limitée aux valeurs de texte des modules SEO autorisés et à certains documents produit, avec structure exécutable inchangée et validation indépendante. Les changements de logique, nouveaux jeux, comptes, données et infrastructure restent en revue humaine.',
 'Le contrôleur de production est préparé avec sauvegarde/restauration vérifiées, préproduction sur copie privée sans réseau, contrôles publics, journal durable et rollback d’image conservant les écritures récentes. La production reste désactivée et exige l’autorisation explicite du propriétaire, une politique verrouillée et une clé SSH dédiée à commande forcée.',
 `Validation : [exécution complète](${evidence.url}), ${evidence.controls.passed}/${evidence.controls.tests} tests de contrôle réussis. État du vérificateur applicatif et des quatre projets Playwright : ${release?.status??'non terminé'}. Les preuves détaillées séparent les étapes échouées, absentes ou ignorées ; elles ne sont pas présentées comme réussies.`,
 'Aucun service payant ni moyen de paiement ajouté. Le budget GitHub à 0 € reste non vérifié ; les protections Plus et la déclaration d’absence de moyen de paiement sont conservées. Voir docs/AUTONOMY-GROWTH.fr.md pour les limites et l’activation initiale encore interdite.'
].join('\n\n');
const existing=await api('/pulls?state=open&head=Aimericv:codex/growth-autonomy');
const pr=existing.length?await api(`/pulls/${existing[0].number}`,'PATCH',{body}):await api('/pulls','POST',{head:'codex/growth-autonomy',base:'main',title:'Puzzoria : expériences de croissance et publications contrôlées, production désactivée',body,draft:true});
evidence.pr={number:pr.number,url:pr.html_url,draft:pr.draft};
const commit=await api(`/git/commits/${process.env.GITHUB_SHA}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'growth-validation.json',mode:'100644',type:'blob',content:JSON.stringify(evidence,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record growth autonomy validation without production activation',tree:tree.sha,parents:[process.env.GITHUB_SHA]});
await api('/git/refs','POST',{ref:`refs/heads/codex/growth-validation/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify({url:evidence.url,source:evidence.source,controls:evidence.controls,release:release?.status,trends:evidence.trends,productionEnabled:evidence.productionEnabled}));
