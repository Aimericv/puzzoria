import {ISSUE_TITLE} from "./policy.mjs";

export async function ensureIssue(api,state) {
  if(state.issueNumber) return state.issueNumber;
  const issue=await api("/issues","POST",{title:ISSUE_TITLE,body:"L'agent est en préparation. Les réveils permanents ne sont pas activés.\n\nÉcrivez ici vos consignes en français. Seuls les messages du propriétaire seront traités. Les conversations Codex Cloud ne sont pas automatiquement transmises ici.\n\nAucun déploiement ou achat n'est autorisé."});
  state.issueNumber=issue.number;return issue.number;
}

export async function readComments(api,number) {
  const all=[];
  for(let page=1;;page++) {
    const rows=await api(`/issues/${number}/comments?per_page=100&page=${page}`);
    all.push(...rows);
    if(rows.length<100) return all;
    if(all.length>10000) throw new Error("Inbox exceeds the safe pagination limit");
  }
}

export async function report(api,state,text) {
  const run=state.lastRun?.url ?? "";
  const body=`${text}\n\nÉtat : **${state.status}**. Sessions validées : ${state.completedSessions}.`+
    (state.nextEligibleAt?` Prochaine admissibilité : ${state.nextEligibleAt}.`:"")+
    (run?`\n\n[Exécution GitHub](${run})`:"");
  await api(`/issues/${state.issueNumber}/comments`,"POST",{body});
  await api(`/issues/${state.issueNumber}`,"PATCH",{body:`## État courant\n\n**${state.status}** — ${state.completedSessions} session(s) vérifiée(s).\n\n${state.nextEligibleAt?`Prochaine admissibilité : ${state.nextEligibleAt}.`:"La prochaine session choisira sa mission à partir de la mémoire et de vos consignes."}\n\n${run?`[Dernière exécution](${run})`:""}\n\nÉcrivez vos consignes en commentaires. Seul le propriétaire est accepté. /pause, /resume et /status sont pris en charge. Une conversation Codex Cloud n'est pas automatiquement transmise ici.\n\nAucun achat, merge ou déploiement de production. L'activation permanente nécessite la validation explicite du propriétaire.`});
}
