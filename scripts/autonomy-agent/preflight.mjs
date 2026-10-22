import {readFileSync,writeFileSync} from "node:fs";
import {github} from "../autonomy-pilot/github.mjs";
import {assertFunding,REPOSITORY,canWake,trustedMessages} from "./policy.mjs";
import {StateStore} from "./store.mjs";
import {ensureIssue,readComments,report} from "./inbox.mjs";

const control=JSON.parse(readFileSync("agent/autonomy/control.json","utf8"));
assertFunding(control);
if(process.env.GITHUB_REPOSITORY!==REPOSITORY) throw new Error("Unexpected repository");
const validation=process.env.AGENT_MODE==="validation";
if(!validation && (control.permanentActivationApproved!==true || process.env.PUZZORIA_AGENT_ENABLED!=="true"))
  throw new Error("Permanent activation is not approved; no autonomous wakeup is authorized");
const api=github(process.env.GITHUB_TOKEN,REPOSITORY);
const store=new StateStore(api,control,process.env.GITHUB_SHA), state=await store.load();
state.permanentActivationEnabled=control.permanentActivationApproved===true&&process.env.PUZZORIA_AGENT_ENABLED==="true";
const repo=await api("");
state.ownerId=repo.owner.id;
await ensureIssue(api,state);
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
if(process.env.GITHUB_EVENT_NAME==="issue_comment" && (event.issue?.number!==state.issueNumber || event.issue?.pull_request || event.comment?.user?.id!==state.ownerId || event.comment?.user?.type!=="User")) {
  if(process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT,"run_model=false\n",{flag:"a"});
  console.log("Unrelated or unauthorized inbox event ignored.");
  process.exit(0);
}
if(validation && state.controlSha!==process.env.GITHUB_SHA && ["retrying","blocked"].includes(state.status)) {state.status="ready";state.nextEligibleAt=null;}
state.controlSha=process.env.GITHUB_SHA;
const comments=await readComments(api,state.issueNumber);
const messages=trustedMessages(comments,state.ownerId,state.issueNumber,state.lastMessageId);
state.pendingMessages ??=[];
for(const message of messages) {
  const command=message.text.trim().toLowerCase();
  if(command==="/pause") state.paused=true;
  else if(command==="/resume" || command==="/reprendre") {state.paused=false;if(state.status==="paused")state.status="ready";}
  else if(command!=="/status") state.pendingMessages.push(message);
}
state.lastMessageId=Math.max(state.lastMessageId,...comments.map(comment=>comment.id));
if(state.paused) state.status="paused";
const onlyStatus=messages.length>0&&messages.every(message=>message.text.trim().toLowerCase()==="/status");
const runModel=!state.paused&&!onlyStatus&&canWake(state,Date.now(),state.pendingMessages.length>0);
await store.save("Read owner directives and decide whether a model session is due");
if(messages.length) await report(api,state,`Consignes reçues : ${messages.map(message=>`#${message.id}`).join(", ")}. ${runModel?"La prochaine session va les traiter.":"Elles sont conservées pour la prochaine session admissible."}`);
if(process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT,`run_model=${runModel}\nissue_url=https://github.com/${REPOSITORY}/issues/${state.issueNumber}\n`,{flag:"a"});
console.log(JSON.stringify({runModel,status:state.status,issueNumber:state.issueNumber,nextEligibleAt:state.nextEligibleAt,permanentActivationApproved:control.permanentActivationApproved}));
