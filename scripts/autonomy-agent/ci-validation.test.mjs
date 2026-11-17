import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {relatedUnitFiles,runDevelopmentUnits,assertFinalCI,browserJobs} from './ci-validation.mjs';

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
  const head='a'.repeat(40),base='b'.repeat(40),merge='c'.repeat(40);
  const pr={number:5,state:'open',draft:false,head:{sha:head,repo:{full_name:'Aimericv/puzzoria'}},base:{ref:'main',sha:base}};
  const rows={
    '/pulls/5':pr,'/git/ref/heads/main':{object:{sha:base}},
    '/actions/runs/100':{event:'pull_request',path:'.github/workflows/ci.yml',head_sha:head,run_attempt:2,repository:{full_name:'Aimericv/puzzoria'}},
    ['/git/commits/'+merge]:{parents:[{sha:base},{sha:head}]},
    '/actions/runs/100/attempts/2/jobs?per_page=100':{total_count:6,jobs:['budget','checks',...browserJobs].map(name=>({name,run_id:100,status:'completed',conclusion:'success'}))},
  };
  const options={event:{pull_request:structuredClone(pr)},runId:'100',attempt:2,merge,mode:'final'};
  const api=async(path,method='GET')=>{assert.equal(method,'GET');assert.ok(Object.hasOwn(rows,path),path);return rows[path];};
  return {rows,api,options};
}

test('final evidence requires one exact head/base/merge and every browser in this same attempt',async()=>{
  const f=finalFixture(),r=await assertFinalCI(f.api,f.options);
  assert.equal(r.eligibleForMerge,true);assert.equal(r.attempt,2);
  const mutations=[
    f=>f.options.mode='development',f=>f.options.event.pull_request.draft=true,
    f=>f.rows['/pulls/5'].draft=true,f=>f.rows['/pulls/5'].state='closed',
    f=>f.rows['/pulls/5'].head.sha='d'.repeat(40),f=>f.rows['/pulls/5'].base.sha='d'.repeat(40),
    f=>f.rows['/git/ref/heads/main'].object.sha='d'.repeat(40),
    f=>f.rows['/actions/runs/100'].head_sha='d'.repeat(40),f=>f.rows['/actions/runs/100'].run_attempt=1,
    f=>f.rows['/actions/runs/100'].event='workflow_dispatch',f=>f.rows['/actions/runs/100'].path='other.yml',
    f=>f.rows['/actions/runs/100'].repository.full_name='other/project',
    f=>f.rows['/git/commits/'+f.options.merge].parents.reverse(),
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
  assert.doesNotMatch(final,/contents: write|actions: write/);
  for(const project of ['desktop','mobile','android','iphone-webkit'])assert.match(text,new RegExp('project: '+project));
  assert.match(text,/npm run build/);assert.match(text,/npm run seo:check/);assert.match(text,/node --test --test-isolation=none/);
});
