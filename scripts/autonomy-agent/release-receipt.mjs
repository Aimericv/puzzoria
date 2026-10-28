const validSha=value=>/^[a-f0-9]{40}$/.test(value??'');
const restore=(target,source)=>{for(const key of Object.keys(target))delete target[key];Object.assign(target,source);};
export async function commitObservedDeployment({state,store,candidate,experiment,receipt,sha,expected}) {
  if(!validSha(sha)||!validSha(expected)||receipt.sha!==sha||!['healthy','rolled_back'].includes(receipt.phase)||receipt.backup?.verified!==true||receipt.phase==='healthy'&&(receipt.currentCommit!==sha||!Number.isFinite(Date.parse(receipt.releasedAt))))throw Error('A verified exact host receipt is required');
  const previous=structuredClone(state);
  try {
    candidate.status=receipt.phase==='healthy'?'deployed':'rolled_back';
    const queued=state.growth.releaseQueue?.find(row=>row.prNumber===candidate.prNumber&&row.sha===candidate.sha);
    if(queued)queued.status=candidate.status;
    const deployment={status:candidate.status,sha,releasedAt:receipt.releasedAt??null,finishedAt:receipt.finishedAt,previousCommit:expected};
    if(experiment)experiment.deployment=deployment;
    if(candidate.status==='deployed')state.growth.lastDeployedCommit=sha;
    await store.save('Record the observed host receipt before optional attribution or report requests');
    return deployment;
  }catch(error){restore(state,previous);throw error;}
}
export async function attributeSharedRollouts({api,state,store,experiment,deployment,onDeferred=()=>{}}) {
  if(deployment.status!=='deployed')return;
  const confirmed=structuredClone(state);let changed=false;
  for(const row of state.growth.experiments){
    if(row===experiment||!validSha(row.mergeSha)||row.deployment?.releasedAt)continue;
    try {
      const comparison=await api(`/compare/${row.mergeSha}...${deployment.sha}`);
      if(['ahead','identical'].includes(comparison.status)){row.deployment={...deployment,sharedRollout:true};changed=true;}
    }catch{onDeferred({sharedAttributionDeferred:true});}
  }
  if(changed)try{await store.save('Attribute already confirmed shared production without changing its receipt');}catch{restore(state,confirmed);onDeferred({sharedAttributionDeferred:true});}
}
