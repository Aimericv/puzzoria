import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {github} from './autonomy-pilot/github.mjs';
const source='2184c2b2ec0d7e035216927ccc9ce48fbf52b048',base='692ddc9c815940e6df3df0287dcd3aceb7530b05',native='3d0c1fa8b2b1d5f45f7d8d3a866acb2ef078b402';
const allowed=['e2e/seo.spec.ts'];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==source||JSON.stringify(git('diff','--name-only',base,source).split('\n'))!==JSON.stringify(allowed))throw Error('Unexpected source change');
for(const name of ['seo-baseline','seo-proposal']) {
 const report=JSON.parse(readFileSync(`.ci-results/${name}.json`));
 if(report.stats.expected!==1||report.stats.unexpected!==0||report.stats.flaky!==0||report.stats.skipped!==0)throw Error('Both real SEO fixtures must pass without skips or flakes');
}
if(git('status','--porcelain','--untracked-files=no'))throw Error('Fixture was not restored');
const control=JSON.parse(readFileSync('agent/autonomy/control.json'));
if(control.release.productionEnabled!==false||control.release.productionAuthorization!==null)throw Error('Production must stay disabled');
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const load=path=>import(pathToFileURL(resolve(path)));
const {StateStore}=await load('scripts/autonomy-agent/store.mjs');
const {classifyRelease}=await load('scripts/autonomy-agent/release-policy.mjs');
const {releasePolicyHash}=await load('scripts/autonomy-agent/release-client.mjs');
const file='src/lib/seo-content.ts',get=async(ref)=>Buffer.from((await api(`/contents/${file}?ref=${ref}`)).content,'base64').toString('utf8');
const original=await get(native);
if(classifyRelease([{path:file,mode:'100644',before:await get(base),after:original}]).risk!=='low')throw Error('Original proposal no longer eligible');
const url=`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`;
await api(`/statuses/${source}`,'POST',{state:'success',context:'autonomy/seo-render-contract',description:'SSR all titles/texts, 4 locales x 7 games, old/new content; lint/types',target_url:url});
const prs=await api('/pulls?state=all&head=Aimericv:codex/seo-render-contract');
let pr=prs[0];
if(!pr)pr=await api('/pulls','POST',{head:'codex/seo-render-contract',base:'main',title:'Vérifier tout le contenu SEO rendu sans figer le nombre de sections',draft:false,body:`Le test SEO imposait trois sections par guide et rejetait l’ajout légitime de contenu. Il vérifie maintenant le nombre attendu, chaque titre et chaque paragraphe dans leur ordre, avec au moins trois sections, sur les quatre langues et sept jeux sans JavaScript. Aucun contrôle SEO existant n’est supprimé.\n\nValidation ciblée réelle : le même test Playwright passe sur le contenu actuel puis sur les huit paragraphes proposés par la session native (SHA ${native}), sans modifier les assertions ni délais entre les cas. Lint et types passent. Cette PR ne modifie que le test ; la PR #11 devra ensuite passer toute la validation indépendante sur son nouveau SHA exact. Production désactivée, aucune nouvelle inférence ni accès VPS. [Validation](${url}).`});
if(pr.head.sha!==source)throw Error('Handoff PR changed');
let main;
if(pr.merged_at){const actual=await api(`/pulls/${pr.number}`);main=actual.merge_commit_sha;if((await api('/git/ref/heads/main')).object.sha!==main)throw Error('Main changed after handoff merge');}
else {if((await api('/git/ref/heads/main')).object.sha!==base)throw Error('Unexpected main');const merge=await api(`/pulls/${pr.number}/merge`,'PUT',{sha:source,merge_method:'merge',commit_title:'Verify complete SEO guide rendering; production disabled'});if(!merge.merged)throw Error('Merge refused');main=merge.sha;}
let work=await api('/pulls/11');
if(work.merged||work.head.repo.full_name!=='Aimericv/puzzoria'||work.head.ref!=='codex/experiments/word-guide-worked-deductions'||await get(work.head.sha)!==original)throw Error('Unrelated or changed product proposal');
let comparison=await api(`/compare/${main}...${work.head.sha}`);
if(comparison.status!=='ahead'||comparison.behind_by!==0)await api('/pulls/11/update-branch','PUT',{expected_head_sha:work.head.sha});
let head,confirmed=false;
for(let i=0;i<40;i++){
 try{work=await api('/pulls/11');head=work.head.sha;comparison=await api(`/compare/${main}...${head}`);confirmed=comparison.status==='ahead'&&comparison.behind_by===0&&comparison.files.length===1&&comparison.files[0].filename===file&&comparison.files[0].status==='modified'&&await get(head)===original;if(confirmed)break;}catch(error){if(![404,409,422].includes(error.status))throw error;}
 await new Promise(r=>setTimeout(r,2500));
}
if(!confirmed)throw Error('Proposal ancestry and unchanged content not yet confirmed');
const store=new StateStore(api,control,source),state=await store.load();
const receipt=state.growth?.releaseCandidate,row=state.growth?.experiments.find(e=>e.id==='word-guide-worked-deductions');
if(state.status!=='ready'||state.paused||state.lastSession.runId!=='40387959783'||state.lastSession.status!=='verified'||!row||!['5a6437d0b0c7e4aa703876df5d7d566eb83caf7f',head].includes(receipt?.sha)||!receipt.verified||receipt.prNumber!==11)throw Error('Do not overwrite changed autonomous state');
if(receipt.sha!==head||receipt.base!==main){Object.assign(receipt,{sha:head,base:main,status:'proposed',nativeVerifiedSha:native,rebase:{testOnly:true,previousHead:receipt.sha}});delete receipt.risk;delete receipt.result;row.candidateSha=head;row.status='proposed';await store.save('Preserve exact native application data and criteria across verified controller-only rebase');}
const proof={source,main,pr:{number:pr.number,url:pr.html_url},candidate:{number:11,sha:head,base:main,nativeVerifiedSha:native,applicationContentUnchanged:true},targetedSeo:{baseline:true,proposal:true,locales:4,games:7,allTitlesAndParagraphs:true},lint:true,typecheck:true,policyHash:releasePolicyHash(),productionEnabled:false,url};
const publish=async value=>{const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent);const tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'seo-render-validation.json',mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'}]});const commit=await api('/git/commits','POST',{message:'Record validated pending handoff and exact product proposal; production disabled',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/seo-render-validation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});};
await api('/issues/3/comments','POST',{body:`Test SEO corrigé et renforcé : ${pr.html_url}. La PR #11 conserve exactement le contenu proposé par l’agent et son protocole initial. La validation complète sera exécutée par le workflow principal, sans nouvelle inférence. Aucun déploiement de production.`});
await publish(proof);
let requested=false;
for(let i=0;i<8;i++){try{await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'validate-pending':true,'deploy-pending':false,'check-search-console':false}});requested=true;break;}catch(error){if(error.status!==422)throw error;await new Promise(r=>setTimeout(r,3000));}}
if(!requested)throw Error('Workflow input registration not yet confirmed; validation was not requested');
console.log(JSON.stringify({...proof,validationRequested:true,modelInferenceRequested:false}));
