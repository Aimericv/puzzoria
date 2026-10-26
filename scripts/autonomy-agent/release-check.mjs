import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {github} from '../autonomy-pilot/github.mjs';
import {StateStore} from './store.mjs';
import {assertFunding,REPOSITORY} from './policy.mjs';
import {classifyRelease} from './release-policy.mjs';
import {mergeSafeCandidate} from './release-controller.mjs';
import {validateRelease} from './release-validation.mjs';

const mode=process.argv[2],control=JSON.parse(readFileSync('agent/autonomy/control.json','utf8'));assertFunding(control);
if(process.env.GITHUB_REPOSITORY!==REPOSITORY)throw Error('Unexpected repository');
const api=github(process.env.GITHUB_TOKEN,REPOSITORY),store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
const output=(key,value)=>{if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`,{flag:'a'});};
const get=async(path,ref)=>{const file=await api(`/contents/${path}?ref=${ref}`);if(file.encoding!=='base64'||file.size>262144)throw Error('Unexpected candidate file');return Buffer.from(file.content,'base64').toString('utf8');};
async function load(receipt) {
 const comparison=await api(`/compare/${receipt.base}...${receipt.sha}`);
 if(comparison.status!=='ahead'||comparison.behind_by!==0||!comparison.files?.length||comparison.files.length>=300)throw Error('Candidate is not isolated from the expected main');
 const tree=await api(`/git/trees/${receipt.sha}?recursive=1`);if(tree.truncated)throw Error('Candidate tree is truncated');
 const files=[];
 for(const row of comparison.files) {
  const entry=tree.tree.find(entry=>entry.path===row.filename);
  const eligible=/^(src\/lib\/(?:seo-content|rare-word-seo|new-games-seo|social-seo)\.ts|docs\/[a-zA-Z0-9/_-]+\.md)$/.test(row.filename);
  files.push({path:row.filename,mode:entry?.mode??'deleted',deleted:row.status==='removed',after:eligible&&entry?.mode==='100644'?await get(row.filename,receipt.sha):'',before:eligible&&row.status!=='added'?await get(row.filename,receipt.base):undefined});
 }
 return files;
}
if(mode==='prepare') {
 output('eligible','false');const receipt=state.growth?.releaseCandidate;
 if(!receipt||control.release?.safeMergeEnabled!==true||process.env.PUZZORIA_AGENT_ENABLED!=='true')process.exit(0);
 if(!/^[a-f0-9]{40}$/.test(receipt.sha)||!/^\d+$/.test(String(receipt.prNumber)))throw Error('Invalid trusted receipt');
 const main=(await api('/git/ref/heads/main')).object.sha;
 const experiment=state.growth.experiments.find(row=>row.id===receipt.experimentId);
 if(main!==receipt.base){receipt.status='stale_main';await store.save('Preserve a proposal whose main changed; no automatic rebase');process.exit(0);}
 const files=await load(receipt),risk=classifyRelease(files);receipt.risk=risk;
 if(risk.risk!=='low'){receipt.status='manual_review';experiment.status='manual_review';await store.save('Require owner review for non-editorial or sensitive changes');await api('/issues/3/comments','POST',{body:`[Expérience ${experiment.id}](${experiment.prUrl}) : revue humaine requise (${risk.reason}). Aucun déploiement automatique.`});process.exit(0);}
 const now=Date.now();state.releaseValidationHistory=(state.releaseValidationHistory??[]).filter(row=>now-Date.parse(row.at)<7*86400000);
 if(state.releaseValidationHistory.reduce((sum,row)=>sum+row.minutes,0)+control.release.maximumValidationMinutes>control.release.validationBudgetMinutes7d){receipt.status='waiting_validation_budget';await store.save('Wait within the free validation-minute allowance');process.exit(0);}
 state.releaseValidationHistory.push({at:new Date(now).toISOString(),runId:process.env.GITHUB_RUN_ID,sha:receipt.sha,minutes:control.release.maximumValidationMinutes});
 receipt.status='validating';await store.save('Reserve bounded validation time before allocating the full release verifier');
 mkdirSync('.release',{recursive:true});writeFileSync('.release/request.json',JSON.stringify({...receipt,risk},null,2)+'\n');output('eligible','true');output('head',receipt.sha);output('base',receipt.base);output('kind',risk.kind);
} else if(mode==='validate') {
 const receipt=JSON.parse(readFileSync('.release/request.json','utf8'));
 const commit=await api(`/git/commits/${receipt.sha}`);
 if(receipt.risk.kind==='documentation'){mkdirSync('.release',{recursive:true});writeFileSync('.release/proof.json',JSON.stringify({head:receipt.sha,base:receipt.base,tree:commit.tree.sha,status:'passed',documentationOnly:true})+'\n');}
 else validateRelease({head:receipt.sha,base:receipt.base,tree:commit.tree.sha});
} else if(mode==='finalize') {
 const receipt=JSON.parse(readFileSync('.release/request.json','utf8')),record=state.growth?.releaseCandidate;
 output('deploy','false');if(!record||record.sha!==receipt.sha)throw Error('The release receipt changed');
 if(!existsSync('.release/proof.json')){record.status='validation_failed';await store.save('No automatic merge without complete validation');process.exit(0);}
 const validation=JSON.parse(readFileSync('.release/proof.json','utf8'));
 if(validation.status!=='passed'){record.status='validation_failed';await store.save('Validation failed; preserve the proposal without merging');process.exit(0);}
 const result=await mergeSafeCandidate({api,receipt,validation,files:await load(receipt),policy:control.release,agentEnabled:process.env.PUZZORIA_AGENT_ENABLED});
 record.status=result.status;record.result=result;
 const experiment=state.growth.experiments.find(row=>row.id===receipt.experimentId);experiment.status=result.status;
 if(result.status==='merged'){experiment.mergeSha=result.sha;record.mergeSha=result.sha;record.status=result.risk.requiresDeployment?'awaiting_activation':'merged_documentation';output('deploy',String(result.risk.requiresDeployment));output('sha',result.sha);output('candidate',receipt.sha);}
 await store.save('Record exact tested merge result without assuming a production rollout');
 await api('/issues/3/comments','POST',{body:`[Expérience ${experiment.id}](${experiment.prUrl}) : ${record.status}. ${result.status==='merged'?'Fusion limitée au contenu classé à faible risque après validation indépendante.':'Aucune fusion automatique effectuée.'} Aucun effet en production n'est attribué sans confirmation du déploiement.`});
} else throw Error('Use prepare, validate or finalize');
