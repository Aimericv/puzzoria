import {allowedOutput, CONTROL_BRANCH, PROOF_BRANCH} from "./policy.mjs";

export function github(token, repository) {
  if(repository!=="Aimericv/puzzoria") throw new Error("Unexpected repository");
  return async function request(path,method="GET",body) {
    const comparison=/^\/compare\/[a-f0-9]{40}\.\.\.[a-f0-9]{40}$/.test(path);
    if((path!=="" && !path.startsWith("/")) || (path.includes("..")&&!comparison)) throw new Error("Invalid GitHub path");
    const response=await fetch(`https://api.github.com/repos/${repository}${path}`,{method,headers:{Authorization:`Bearer ${token}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
    if(!response.ok) {
      const error=new Error(`GitHub ${method} ${path.split("?")[0]} returned ${response.status}`);
      error.status=response.status;
      throw error;
    }
    return response.status===204?null:response.json();
  };
}
export async function publish(api, parent, files, phase, evidence) {
  for(const file of files) if(!allowedOutput(file.path)) throw new Error("Publication outside the bounded task");
  const parentCommit=await api(`/git/commits/${parent}`);
  const tree=await api("/git/trees","POST",{base_tree:parentCommit.tree.sha,tree:[...files,{path:`agent/pilot/evidence/session-${phase}.json`,content:JSON.stringify(evidence,null,2)+"\n"}].map(f=>({...f,mode:"100644",type:"blob"}))});
  const commit=await api("/git/commits","POST",{message:`Codex cloud pilot: independent session ${phase}`,tree:tree.sha,parents:[parent]});
  if(phase===1) await api("/git/refs","POST",{ref:`refs/heads/${PROOF_BRANCH}`,sha:commit.sha});
  else {
    const current=await api(`/git/ref/heads/${PROOF_BRANCH}`);
    if(current.object.sha!==parent) throw new Error("Proof branch changed concurrently");
    await api(`/git/refs/heads/${PROOF_BRANCH}`,"PATCH",{sha:commit.sha,force:false});
  }
  let pr;
  if(phase===1) pr=await api("/pulls","POST",{head:PROOF_BRANCH,base:CONTROL_BRANCH,title:"Prove two independent Codex Plus cloud sessions",body:"Bounded development proof. Code and memory produced on GitHub-hosted runners with ChatGPT Plus auth. No production deployment or automatic merge. See agent/pilot/evidence for machine-recorded session evidence.",draft:true});
  else {const prs=await api(`/pulls?head=Aimericv:${PROOF_BRANCH}&state=open`);pr=prs[0];if(!pr) throw new Error("Missing first-session PR");}
  await api(`/statuses/${commit.sha}`,"POST",{state:"success",context:"autonomy-pilot/isolation-and-task",description:`Session ${phase}: sandbox canaries and independent verification passed`,target_url:`https://github.com/Aimericv/puzzoria/actions/runs/${evidence.runId}`});
  return {sha:commit.sha,pr:pr.number,url:pr.html_url};
}
