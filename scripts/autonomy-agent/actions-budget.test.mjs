import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {monthWindow,emptyUsage,checkedUsage,chargedMinutes,reservedMinutes,observeJobs,allocation,reserveAllocation,assertGrant,ciScope,ACTIONS_LIMIT,recoveryAllowance} from './actions-budget.mjs';
import {loadUsage,saveUsage,admitUsage,extendUsage,reconcileUsage,resumeWorkflows,suspendWorkflows,changedScope,changedCI,retryDeferredCI,recoverUsage} from './actions-budget-runtime.mjs';
const now=Date.parse('2026-11-01T00:07:00Z');
const run=(id,status='completed',attempt=1)=>({id,run_attempt:attempt,status});
const job=(id,runId,seconds,extra={})=>({id,run_id:runId,status:'completed',conclusion:'success',runner_id:5,labels:['ubuntu-24.04'],started_at:new Date(now).toISOString(),completed_at:new Date(now+seconds*1000).toISOString(),steps:[{name:'work'}],...extra});
function spent(minutes,time=now){const u=emptyUsage(time);if(minutes)u.jobs[1]={run:'1',minutes};return u;}
function fixture(usage=emptyUsage(now)) {
  let head='ledger-0',document=structuredClone(usage),nextDocument,sequence=0;
  const calls=[],runs=[],jobs=new Map(),switches=[...['autonomy-agent.yml','ci.yml','analytics-check.yml','growth-check.yml'].map((n,i)=>({id:i+1,path:'.github/workflows/'+n,state:'disabled_manually'}))];
  const api=async(path,method='GET',body)=>{
    assert.ok(!path.includes('..'),'path must pass the existing GitHub client traversal check');calls.push({path,method,body});
    if(path==='/git/ref/heads/codex/actions-usage')return {object:{sha:head}};
    if(path.startsWith('/contents/agent/operations/'))return {encoding:'base64',size:100,content:Buffer.from(JSON.stringify(document)).toString('base64')};
    if(path.startsWith('/git/commits/')&&method==='GET')return {tree:{sha:'tree'}};
    if(path==='/git/trees'){nextDocument=JSON.parse(body.tree[0].content);return {sha:'next-tree'};}
    if(path==='/git/commits')return {sha:'ledger-'+ ++sequence};
    if(path==='/git/refs/heads/codex/actions-usage'){assert.equal(body.force,false);head=body.sha;document=nextDocument;return {};}
    if(path.startsWith('/actions/runs?'))return {total_count:runs.length,workflow_runs:runs};
    if(/^\/actions\/runs\/\d+\/jobs\?/.test(path))return {jobs:jobs.get(Number(path.split('/')[3]))??[]};
    if(/^\/actions\/runs\/\d+$/.test(path))return runs.find(r=>r.id===Number(path.split('/').at(-1)));
    if(path==='/actions/workflows?per_page=100')return {total_count:switches.length,workflows:switches};
    if(/\/actions\/workflows\/\d+\/(enable|disable)$/.test(path)){const w=switches.find(w=>w.id===Number(path.split('/')[3]));w.state=path.endsWith('/enable')?'active':'disabled_manually';return null;}
    throw Error('Unexpected fake API '+method+' '+path);
  };
  return {api,calls,runs,jobs,switches,get usage(){return document;},changeHead(){head='another-writer';}};
}
test('job-level accounting includes failed/cancelled attempts, rounds separately and never erases deleted history',()=>{
  const u=emptyUsage(now);
  observeJobs(u,run(10),[job(100,10,1),job(101,10,61,{conclusion:'failure'}),job(102,10,10,{conclusion:'cancelled'})],now);
  assert.equal(chargedMinutes(u),4);
  observeJobs(u,run(10,'completed',2),[job(103,10,2)],now);assert.equal(chargedMinutes(u),5);
  observeJobs(u,run(10,'completed',2),[job(103,10,0)],now);assert.equal(chargedMinutes(u),5);
  observeJobs(u,run(11),[job(104,11,-1,{runner_id:null,steps:[],conclusion:'cancelled'})],now);assert.equal(chargedMinutes(u),5);
  assert.throws(()=>observeJobs(u,run(11),[job(105,11,-1)],now));
  assert.throws(()=>observeJobs(u,run(11),[job(105,11,1,{labels:['windows-latest']})],now));
  assert.throws(()=>observeJobs(u,run(11),[job(105,12,1)],now));
});
test('UTC calendar rollover creates a new ledger without zeroing the previous month or confusing DST',()=>{
  assert.equal(monthWindow(Date.parse('2026-10-31T23:59:59Z')).month,'2026-10');
  assert.equal(monthWindow(Date.parse('2026-11-01T00:00:00Z')).month,'2026-11');
  const old=spent(ACTIONS_LIMIT+100,Date.parse('2026-10-31T23:59:59Z'));
  assert.equal(allocation(old,{kind:'session',now:Date.parse('2026-10-31T23:59:59Z')}).halt,true);
  assert.throws(()=>checkedUsage(old,now));assert.equal(chargedMinutes(old),ACTIONS_LIMIT+100);
  assert.equal(allocation(emptyUsage(now),{kind:'session',now}).allowed,true);
  const overlap=job(7,7,60,{started_at:'2026-10-31T23:59:40Z',completed_at:'2026-11-01T00:00:40Z'});
  const u=emptyUsage(now);observeJobs(u,run(7),[overlap],now);assert.equal(chargedMinutes(u),1);
});
test('corrupted counters and forged totals cannot raise the protected 1900 minute limit',()=>{
  for(const mutate of [u=>u.jobs=[],u=>u.jobs.x={run:'1',minutes:-1},u=>u.limit=999999,u=>u.runs[1]={attempt:1,completed:'true'},u=>u.reservations['1:1']={run:'1',attempt:1,at:new Date(now).toISOString(),total:0,before:0,jobs:{first:90}},u=>u.reservations['1:1']={run:'1',attempt:1,at:new Date(now).toISOString(),total:0,before:0,jobs:{},reason:'untracked_running_job_worst_case'}]) {
    const u=emptyUsage(now);mutate(u);assert.throws(()=>allocation(u,{kind:'ci',now}));
  }
  assert.throws(()=>allocation(emptyUsage(now),{kind:'unlimited',now}));
});

