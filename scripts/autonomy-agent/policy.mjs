import {assertFreeChatGPT} from "../autonomy-pilot/policy.mjs";

export const REPOSITORY="Aimericv/puzzoria";
export const STATE_BRANCH="codex/agent-state";
export const WORK_BRANCH="codex/agent-work";
export const STATE_PATH="agent/autonomy/state.json";
export const ISSUE_TITLE="Puzzoria — consignes et activité de l'agent";
export const MEMORY_FILES=["STATE.md","DECISIONS.md","EXPERIMENTS.md","PLAN.json"];

export function assertFunding(control) {
  const funding=control?.funding;
  if(control?.repository!==REPOSITORY || funding?.mode!=="no-payment-method" ||
     !funding.ownerDeclaration || !Number.isFinite(Date.parse(funding.verifiedAt)))
    throw new Error("Actions funding is unverified: an old $0-budget flag is not evidence; no paid execution is authorized");
  // This records the owner's explicit declaration, not a billing API verification.
  return {mode:funding.mode,source:"owner-declaration",verifiedAt:funding.verifiedAt};
}

export function quotaGate(account,limits,now=Date.now()) {
  const buckets=Object.values(limits?.rateLimitsByLimitId ?? {codex:limits?.rateLimits}).filter(Boolean);
  const blocking=buckets.flatMap(bucket=>[bucket.primary,bucket.secondary].filter(window=>window?.usedPercent>=100));
  // Other financial/account checks remain fail-closed even when a quota is exhausted.
  const clone=structuredClone(limits ?? {});
  for(const bucket of Object.values(clone.rateLimitsByLimitId ?? {codex:clone.rateLimits}).filter(Boolean)) {
    for(const window of [bucket.primary,bucket.secondary].filter(Boolean)) if(window.usedPercent>=100) window.usedPercent=99;
    bucket.rateLimitReachedType=null;
    bucket.spendControlReached=false;
  }
  try { assertFreeChatGPT(account,limits); return {status:"ready",quotas:assertFreeChatGPT(account,limits)}; }
  catch {
    // Missing/paid/API auth cannot be reclassified as an ordinary quota wait.
    if(account?.type!=="chatgpt" || account.planType!=="plus") return {status:"needs_login",reason:"ChatGPT Plus authentication unavailable"};
    if(!blocking.length) return {status:"blocked",reason:"Included usage or zero paid credits is unavailable, unknown or blocked"};
    const financiallyObservable=structuredClone(clone);
    financiallyObservable.ordinaryUsageAllowed=true;
    try {assertFreeChatGPT(account,financiallyObservable);} catch {return {status:"blocked",reason:"Financial or quota metadata is not safe to resume"};}
    if(buckets.some(bucket=>bucket.spendControlReached)) return {status:"blocked",reason:"Spend control reached; no automatic paid fallback"};
    const resets=blocking.map(window=>Number(window.resetsAt)*1000);
    if(resets.some(reset=>!Number.isFinite(reset)||reset<=now)) return {status:"blocked",reason:"Blocking quota reset is missing or stale"};
    return {status:"waiting_quota",nextEligibleAt:new Date(Math.max(...resets)).toISOString(),reason:"Included quota exhausted"};
  }
}

export function allowedCandidate(path) {
  if(typeof path!=="string" || path.includes("\\") || path.split("/").some(part=>!part||part==="."||part===".."||part.startsWith("."))) return false;
  if(/^(src|tests|e2e)\/.+\.(?:ts|tsx|css)$/.test(path)) return true;
  return /^docs\/.+\.md$/.test(path) && !/^docs\/(?:AUTONOMY|CLOUD-HANDOFF)/i.test(path);
}

export function trustedMessages(comments,ownerId,issueNumber,lastId=0) {
  if(!Number.isSafeInteger(ownerId) || ownerId<=0) throw new Error("Immutable repository owner ID required");
  return comments.filter(comment=>comment.id>lastId && comment.user?.id===ownerId && comment.user?.type==="User" &&
    comment.issue_url?.endsWith(`/issues/${issueNumber}`) && typeof comment.body==="string")
    .sort((a,b)=>a.id-b.id).map(comment=>({id:comment.id,text:comment.body.slice(0,16000),url:comment.html_url}));
}

export function canWake(state,now=Date.now(),hasMessages=false) {
  if(state.status==="paused" || state.status==="needs_login") return false;
  if(state.nextEligibleAt && Date.parse(state.nextEligibleAt)>now) return false;
  return hasMessages || state.status!=="blocked";
}

export function redact(text,secrets=[]) {
  let clean=String(text);
  for(const value of secrets.filter(value=>typeof value==="string"&&value.length>0)) clean=clean.split(value).join("[redacted]");
  return clean.replace(/Bearer\s+[^\s"']+/gi,"Bearer [redacted]")
    .replace(/https?:\/\/[^\s"']+\?[^\s"']+/g,"[redacted-url-query]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[redacted-jwt]").slice(0,12000);
}
