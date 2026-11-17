import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {github} from '../autonomy-pilot/github.mjs';

const sha=value=>/^[a-f0-9]{40}$/.test(value??'');
export const browserJobs=['desktop','mobile','android','iphone-webkit'].map(name=>`E2E (${name})`);

export function relatedUnitFiles(files) {
  if(!Array.isArray(files)||files.length>3000||files.some(p=>typeof p!=='string'||p.length>1024||/[\r\n\0\\]/.test(p)||p.startsWith('-')||p.split('/').some(part=>part==='..'||part==='.'||!part)))throw Error('Invalid changed paths');
  // Shared/server/configuration changes and unknown files retain all unit tests.
  const known=/^(?:src\/(?:components|lib|app)\/|tests\/.+\.test\.ts$|e2e\/.+\.spec\.ts$|public\/|content\/)/;
  const shared=/^(?:src\/lib\/server\/|src\/app\/api\/|src\/app\/(?:layout|globals)\.|src\/lib\/(?:types|i18n|engine|storage|store|auth|challenges|game-modes)(?:\.|\/))/;
  if(!files.length||files.some(p=>!known.test(p)||shared.test(p)))return null;
  const selected=files.filter(p=>/\.(?:ts|tsx)$/.test(p)&&!p.startsWith('e2e/'));
  return selected.length?selected:null;
}

export function runDevelopmentUnits(files,{run,read,record}={}) {
  mkdirSync('.ci-results',{recursive:true});
  const report='.ci-results/unit.json',selected=relatedUnitFiles(files);
  const common=['--maxWorkers=2','--reporter=json',`--outputFile=${report}`];
  run??=args=>{
    rmSync(report,{force:true}); // One known report, never a directory or database.
    const result=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs',...args],{stdio:'inherit'});
    if(result.error)throw result.error;
    return result.status??1;
  };
  read??=()=>JSON.parse(readFileSync(report,'utf8'));
  record??=value=>writeFileSync('.ci-results/development-selection.json',JSON.stringify(value)+'\n');
  let scope=selected?'related':'full',status=run(selected?['related',...selected.map(p=>'./'+p),'--run','--passWithNoTests',...common]:['run',...common]);
  if(status!==0)return status; // Never replace a failing targeted run with a passing fallback.
  let result=read();
  if(selected&&result.success===true&&result.numPassedTests===0&&result.numFailedTests===0&&result.numPendingTests===0){
    scope='full-fallback';status=run(['run',...common]);if(status!==0)return status;result=read();
  }
  if(result.success!==true||!Number.isSafeInteger(result.numPassedTests)||result.numPassedTests<1||result.numFailedTests!==0||result.numPendingTests!==0)throw Error('Development requires actual passing tests, without failures or skips');
  record({mode:'development',unitScope:scope,relatedFiles:selected?.length??0,passed:result.numPassedTests,eligibleForMerge:false});
  return 0;
}

export async function assertFinalCI(api,{event,runId,attempt,merge,mode}) {
  const pr=event?.pull_request;
  if(mode!=='final')throw Error('Development validation only: mark the PR ready for review to run final validation');
  if(!pr||pr.draft!==false||pr.head?.repo?.full_name!=='Aimericv/puzzoria'||pr.base?.ref!=='main'||!sha(pr.head.sha)||!sha(pr.base.sha)||!sha(merge)||!/^\d+$/.test(String(runId))||!Number.isSafeInteger(attempt)||attempt<1)throw Error('Pinned final PR validation is required');
  const matches=(current,tip)=>current.state==='open'&&current.draft===false&&current.head?.sha===pr.head.sha&&current.head?.repo?.full_name==='Aimericv/puzzoria'&&current.base?.ref==='main'&&current.base?.sha===pr.base.sha&&tip.object?.sha===pr.base.sha;
  if(!matches(await api(`/pulls/${pr.number}`),await api('/git/ref/heads/main')))throw Error('PR head, base or review state changed; final validation is stale');
  const run=await api(`/actions/runs/${runId}`),commit=await api(`/git/commits/${merge}`);
  if(run.event!=='pull_request'||run.path!=='.github/workflows/ci.yml'||run.head_sha!==pr.head.sha||run.run_attempt!==attempt||run.repository?.full_name!=='Aimericv/puzzoria'||JSON.stringify(commit.parents?.map(p=>p.sha))!==JSON.stringify([pr.base.sha,pr.head.sha]))throw Error('Final run or tested merge provenance mismatch');
  const rows=await api(`/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
  if(!Array.isArray(rows.jobs)||rows.total_count!==rows.jobs.length||rows.jobs.length>=100)throw Error('Incomplete final job evidence');
  for(const name of ['budget','checks',...browserJobs]){
    const jobs=rows.jobs.filter(job=>job.name===name);
    if(jobs.length!==1||String(jobs[0].run_id)!==String(runId)||jobs[0].status!=='completed'||jobs[0].conclusion!=='success')throw Error('Required final job did not pass: '+name);
  }
  if(!matches(await api(`/pulls/${pr.number}`),await api('/git/ref/heads/main')))throw Error('PR changed while final evidence was collected');
  return {mode:'final',run:String(runId),attempt,head:pr.head.sha,base:pr.base.sha,merge,eligibleForMerge:true};
}

export async function main(mode=process.argv[2],env=process.env) {
  if(mode==='development'){
    if(!sha(env.PUZZORIA_CI_BASE))throw Error('Pinned CI base required');
    const files=execFileSync('git',['diff','--no-renames','--name-only','-z',`${env.PUZZORIA_CI_BASE}...HEAD`],{encoding:'utf8',maxBuffer:4*1024*1024}).split('\0').filter(Boolean);
    return runDevelopmentUnits(files);
  }
  if(mode!=='final'||env.GITHUB_REPOSITORY!=='Aimericv/puzzoria')throw Error('Fixed Puzzoria final workflow required');
  const result=await assertFinalCI(github(env.GITHUB_TOKEN,'Aimericv/puzzoria'),{event:JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,'utf8')),runId:env.GITHUB_RUN_ID,attempt:Number(env.GITHUB_RUN_ATTEMPT),merge:env.GITHUB_SHA,mode:env.PUZZORIA_CI_MODE});
  mkdirSync('.ci-results',{recursive:true});writeFileSync('.ci-results/final.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));return 0;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{process.exitCode=await main();}catch(error){console.error(error.message);process.exitCode=1;}
}
