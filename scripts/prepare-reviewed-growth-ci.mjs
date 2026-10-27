import{readFileSync,writeFileSync,mkdirSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{resolve}from'node:path';
import{pathToFileURL}from'node:url';
import{github}from'./autonomy-pilot/github.mjs';
const source='8b8d23691427c4ba78e4fabbc2de45cfb6987fd9';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source)throw Error('Pinned review source required');
const control=JSON.parse(readFileSync('agent/autonomy/control.json'));if(control.release.productionEnabled!==false||control.release.productionAuthorization!==null||control.release.validationBudgetMinutes7d!==180)throw Error('Production and spending gates must remain unchanged');
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const {reconcileValidationReservations,validationBudgetAvailable}=await import(pathToFileURL(resolve('scripts/autonomy-agent/release-budget.mjs')));
const data=await api('/contents/agent/autonomy/state.json?ref=codex%2Fagent-state'),state=JSON.parse(Buffer.from(data.content,'base64'));
const history=await reconcileValidationReservations(api,structuredClone(state.releaseValidationHistory));
const previousReviews=[];
for(const id of [40537512719]){
 const run=await api(`/actions/runs/${id}`),{jobs}=await api(`/actions/runs/${id}/jobs`),job=jobs.find(j=>j.name==='validate');
 const start=Date.parse(job?.started_at),end=Date.parse(job?.completed_at);
 if(run.status!=='completed'||run.run_attempt!==1||!job||job.status!=='completed'||!Number.isFinite(start)||!Number.isFinite(end)||end<start)throw Error('Previous review accounting is unknown');
 previousReviews.push({runId:id,minutes:Math.ceil((end-start)/60000)+2,source:'completed-review-job-timestamps'});
}
if(history.some(r=>!r.settled)||!validationBudgetAvailable([...history,...previousReviews],102,180))throw Error('Observed prior validation plus bounded review CI exceeds unchanged allowance');
const url=`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`;
const prs=await api('/pulls?state=all&head=Aimericv:codex/first-growth-release');
const pr=prs[0]??await api('/pulls','POST',{head:'codex/first-growth-release',base:'main',draft:true,title:'Intégrer les expériences SEO et finaliser la chaîne autonome de publications',body:`Les propositions #11, #15, #18 et #19 attendaient une validation ou une revue. Cette révision conserve leurs commits : guides Word enrichis, accès aux fiches de vocabulaire déjà publiques, audit du premier démarrage et douze scénarios navigateur supplémentaires. Les règles serveur de publication et de propriété des parties restent identiques. Le test SEO vérifie toutes les sections et les liens réellement publiés sans JavaScript.\n\nLe superviseur conserve les PR dans une file, sépare la version à déployer des nouvelles propositions et rapproche les jobs terminés sans augmenter le plafond de 180 minutes. Une mise à jour de branche ordinaire sans conflit est entièrement reclassée puis retestée. Les reçus SSH ambigus ont une reprise idempotente bornée ; la première publication approuvée ne peut pas être remplacée par une nouvelle proposition.\n\nPour rester compatible avec un dépôt privé sans offre payante supplémentaire, la clé distincte est un secret de dépôt injecté uniquement dans le job de production après vérification de main, de la politique et du reçu. L’installateur Windows vérifie l’accord initial exact, le paquet et l’empreinte SSH ; la clé administrative reste sur le PC.\n\nCette PR reste en brouillon pendant ses vérifications : contrôles du superviseur, syntaxe/dry-run PowerShell, lint/types/contenus/SEO/build, tests unitaires et quatre projets Playwright complets isolés. Les deux scénarios Docker de rollback déjà validés sont réutilisés seulement si leurs modules sont identiques. Aucune production, fusion ou modification de l’état protégé par cette CI. [Validation](${url}).`});
const plan={source,pr:{number:pr.number,url:pr.html_url},sourceStateGeneration:state.generation,protectedStateChanged:false,previousObservedMinutes:history.reduce((s,r)=>s+r.minutes,0),previousReviews,reviewJobMaximumMinutes:100,safetyMarginMinutes:2,withinValidationAllowance:true,limit:180,productionEnabled:false,url};
mkdirSync('.ci-results',{recursive:true});writeFileSync('.ci-results/review-plan.json',JSON.stringify(plan,null,2)+'\n');
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'reviewed-growth-plan.json',mode:'100644',type:'blob',content:JSON.stringify(plan,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Plan a single bounded review CI without protected-state changes or activation',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/reviewed-growth-plan/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(plan));