test('daily self-recovery is reserved through month end, then releases its elapsed technical margin',()=>{
  assert.equal(recoveryAllowance(now),30*8);
  assert.equal(recoveryAllowance(Date.parse('2026-11-30T12:00:00Z')),8);
  const u=emptyUsage(now),p=allocation(u,{kind:'session',now});reserveAllocation(u,p,100,1,now);
  assert.ok(chargedMinutes(u)+reservedMinutes(u)+recoveryAllowance(now)<=ACTIONS_LIMIT);
});

test('owner-approved cap migrates the old ledger without losing charges, holds or deferred CI',async()=>{
  const u=spent(1461);u.limit=1700;
  reserveAllocation(u,allocation(u,{kind:'ci',scope:'controller',now}),100,1,now);
  u.deferredCI=[{pr:49,head:'a'.repeat(40),run:'99',attempt:1,scope:'application'}];
  const original=structuredClone(u),f=fixture(u),loaded=await loadUsage(f.api,now);
  assert.equal(chargedMinutes(loaded.usage),1461);assert.equal(reservedMinutes(loaded.usage),26);
  await saveUsage(f.api,loaded,now);
  assert.deepEqual(f.usage,{...original,limit:1900,observedAt:new Date(now).toISOString(),source:'GitHub allocated job timestamps; per-job rounding; all attempts; no billing API credential'});
  for(const limit of [0,1699,1701,1899,1901,2000,'1900'])assert.throws(()=>checkedUsage({...u,limit},now));
});

