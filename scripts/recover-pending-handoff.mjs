import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {github} from './autonomy-pilot/github.mjs';
const source='06f2ec582a6dfadc5f15b616f43816f1b784d686',base='87dea5bf013d5d584649efb465660a1d609ccd76',native='3d0c1fa8b2b1d5f45f7d8d3a866acb2ef078b402';
const allowed=['.github/workflows/autonomy-agent.yml','docs/AUTONOMY-GROWTH.fr.md','scripts/autonomy-agent/control.test.mjs','scripts/autonomy-agent/pending-release.mjs','scripts/autonomy-agent/policy.mjs'];
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==source||JSON.stringify(git('diff','--name-only',base,source).split('\n'))!==JSON.stringify(allowed))throw Error('Unexpected source change');
const tap=readFileSync('.ci-results/control.tap','utf8'),count=n=>Number(tap.match(new RegExp(`^# ${n} (\\d+)`,'m'))?.[1]??0);
if(count('tests')!==59||count('pass')!==59||count('fail')!==0)throw Error('59 controls required');
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
await api(`/statuses/${source}`,'POST',{state:'success',context:'autonomy/pending-handoff',description:'59 controls and lint; no app change or model inference; production off',target_url:url});
const prs=await api('/pulls?state=all&head=Aimericv:codex/pending-release-handoff');
let pr=prs[0];
if(!pr)pr=await api('/pulls','POST',{head:'codex/pending-release-handoff',base:'main',title:'Reprendre les validations en attente sans nouvelle inférence',draft:false,body:`La transmission à la CI relit maintenant le reçu vérifié dans la mémoire protégée et transmet un booléen entre les jobs. L’entrée validate-pending permet de reprendre une validation sans consommer le quota du modèle. Pause, commandes de statut, consignes non traitées, état bloqué, authenticité du reçu et base main restent vérifiés.\n\nValidation ciblée : 59 tests du superviseur, lint et classement de la vraie PR #11 ; aucun fichier applicatif modifié. La PR #11 doit ensuite passer sa validation indépendante complète sur son SHA exact. Aucun modèle supplémentaire, aucune modification de quotas ou d’authentification ; production désactivée. [Contrôles](${url}).`});
if(pr.head.sha!==source)throw Error('Handoff PR changed');
let main;
if(pr.merged_at){const actual=await api(`/pulls/${pr.number}`);main=actual.merge_commit_sha;if((await api('/git/ref/heads/main')).object.sha!==main)throw Error('Main changed after handoff merge');}
else {if((await api('/git/ref/heads/main')).object.sha!==base)throw Error('Unexpected main');const merge=await api(`/pulls/${pr.number}/merge`,'PUT',{sha:source,merge_method:'merge',commit_title:'Resume verified pending checks without inference; production disabled'});if(!merge.merged)throw Error('Merge refused');main=merge.sha;}
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
if(state.status!=='ready'||state.paused||state.lastSession.runId!=='40387959783'||state.lastSession.status!=='verified'||!row||![native,head].includes(receipt?.sha)||!receipt.verified||receipt.prNumber!==11)throw Error('Do not overwrite changed autonomous state');
if(receipt.sha!==head||receipt.base!==main){Object.assign(receipt,{sha:head,base:main,status:'proposed',nativeVerifiedSha:native,rebase:{controllerOnly:true,previousHead:native}});delete receipt.risk;delete receipt.result;row.candidateSha=head;row.status='proposed';await store.save('Preserve exact native application data and criteria across verified controller-only rebase');}
const proof={source,main,pr:{number:pr.number,url:pr.html_url},candidate:{number:11,sha:head,base:main,nativeVerifiedSha:native,applicationContentUnchanged:true},tests:59,lint:true,policyHash:releasePolicyHash(),productionEnabled:false,url};
const publish=async value=>{const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent);const tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'pending-handoff-validation.json',mode:'100644',type:'blob',content:JSON.stringify(value,null,2)+'\n'}]});const commit=await api('/git/commits','POST',{message:'Record validated pending handoff and exact product proposal; production disabled',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/pending-handoff-validation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});};
await api('/issues/3/comments','POST',{body:`Reprise du superviseur corrigée : ${pr.html_url}. La PR #11 conserve exactement le contenu proposé par l’agent et son protocole initial. La validation complète sera exécutée par le workflow principal, sans nouvelle inférence. Aucun déploiement de production.`});
await publish(proof);
let requested=false;
for(let i=0;i<8;i++){try{await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'validate-pending':true,'deploy-pending':false,'check-search-console':false}});requested=true;break;}catch(error){if(error.status!==422)throw error;await new Promise(r=>setTimeout(r,3000));}}
if(!requested)throw Error('Workflow input registration not yet confirmed; validation was not requested');
console.log(JSON.stringify({...proof,validationRequested:true,modelInferenceRequested:false}));
