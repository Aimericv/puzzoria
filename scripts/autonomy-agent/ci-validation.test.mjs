import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {deflateRawSync} from 'node:zlib';
import {relatedUnitFiles,runDevelopmentUnits,assertFinalCI,verifyFinalRun,browserJobs} from './ci-validation.mjs';
import {changedCI} from './actions-budget-runtime.mjs';
import {allocation,assertGrant,browserTimeouts,emptyUsage,reserveAllocation} from './actions-budget.mjs';
import {campaignBase} from './ci51-campaign.mjs';
const baseRef=`/git/ref/heads/${campaignBase}`;

test('development selection widens shared, sensitive, configuration and unknown changes',()=>{
  assert.deepEqual(relatedUnitFiles(['src/components/football-profile-page.tsx','tests/seo.test.ts']),['src/components/football-profile-page.tsx','tests/seo.test.ts']);
  for(const path of ['src/lib/server/database.ts','src/app/api/runs/route.ts','src/lib/types.ts','src/app/layout.tsx','package-lock.json','next.config.ts','new-file','e2e/smoke.spec.ts','public/icon.svg'])assert.equal(relatedUnitFiles([path]),null,path);
  for(const path of ['../secret','src/../secret','-run','src/a\n.ts','src\\secret.ts'])assert.throws(()=>relatedUnitFiles([path]));
});

test('an empty related set falls back to real full unit tests, and failures cannot be masked',()=>{
  const commands=[],results=[{success:true,numPassedTests:0,numFailedTests:0,numPendingTests:0},{success:true,numPassedTests:410,numFailedTests:0,numPendingTests:0}];let receipt;
  assert.equal(runDevelopmentUnits(['src/lib/date.ts'],{run:args=>{commands.push(args);return 0;},read:()=>results.shift(),record:r=>receipt=r}),0);
  assert.equal(commands[0][0],'related');assert.ok(commands[0].includes('--run'));assert.equal(commands[1][0],'run');
  assert.equal(receipt.unitScope,'full-fallback');assert.equal(receipt.eligibleForMerge,false);
  let called=0;assert.equal(runDevelopmentUnits(['src/lib/date.ts'],{run:()=>{called++;return 1;},read:()=>assert.fail('Failed run must not fall back'),record:()=>assert.fail()}),1);assert.equal(called,1);
  for(const data of [{success:true,numPassedTests:0,numFailedTests:0,numPendingTests:0},{success:true,numPassedTests:1,numFailedTests:0,numPendingTests:1},{success:false,numPassedTests:1,numFailedTests:0,numPendingTests:0}])assert.throws(()=>runDevelopmentUnits(['package.json'],{run:()=>0,read:()=>data,record:()=>assert.fail()}),/actual passing/);
  assert.throws(()=>runDevelopmentUnits(['src/lib/date.ts'],{run:()=>0,read:()=>{throw Error('Missing report');}}),/Missing report/);
  called=0;
  assert.throws(()=>runDevelopmentUnits(['src/lib/date.ts'],{run:()=>{called++;return 0;},read:()=>({success:false,numPassedTests:0,numFailedTests:0,numPendingTests:0}),record:()=>assert.fail()}),/actual passing/);
  assert.equal(called,1);
});

function finalFixture() {
  const head='a'.repeat(40),base='b'.repeat(40),merge='c'.repeat(40),tree='e'.repeat(40);
  const pr={number:5,state:'open',draft:false,merge_commit_sha:merge,head:{sha:head,repo:{full_name:'Aimericv/puzzoria'}},base:{ref:campaignBase,sha:base}};
  const rows={
    '/pulls/5':pr,[baseRef]:{object:{sha:base}},
    '/actions/runs/100':{event:'pull_request',path:'.github/workflows/ci.yml',head_sha:head,run_attempt:2,repository:{full_name:'Aimericv/puzzoria'}},
    ['/git/commits/'+merge]:{sha:merge,tree:{sha:tree},parents:[{sha:base},{sha:head}]},
    '/actions/runs/100/attempts/2/jobs?per_page=100':{total_count:6,jobs:['budget','checks',...browserJobs].map(name=>({name,run_id:100,status:'completed',conclusion:'success'}))},
  };
  const options={event:{pull_request:structuredClone(pr)},runId:'100',attempt:2,merge,mode:'final'};
  const api=async(path,method='GET')=>{assert.equal(method,'GET');assert.ok(Object.hasOwn(rows,path),path);return rows[path];};
  return {rows,api,options};
}

