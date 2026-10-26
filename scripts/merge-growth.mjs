// Prepared operator action. Run only from the trusted diagnostic runner after
// both final CI runs succeed; never touch production configuration or keys.
import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const head='78f028830caae969499bb03c716958660aee7fad',expectedBase='ff1ce7d52f4862c9b9072299139a8e2e35a12207';
const pr=await api('/pulls/9');
if(pr.head.sha!==head||pr.base.sha!==expectedBase||pr.base.ref!=='main'||pr.head.ref!=='codex/growth-autonomy'||pr.head.repo.full_name!=='Aimericv/puzzoria'||pr.merged)throw Error('Implementation PR or main changed');
const {workflow_runs:runs}=await api('/actions/runs?branch=codex%2Fgrowth-autonomy&per_page=20');
const full=runs.find(r=>r.head_sha===head&&r.path==='.github/workflows/growth-check.yml');
const standard=runs.find(r=>r.head_sha===head&&r.path==='.github/workflows/ci.yml');
for(const run of [full,standard])if(run?.conclusion!=='success'||run.status!=='completed')throw Error('Both full checks must pass before merging');
const file=await api(`/contents/growth-validation.json?ref=codex%2Fgrowth-validation%2F${full.id}`);
const proof=JSON.parse(Buffer.from(file.content,'base64'));
if(proof.source!==head||proof.controls.passed!==54||proof.controls.failed!==0||proof.release?.status!=='passed'||proof.productionEnabled!==false)throw Error('Final exact-source validation evidence missing');
const settings=await api(`/contents/agent/autonomy/control.json?ref=${head}`);
const control=JSON.parse(Buffer.from(settings.content,'base64'));
if(control.release.productionEnabled!==false||control.release.productionAuthorization!==null||control.release.target.initialCommit!==null)throw Error('Production must remain disabled');
if(pr.draft){
 const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{isDraft}}}',variables:{id:pr.node_id}})});
 const data=await response.json();if(!response.ok||data.errors?.length||data.data?.markPullRequestReadyForReview?.pullRequest?.isDraft!==false)throw Error('Could not mark validated PR ready');
}
const merge=await api('/pulls/9/merge','PUT',{sha:head,merge_method:'merge',commit_title:'Puzzoria: measured growth experiments and guarded releases (production disabled)'});
if(!merge.merged)throw Error('GitHub refused the validated merge');
await api('/issues/3/comments','POST',{body:`Évolution du superviseur installée via la PR #9 (${merge.sha}). Les prochains réveils choisiront des expériences d’acquisition, SEO ou rétention, avec Google Trends disponible et TikTok actuellement indisponible. Les critères, propositions et résultats observés sont suivis séparément. Les fusions automatiques sont limitées aux textes SEO et documents produit classés sûrs après validation ; nouveaux jeux, logique et opérations sensibles restent en revue humaine. Le déploiement automatique est toujours désactivé et aucun accès VPS n’a été utilisé. Les protections Plus et l’absence de repli payant sont conservées. Une conversation Codex Cloud ne transmet pas automatiquement ses messages ici.`});
await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'deploy-pending':false,'check-search-console':false}});
console.log(JSON.stringify({merged:true,sha:merge.sha,pr:pr.html_url,productionEnabled:false,wakeRequested:true}));
const result={merged:true,sha:merge.sha,source:head,pr:pr.html_url,productionEnabled:false,wakeRequested:true,validation:{standard:standard.id,isolated:full.id,controls:proof.controls,release:proof.release,controller:proof.controller}};
const parent=process.env.GITHUB_SHA,sourceCommit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:sourceCommit.tree.sha,tree:[{path:'growth-activation.json',mode:'100644',type:'blob',content:JSON.stringify(result,null,2)+'\n'}]});
const record=await api('/git/commits','POST',{message:'Record validated growth implementation and first wake request; production disabled',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/growth-activation/${process.env.GITHUB_RUN_ID}`,sha:record.sha});
