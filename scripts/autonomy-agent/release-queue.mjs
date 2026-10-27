const sha=value=>/^[a-f0-9]{40}$/.test(value??'');
export function verifiedReceipt(receipt) {
  return receipt?.verified===true&&sha(receipt.sha)&&sha(receipt.base)&&Number.isSafeInteger(receipt.prNumber)&&receipt.prNumber>0&&/^[a-z0-9][a-z0-9-]{0,79}$/.test(receipt.experimentId??'');
}
const terminal=new Set(['merged','merged_documentation','merged_externally','closed','deployed','rolled_back']);
export function ensureReleaseQueue(state) {
  state.growth??={};const growth=state.growth;
  if(!growth.pendingDeployment&&growth.releaseCandidate?.status==='awaiting_activation')growth.pendingDeployment=structuredClone(growth.releaseCandidate);
  growth.releaseQueue??=[];
  if(!Array.isArray(growth.releaseQueue)||growth.releaseQueue.length>64||growth.releaseQueue.some(row=>!verifiedReceipt(row)))throw Error('Invalid trusted release queue');
  for(const row of [growth.releaseCandidate,growth.deferredReleaseCandidate])if(verifiedReceipt(row)&&!growth.releaseQueue.some(entry=>entry.prNumber===row.prNumber))growth.releaseQueue.push(structuredClone(row));
  return growth.releaseQueue;
}
export function rememberReleaseCandidate(state,receipt) {
  if(!verifiedReceipt(receipt))throw Error('Only verified publication receipts may enter the release queue');
  const queue=ensureReleaseQueue(state),index=queue.findIndex(row=>row.prNumber===receipt.prNumber);
  if(index>=0)queue[index]=structuredClone(receipt);else queue.push(structuredClone(receipt));
  // The experiment ledger and Git history retain terminal records.
  state.growth.releaseQueue=queue.filter(row=>!terminal.has(row.status)).concat(queue.filter(row=>terminal.has(row.status)).slice(-16));
  if(state.growth.releaseQueue.length>64)throw Error('Pending release queue is full; preserve work for review');
  state.growth.releaseCandidate=state.growth.releaseQueue.find(row=>row.prNumber===receipt.prNumber)??structuredClone(receipt);
  return state.growth.releaseCandidate;
}
export function validationCandidates(state) {
  const source=[...(state.growth?.releaseQueue??[]),state.growth?.releaseCandidate,state.growth?.deferredReleaseCandidate];
  const seen=new Set();return source.filter(row=>{
    if(!verifiedReceipt(row)||seen.has(row.prNumber))return false;seen.add(row.prNumber);
    return [undefined,'proposed','waiting_validation_budget','validation_failed','validating','stale_main'].includes(row.status);
  });
}
export function pendingDeployment(state) {
  return state.growth?.pendingDeployment??(state?.growth?.releaseCandidate?.status==='awaiting_activation'?state.growth.releaseCandidate:null);
}
