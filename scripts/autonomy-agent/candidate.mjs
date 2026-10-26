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

export async function publishCandidate(api,parent,files,summary,expectedHead=null,metadata={}) {
  if(!files.length && parent===expectedHead) return null;
  const branch=metadata.branch??WORK_BRANCH;
  if(branch!==WORK_BRANCH&&!/^codex\/experiments\/[a-z0-9][a-z0-9-]{2,63}$/.test(branch))throw Error('Invalid experiment branch');
  const sha=await stageCandidate(api,parent,files,branch,expectedHead);
  const prs=await api(`/pulls?state=open&head=Aimericv:${branch}`);
  const description=`${summary}\n\nDéveloppement autonome avec ChatGPT Plus. Lint, types, tests unitaires, contenus et build exécutés par le vérificateur isolé. Voir le ticket de suivi et les preuves de session pour les résultats exacts.\n\n${metadata.experiment?`Expérience : ${metadata.experiment.id}. Objectif : ${metadata.experiment.objective}. Hypothèse : ${metadata.experiment.hypothesis}. Métrique : ${metadata.experiment.metric}. Aucune amélioration de production n'est attribuée avant un déploiement réellement confirmé.`:'Les sources de métriques disponibles sont décrites dans le rapport de session.'}\n\nLa fusion à faible risque demande une validation complète indépendante. La production reste soumise à son verrou d'activation et aux contrôles de déploiement.`;
  const pr=prs.length?await api(`/pulls/${prs[0].number}`,"PATCH",{body:description}):await api("/pulls","POST",{head:branch,base:"main",title:metadata.experiment?`Puzzoria : expérience ${metadata.experiment.id}`:"Puzzoria : contribution de l'agent autonome",body:description,draft:true});
  return {sha,url:pr.html_url,number:pr.number};
}