test('final evidence requires one exact head/base/merge and every browser in this same attempt',async()=>{
  const f=finalFixture(),r=await assertFinalCI(f.api,f.options);
  assert.deepEqual(r,{schemaVersion:1,repository:'Aimericv/puzzoria',pr:5,mode:'final',run:'100',attempt:2,head:'a'.repeat(40),base:'b'.repeat(40),merge:'c'.repeat(40),tree:'e'.repeat(40),eligibleForMerge:true});
  const mutations=[
    f=>f.options.mode='development',f=>f.options.event.pull_request.draft=true,
    f=>f.rows['/pulls/5'].draft=true,f=>f.rows['/pulls/5'].state='closed',
    f=>f.rows['/pulls/5'].head.sha='d'.repeat(40),f=>f.rows['/pulls/5'].base.sha='d'.repeat(40),
    f=>f.rows['/pulls/5'].merge_commit_sha='d'.repeat(40),
    f=>f.rows[baseRef].object.sha='d'.repeat(40),
    f=>f.rows['/actions/runs/100'].head_sha='d'.repeat(40),f=>f.rows['/actions/runs/100'].run_attempt=1,
    f=>f.rows['/actions/runs/100'].event='workflow_dispatch',f=>f.rows['/actions/runs/100'].path='other.yml',
    f=>f.rows['/actions/runs/100'].repository.full_name='other/project',
    f=>f.rows['/git/commits/'+f.options.merge].parents.reverse(),
    f=>f.rows['/git/commits/'+f.options.merge].tree.sha=null,
    f=>f.rows['/actions/runs/100/attempts/2/jobs?per_page=100'].total_count=101,
    f=>f.rows['/actions/runs/100/attempts/2/jobs?per_page=100'].jobs.pop(),
    f=>f.rows['/actions/runs/100/attempts/2/jobs?per_page=100'].jobs[2].run_id=99,
  ];
  for(const mutate of mutations){const bad=finalFixture();mutate(bad);await assert.rejects(assertFinalCI(bad.api,bad.options));}
  for(const conclusion of ['failure','skipped','cancelled',null]){const bad=finalFixture();bad.rows['/actions/runs/100/attempts/2/jobs?per_page=100'].jobs[2].conclusion=conclusion;await assert.rejects(assertFinalCI(bad.api,bad.options),/did not pass/);}
  const raced=finalFixture();let reads=0;
  await assert.rejects(assertFinalCI(async path=>{if(path==='/pulls/5'&&++reads===2)raced.rows[path].head.sha='d'.repeat(40);return raced.api(path);},raced.options),/while final evidence/);
});

test('workflow preserves guards and runs four browsers only for final application checks',()=>{
  const text=readFileSync('.github/workflows/ci.yml','utf8');
  assert.match(text,/ready_for_review, converted_to_draft/);assert.doesNotMatch(text,/pull_request_target|workflow_dispatch|continue-on-error|secrets\./);
  assert.match(text,/mode != 'development'/);assert.match(text,/ci-validation\.mjs development/);
  const final=text.slice(text.indexOf('\n  final:'));
  assert.match(final,/if: always\(\)/);assert.match(final,/ref: \$\{\{ github.event.pull_request.base.sha \}\}/);
  assert.match(final,/actions-budget-run\.mjs assert/);assert.match(final,/PUZZORIA_BUDGET_JOB: Final validation/);
  assert.match(final,/ci-validation\.mjs final/);assert.match(final,/if-no-files-found: error/);
  assert.match(final,/name: ci-final-evidence-\$\{\{ github.run_id \}\}-\$\{\{ github.run_attempt \}\}/);
  assert.doesNotMatch(final,/overwrite:/);
  assert.doesNotMatch(final,/contents: write|actions: write/);
  for(const project of ['desktop','mobile','android','iphone-webkit'])assert.match(text,new RegExp('project: '+project));
  assert.match(text,/npm run build/);assert.match(text,/npm run seo:check/);assert.match(text,/node --test --test-isolation=none/);
});

