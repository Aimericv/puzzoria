import {readFileSync,appendFileSync} from 'node:fs';
import {github} from '../autonomy-pilot/github.mjs';
import {ACTIONS_LIMIT,monthWindow,MANAGED_WORKFLOWS,chargedMinutes,reservedMinutes} from './actions-budget.mjs';
import {admitUsage,loadUsage,suspendWorkflows,changedCI,requireJobBudget,extendUsage,recoverUsage} from './actions-budget-runtime.mjs';

if(process.env.GITHUB_REPOSITORY!=='Aimericv/puzzoria')throw Error('Fixed Puzzoria repository required');
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),mode=process.argv[2]??'admit',now=Date.now();
const output=(key,value)=>{if(process.env.GITHUB_OUTPUT)appendFileSync(process.env.GITHUB_OUTPUT,`${key}=${value}\n`);};
const summary=value=>{if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,value+'\n');};
try {
  if(mode==='assert') {
    await requireJobBudget(api,process.env.PUZZORIA_BUDGET_JOB??process.env.GITHUB_JOB,Number(process.env.PUZZORIA_JOB_TIMEOUT));
  } else if(mode==='extend-production') {
    const admitted=await extendUsage(api,{production:30});output('allowed',admitted);
  } else if(mode==='reset') {
    // Never zero an existing month or change pause, quota, release or production authorization.
    const {usage,enabled}=await recoverUsage(api,{now,run:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT??1)});
    summary(`Actions ${monthWindow(now).month} : ${chargedMinutes(usage)} min observées, ${reservedMinutes(usage)} réservées. Réactivation : ${enabled}. Plafond Puzzoria : ${ACTIONS_LIMIT} min. Workflows concernés : ${MANAGED_WORKFLOWS.join(', ')}.`);
  } else if(mode==='admit') {
    const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
    let kind=process.env.PUZZORIA_BUDGET_KIND;
    const context=kind==='ci'?await changedCI(api,event):{scope:'application',mode:'final'};
    if(kind==='autonomy')kind=event.inputs?.['check-search-console']===true||event.inputs?.['check-search-console']==='true'?'search-console':event.inputs?.['deploy-pending']===true||event.inputs?.['deploy-pending']==='true'?'deployment':event.inputs?.['validate-pending']===true||event.inputs?.['validate-pending']==='true'?'validation':'session';
    const plan=await admitUsage(api,{kind,...context,now,run:process.env.GITHUB_RUN_ID,attempt:Number(process.env.GITHUB_RUN_ATTEMPT??1),manual:process.env.GITHUB_EVENT_NAME==='workflow_dispatch',ci:kind==='ci'?{pr:event.pull_request.number,head:event.pull_request.head.sha,base:context.base}:undefined});
    for(const [key,value] of Object.entries({allowed:plan.allowed,scope:plan.scope,mode:plan.mode,head:context.head??'',base:context.base??'',session_timeout:plan.sessionTimeout??3,release_allowed:Boolean(plan.releaseAllowed),production_allowed:Boolean(plan.productionAllowed||kind==='deployment'&&plan.allowed)}))output(key,value);
    summary(`Actions ${plan.month} : **${plan.used} / ${plan.limit} min observées**, ${plan.held} min déjà réservées. Admission : ${plan.allowed} (${plan.reason??kind}). Les limites, arrondis, tentatives et marges d'annulation sont appliqués hors mémoire du modèle. [Comptabilité](https://github.com/Aimericv/puzzoria/tree/codex/actions-usage/agent/operations).`);
    console.log(JSON.stringify(plan));
    if(kind==='ci'&&!plan.allowed)process.exitCode=1; // Deferred compute is never a green application validation.
  } else if(mode==='seed-check') {
    // Read-only local operator diagnostics; no inference or hosted work.
    const {usage}=await loadUsage(api,now);console.log(JSON.stringify({month:usage.month,charged:chargedMinutes(usage),held:reservedMinutes(usage)}));
  } else throw Error('Unknown budget operation');
} catch(error) {
  output('allowed',false);output('release_allowed',false);output('production_allowed',false);
  // Failure to account never authorizes compute. Try the external stop switches.
  if(mode!=='assert')try{await suspendWorkflows(api);}catch{/* The job remains failed and cannot admit downstream work. */}
  console.error(`Actions budget refused: ${error.message}`);process.exitCode=1;
}