test('one full CI fits the reviewed November balance while further admissions still respect reservations',()=>{
  const time=Date.parse('2026-11-15T12:00:00Z'),u=spent(1461,time);u.limit=1700;
  const policy=allocation(u,{kind:'ci',scope:'controller',now:time});assert.equal(policy.allowed,true);
  reserveAllocation(u,policy,100,1,time);
  const full=allocation(u,{kind:'ci',now:time});assert.equal(full.allowed,true);
  reserveAllocation(u,full,101,1,time);
  assert.equal(reservedMinutes(u),204);
  assert.ok(chargedMinutes(u)+reservedMinutes(u)+recoveryAllowance(time)+8<=1900);
  assert.equal(allocation(u,{kind:'ci',now:time}).allowed,false);
});

test('deferred compute retries only its failed admission and persists cooldown before dispatch',async()=>{
  const f=fixture(),loaded=await loadUsage(f.api,now),head='a'.repeat(40);let dispatched=0;
  loaded.usage.deferredCI=[{run:'10',attempt:1,pr:5,head,scope:'controller'}];
  const api=async(path,...rest)=>{
    if(path==='/pulls/5')return {state:'open',head:{sha:head}};
    if(path==='/actions/runs/10')return run(10);
    if(path==='/actions/runs/10/jobs?per_page=100')return {jobs:[{id:77,name:'budget',conclusion:'failure'}]};
    if(path==='/actions/jobs/77/rerun'){assert.ok(f.usage.deferredCI[0].nextRetryAt);dispatched++;return {};}
    return f.api(path,...rest);
  };
  await retryDeferredCI(api,loaded,now);assert.equal(dispatched,1);
  await retryDeferredCI(api,loaded,now+60000);assert.equal(dispatched,1);
  loaded.usage.deferredCI[0].nextRetryAt=null;
  const failingTestAPI=(path,...rest)=>path==='/actions/runs/10/jobs?per_page=100'?Promise.resolve({jobs:[{id:78,name:'checks',conclusion:'failure'}]}):api(path,...rest);
  await retryDeferredCI(failingTestAPI,loaded,now);assert.equal(dispatched,1);assert.deepEqual(loaded.usage.deferredCI,[]);
});
test('all expensive paths reserve worst-case runner and cancellation time before they are granted',()=>{
  for(const kind of ['ci','analytics','search-console','session','validation','deployment'])for(let used=0;used<=ACTIONS_LIMIT+50;used+=7) {
    const u=spent(used),p=allocation(u,{kind,now,manual:true});
    reserveAllocation(u,p,99,1,now);
    if(p.allowed)assert.ok(chargedMinutes(u)+reservedMinutes(u)+recoveryAllowance(now)<=ACTIONS_LIMIT);
    if(used>=ACTIONS_LIMIT)assert.equal(p.allowed,false);
  }
});
test('admission is tied to a run, attempt, job and timeout; a heavy-job-only rerun is refused',()=>{
  const u=emptyUsage(now),p=allocation(u,{kind:'ci',scope:'controller',now});reserveAllocation(u,p,100,1,now);
  assert.equal(assertGrant(u,{run:'100',attempt:1,job:'checks',minutes:12,now}),12);
  for(const change of [{run:'101'},{attempt:2},{job:'production'},{minutes:90}])assert.throws(()=>assertGrant(u,{run:'100',attempt:1,job:'checks',minutes:12,now,...change}));
  assert.throws(()=>reserveAllocation(u,p,100,1,now));
});
test('completed attempts release unused reservation only after observable GitHub completion',()=>{
  const u=emptyUsage(now),p=allocation(u,{kind:'ci',now});reserveAllocation(u,p,10,1,now);
  const initial=reservedMinutes(u);observeJobs(u,run(10,'in_progress'),[job(1,10,61)],now);assert.equal(reservedMinutes(u),initial-2);
  observeJobs(u,run(10),[job(1,10,61)],now);assert.equal(reservedMinutes(u),0);
});
test('four daily opportunities remain possible; reduced headroom changes cadence without per-experiment limits',()=>{
  const fresh=allocation(emptyUsage(now),{kind:'session',now});assert.equal(fresh.cadence,6);assert.ok(fresh.sessionTimeout>=8);
  const u=spent(ACTIONS_LIMIT-400);u.lastModelAt=new Date(now-6*3600000).toISOString();
  const slow=allocation(u,{kind:'session',now});assert.ok(slow.cadence>6);assert.equal(slow.allowed,false);
  assert.equal(allocation(u,{kind:'session',now:now+24*3600000}).allowed,true);
  const metadata=allocation(emptyUsage(now),{kind:'validation',now});assert.equal(metadata.sessionTimeout,3);assert.equal(metadata.jobs.first,3);
});
test('CI scope reduction never applies to runtime code, manifests, game content, browser tests or unknown paths',()=>{
  assert.equal(ciScope(['scripts/autonomy-agent/run.mjs','.github/workflows/ci.yml']),'controller');
  assert.equal(ciScope(['docs/guide.md']),'documentation');
  for(const path of ['src/lib/seo-content.ts','package-lock.json','e2e/game.spec.ts','tests/auth.test.ts','content/words.json','public/icon.svg','unknown'])assert.equal(ciScope([path]),'application');
  assert.equal(ciScope(['docs/guide.md','src/app/page.tsx']),'application');
});
test('durable CAS precedes admission and refuses simultaneous writers',async()=>{
  const f=fixture(),loaded=await loadUsage(f.api,now);f.changeHead();await assert.rejects(saveUsage(f.api,loaded,now),/Concurrent/);
  assert.ok(!f.calls.some(c=>c.method==='PATCH'));
  const good=fixture();const p=await admitUsage(good.api,{kind:'session',now,run:'100',attempt:1});assert.equal(p.allowed,true);
  assert.ok(good.usage.reservations['100:1']);assert.ok(good.calls.find(c=>c.method==='PATCH'));
});
test('API errors and unknown accounting refuse compute; exhausted months disable guarded workflows',async()=>{
  const bad=fixture();await assert.rejects(admitUsage(async(path,...rest)=>{if(path.startsWith('/actions/runs?'))throw Error('API unavailable');return bad.api(path,...rest);},{kind:'session',now,run:'100',attempt:1}));
  const f=fixture(spent(1800));f.switches.forEach(w=>w.state='active');
  const p=await admitUsage(f.api,{kind:'session',now,run:'100',attempt:1});assert.equal(p.allowed,false);assert.equal(p.halt,true);
  assert.ok(f.switches.every(w=>w.state==='disabled_manually'));
});
test('renewal enables only the managed workflows, never legacy pilots or human pause/production controls',async()=>{
  const f=fixture();assert.equal(await resumeWorkflows(f.api,f.usage,now),true);
  assert.equal(f.switches.find(w=>w.path.endsWith('growth-check.yml')).state,'disabled_manually');
  assert.ok(!f.calls.some(c=>c.path.includes('agent-state')||c.path.includes('secrets')||c.path.includes('variables')));
  await suspendWorkflows(f.api);assert.ok(f.switches.every(w=>w.state==='disabled_manually'));
});

