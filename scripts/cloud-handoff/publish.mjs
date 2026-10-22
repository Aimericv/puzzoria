import {readFileSync,existsSync} from "node:fs";
import {github} from "../autonomy-pilot/github.mjs";

// Trusted publisher only: the remote cloud task never receives this GitHub token.
const repository="Aimericv/puzzoria", runId=process.env.GITHUB_RUN_ID;
if(process.env.GITHUB_REPOSITORY!==repository || !/^\d+$/.test(runId ?? "")) throw new Error("Unexpected publication context");
const api=github(process.env.GITHUB_TOKEN,repository);
const input=existsSync(".handoff-out/evidence.json") ? JSON.parse(readFileSync(".handoff-out/evidence.json","utf8")) : {status:"failed-before-evidence",error:"See GitHub run: the submission step did not produce evidence"};
const allowed=["schemaVersion","repository","runId","phase","environmentId","status","recordedAt","sourceCheckpoint","error","taskUrl","taskId","targetVerified","task","authMethod","plan","paidCredits","cliVersion","nonce","quotasBefore","quotasAfter","conversationReplyVerified"];
const evidence=Object.fromEntries(allowed.filter(key=>key in input).map(key=>[key,input[key]]));
evidence.runId=runId;
evidence.runUrl=`https://github.com/${repository}/actions/runs/${runId}`;
evidence.submissionStepOutcome=process.env.HANDOFF_OUTCOME;
evidence.checkpointArtifactId=process.env.HANDOFF_ARTIFACT_ID || null;
evidence.checkpointArtifactName=`cloud-handoff-${runId}-${process.env.GITHUB_RUN_ATTEMPT}`;
evidence.elapsedSeconds=Number(process.env.HANDOFF_ELAPSED_SECONDS || 0) || null;
const content=JSON.stringify(evidence,null,2)+"\n";
if(content.length>32768 || (process.env.GITHUB_TOKEN && content.includes(process.env.GITHUB_TOKEN))) throw new Error("Unexpected evidence publication");
const parent=process.env.GITHUB_SHA;
const commit=await api(`/git/commits/${parent}`);
const tree=await api("/git/trees","POST",{base_tree:commit.tree.sha,tree:[{path:"agent/cloud-handoff/evidence.json",mode:"100644",type:"blob",content}]});
const result=await api("/git/commits","POST",{message:`Record one-off Codex Cloud handoff ${runId}`,tree:tree.sha,parents:[parent]});
const branch=`codex/cloud-handoff-evidence/${runId}`;
// Creation only: never overwrite an existing result or change main/the pilot.
await api("/git/refs","POST",{ref:`refs/heads/${branch}`,sha:result.sha});
console.log(JSON.stringify({branch,commit:result.sha,runUrl:evidence.runUrl,taskUrl:evidence.taskUrl ?? null}));
