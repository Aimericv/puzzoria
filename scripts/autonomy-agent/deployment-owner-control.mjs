import {readComments} from './inbox.mjs';
import {trustedMessages} from './policy.mjs';
export function deploymentStateAdmissible(state) {
  return !!state&&!state.paused&&state.status!=='paused'&&!(state.pendingMessages?.length);
}
export async function deploymentOwnerControl(api,state) {
  if(!deploymentStateAdmissible(state)||!Number.isSafeInteger(state.ownerId)||state.ownerId<1||!Number.isSafeInteger(state.issueNumber)||state.issueNumber<1)return false;
  try {
    const repo=await api('');
    if(repo.full_name!=='Aimericv/puzzoria'||repo.owner?.id!==state.ownerId)return false;
    const comments=await readComments(api,state.issueNumber);
    if(comments.some(c=>!Number.isSafeInteger(c.id)||!Number.isSafeInteger(c.user?.id)||typeof c.body!=='string'))return false;
    // A queued issue event must not let a deployment overtake its owner's pause
    // or new directives. /status only reads state and cannot authorize a rollout.
    return trustedMessages(comments,state.ownerId,state.issueNumber,state.lastMessageId)
      .every(message=>message.text.trim().toLowerCase()==='/status');
  }catch{return false;}
}
