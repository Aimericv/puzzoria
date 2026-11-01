// Protected operator policy. The model cannot edit this module or its ledger.
export const ACTIONS_LIMIT=1700;
export const ACTIONS_BRANCH='codex/actions-usage';
export const CONTROL_ALLOWANCE=8; // 2 minute guard + cancellation/rounding margin.
// Reserve every remaining daily recovery, including cancellation margin.
export const recoveryAllowance=(now=Date.now())=>Math.max(1,Math.ceil((monthWindow(now).end-now)/86400000))*CONTROL_ALLOWANCE;
export const MANAGED_WORKFLOWS=['autonomy-agent.yml','ci.yml','analytics-check.yml'];
export const RETIRED_WORKFLOWS=['autonomy-pilot.yml','cloud-handoff-smoke.yml','growth-check.yml','agent-diagnostics.yml','ci-inspection.yml'];
export const jobReservation=minutes=>minutes+6;
export function monthWindow(now=Date.now()) {
  const d=new Date(now),start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1),end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
  return {month:new Date(start).toISOString().slice(0,7),start,end};
}
export function emptyUsage(now=Date.now()) {
  return {schemaVersion:1,month:monthWindow(now).month,jobs:{},runs:{},reservations:{},lastModelAt:null};
}
export function checkedUsage(value,now=Date.now()) {
  const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(value?.schemaVersion!==1||value.month!==monthWindow(now).month||value.limit!==undefined&&value.limit!==ACTIONS_LIMIT||!record(value.jobs)||!record(value.runs)||!record(value.reservations)||
     Object.entries(value.jobs).some(([id,j])=>!/^\d+$/.test(id)||!record(j)||!Number.isSafeInteger(j.minutes)||j.minutes<0||!/^\d+$/.test(String(j.run))))throw Error('Invalid monthly Actions ledger');
  for(const [id,entry] of Object.entries(value.runs))if(!/^\d+$/.test(id)||!record(entry)||!Number.isSafeInteger(entry.attempt)||entry.attempt<1||typeof entry.completed!=='boolean')throw Error('Invalid observed run');
  for(const [key,entry] of Object.entries(value.reservations)) {
    if(!record(entry))throw Error('Invalid Actions reservation');
    if(!record(entry.jobs)||!Number.isSafeInteger(entry.total)||entry.total<0||!Number.isSafeInteger(entry.before)||entry.before<0||!/^\d+$/.test(String(entry.run))||!Number.isSafeInteger(entry.attempt)||entry.attempt<1)throw Error('Invalid Actions reservation');
    if(key!==`${entry.run}:${entry.attempt}`||!Number.isFinite(Date.parse(entry.at)))throw Error('Invalid reservation identity');
    const expected=Object.entries(entry.jobs).reduce((sum,[name,time])=>{
      if(!Number.isSafeInteger(time)||time<1||time>90)throw Error('Invalid reserved timeout');
      return sum+(name==='budget'?time:jobReservation(time));
    },0);
    if(entry.reason==='untracked_running_job_worst_case'){
      if(Object.keys(entry.jobs).length||entry.total<366||entry.total%366!==0)throw Error('Invalid untracked runner reservation');
    }else if(entry.total!==expected)throw Error('Reservation does not cover its jobs');
  }
  return value;
}
export function chargedMinutes(usage) {return Object.values(usage.jobs).reduce((sum,j)=>sum+j.minutes,0);}
export function reservedMinutes(usage) {
  return Object.values(usage.reservations).reduce((sum,r)=>{
    if(!Number.isSafeInteger(r.total)||r.total<0||!Number.isSafeInteger(r.before)||r.before<0)throw Error('Invalid Actions reservation');
    if(usage.runs[r.run]?.completed && usage.runs[r.run].attempt>=r.attempt)return sum;
    const actual=Object.values(usage.jobs).filter(j=>j.run===r.run).reduce((s,j)=>s+j.minutes,0);
    return sum+Math.max(0,r.total-Math.max(0,actual-r.before));
  },0);
}
export function observeJobs(usage,run,jobs,now=Date.now()) {
  const {start,end}=monthWindow(now);
  if(!/^\d+$/.test(String(run.id))||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<1)throw Error('Invalid GitHub run');
  for(const job of jobs) {
    if(job.run_id!==run.id||!/^\d+$/.test(String(job.id)))throw Error('Job provenance mismatch');
    if(job.conclusion==='skipped'||(!job.runner_id&&!(job.steps?.length)))continue; // Includes cancelled queue entries with synthetic timestamps.
    if(!job.labels?.some(label=>['ubuntu-latest','ubuntu-24.04','ubuntu-22.04'].includes(label))||job.labels.some(label=>/windows|macos|self-hosted|large/i.test(label)))throw Error('Unpriced runner; refuse further allocation');
    if(job.status!=='completed')continue;
    const from=Date.parse(job.started_at),to=Date.parse(job.completed_at);
    if(!Number.isFinite(from)||!Number.isFinite(to)||to<from)throw Error('Unknown allocated job duration');
    if(to<start||from>=end)continue;
    const minutes=Math.max(1,Math.ceil((to-from)/60000));
    // A job overlapping the boundary is conservatively charged in both months.
    usage.jobs[job.id]={run:String(run.id),minutes:Math.max(minutes,usage.jobs[job.id]?.minutes??0)};
  }
  usage.runs[run.id]={attempt:run.run_attempt,completed:run.status==='completed'};
}
export function ciScope(files) {
  if(!Array.isArray(files)||!files.length)return 'application';
  if(files.every(path=>path==='README.md'||/^docs\/.+\.md$/.test(path)))return 'documentation';
  if(files.every(path=>/^(?:scripts\/|deploy\/|agent\/|\.github\/|tests\/infrastructure\/|docs\/)/.test(path)||['AGENTS.md','README.md'].includes(path)))return 'controller';
  return 'application'; // Unknown files, manifests, runtime code, tests and browser changes get full validation.
}
export function allocation(usage,{kind,scope='application',now=Date.now(),manual=false}={}) {
  if(!['ci','analytics','search-console','session','validation','deployment'].includes(kind))throw Error('Unknown budgeted operation');
  checkedUsage(usage,now);
  const used=chargedMinutes(usage),held=reservedMinutes(usage),remaining=ACTIONS_LIMIT-used-held;
  const base={kind,scope,used,held,remaining,month:usage.month,limit:ACTIONS_LIMIT,allowed:false,jobs:{budget:CONTROL_ALLOWANCE},reason:'monthly_limit'};
  const safe=remaining-CONTROL_ALLOWANCE-recoveryAllowance(now)-CONTROL_ALLOWANCE;
  if(safe<0)return {...base,halt:true};
  const grant=jobs=>({...base,allowed:true,reason:null,jobs:{budget:CONTROL_ALLOWANCE,...jobs}});
  if(kind==='ci') {
    const jobs=scope==='documentation'?{checks:3}:scope==='controller'?{checks:12}:{checks:12,...Object.fromEntries(['desktop','mobile','android','iphone-webkit'].map(p=>[`E2E (${p})`,30]))};
    return Object.values(jobs).reduce((s,n)=>s+jobReservation(n),0)<=safe?grant(jobs):base;
  }
  if(kind==='analytics'||kind==='search-console')return jobReservation(3)<=safe?grant({[kind==='analytics'?'check':'search-console-check']:3}):base;
  const remainingDays=Math.max(1,(monthWindow(now).end-now)/86400000);
  // Keep inexpensive polling and a validation opportunity in the remaining envelope.
  const daily=Math.max(0,(safe-96)/remainingDays-4);
  const cadence=daily>=32?6:daily>=16?12:24;
  if(kind==='session'&&!manual&&usage.lastModelAt&&now-Date.parse(usage.lastModelAt)<cadence*3600000-60000)return {...base,reason:'adaptive_cadence',cadence};
  const timeout=Math.max(8,Math.min(20,Math.floor(daily/(24/cadence))));
  const jobs=kind==='session'?{first:timeout}:kind==='validation'?{first:3}:{};
  const cost=Object.values(jobs).reduce((s,n)=>s+jobReservation(n),0);
  if(cost>safe)return {...base,halt:safe<jobReservation(8),cadence};
  // Cheap classification comes first. Validation/deployment reserve their exact
  // worst-case cost later, after a real candidate/approved rollout is known.
  const release={...jobs,'release-prepare':4,'production-gate':3};
  const releaseCost=Object.values(release).reduce((s,n)=>s+jobReservation(n),0);
  const deployment={...jobs,'production-gate':3};
  const deployCost=Object.values(deployment).reduce((s,n)=>s+jobReservation(n),0);
  if(kind==='deployment')return deployCost<=safe?grant(deployment):base;
  const plan=grant(releaseCost<=safe?release:deployCost<=safe?deployment:jobs);
  return {...plan,cadence,sessionTimeout:kind==='session'?timeout:3,releaseAllowed:releaseCost<=safe,productionAllowed:deployCost<=safe};
}
export function reserveAllocation(usage,plan,run,attempt,now=Date.now()) {
  const key=`${run}:${attempt}`;
  if(!/^\d+$/.test(String(run))||!Number.isSafeInteger(attempt)||attempt<1||usage.reservations[key])throw Error('A fresh run/attempt reservation is required');
  const total=Object.entries(plan.jobs).reduce((s,[name,time])=>s+(name==='budget'?time:jobReservation(time)),0);
  const before=Object.values(usage.jobs).filter(j=>j.run===String(run)).reduce((s,j)=>s+j.minutes,0);
  usage.reservations[key]={run:String(run),attempt,total,before,at:new Date(now).toISOString(),jobs:plan.jobs};
  if(plan.allowed&&plan.kind==='session')usage.lastModelAt=new Date(now).toISOString();
  return usage.reservations[key];
}
export function assertGrant(usage,{run,attempt,job,minutes,now=Date.now()}) {
  checkedUsage(usage,now);
  const entry=usage.reservations[`${run}:${attempt}`];
  if(!entry||!Number.isSafeInteger(minutes)||minutes<1||entry.jobs?.[job]<minutes||!Object.hasOwn(entry.jobs??{},job))throw Error('No protected monthly reservation for this job and attempt');
  if(chargedMinutes(usage)+reservedMinutes(usage)+recoveryAllowance(now)>ACTIONS_LIMIT)throw Error('Monthly Actions envelope is unavailable');
  return entry.jobs[job];
}
