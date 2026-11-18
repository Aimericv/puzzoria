import {ACTIONS_LIMIT,CI51_TEMPORARY_LIMIT,CONTROL_ALLOWANCE,allocation,chargedMinutes,emptyUsage,recoveryAllowance,reserveAllocation,reservedMinutes} from './actions-budget.mjs';

export const campaignBase='codex/ci51-validation-base';
export const campaignAlternate='codex/ci51-validation-alternate';
export const campaignHead='codex/ci51-validation-candidate';
export const expiresAt=Date.parse('2026-11-19T21:45:00Z');
const repository='Aimericv/puzzoria';
const stages=['opened','ready_for_review','converted_to_draft'];

export async function campaignStage(api,usage,{event,run,attempt,scope,mode,now}) {
  const pr=event?.pull_request;
  const saved=usage.ci51ValidationCampaign;
  const completed=saved?.runs.length??0;
  const previous=saved?.runs.at(-1);
  if(now>=expiresAt||attempt!==1||scope!=='application'||event?.action!==stages[completed]||
     !Number.isSafeInteger(pr?.number)||pr.state!=='open'||pr.head?.ref!==campaignHead||
     pr.head.repo?.full_name!==repository||pr.base?.ref!==campaignBase||
     mode!==(completed===1?'final':'development')||
     (saved&&(saved.pr!==pr.number||saved.head!==pr.head.sha||saved.base!==pr.base.sha||
       saved.runs.includes(String(run))||usage.runs[previous]?.completed!==true))) {
    throw Error('CI51 campaign stage, revision or expiry does not authorize this run');
  }
  const workflowRun=await api(`/actions/runs/${run}`);
  if((await api('')).visibility!=='public'||workflowRun.event!=='pull_request'||workflowRun.path!=='.github/workflows/ci.yml'||
     workflowRun.repository?.full_name!==repository||workflowRun.run_attempt!==attempt||workflowRun.head_sha!==pr.head.sha||
     workflowRun.head_branch!==campaignHead)throw Error('CI51 requires the expected public repository and workflow run');
  const remaining=stages.slice(completed).reduce((total,stage)=>{
    const sample=emptyUsage(now);
    const next=allocation(sample,{kind:'ci',mode:stage==='ready_for_review'?'final':'development',now});
    return total+reserveAllocation(sample,next,'1',1,now).total;
  },0);
  if(chargedMinutes(usage)+reservedMinutes(usage)+recoveryAllowance(now)+CONTROL_ALLOWANCE+remaining>CI51_TEMPORARY_LIMIT) {
    throw Error('CI51 temporary ceiling does not cover all remaining campaign stages');
  }
  return {pr:pr.number,head:pr.head.sha,base:pr.base.sha,runs:[...(saved?.runs??[]),String(run)]};
}

export async function campaignJobLimit(api,usage,{run,attempt,now}) {
  const saved=usage.ci51ValidationCampaign;
  if(!saved?.runs.includes(String(run)))return ACTIONS_LIMIT;
  if(now>=expiresAt||attempt!==1||saved.runs.at(-1)!==String(run)||usage.runs[run]?.completed===true) {
    throw Error('CI51 campaign reservation expired or concluded');
  }
  const pr=await api(`/pulls/${saved.pr}`);
  if(pr.state!=='open'||pr.head?.ref!==campaignHead||pr.head.sha!==saved.head||pr.base?.ref!==campaignBase||
     pr.base.sha!==saved.base||pr.draft!==(saved.runs.length!==2)||(await api('')).visibility!=='public') {
    throw Error('CI51 campaign PR no longer matches its active reservation');
  }
  return CI51_TEMPORARY_LIMIT;
}