test('stopping compute also cancels queued admissions while preserving reserved production work',async()=>{
  const f=fixture();reserveAllocation(f.usage,allocation(f.usage,{kind:'deployment',now}),102,1,now);
  const cancelled=[];
  const api=async(path,...rest)=>{
    if(path.startsWith('/actions/runs?status='))return {workflow_runs:path.includes('status=queued&')?[{id:101,run_attempt:1,path:'.github/workflows/ci.yml'},{id:102,run_attempt:1,path:'.github/workflows/autonomy-agent.yml'}]:[]};
    if(path==='/actions/runs/101/cancel'){cancelled.push(101);return {};}
    return f.api(path,...rest);
  };
  await suspendWorkflows(api,f.usage,'100');assert.deepEqual(cancelled,[101]);
});

test('daily recovery never resets current spending and reopens a genuinely fresh month without altering pause/auth',async()=>{
  for(const amount of [0,ACTIONS_LIMIT-200]){
    const f=fixture(spent(amount)),api=async(path,...rest)=>{
      if(path.startsWith('/contents/agent/operations/actions-2026-10.json'))throw Object.assign(Error('absent previous month'),{status:404});
      return f.api(path,...rest);
    };
    const result=await recoverUsage(api,{now,run:'200'});
    assert.equal(chargedMinutes(result.usage),amount);assert.equal(result.enabled,amount===0);
    assert.ok(!f.calls.some(c=>c.path.includes('agent-state')||c.path.includes('secrets')||c.path.includes('variables')));
    f.runs.push(run(200));f.jobs.set(200,[job(2,200,1)]);
    await recoverUsage(api,{now,run:'201'});assert.equal(chargedMinutes(f.usage),amount+1);
  }
});
test('validation and deployment extend the same global reservation, never a hidden seven-day sub-budget',async()=>{
  const f=fixture(),env={GITHUB_RUN_ID:'100',GITHUB_RUN_ATTEMPT:'1'};
  await admitUsage(f.api,{kind:'session',now,run:'100',attempt:1});
  f.runs.push(run(100,'in_progress'));
  assert.equal(await extendUsage(f.api,{'release-validation':5,'release-finalize':4},{env,now}),true);
  assert.equal(f.usage.reservations['100:1'].jobs['release-validation'],5);
  assert.equal(await extendUsage(f.api,{production:30},{env,now}),true);
  assert.ok(chargedMinutes(f.usage)+reservedMinutes(f.usage)+recoveryAllowance(now)<=ACTIONS_LIMIT);
  f.usage.jobs[1]={run:'1',minutes:1680};assert.equal(await extendUsage(f.api,{'release-validation':90},{env,now}),false);
});
test('prior-month reruns remain observable even outside the created-date search',async()=>{
  const f=fixture();const plan=allocation(f.usage,{kind:'ci',scope:'controller',now});reserveAllocation(f.usage,plan,100,2,now);
  f.runs.push(run(100));f.jobs.set(100,[job(55,100,61)]);
  const api=(path,...rest)=>path.startsWith('/actions/runs?')?Promise.resolve({total_count:0,workflow_runs:[]}):f.api(path,...rest);
  await reconcileUsage(api,f.usage,{now,currentRun:'200'});assert.equal(chargedMinutes(f.usage),2);
});
test('live PR heads are checked before scope classification and stale budget retries are discarded',async()=>{
  const f=fixture(),head='a'.repeat(40),base='b'.repeat(40);
  const event={pull_request:{number:5,draft:false,base:{sha:base},head:{sha:head,repo:{full_name:'Aimericv/puzzoria'}}}};
  assert.equal(await changedScope(async path=>path==='/pulls/5'?{draft:false,head:{sha:head},base:{ref:'main',sha:base}}:[{filename:'docs/a.md'}],event),'documentation');
  await assert.rejects(changedScope(async()=>({head:{sha:'b'.repeat(40)}}),event),/changed/);
  const loaded=await loadUsage(f.api,now);loaded.usage.deferredCI=[{run:'10',attempt:1,pr:5,head,scope:'controller'}];
  await retryDeferredCI(async(path,...rest)=>path==='/pulls/5'?{state:'closed'}:f.api(path,...rest),loaded,now);
  assert.deepEqual(loaded.usage.deferredCI,[]);
});