test('WebKit uses the pinned release browser image and the workflow matches the protected timeouts',()=>{
  const workflow=readFileSync('.github/workflows/ci.yml','utf8');
  const e2e=workflow.slice(workflow.indexOf('\n  e2e:'),workflow.indexOf('\n  final:'));
  const image=readFileSync('.github/containers/release-verifier.Dockerfile','utf8').match(/^FROM (mcr\.microsoft\.com\/playwright:[^\s]+)$/m)?.[1];
  assert.match(image,/^mcr\.microsoft\.com\/playwright:v[\d.]+-noble@sha256:[a-f0-9]{64}$/);
  const lock=JSON.parse(readFileSync('package-lock.json','utf8'));
  assert.ok(image.includes(`:v${lock.packages['node_modules/@playwright/test'].version}-noble@`));
  assert.ok(e2e.includes(`WEBKIT_IMAGE: ${image}`));
  assert.match(e2e,/timeout-minutes: \$\{\{ matrix.timeout \}\}/);
  assert.match(e2e,/PUZZORIA_JOB_TIMEOUT: \$\{\{ matrix.timeout \}\}/);
  assert.match(e2e,/matrix.browser == 'chromium'\n\s+run: npx playwright install --with-deps chromium/);
  assert.match(e2e,/docker pull "\$WEBKIT_IMAGE"/);
  assert.match(e2e,/--project=iphone-webkit --reporter=line,json/);
  assert.match(e2e,/ref: \$\{\{ github.sha \}\}/);
  for(const [job,minutes] of Object.entries(browserTimeouts)){
    const project=job.slice(5,-1);
    assert.match(e2e,new RegExp(`project: ${project}\\s+browser: \\w+\\s+timeout: ${minutes}\\b`));
  }
});

test('draft to review to draft requires a fresh final reservation and rejects stale evidence', async () => {
  const { rows, api, options } = finalFixture();
  const live = rows['/pulls/5'];
  const budgetApi = path => path.startsWith('/pulls/5/files?')
    ? [{ filename: 'src/components/example.tsx' }]
    : api(path);
  const event = action => ({ action, pull_request: structuredClone(live) });
  const now = Date.parse('2026-11-18T12:00:00Z');
  const usage = emptyUsage(now);
  const admit = async (payload, run) => {
    const context = await changedCI(budgetApi, payload);
    const plan = allocation(usage, { kind: 'ci', ...context, now });
    assert.equal(plan.allowed, true);
    reserveAllocation(usage, plan, run, 2, now);
    return context.mode;
  };

  live.draft = true;
  const opened = event('opened');
  assert.equal(await admit(opened, '99'), 'development');
  assert.throws(() => assertGrant(usage, { run: '99', attempt: 2, job: browserJobs[0], minutes: 30, now }));
  await assert.rejects(assertFinalCI(api, { ...options, event: opened, mode: 'development' }), /Development validation only/);

  live.draft = false;
  const ready = event('ready_for_review');
  await assert.rejects(changedCI(budgetApi, opened), /changed/);
  assert.equal(await admit(ready, '100'), 'final');
  for (const job of browserJobs) assert.equal(assertGrant(usage, { run: '100', attempt: 2, job, minutes: browserTimeouts[job], now }), browserTimeouts[job]);
  const lastBrowser = rows['/actions/runs/100/attempts/2/jobs?per_page=100'].jobs.at(-1);
  lastBrowser.status = 'in_progress';
  lastBrowser.conclusion = null;
  await assert.rejects(assertFinalCI(api, { ...options, event: ready }), /Required final job did not pass/);
  lastBrowser.status = 'completed';
  lastBrowser.conclusion = 'success';
  assert.equal((await assertFinalCI(api, { ...options, event: ready })).eligibleForMerge, true);

  live.draft = true;
  const converted = event('converted_to_draft');
  assert.equal(await admit(converted, '101'), 'development');
  await assert.rejects(changedCI(budgetApi, ready), /changed/);
  await assert.rejects(assertFinalCI(api, { ...options, event: ready }), /stale/);
});

// Same single-entry ZIP layout as upload-artifact, including the deflate data descriptor.
function receiptZip(receipt,filename='final.json') {
  const name=Buffer.from(filename),bytes=Buffer.from(JSON.stringify(receipt)),deflated=deflateRawSync(bytes);
  const local=Buffer.alloc(30),descriptor=Buffer.alloc(16),directory=Buffer.alloc(46),end=Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);local.writeUInt16LE(8,6);local.writeUInt16LE(8,8);local.writeUInt16LE(name.length,26);
  descriptor.writeUInt32LE(0x08074b50);descriptor.writeUInt32LE(deflated.length,8);descriptor.writeUInt32LE(bytes.length,12);
  directory.writeUInt32LE(0x02014b50);directory.writeUInt16LE(8,8);directory.writeUInt16LE(8,10);
  directory.writeUInt32LE(deflated.length,20);directory.writeUInt32LE(bytes.length,24);directory.writeUInt16LE(name.length,28);
  end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
  end.writeUInt32LE(directory.length+name.length,12);end.writeUInt32LE(local.length+name.length+deflated.length+descriptor.length,16);
  return Buffer.concat([local,name,deflated,descriptor,directory,name,end]);
}

