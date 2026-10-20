import {spawn,execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync,chownSync,chmodSync,renameSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {join,dirname} from "node:path";
import {Rpc} from "./rpc.mjs";
import {seal,unseal} from "./vault.mjs";
import {assertFreeChatGPT,STATE_PATH} from "./policy.mjs";
import {github,publish} from "./github.mjs";
import {collectOutputs} from "./outputs.mjs";

const phase=Number(process.argv[2]), uid=3050;
const base="/opt/puzzoria-pilot", work=base+"/work", auth=base+"/auth", readonly=base+"/readonly";
const cli=readonly+"/node_modules/@openai/codex/bin/codex.js", node=process.execPath;
const repository=process.env.GITHUB_REPOSITORY, runId=process.env.GITHUB_RUN_ID;
const key=process.env.CODEX_PILOT_VAULT_KEY, token=process.env.GITHUB_TOKEN;
const rootCheckout=process.env.GITHUB_WORKSPACE, output=join(rootCheckout,".pilot-out");
if(process.getuid?.()!==0 || ![1,2].includes(phase) || repository!=="Aimericv/puzzoria" || !key || !token) throw new Error("Invalid trusted pilot environment");
const parent=execFileSync("git",["rev-parse","HEAD"],{cwd:rootCheckout,encoding:"utf8"}).trim();
const env={PATH:dirname(node)+":/usr/local/bin:/usr/bin:/bin",HOME:"/home/puzzoria-pilot",CODEX_HOME:auth,TMPDIR:work+"/.tmp",LANG:"C.UTF-8"};
mkdirSync(env.TMPDIR,{recursive:true});chownSync(env.TMPDIR,uid,uid);
mkdirSync(output,{recursive:true,mode:0o755});
const authFile=auth+"/auth.json", context={repository,runId,phase};
let authValue;
if(phase===1) {
  // A seed is valid only for the initial proof. Never overwrite a rotated session with it.
  const api=github(token,repository);
  const existing=await api("/git/matching-refs/heads/codex/autonomy-proof");
  if(existing.length) throw new Error("Proof already exists: reuse its latest encrypted checkpoint, do not reseed");
  authValue=JSON.parse(process.env.CODEX_PILOT_SEED ?? "null");
} else authValue=unseal(readFileSync(join(rootCheckout,".pilot-in/auth.enc"),"utf8"),key,{repository,runId,phase:1});
if(!authValue?.tokens?.access_token || !authValue.tokens.refresh_token || authValue.OPENAI_API_KEY) throw new Error("ChatGPT managed auth required");
writeFileSync(authFile,JSON.stringify(authValue),{mode:0o600});chownSync(authFile,uid,uid);
writeFileSync(auth+"/config.toml",'cli_auth_credentials_store="file"\nforced_login_method="chatgpt"\ndefault_permissions="pilot"\ncheck_for_update_on_startup=false\nweb_search="disabled"\n[projects."/opt/puzzoria-pilot/work"]\ntrust_level="untrusted"\n',{mode:0o644});
chmodSync(auth+"/config.toml",0o444);
writeFileSync(auth+"/canary",randomBytes(24).toString("hex"),{mode:0o600});chownSync(auth+"/canary",uid,uid);
writeFileSync(base+"/private/canary",randomBytes(24).toString("hex"),{mode:0o600});

function sandbox(args) {
  return execFileSync(node,[cli,"sandbox","--include-managed-config","-P","pilot","-C",work,"--",node,...args],{uid,gid:uid,env,cwd:work,stdio:["ignore","pipe","pipe"],timeout:120000});
}
function persistAuth() {
  const current=JSON.parse(readFileSync(authFile,"utf8"));
  if(!current.tokens?.refresh_token || current.OPENAI_API_KEY) throw new Error("Cannot persist unexpected auth");
  const sealed=seal(current,key,context);
  if(Buffer.byteLength(sealed)>65536) throw new Error("Unexpected auth checkpoint size");
  writeFileSync(join(output,"auth.enc.tmp"),sealed,{mode:0o644});
  renameSync(join(output,"auth.enc.tmp"),join(output,"auth.enc"));
}
function stopAgent() {
  try {execFileSync("pkill",["-KILL","-u",String(uid)],{stdio:"ignore"});}
  catch(error) {if(error.status!==1) throw new Error("Cannot stop all agent processes",{cause:error});}
}
let child, rpc, verified=false;
try {
  sandbox([readonly+"/isolation.mjs"]);
  child=spawn(node,[cli,"app-server"],{uid,gid:uid,env,cwd:readonly,stdio:["pipe","pipe","ignore"],detached:true});
  rpc=new Rpc(child);
  await rpc.request("initialize",{clientInfo:{name:"puzzoria-autonomy-pilot",version:"1"}});rpc.send({method:"initialized"});
  const before=JSON.parse(readFileSync(authFile,"utf8"));
  const account=(await rpc.request("account/read",{refreshToken:true})).account;
  const after=JSON.parse(readFileSync(authFile,"utf8"));
  const renewed=before.tokens.access_token!==after.tokens.access_token || before.tokens.refresh_token!==after.tokens.refresh_token;
  persistAuth();
  const limits=await rpc.request("account/rateLimits/read");
  const quotas=assertFreeChatGPT(account,limits);
  if(phase===2 && !renewed) throw new Error("Second-session native credential renewal was not demonstrated");
  let prior,nonce;
  if(phase===1) {
    nonce=randomBytes(24).toString("hex");
    mkdirSync(join(work,"agent/pilot/memory"),{recursive:true});chownSync(join(work,"agent/pilot/memory"),uid,uid);
    writeFileSync(join(work,STATE_PATH),JSON.stringify({schemaVersion:1,continuityNonce:nonce,sourceCommit:parent,phase:0},null,2));chownSync(join(work,STATE_PATH),uid,uid);
  } else {
    prior=JSON.parse(readFileSync(join(work,STATE_PATH),"utf8"));
    if(prior.phase!==1 || typeof prior.continuityNonce!=="string" || prior.continuityNonce.length!==48) throw new Error("Missing independent-session GitHub memory");
    nonce=prior.continuityNonce;
  }
  let commands=0;rpc.listeners.push(m=>{if(m.method==="item/completed" && m.params.item.type==="commandExecution")commands++;});
  const thread=await rpc.request("thread/start",{cwd:work,approvalPolicy:"never",config:{default_permissions:"pilot"},developerInstructions:"Follow agent/pilot/BOOT.md. You may edit only agent/pilot/task/*.mjs and agent/pilot/memory/STATE.json or STATE.md. Preserve the continuity nonce. Use the native sandbox and local Node tests; do not access credentials, network, production, or GitHub publication."});
  if(phase===2) {
    const first=JSON.parse(readFileSync(join(work,"agent/pilot/evidence/session-1.json"),"utf8"));
    if(first.phase!==1 || first.runId!==runId || first.threadId===thread.thread.id) throw new Error("Independent Codex thread provenance was not demonstrated");
  }
  await rpc.turn(thread.thread.id,`Perform session ${phase} from agent/pilot/BOOT.md. Read AGENTS.md and the memory FROM DISK first. Source commit: ${parent}. Write STATE.json with phase=${phase}, status="completed", sourceCommit="${parent}", preserving continuityNonce. Do not ask the user to execute the development work. Run meaningful Node tests. Publication is handled separately.`);
  const endQuotas=assertFreeChatGPT((await rpc.request("account/read")).account,await rpc.request("account/rateLimits/read"));
  persistAuth();
  child.stdin.end();
  try{process.kill(-child.pid,"SIGTERM");}catch{/* Already stopped. */}
  stopAgent();
  child=null;
  let files=collectOutputs(work);
  const state=JSON.parse(files.find(f=>f.path===STATE_PATH)?.content ?? "null");
  if(state.phase!==phase || state.status!=="completed" || state.continuityNonce!==nonce || state.sourceCommit!==parent) throw new Error("Continuity memory did not survive the independent session");
  const tests=files.filter(f=>f.path.endsWith(".test.mjs"));if(!tests.length || !commands) throw new Error("No agent development/test execution demonstrated");
  sandbox(["--test",...tests.map(f=>join(work,f.path))]);
  sandbox([readonly+"/verify-task.mjs",String(phase)]);
  stopAgent();
  const afterTests=collectOutputs(work);
  if(JSON.stringify(afterTests)!==JSON.stringify(files)) throw new Error("Tests changed candidate publication");
  for(const {content} of files) {
    for(const secret of [key,token,before.tokens.access_token,before.tokens.refresh_token,after.tokens.access_token,after.tokens.refresh_token]) if(secret && content.includes(secret)) throw new Error("Secret detected in candidate publication");
  }
  const evidence={schemaVersion:1,phase,runId,attempt:process.env.GITHUB_RUN_ATTEMPT,job:process.env.GITHUB_JOB,sourceCommit:parent,threadId:thread.thread.id,model:thread.model,authMethod:account.type,plan:account.planType,nativeAuthRenewed:renewed,encryptedAuthRestored:phase===2,newThread:true,memoryFromGitHub:phase===2,isolationCanaries:true,independentTaskChecks:true,commands,quotasBefore:quotas,quotasAfter:endQuotas,recordedAt:new Date().toISOString()};
  const published=await publish(github(token,repository),parent,files,phase,evidence);
  writeFileSync(join(output,"evidence.json"),JSON.stringify({...evidence,...published},null,2));
  if(process.env.GITHUB_OUTPUT) writeFileSync(process.env.GITHUB_OUTPUT,`proof_sha=${published.sha}\npr_url=${published.url}\n`,{flag:"a"});
  console.log(JSON.stringify({phase,status:"verified",pr:published.url,authRenewed:renewed}));verified=true;
} finally {
  if(child){try{process.kill(-child.pid,"SIGTERM");}catch{/* Already stopped. */}}
  stopAgent();
  persistAuth();
  // Only encrypted auth and redacted machine evidence leave the runner.
  if(!verified) console.error("Pilot did not verify; no deployment or merge was attempted.");
}
