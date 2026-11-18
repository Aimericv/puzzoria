import {ACTIONS_LIMIT,CI51_TEMPORARY_LIMIT,ACTIONS_BRANCH,CONTROL_ALLOWANCE,recoveryAllowance,MANAGED_WORKFLOWS,RETIRED_WORKFLOWS,monthWindow,emptyUsage,checkedUsage,observeJobs,chargedMinutes,reservedMinutes,allocation,reserveAllocation,ciScope,assertGrant} from './actions-budget.mjs';
import {campaignBase,campaignJobLimit,campaignStage} from './ci51-campaign.mjs';

export const usagePath=now=>`agent/operations/actions-${monthWindow(now).month}.json`;
async function optional(api,path) {try{return await api(path);}catch(e){if(e.status===404)return null;throw e;}}
export async function loadUsage(api,now=Date.now()) {
  const ref=await optional(api,`/git/ref/heads/${ACTIONS_BRANCH}`),head=ref?.object.sha??null;
  const file=head?await optional(api,`/contents/${usagePath(now)}?ref=${head}`):null;
  if(file&&(file.encoding!=='base64'||file.size>1048576))throw Error('Monthly ledger is not a bounded JSON file');
  return {head,usage:file?checkedUsage(JSON.parse(Buffer.from(file.content,'base64')),now):emptyUsage(now)};
}
export async function saveUsage(api,loaded,now=Date.now()) {
  const actual=await optional(api,`/git/ref/heads/${ACTIONS_BRANCH}`);
  if((actual?.object.sha??null)!==loaded.head)throw Error('Concurrent monthly accounting; refuse stale admission');
  const parent=loaded.head??(await api('/git/ref/heads/main')).object.sha,commit=await api(`/git/commits/${parent}`);
  const content=JSON.stringify({...loaded.usage,observedAt:new Date(now).toISOString(),source:'GitHub allocated job timestamps; per-job rounding; all attempts; no billing API credential',limit:ACTIONS_LIMIT},null,2)+'\n';
  if(Buffer.byteLength(content)>1048576)throw Error('Monthly ledger exceeded its protected size bound');
  const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:usagePath(now),mode:'100644',type:'blob',content}]});
  const next=await api('/git/commits','POST',{message:`Account for Puzzoria Actions ${monthWindow(now).month}`,tree:tree.sha,parents:[parent]});
  if(loaded.head)await api(`/git/refs/heads/${ACTIONS_BRANCH}`,'PATCH',{sha:next.sha,force:false});
  else await api('/git/refs','POST',{ref:`refs/heads/${ACTIONS_BRANCH}`,sha:next.sha});
  loaded.head=next.sha;
}
async function listRuns(api,from,to) {
  const range=encodeURIComponent(new Date(from).toISOString()+'..'+new Date(to).toISOString()).replace('..','%2E%2E');
  const query=`created=${range}&per_page=100`;
  const first=await api(`/actions/runs?${query}&page=1`);
  if(!Array.isArray(first.workflow_runs)||!Number.isSafeInteger(first.total_count))throw Error('Incomplete run accounting');
  if(first.total_count>1000){if(to-from<2000)throw Error('Run history exceeds API enumeration limits');const mid=Math.floor((from+to)/2);return [...await listRuns(api,from,mid),...await listRuns(api,mid+1,to)];}
  const runs=[...first.workflow_runs];
  for(let page=2;runs.length<first.total_count;page++) {
    const result=await api(`/actions/runs?${query}&page=${page}`);
    if(!result.workflow_runs?.length)throw Error('Truncated run pagination');runs.push(...result.workflow_runs);
  }
  return runs;
}
export async function reconcileUsage(api,usage,{now=Date.now(),currentRun}={}) {
  const window=monthWindow(now),runs=await listRuns(api,window.start-86400000,Math.min(now,window.end-1));
  const unique=[...new Map(runs.map(run=>[run.id,run])).values()];
  // A previous-month run can be retried this month. Its creation date is old,
  // so include every unsettled admitted run explicitly, not just the search.
  for(const entry of Object.values(usage.reservations))if(!unique.some(r=>String(r.id)===entry.run)&&(!usage.runs[entry.run]?.completed||usage.runs[entry.run].attempt<entry.attempt))unique.push(await api(`/actions/runs/${entry.run}`));
  let index=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(index<unique.length) {
      const run=unique[index++],known=usage.runs[run.id];
      if(known?.completed&&run.status==='completed'&&known.attempt===run.run_attempt)continue;
      const jobs=[];
      for(let page=1;;page++){const data=await api(`/actions/runs/${run.id}/jobs?filter=all&per_page=100&page=${page}`);if(!Array.isArray(data.jobs))throw Error('Unknown job history');jobs.push(...data.jobs);if(data.jobs.length<100)break;if(page>=30)throw Error('Oversized job history');}
      observeJobs(usage,run,jobs,now);
      // External/restarted work not admitted by this ledger never counts as free.
      const key=`${run.id}:${run.run_attempt}`;
      const live=jobs.filter(j=>j.runner_id&&j.status!=='completed');
      if(String(run.id)!==String(currentRun)&&live.length&&!usage.reservations[key]) {
        const before=Object.values(usage.jobs).filter(j=>j.run===String(run.id)).reduce((s,j)=>s+j.minutes,0);
        usage.reservations[key]={run:String(run.id),attempt:run.run_attempt,before,total:live.length*366,jobs:{},at:new Date(now).toISOString(),reason:'untracked_running_job_worst_case'};
      }
    }
  }));
  return usage;
}
export async function suspendWorkflows(api,usage,currentRun) {
  const data=await api('/actions/workflows?per_page=100');
  if(!Array.isArray(data.workflows)||data.total_count>100)throw Error('Cannot enumerate all workflow switches');
  const targets=new Set([...MANAGED_WORKFLOWS,...RETIRED_WORKFLOWS]);
  for(const workflow of data.workflows)if(targets.has(workflow.path.split('/').at(-1))&&workflow.state==='active')await api(`/actions/workflows/${workflow.id}/disable`,'PUT');
  // Disabling a workflow alone does not remove runs already waiting in its
  // concurrency queue. Cancel unadmitted runs; preserve every admitted job,
  // including deployment transactions and their rollback/receipt handling.
  if(usage)for(const status of ['queued','in_progress','waiting','pending','requested'])for(let page=1;page<=30;page++){
    const rows=await api(`/actions/runs?status=${status}&per_page=100&page=${page}`);
    if(!Array.isArray(rows.workflow_runs))throw Error('Cannot enumerate pending admissions');
    for(const run of rows.workflow_runs)if(targets.has(String(run.path).split('/').at(-1))&&String(run.id)!==String(currentRun)&&!usage.reservations[`${run.id}:${run.run_attempt}`])await api(`/actions/runs/${run.id}/cancel`,'POST',{});
    if(rows.workflow_runs.length<100)break;
    if(page===30)throw Error('Oversized admission queue');
  }
}
export async function resumeWorkflows(api,usage,now=Date.now()) {
  if(chargedMinutes(usage)+reservedMinutes(usage)+2*CONTROL_ALLOWANCE+recoveryAllowance(now)>=ACTIONS_LIMIT)return false;
  const data=await api('/actions/workflows?per_page=100');
  if(!Array.isArray(data.workflows)||data.total_count>100)throw Error('Cannot enumerate workflow switches');
  for(const name of MANAGED_WORKFLOWS) {
    const workflow=data.workflows.find(w=>w.path===`.github/workflows/${name}`);
    if(!workflow)throw Error('Managed workflow is missing');
    if(workflow.state==='disabled_manually'||workflow.state==='disabled_inactivity')await api(`/actions/workflows/${workflow.id}/enable`,'PUT');
  }
  return true;
}
export async function recoverUsage(api,{run,attempt=1,now=Date.now()}={}) {
  const loaded=await loadUsage(api,now);await reconcileUsage(api,loaded.usage,{now,currentRun:run});
  const previous=await loadUsage(api,monthWindow(now).start-1);
  loaded.usage.deferredCI??=[];
  for(const row of previous.usage.deferredCI??[])if(!loaded.usage.deferredCI.some(r=>r.pr===row.pr))loaded.usage.deferredCI.push({...row,nextRetryAt:null});
  reserveAllocation(loaded.usage,{jobs:{budget:CONTROL_ALLOWANCE},allowed:false},run,attempt,now);
  await saveUsage(api,loaded,now);
  const enabled=await resumeWorkflows(api,loaded.usage,now);
  if(!enabled)await suspendWorkflows(api,loaded.usage,run);
  else try{await retryDeferredCI(api,loaded,now);}catch{/* Next recovery/wake retries without admitting unaccounted compute. */}
  return {usage:loaded.usage,enabled};
}
export async function retryDeferredCI(api,loaded,now=Date.now()) {
  for(const row of loaded.usage.deferredCI??[]) {
    if(row.nextRetryAt&&Date.parse(row.nextRetryAt)>now)continue;
    if(!Number.isSafeInteger(row.pr)||!/^\d+$/.test(row.run)||!/^[a-f0-9]{40}$/.test(row.head))throw Error('Invalid deferred CI receipt');
    if(!allocation(loaded.usage,{kind:'ci',scope:row.scope,mode:row.mode??'final',now}).allowed)return;
    const pr=await api(`/pulls/${row.pr}`);
    const currentMode=row.scope==='application'&&pr.draft?'development':'final';
    if(pr.state!=='open'||pr.head?.sha!==row.head||row.base&&pr.base?.sha!==row.base||row.mode&&row.mode!==currentMode){loaded.usage.deferredCI=loaded.usage.deferredCI.filter(r=>r!==row);await saveUsage(api,loaded,now);continue;}
    const run=await api(`/actions/runs/${row.run}`);
    if(run.status!=='completed')return;
    const {jobs}=await api(`/actions/runs/${row.run}/jobs?per_page=100`),gate=jobs.find(job=>job.name==='budget'&&job.conclusion==='failure');
    if(!gate){loaded.usage.deferredCI=loaded.usage.deferredCI.filter(r=>r!==row);await saveUsage(api,loaded,now);continue;}
    // Persist a cooldown before the API call: an ambiguous HTTP failure must
    // not create repeated dispatches. A successful new admission removes it.
    row.nextRetryAt=new Date(now+6*3600000).toISOString();await saveUsage(api,loaded,now);
    await api(`/actions/jobs/${gate.id}/rerun`,'POST',{});return;
  }
}
export async function admitUsage(api,{kind,scope='application',mode='final',now=Date.now(),run,attempt,manual=false,ci,campaignEvent}={}) {
  const loaded=await loadUsage(api,now);
  await reconcileUsage(api,loaded.usage,{now,currentRun:run});
  const campaign=campaignEvent?await campaignStage(api,loaded.usage,{event:campaignEvent,scope,mode,now,run,attempt}):null;
  const plan=allocation(loaded.usage,{kind,scope,mode,now,manual,limit:campaign?CI51_TEMPORARY_LIMIT:ACTIONS_LIMIT});
  if(campaign){
    if(!plan.allowed)throw Error('CI51 admission refused');
    loaded.usage.ci51ValidationCampaign=campaign;
  }
  if(kind==='ci'&&ci){
    loaded.usage.deferredCI=(loaded.usage.deferredCI??[]).filter(row=>row.pr!==ci.pr);
    if(!plan.allowed)loaded.usage.deferredCI.push({pr:ci.pr,head:ci.head,...(ci.base?{base:ci.base}:{}),run:String(run),attempt,scope,mode,nextRetryAt:new Date(now+6*3600000).toISOString()});
  }
  reserveAllocation(loaded.usage,plan,run,attempt,now);
  await saveUsage(api,loaded,now); // No expensive output before durable CAS succeeds.
  if(plan.halt)await suspendWorkflows(api,loaded.usage,run);
  else if(kind!=='ci')try{await retryDeferredCI(api,loaded,now);}catch{/* A deferred CI retry is optional; it never bypasses its new budget admission. */}
  return plan;
}
export async function requireJobBudget(api,job,minutes,{env=process.env,now=Date.now()}={}) {
  const {usage}=await loadUsage(api,now);
  const run=env.GITHUB_RUN_ID,attempt=Number(env.GITHUB_RUN_ATTEMPT??1);
  const limit=await campaignJobLimit(api,usage,{run,attempt,now});
  return assertGrant(usage,{run,attempt,job,minutes,now,limit});
}
export async function extendUsage(api,requirements,{env=process.env,now=Date.now()}={}) {
  const loaded=await loadUsage(api,now);await reconcileUsage(api,loaded.usage,{now,currentRun:env.GITHUB_RUN_ID});
  const entry=loaded.usage.reservations[`${env.GITHUB_RUN_ID}:${Number(env.GITHUB_RUN_ATTEMPT??1)}`];
  if(!entry)throw Error('Cannot extend an unadmitted run');
  let extra=0;
  for(const [job,minutes] of Object.entries(requirements)){
    if(!['release-validation','release-finalize','production'].includes(job)||!Number.isSafeInteger(minutes)||minutes<1||minutes>90)throw Error('Invalid protected follow-up allocation');
    extra+=Math.max(0,minutes+6-(Object.hasOwn(entry.jobs,job)?entry.jobs[job]+6:0));
  }
  const available=chargedMinutes(loaded.usage)+reservedMinutes(loaded.usage)+extra+CONTROL_ALLOWANCE+recoveryAllowance(now)<=ACTIONS_LIMIT;
  if(available){entry.total+=extra;for(const [job,minutes] of Object.entries(requirements))entry.jobs[job]=Math.max(entry.jobs[job]??0,minutes);}
  await saveUsage(api,loaded,now);
  return available;
}
export async function changedScope(api,event) {
  return (await changedCI(api,event)).scope;
}
export async function changedCI(api,event) {
  const pr=event?.pull_request;
  if(!pr||pr.head?.repo?.full_name!=='Aimericv/puzzoria')throw Error('Same-repository PR is required for budgeted CI');
  const latest=await api(`/pulls/${pr.number}`);
  if(latest.head?.sha!==pr.head.sha||latest.base?.ref!==campaignBase||pr.base?.ref!==campaignBase||
    !/^[a-f0-9]{40}$/.test(pr.base?.sha??'')||latest.base.sha!==pr.base.sha||
    typeof pr.draft!=='boolean'||latest.draft!==pr.draft)throw Error('PR changed before budget classification');
  const files=[];
  for(let page=1;;page++){const rows=await api(`/pulls/${pr.number}/files?per_page=100&page=${page}`);if(!Array.isArray(rows))throw Error('Invalid diff');for(const row of rows){files.push(row.filename);if(row.previous_filename)files.push(row.previous_filename);}if(rows.length<100)break;if(page>=30)throw Error('Incomplete PR diff');}
  const scope=ciScope(files);
  return {scope,mode:scope==='application'&&latest.draft?'development':'final',head:pr.head.sha,base:pr.base.sha};
}