test('draft CI reserves its final refusal gate but never grants a browser job',()=>{
  const u=emptyUsage(now),plan=allocation(u,{kind:'ci',mode:'development',now});
  assert.deepEqual(plan.jobs,{budget:8,checks:12,'Final validation':2});
  reserveAllocation(u,plan,100,1,now);assert.equal(reservedMinutes(u),34);
  assert.equal(assertGrant(u,{run:'100',attempt:1,job:'Final validation',minutes:2,now}),2);
  assert.throws(()=>assertGrant(u,{run:'100',attempt:1,job:'E2E (desktop)',minutes:30,now}));
  assert.throws(()=>allocation(u,{kind:'ci',mode:'fast',now}));
  assert.equal(allocation(emptyUsage(now),{kind:'ci',now}).jobs['E2E (iphone-webkit)'],30);
});

test('CI mode comes from the live PR, with stale base/draft and renames checked',async()=>{
  const head='a'.repeat(40),base='b'.repeat(40);
  const pr={number:5,draft:true,head:{sha:head,repo:{full_name:'Aimericv/puzzoria'}},base:{ref:'main',sha:base}};
  const api=async path=>path==='/pulls/5'?structuredClone(pr):[{filename:'src/components/card.tsx'}];
  assert.deepEqual(await changedCI(api,{pull_request:pr}),{scope:'application',mode:'development',head,base});
  for(const mutate of [p=>p.base.sha='c'.repeat(40),p=>p.draft=false,p=>delete p.base.sha,p=>delete p.draft]){
    const stale=structuredClone(pr);mutate(stale);await assert.rejects(changedCI(api,{pull_request:stale}),/changed/);
  }
  const renamed=path=>path==='/pulls/5'?api(path):Promise.resolve([{filename:'docs/example.md',previous_filename:'src/components/card.tsx'}]);
  assert.equal((await changedCI(renamed,{pull_request:pr})).scope,'application');
  const ready={...pr,draft:false};
  assert.equal((await changedCI(path=>path==='/pulls/5'?Promise.resolve(ready):api(path),{pull_request:ready})).mode,'final');
});

