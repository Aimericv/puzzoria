import {classifyRelease,assertValidation} from './release-policy.mjs';

// The caller supplies only trusted GitHub API and validator functions. Nothing
// from model output is interpreted as shell, an approval or a test result.
export async function mergeSafeCandidate({api,receipt,validation,files,policy,agentEnabled}) {
  if(agentEnabled!=='true'||policy?.safeMergeEnabled!==true) return {status:'disabled'};
  const risk=classifyRelease(files);
  if(risk.risk!=='low')return {status:'manual_review',risk};
  const head=receipt.sha,base=receipt.base;
  if(!/^[a-f0-9]{40}$/.test(head??'')||!/^[a-f0-9]{40}$/.test(base??'')||!Number.isSafeInteger(receipt.prNumber)||receipt.verified!==true)throw Error('A trusted verified publication receipt is required');
  if(risk.kind==='documentation') {
    if(validation?.head!==head||validation?.base!==base||validation?.status!=='passed'||validation?.documentationOnly!==true)throw Error('Pinned documentation validation required');
  } else assertValidation(validation,{head,base,minimumUnitTests:policy.minimumUnitTests});
  const pr=await api(`/pulls/${receipt.prNumber}`);
  if(pr.head.sha!==head||pr.base.sha!==base||pr.base.ref!=='main'||pr.head.repo?.full_name!=='Aimericv/puzzoria'||pr.merged||!pr.head.ref.startsWith('codex/experiments/'))throw Error('PR changed or is not an isolated autonomous experiment');
  if((await api('/git/ref/heads/main')).object.sha!==base) return {status:'stale_main'};
  const candidate=await api(`/git/commits/${head}`),main=await api(`/git/commits/${base}`);
  if(candidate.tree.sha!==validation.tree)throw Error('Validated source tree changed');
  // A two-parent commit with an exact candidate tree, followed by a non-forced
  // ref update, provides a main compare-and-swap: a racing main update is not
  // an ancestor of this commit and GitHub refuses it. Never use force or a
  // queued auto-merge that could merge an untested future revision.
  const commit=await api('/git/commits','POST',{message:`Puzzoria: validated growth experiment ${receipt.experimentId}`,tree:candidate.tree.sha,parents:[base,head]});
  try{await api('/git/refs/heads/main','PATCH',{sha:commit.sha,force:false});}
  catch(error){if([409,422].includes(error.status))return {status:'stale_main'};throw error;}
  return {status:'merged',sha:commit.sha,candidate:head,previousMain:base,previousTree:main.tree.sha,risk,prNumber:receipt.prNumber};
}
