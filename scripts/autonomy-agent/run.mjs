import {spawn,execFileSync} from "node:child_process";
import {readFileSync,writeFileSync,mkdirSync,rmSync,chownSync,chmodSync,readlinkSync,readdirSync,lstatSync,symlinkSync} from "node:fs";
import {join,dirname,resolve} from "node:path";
import {github} from "../autonomy-pilot/github.mjs";
import {Rpc} from "../autonomy-pilot/rpc.mjs";
import {StateStore} from "./store.mjs";
import {Checkpoints,artifactClient} from "./checkpoint.mjs";
import {assertFunding,quotaGate,redact,REPOSITORY,MEMORY_FILES} from "./policy.mjs";
import {collectCandidate,collectMemory,restoreNextEnv} from "./outputs.mjs";
import {publishCandidate,stageCandidate} from "./candidate.mjs";
import {report} from "./inbox.mjs";
import {verifyCandidate} from "./verify.mjs";
import {collectAnalytics,ANALYTICS_FILE} from "./analytics.mjs";

const base="/opt/puzzoria-pilot", work=base+"/work", auth=base+"/auth", readonly=base+"/readonly",uid=3050;
const cli=readonly+"/node_modules/@openai/codex/bin/codex.js", node=process.execPath;
const control=JSON.parse(readFileSync("agent/autonomy/control.json","utf8"));
const funding=assertFunding(control),validation=process.env.AGENT_MODE==="validation";
if(process.getuid()!==0 || process.env.GITHUB_REPOSITORY!==REPOSITORY || !process.env.CODEX_PILOT_VAULT_KEY) throw new Error("Trusted runner context required");
if(!validation && (control.permanentActivationApproved!==true || process.env.PUZZORIA_AGENT_ENABLED!=="true")) throw new Error("Permanent activation remains disabled");
const api=github(process.env.GITHUB_TOKEN,REPOSITORY), store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
const runId=process.env.GITHUB_RUN_ID, output=resolve(".agent-out");mkdirSync(output,{recursive:true,mode:0o755});
const secrets=[process.env.GITHUB_TOKEN,process.env.CODEX_PILOT_VAULT_KEY,process.env.PUZZORIA_ANALYTICS_READ_TOKEN];
const evidence={schemaVersion:1,runId,job:process.env.GITHUB_JOB,mode:validation?"validation":"autonomous",funding,startedAt:new Date().toISOString(),status:"starting",commands:[],productionDeployment:false};
state.lastRun={id:runId,url:`https://github.com/${REPOSITORY}/actions/runs/${runId}`};
const checkpoints=new Checkpoints({api,store,key:process.env.CODEX_PILOT_VAULT_KEY,runId,authFile:auth+"/auth.json",directory:resolve(".agent-in"),client:await artifactClient()});
let child,rpc,watching=false,baseline;
function stopAgent() {try{execFileSync("pkill",["-KILL","-u",String(uid)],{stdio:"ignore"});}catch(error){if(error.status!==1)throw error;}}
const env={PATH:dirname(node)+":/usr/local/bin:/usr/bin:/bin",HOME:"/home/puzzoria-pilot",CODEX_HOME:auth,TMPDIR:work+"/.tmp",XDG_DATA_HOME:work+"/.tmp/data",LANG:"C.UTF-8",NEXT_TELEMETRY_DISABLED:"1"};
function sandbox(args,timeout=180000) {
  return execFileSync(node,[cli,"sandbox","--include-managed-config","-P","pilot","-C",work,"--",...args],{uid,gid:uid,env,cwd:work,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout,maxBuffer:8*1024*1024});
}
function snapshot(directory,prefix="",result=new Map()) {
  for(const name of readdirSync(join(directory,prefix))) {
    const path=prefix?`${prefix}/${name}`:name, stat=lstatSync(join(directory,path));
    if(stat.isSymbolicLink() || (!stat.isDirectory()&&(!stat.isFile()||stat.nlink!==1))) throw new Error("Unexpected links in the source archive");
    if(stat.isDirectory()) snapshot(directory,path,result); else result.set(path,readFileSync(join(directory,path)));
  }
  return result;
}
async function prepareSource() {
  const main=(await api("/git/ref/heads/main")).object.sha;
  const source=state.wipSha ?? state.codeSha ?? main;
  evidence.sourceCommit=source;
  const response=await fetch(`https://api.github.com/repos/${REPOSITORY}/tarball/${source}`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json"},signal:AbortSignal.timeout(60000)});
  if(!response.ok) throw new Error(`Source archive unavailable (${response.status})`);
  const archive=resolve(".agent-out/source.tar.gz");writeFileSync(archive,Buffer.from(await response.arrayBuffer()));
  const entries=execFileSync("tar",["-tvzf",archive],{encoding:"utf8",maxBuffer:8*1024*1024});
  if(entries.split("\n").filter(Boolean).some(line=>!["d","-"].includes(line[0]))) throw new Error("Linked source archive entries are forbidden");
  rmSync(work,{recursive:true,force:true});mkdirSync(work,{recursive:true});
  execFileSync("tar",["-xzf",archive,"--strip-components=1","-C",work]);rmSync(archive);
  baseline=snapshot(work);
  for(const name of ["package.json","package-lock.json"]) if(!baseline.get(name)?.equals(readFileSync(name))) throw new Error("Candidate dependency manifests differ from approved dependencies");
  symlinkSync("/opt/puzzoria-agent-deps/node_modules",work+"/node_modules");
  mkdirSync(work+"/.tmp",{recursive:true});mkdirSync(work+"/agent/autonomy/memory",{recursive:true});
  writeFileSync(work+"/agent/autonomy/MANDATE.md",readFileSync("agent/autonomy/MANDATE.md"));
  for(const name of MEMORY_FILES) {
    const content=name==="PLAN.json"?JSON.stringify({...JSON.parse(state.memory[name]),continuityNonce:state.continuityNonce}):state.memory[name];
    writeFileSync(work+"/agent/autonomy/memory/"+name,content);
  }
  writeFileSync(work+"/agent/autonomy/INBOX.json",JSON.stringify(state.pendingMessages ?? [],null,2));
  for(const path of ["agent/autonomy/MANDATE.md","agent/autonomy/INBOX.json"]) baseline.set(path,readFileSync(join(work,path)));
  execFileSync("chown",["-R","--no-dereference",`${uid}:${uid}`,work]);
}
try {
  await prepareSource();
  const restored=await checkpoints.restore();secrets.push(...Object.values(restored.tokens));
  writeFileSync(auth+"/auth.json",JSON.stringify(restored),{mode:0o600});chownSync(auth+"/auth.json",uid,uid);
  writeFileSync(auth+"/config.toml",'cli_auth_credentials_store="file"\nforced_login_method="chatgpt"\ndefault_permissions="pilot"\ncheck_for_update_on_startup=false\nweb_search="disabled"\n');chmodSync(auth+"/config.toml",0o444);
  writeFileSync(auth+"/canary","private-auth-canary",{mode:0o600});chownSync(auth+"/canary",uid,uid);
  writeFileSync(base+"/private/canary","private-control-canary",{mode:0o600});
  sandbox([node,readonly+"/isolation.mjs",String(process.pid),readlinkSync("/proc/self/ns/pid")]);evidence.isolationCanaries=true;
  child=spawn(node,[cli,"app-server"],{uid,gid:uid,env,cwd:readonly,stdio:["pipe","pipe","ignore"],detached:true});rpc=new Rpc(child);
  await rpc.request("initialize",{clientInfo:{name:"puzzoria-autonomous-agent",version:"1"}});rpc.send({method:"initialized"});
  const account=(await rpc.request("account/read",{refreshToken:true})).account;
  await checkpoints.flush(); // An upload and state pointer are confirmed before inference.
  const gate=quotaGate(account,await rpc.request("account/rateLimits/read"));evidence.quotaBefore=gate;
  if(gate.status!=="ready") {
    state.status=gate.status;state.nextEligibleAt=gate.nextEligibleAt ?? null;state.blockedReason=gate.reason;evidence.status=gate.status;
    await store.save("Pause before inference until the actual blocking quota resets");
    await report(api,state,`Aucune inférence lancée : ${gate.reason}.`);
  } else {
    const metrics=await collectAnalytics({token:process.env.PUZZORIA_ANALYTICS_READ_TOKEN});
    writeFileSync(ANALYTICS_FILE,JSON.stringify(metrics,null,2)+"\n",{mode:0o444});
    evidence.analytics={status:metrics.status,source:metrics.source,fetchedAt:metrics.fetchedAt,sha256:metrics.sha256,reason:metrics.reason};
    state.status="running";state.nextEligibleAt=null;state.blockedReason=null;await store.save("Start an admissible autonomous Puzzoria session");
    await report(api,state,`Session démarrée : lecture de la mémoire et des consignes, choix autonome d'une contribution Puzzoria.\n\nStatistiques Puzzoria : ${metrics.status}${metrics.status==="available"?` (7/30/90 jours, collectées à ${metrics.fetchedAt})`:metrics.reason?` (${metrics.reason})`:""}. Lecture des agrégats seulement ; aucune modification de production.`);
    checkpoints.start(()=>{try{process.kill(-child.pid,"SIGTERM");}catch{/* Already exited. */}});watching=true;
    let toolCommands=0;evidence.modelCommands=[];
    rpc.listeners.push(message=>{
      if(message.method==="item/completed"&&message.params.item.type==="commandExecution") {
        toolCommands++;
        if(evidence.modelCommands.length<30) {
          const entry={command:redact(message.params.item.command ?? "",secrets).slice(0,500),exitCode:message.params.item.exitCode ?? null};
          evidence.modelCommands.push(entry);console.log(JSON.stringify({event:"tool_completed",...entry}));
        }
      }
    });
    const thread=await rpc.request("thread/start",{cwd:work,approvalPolicy:"never",config:{default_permissions:"pilot"},developerInstructions:"Lis AGENTS.md, agent/autonomy/MANDATE.md, INBOX.json et la mémoire depuis le disque. Choisis librement une contribution utile à Puzzoria. Développe et teste dans le sandbox. Tu ne peux modifier ni les scripts/workflows, manifests/verrous, instructions, protections ou secrets. Aucun achat, réseau externe, merge ou déploiement. Le superviseur publie les fichiers autorisés après arrêt des outils. Mets à jour les quatre fichiers de mémoire, sans inventer de résultats."});
    evidence.threadId=thread.thread.id;evidence.model=thread.model;evidence.previousCompletedSessions=state.completedSessions;
    if(evidence.threadId===state.lastSession?.threadId) throw new Error("The independent session reused the previous thread unexpectedly");
    let timeout;
    try {
      await Promise.race([rpc.turn(thread.thread.id,`${validation?"Validation réelle : réalise une petite contribution de développement Puzzoria de ton choix et ses tests, sans roadmap imposée. ":"Poursuis le mandat autonome de Puzzoria. "}Lis d'abord la mémoire et les consignes depuis le disque, puis décide et agis. Le code source exporté correspond au commit ${evidence.sourceCommit}. Le dépôt Git et les identités ne sont pas exposés aux outils ; le superviseur calcule le diff et publie. La limite de temps de cette session est opérationnelle, pas un budget stratégique par expérience. Laisse une mémoire et une prochaine mission choisie par toi.`),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error("Session time boundary reached; preserve work for the next wake")),22*60*1000);})]);
    } finally {clearTimeout(timeout);}
    await checkpoints.stop();watching=false;
    const endGate=quotaGate((await rpc.request("account/read")).account,await rpc.request("account/rateLimits/read"));evidence.quotaAfter=endGate;
    if(!["ready","waiting_quota"].includes(endGate.status)) throw new Error("The post-session included-usage check is not admissible");
    await checkpoints.flush();
    try{process.kill(-child.pid,"SIGTERM");}catch{/* Already stopped. */}stopAgent();child=null;
    if(!toolCommands) throw new Error("No tool execution was observed");
    restoreNextEnv(work,baseline);
    const {memory,plan}=collectMemory(work,state.continuityNonce);
    const files=collectCandidate(work,baseline);
    if(validation&&!state.wipSha&&!files.some(file=>/^(src|tests)\//.test(file.path))) throw new Error("Validation requires a real Puzzoria code/test contribution, not only a report");
    // Remove model-created caches/configuration outputs before independent checks.
    for(const name of readdirSync(work)) if(/^\.next(?:-|$)/.test(name)||[".tmp",".sites-runtime",".data","test-results","playwright-report",".agent-tests.json",".sandbox-write-test"].includes(name)||name.endsWith(".tsbuildinfo")) rmSync(join(work,name),{recursive:true,force:true});
    mkdirSync(work+"/.tmp");chownSync(work+"/.tmp",uid,uid);
    verifyCandidate({work,dependencies:"/opt/puzzoria-agent-deps/node_modules",uid,evidence});
    const tests=JSON.parse(readFileSync(work+"/.agent-tests.json","utf8"));
    if(!tests.success || tests.numPassedTests<1 || tests.numFailedTests || tests.numPendingTests) throw new Error("The independent unit suite did not complete with real passing tests");
    evidence.tests={passed:tests.numPassedTests,failed:tests.numFailedTests,skipped:tests.numPendingTests};
    stopAgent();restoreNextEnv(work,baseline);
    if(JSON.stringify(collectCandidate(work,baseline))!==JSON.stringify(files)) throw new Error("Candidate tests changed their publication");
    const currentAuth=JSON.parse(readFileSync(auth+"/auth.json","utf8"));secrets.push(...Object.values(currentAuth.tokens));
    for(const content of [...files.map(file=>file.content ?? ""),...Object.values(memory)])
      if(secrets.some(secret=>typeof secret==="string"&&secret.length>0&&content.includes(secret))) throw new Error("Sensitive value detected in candidate output");
    const published=await publishCandidate(api,evidence.sourceCommit,files,plan.summary,state.codeSha);evidence.publication=published;evidence.toolCommands=toolCommands;
    state.memory=memory;state.codeSha=published?.sha ?? evidence.sourceCommit;state.completedSessions++;state.pendingMessages=[];
    state.wipSha=null;state.retryCount=0;state.status=endGate.status;state.nextEligibleAt=endGate.nextEligibleAt ?? null;
    state.blockedReason=plan.blockedReason;state.lastSession=evidence;evidence.status="verified";
    await store.save("Publish verified autonomous work and its continuation memory");
    await report(api,state,`${redact(plan.summary,secrets)}\n\nTests indépendants : ${evidence.tests.passed} réussis ; lint, types et build réussis.\n\nProchaine mission choisie par l'agent : ${redact(plan.nextMission,secrets)}${published?`\n\n[PR de travail](${published.url})`:""}`);
  }
} catch(error) {
  if(child){try{process.kill(-child.pid,"SIGTERM");}catch{/* Already stopped. */}}stopAgent();child=null;
  if(watching){try{await checkpoints.stop();}catch{/* The error is retained below/finally. */}watching=false;}
  evidence.status="failed";evidence.error=redact(error.message,secrets);
  state.retryCount=(state.retryCount ?? 0)+1;
  state.status=state.retryCount<=3?"retrying":"blocked";
  state.nextEligibleAt=state.status==="retrying"?new Date(Date.now()+15*60*1000).toISOString():null;
  state.blockedReason=evidence.error;state.lastSession=evidence;
  try {
    const current=JSON.parse(readFileSync(auth+"/auth.json","utf8"));secrets.push(...Object.values(current.tokens));
    if(baseline) {
      restoreNextEnv(work,baseline);
      const files=collectCandidate(work,baseline);
      let partialMemory=state.memory;
      try {partialMemory=collectMemory(work,state.continuityNonce).memory;} catch {evidence.partialMemoryRejected=true;}
      for(const content of [...files.map(file=>file.content ?? ""),...Object.values(partialMemory)])
        if(secrets.some(secret=>typeof secret==="string"&&secret.length>0&&content.includes(secret))) throw new Error("Sensitive output rejected",{cause:error});
      if(files.length) {
        const sha=await stageCandidate(api,evidence.sourceCommit,files,"codex/agent-wip",state.wipBranchHead ?? null);
        state.wipSha=sha;state.wipBranchHead=sha;evidence.unverifiedSnapshot=sha;
      }
      state.memory=partialMemory;
    }
  } catch(snapshotError) {evidence.snapshotError=redact(snapshotError.message,secrets);}
  process.exitCode=1;
  try {await store.save("Preserve an autonomous session failure without activating or deploying");await report(api,state,`Session interrompue : ${evidence.error}. La mémoire et le dernier checkpoint confirmé sont conservés.`);} catch {/* Independent proof publication is attempted by the workflow. */}
  console.error(evidence.error);
} finally {
  if(child){try{process.kill(-child.pid,"SIGTERM");}catch{/* Already stopped. */}}
  stopAgent();
  if(watching) {try{await checkpoints.stop();}catch(error){evidence.checkpointError=redact(error.message,secrets);process.exitCode=1;}}
  try {await checkpoints.flush();} catch(error){evidence.checkpointError=redact(error.message,secrets);process.exitCode=1;}
  evidence.finishedAt=new Date().toISOString();
  writeFileSync(join(output,"run.json"),JSON.stringify(evidence,null,2)+"\n",{mode:0o644});
  console.log(JSON.stringify(evidence));
}