test('deferred draft admissions never rerun an event with a changed base or review state',async()=>{
  for(const changed of ['base','review']){
    const f=fixture(),loaded=await loadUsage(f.api,now),head='a'.repeat(40),base='b'.repeat(40);
    loaded.usage.deferredCI=[{run:'10',attempt:1,pr:5,head,base,scope:'application',mode:'development'}];
    const api=(path,...rest)=>path==='/pulls/5'?Promise.resolve({state:'open',head:{sha:head},base:{sha:changed==='base'?'c'.repeat(40):base},draft:changed!=='review'}):f.api(path,...rest);
    await retryDeferredCI(api,loaded,now);assert.deepEqual(loaded.usage.deferredCI,[]);
    assert.ok(!f.calls.some(c=>c.path.includes('/rerun')));
  }
});
test('workflow contracts keep every expensive job guarded and do not claim skipped browser checks as passing',()=>{
  for(const name of ['ci.yml','autonomy-agent.yml','analytics-check.yml']){
    const text=readFileSync('.github/workflows/'+name,'utf8');assert.match(text,/actions-budget-run\.mjs admit/);assert.match(text,/actions-budget-run\.mjs assert/);assert.match(text,/puzzoria-actions-budget/);
  }
  const ci=readFileSync('.github/workflows/ci.yml','utf8');assert.match(ci,/scope == 'application'/);assert.doesNotMatch(ci,/--grep "new SEO pages/);
  const recovery=readFileSync('.github/workflows/actions-budget.yml','utf8');assert.match(recovery,/7 0 \* \* \*/);assert.match(recovery,/timeout-minutes: 2/);
  const action=readFileSync('.github/actions/puzzoria-agent/action.yml','utf8');assert.ok(action.indexOf('preflight.mjs')<action.indexOf('npm ci'));
  const runtime=readFileSync('scripts/autonomy-agent/actions-budget-run.mjs','utf8');assert.match(runtime,/kind==='ci'&&!plan.allowed/);
  const prepare=readFileSync('scripts/autonomy-agent/release-check.mjs','utf8');assert.doesNotMatch(prepare,/validationBudgetMinutes7d/);assert.match(prepare,/extendUsage/);
});
