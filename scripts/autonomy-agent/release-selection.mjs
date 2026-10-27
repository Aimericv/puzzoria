import {classifyRelease,releaseSourceEligible} from './release-policy.mjs';
import {ensureReleaseQueue,validationCandidates} from './release-queue.mjs';
export async function loadReleaseFiles(api,receipt) {
  const comparison=await api(`/compare/${receipt.base}...${receipt.sha}`);
  if(comparison.status!=='ahead'||comparison.behind_by!==0||!comparison.files?.length||comparison.files.length>=300)throw Error('Candidate is not isolated from its recorded base');
  const tree=await api(`/git/trees/${receipt.sha}?recursive=1`);if(tree.truncated)throw Error('Candidate tree is truncated');
  const get=async(path,ref)=>{const f=await api(`/contents/${path}?ref=${ref}`);if(f.encoding!=='base64'||f.size>262144)throw Error('Unexpected release source file');return Buffer.from(f.content,'base64').toString('utf8');};
  const files=[];
  for(const row of comparison.files) {
    const entry=tree.tree.find(e=>e.path===row.filename),eligible=releaseSourceEligible(row.filename);
    files.push({path:row.filename,mode:['added','modified'].includes(row.status)?entry?.mode??'deleted':'unsupported',deleted:row.status==='removed',after:eligible&&entry?.mode==='100644'?await get(row.filename,receipt.sha):'',before:eligible&&row.status!=='added'?await get(row.filename,receipt.base):undefined});
  }
  return files;
}
export async function selectReleaseCandidate(api,state,main,{wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  ensureReleaseQueue(state);const eligible=[];
  for(const receipt of validationCandidates(state)) {
    const experiment=state.growth.experiments?.find(e=>e.id===receipt.experimentId&&e.prNumber===receipt.prNumber&&e.candidateSha===receipt.sha);
    if(!experiment){receipt.status='manual_review';receipt.reason='unknown_or_changed_experiment';continue;}
    if(['stop','pivot'].includes(experiment.decision)){receipt.status='cancelled_by_strategy';experiment.status='cancelled';continue;}
    const pr=await api(`/pulls/${receipt.prNumber}`);
    if(pr.merged){receipt.status='merged_externally';experiment.status='merged_externally';experiment.mergeSha=pr.merge_commit_sha;continue;}
    if(pr.state==='closed'){receipt.status='closed';experiment.status='closed';continue;}
    if(pr.head.sha!==receipt.sha||pr.head.repo?.full_name!=='Aimericv/puzzoria'||!pr.head.ref.startsWith('codex/experiments/')||pr.base.ref!=='main'){receipt.status='manual_review';receipt.reason='publication_changed';continue;}
    const risk=classifyRelease(await loadReleaseFiles(api,receipt));receipt.risk=risk;
    if(risk.risk!=='low'){receipt.status='manual_review';const e=state.growth.experiments?.find(e=>e.id===receipt.experimentId);if(e)e.status='manual_review';continue;}
    eligible.push(receipt);
  }
  // Drain documentation without repeatedly rebasing application PRs first.
  eligible.sort((a,b)=>Number(b.risk.kind==='documentation')-Number(a.risk.kind==='documentation')||a.prNumber-b.prNumber);
  for(const receipt of eligible) {
    if(receipt.base!==main) {
      const old=receipt.sha;
      try{await api(`/pulls/${receipt.prNumber}/update-branch`,'PUT',{expected_head_sha:old});}
      catch(error){if(![409,422].includes(error.status))throw error;receipt.status='manual_review';receipt.reason='rebase_conflict';continue;}
      let next;
      for(let attempt=0;attempt<20;attempt++) {
        const pr=await api(`/pulls/${receipt.prNumber}`);
        if(pr.head.sha!==old) {
          const commit=await api(`/git/commits/${pr.head.sha}`);
          if(!commit.parents?.some(p=>p.sha===old)||!commit.parents.some(p=>p.sha===main)){receipt.status='manual_review';receipt.reason='unexpected_rebase';break;}
          next={...receipt,sha:pr.head.sha,base:main};
          const risk=classifyRelease(await loadReleaseFiles(api,next));
          if(risk.risk!=='low'){receipt.status='manual_review';receipt.reason='changed_rebase_risk';next=null;}
          else next.risk=risk;
          break;
        }
        await wait(1000);
      }
      if(!next){if(receipt.status!=='manual_review')receipt.status='stale_main';continue;}
      Object.assign(receipt,next,{nativeVerifiedSha:receipt.nativeVerifiedSha??old,rebase:{automatic:true,previousHead:old}});
      const experiment=state.growth.experiments?.find(e=>e.id===receipt.experimentId);if(experiment)experiment.candidateSha=receipt.sha;
    }
    state.growth.releaseCandidate=receipt;return receipt;
  }
  return null;
}