async function operatorFixture() {
  const f=finalFixture(),{rows,api,options}=f,pr=rows['/pulls/5'];
  const receipt=await assertFinalCI(api,options);
  const run = rows['/actions/runs/100'];
  Object.assign(run, { status: 'completed', conclusion: 'success', pull_requests: [structuredClone(pr)] });
  const jobs=rows['/actions/runs/100/attempts/2/jobs?per_page=100'];
  const final={name:'Final validation',run_id:100,status:'completed',conclusion:'success'};
  jobs.jobs.push(final);
  jobs.total_count++;
  const artifact={id:85,name:'ci-final-evidence-100-2',expired:false,workflow_run:{id:100,head_sha:pr.head.sha}};
  const artifacts={total_count:1,artifacts:[artifact]};
  rows['/actions/runs/100/artifacts?name=ci-final-evidence-100-2&per_page=100']=artifacts;
  let zip;
  const setZip=(data,filename)=>{
    zip=receiptZip(data,filename);
    artifact.size_in_bytes=zip.length;
    artifact.digest=`sha256:${createHash('sha256').update(zip).digest('hex')}`;
  };
  setZip(receipt);
  const verify=(download=async id=>{assert.equal(id,85);return zip;})=>verifyFinalRun(api,5,100,download);
  return {...f,pr,run,receipt,jobs,final,artifact,artifacts,setZip,verify};
}

test('operator requires a successful final job and all browser jobs from the receipt attempt',async()=>{
  const f=await operatorFixture();
  assert.deepEqual(await f.verify(),f.receipt);
  for(const conclusion of ['skipped','failure','cancelled',null]){
    f.final.conclusion=conclusion;
    await assert.rejects(f.verify(),/Final validation/);
  }
  f.final.conclusion='success';
  f.jobs.jobs.find(job=>job.name==='E2E (iphone-webkit)').status='in_progress';
  await assert.rejects(f.verify(),/E2E \(iphone-webkit\)/);
  f.pr.draft=true;
  await assert.rejects(f.verify(),/open PR ready for review/);
});

test('rewritten run association cannot authorize an untested base or merge',async()=>{
  const f=await operatorFixture();
  const base='d'.repeat(40),merge='f'.repeat(40);
  f.pr.base.sha=base;
  f.pr.merge_commit_sha=merge;
  f.rows[baseRef].object.sha=base;
  f.rows['/git/commits/'+merge]={sha:merge,tree:{sha:'9'.repeat(40)},parents:[{sha:base},{sha:f.pr.head.sha}]};
  f.run.pull_requests=[structuredClone(f.pr)]; // GitHub rewrites this on retarget.
  // The old verifier could construct fresh passing evidence out of those mutable values.
  const newest=await assertFinalCI(f.api,{...f.options,merge,event:{pull_request:f.pr}});
  assert.equal(newest.eligibleForMerge,true);
  await assert.rejects(f.verify(),/receipt does not cover the current PR, base and merge/);
});

test('operator rejects missing, expired, changed and mismatched receipt archives',async()=>{
  const cases=[
    [f=>{f.artifacts.total_count=0;f.artifacts.artifacts=[];},/Missing, expired or invalid/],
    [f=>{f.artifacts.total_count=2;},/Missing, expired or invalid/],
    [f=>{f.artifact.expired=true;},/Missing, expired or invalid/],
    [f=>{f.artifact.name='ci-final-evidence-100-1';},/Missing, expired or invalid/],
    [f=>{f.artifact.workflow_run.id=99;},/Missing, expired or invalid/],
    [f=>{f.artifact.digest='sha256:'+'0'.repeat(64);},/digest mismatch/],
    [f=>f.setZip(f.receipt,'../final.json'),/Invalid final validation receipt ZIP/],
    [f=>f.setZip({...f.receipt,attempt:1}),/receipt does not cover/],
    [f=>f.setZip({...f.receipt,pr:6}),/receipt does not cover/],
    [f=>f.setZip({...f.receipt,tree:'9'.repeat(40)}),/tree differs/],
  ];
  for(const [mutate,message] of cases){
    const f=await operatorFixture();
    mutate(f);
    await assert.rejects(f.verify(),message);
  }
  const f=await operatorFixture();
  const previous=f.api;
  let reads=0;
  const api=async path=>{
    const result=await previous(path);
    return path==='/actions/runs/100'&&++reads===3?{...result,run_attempt:3}:result;
  };
  await assert.rejects(verifyFinalRun(api,5,100,async()=>receiptZip(f.receipt)),/changed while checking/);
});
