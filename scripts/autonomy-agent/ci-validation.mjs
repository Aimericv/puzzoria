import {execFileSync,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {inflateRawSync} from 'node:zlib';
import {github} from '../autonomy-pilot/github.mjs';
import {campaignAlternate,campaignBase} from './ci51-campaign.mjs';

const repository='Aimericv/puzzoria';
const sha=value=>/^[a-f0-9]{40}$/.test(value??'');
const receiptLimit=8192;
export const browserJobs=['desktop','mobile','android','iphone-webkit'].map(name=>`E2E (${name})`);

function requireSuccessfulJobs(rows, runId, names) {
  if (!Array.isArray(rows.jobs) || rows.total_count !== rows.jobs.length || rows.jobs.length >= 100) {
    throw Error('Incomplete final job evidence');
  }
  for (const name of names) {
    const jobs = rows.jobs.filter(job => job.name === name);
    if (jobs.length !== 1 || String(jobs[0].run_id) !== String(runId) || jobs[0].status !== 'completed' || jobs[0].conclusion !== 'success') {
      throw Error('Required final job did not pass: ' + name);
    }
  }
}

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
  if(!pr||!Number.isSafeInteger(pr.number)||pr.number<1||pr.draft!==false||pr.head?.repo?.full_name!==repository||![campaignBase,campaignAlternate].includes(pr.base?.ref)||!sha(pr.head.sha)||!sha(pr.base.sha)||!sha(merge)||!/^\d+$/.test(String(runId))||!Number.isSafeInteger(attempt)||attempt<1)throw Error('Pinned final PR validation is required');
  const matches=(current,tip)=>current.state==='open'&&current.draft===false&&current.head?.sha===pr.head.sha&&current.head?.repo?.full_name===repository&&current.base?.ref===pr.base.ref&&current.base?.sha===pr.base.sha&&current.merge_commit_sha===merge&&tip.object?.sha===pr.base.sha;
  if(!matches(await api(`/pulls/${pr.number}`),await api(`/git/ref/heads/${pr.base.ref}`)))throw Error('PR head, base or review state changed; final validation is stale');
  const run=await api(`/actions/runs/${runId}`),commit=await api(`/git/commits/${merge}`);
  if(run.event!=='pull_request'||run.path!=='.github/workflows/ci.yml'||run.head_sha!==pr.head.sha||run.run_attempt!==attempt||run.repository?.full_name!==repository||commit.sha!==merge||!sha(commit.tree?.sha)||JSON.stringify(commit.parents?.map(p=>p.sha))!==JSON.stringify([pr.base.sha,pr.head.sha]))throw Error('Final run or tested merge provenance mismatch');
  const rows=await api(`/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`);
  requireSuccessfulJobs(rows, runId, ['budget', 'checks', ...browserJobs]);
  if(!matches(await api(`/pulls/${pr.number}`),await api(`/git/ref/heads/${pr.base.ref}`)))throw Error('PR changed while final evidence was collected');
  return {schemaVersion:1,repository,pr:pr.number,mode:'final',run:String(runId),attempt,head:pr.head.sha,base:pr.base.sha,merge,tree:commit.tree.sha,eligibleForMerge:true};
}

// The upload action archives a single, small JSON. Read it in memory, never
// extract paths, and use the central directory for data-descriptor ZIP entries.
function parseReceipt(zip) {
  const invalid=()=>Error('Invalid final validation receipt ZIP');
  const end=zip.length-22;
  if(end<0||zip.readUInt32LE(end)!==0x06054b50||zip.readUInt16LE(end+4)!==0||zip.readUInt16LE(end+6)!==0||
     zip.readUInt16LE(end+8)!==1||zip.readUInt16LE(end+10)!==1||zip.readUInt16LE(end+20)!==0)throw invalid();
  const directory=zip.readUInt32LE(end+16);
  if(directory+46>end||directory+zip.readUInt32LE(end+12)!==end||zip.readUInt32LE(directory)!==0x02014b50)throw invalid();
  const nameLength=zip.readUInt16LE(directory+28),name=Buffer.from('final.json');
  if(nameLength!==name.length||directory+46+nameLength+zip.readUInt16LE(directory+30)+zip.readUInt16LE(directory+32)!==end||
     !zip.subarray(directory+46,directory+46+nameLength).equals(name)||zip.readUInt32LE(directory+42)!==0)throw invalid();
  const flags=zip.readUInt16LE(directory+8),method=zip.readUInt16LE(directory+10);
  if(directory<30+name.length||zip.readUInt32LE(0)!==0x04034b50||(flags&1)!==0||zip.readUInt16LE(6)!==flags||
     zip.readUInt16LE(8)!==method||zip.readUInt16LE(26)!==nameLength||!zip.subarray(30,30+nameLength).equals(name))throw invalid();
  const size=zip.readUInt32LE(directory+24),compressedSize=zip.readUInt32LE(directory+20);
  const start=30+nameLength+zip.readUInt16LE(28);
  if(size<1||size>receiptLimit||compressedSize<1||start+compressedSize>directory||(method!==0&&method!==8))throw invalid();
  const compressed=zip.subarray(start,start+compressedSize);
  const bytes=method===8?inflateRawSync(compressed,{maxOutputLength:receiptLimit}):compressed;
  if(bytes.length!==size)throw invalid();
  return JSON.parse(bytes.toString('utf8'));
}

