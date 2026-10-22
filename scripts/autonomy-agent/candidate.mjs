import {WORK_BRANCH} from "./policy.mjs";
import {optional} from "./store.mjs";

export async function stageCandidate(api,parent,files,branch,expectedHead=null) {
  const current=await optional(api,`/git/ref/heads/${branch}`);
  if((current?.object.sha ?? null)!==expectedHead) throw new Error("Candidate branch changed concurrently");
  const commit=await api(`/git/commits/${parent}`);
  const tree=await api("/git/trees","POST",{base_tree:commit.tree.sha,tree:files.map(file=>file.deleted?{path:file.path,mode:"100644",type:"blob",sha:null}:{path:file.path,mode:"100644",type:"blob",content:file.content})});
  const next=await api("/git/commits","POST",{message:"Puzzoria agent: autonomous work snapshot",tree:tree.sha,parents:[parent]});
  if(current) await api(`/git/refs/heads/${branch}`,"PATCH",{sha:next.sha,force:false});
  else await api("/git/refs","POST",{ref:`refs/heads/${branch}`,sha:next.sha});
  return next.sha;
}

export async function publishCandidate(api,parent,files,summary,expectedHead=null) {
  if(!files.length && parent===expectedHead) return null;
  const sha=await stageCandidate(api,parent,files,WORK_BRANCH,expectedHead);
  const prs=await api(`/pulls?state=open&head=Aimericv:${WORK_BRANCH}`);
  const description=`${summary}\n\nDéveloppement autonome avec ChatGPT Plus, sans déploiement ni fusion automatique. Lint, types, tests unitaires et build exécutés par le superviseur dans le sandbox. Voir le ticket de suivi et les preuves de session pour les résultats exacts.\n\nLes métriques réelles ne sont pas raccordées.`;
  const pr=prs.length?await api(`/pulls/${prs[0].number}`,"PATCH",{body:description}):await api("/pulls","POST",{head:WORK_BRANCH,base:"main",title:"Puzzoria : contribution de l'agent autonome",body:description,draft:true});
  return {sha,url:pr.html_url,number:pr.number};
}
