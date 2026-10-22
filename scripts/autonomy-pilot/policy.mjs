export const CONTROL_BRANCH="codex/autonomy-pilot";
export const PROOF_BRANCH="codex/autonomy-proof";
export const STATE_PATH="agent/pilot/memory/STATE.json";
export function allowedOutput(path) {
  return /^agent\/pilot\/task\/[a-z0-9-]+(?:\.test)?\.mjs$/.test(path) || path===STATE_PATH || path==="agent/pilot/memory/STATE.md";
}
export function assertFreeChatGPT(account, limits) {
  if(account?.type!=="chatgpt" || account.planType!=="plus") throw new Error("The pilot requires ChatGPT Plus auth");
  if(limits?.ordinaryUsageAllowed!==true) throw new Error("Included usage permission unavailable or exhausted");
  const buckets=Object.values(limits.rateLimitsByLimitId ?? {codex:limits.rateLimits}).filter(Boolean);
  if(!buckets.length) throw new Error("Quota information unavailable");
  for(const b of buckets) {
    const credits=b.credits ?? limits.credits;
    if(!credits || credits.hasCredits!==false || credits.unlimited!==false || credits.balance==null || Number(credits.balance)!==0) throw new Error("Zero paid credits must be observable");
    const windows=[b.primary,b.secondary].filter(Boolean);
    if(!windows.length || windows.some(w=>!Number.isFinite(w.usedPercent) || w.usedPercent<0)) throw new Error("Quota information unavailable");
    if(b.rateLimitReachedType || b.spendControlReached || windows.some(w=>w.usedPercent>=100)) throw new Error("Included quota exhausted: wait for reset");
  }
  return buckets.map(b=>({id:b.limitId,primary:b.primary,secondary:b.secondary}));
}