// Operator check before an application merge. GitHub treats skipped checks as passing.
// Use the receipt from the successful attempt as the source of the tested commits.
export async function verifyFinalRun(api, prNumber, runId, download) {
  if (!/^[1-9]\d*$/.test(String(prNumber)) || !/^[1-9]\d*$/.test(String(runId))) throw Error('PR and run numbers required');
  const pr = await api(`/pulls/${prNumber}`);
  if (pr.state !== 'open' || pr.draft !== false) throw Error('An open PR ready for review is required');
  const run = await api(`/actions/runs/${runId}`);
  const completed = value => value.status === 'completed' && value.conclusion === 'success' && value.run_attempt === run.run_attempt;
  if (!completed(run) || !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
    throw Error('No successful final run for the current PR and base');
  }
  requireSuccessfulJobs(await api(`/actions/runs/${runId}/attempts/${run.run_attempt}/jobs?per_page=100`), runId, ['Final validation']);
  const name=`ci-final-evidence-${runId}-${run.run_attempt}`;
  const artifacts=await api(`/actions/runs/${runId}/artifacts?name=${name}&per_page=100`);
  const artifact=artifacts.artifacts?.[0];
  if(artifacts.total_count!==1||artifacts.artifacts?.length!==1||artifact?.name!==name||artifact.expired!==false||
     !Number.isSafeInteger(artifact.id)||artifact.id<1||!Number.isSafeInteger(artifact.size_in_bytes)||artifact.size_in_bytes<1||
     artifact.size_in_bytes>receiptLimit||!/^sha256:[a-f0-9]{64}$/.test(artifact.digest??'')||
     String(artifact.workflow_run?.id)!==String(runId)||artifact.workflow_run?.head_sha!==run.head_sha)throw Error('Missing, expired or invalid final validation artifact');
  const zip=await download(artifact.id);
  if(!Buffer.isBuffer(zip)||zip.length!==artifact.size_in_bytes||`sha256:${createHash('sha256').update(zip).digest('hex')}`!==artifact.digest)throw Error('Final validation artifact digest mismatch');
  const receipt=parseReceipt(zip);
  if(receipt?.schemaVersion!==1||receipt.repository!==repository||receipt.pr!==Number(prNumber)||receipt.mode!=='final'||
     receipt.run!==String(runId)||receipt.attempt!==run.run_attempt||receipt.eligibleForMerge!==true||!sha(receipt.tree)||
     receipt.head!==pr.head?.sha||receipt.base!==pr.base?.sha||!sha(receipt.merge)||receipt.merge!==pr.merge_commit_sha)throw Error('Final validation receipt does not cover the current PR, base and merge');
  const tested=await assertFinalCI(api,{event:{pull_request:pr},runId,attempt:receipt.attempt,merge:receipt.merge,mode:'final'});
  if(receipt.tree!==tested.tree)throw Error('Final validation receipt tree differs from the tested Git tree');
  if(!completed(await api(`/actions/runs/${runId}`)))throw Error('Final run changed while checking its receipt');
  return tested;
}

export async function main(mode=process.argv[2],env=process.env) {
  if (mode === 'verify') {
    const api = async path => JSON.parse(execFileSync('gh', ['api', `repos/${repository}${path}`], { encoding: 'utf8' }));
    const download = id => execFileSync('gh',['api',`repos/${repository}/actions/artifacts/${id}/zip`],{maxBuffer:receiptLimit});
    console.log(JSON.stringify(await verifyFinalRun(api, process.argv[3], process.argv[4], download)));
    return 0;
  }
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
