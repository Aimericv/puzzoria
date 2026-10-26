import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,copyFileSync,symlinkSync,linkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {assertFunding,quotaGate,allowedCandidate,trustedMessages,canWake,pendingReleaseReady,REPOSITORY} from "./policy.mjs";
import {StateStore,initialState} from "./store.mjs";
import {Checkpoints,recoveryPointer} from "./checkpoint.mjs";
import {collectCandidate,restoreNextEnv,collectMemory} from "./outputs.mjs";
import {readComments} from "./inbox.mjs";
import {unseal} from "../autonomy-pilot/vault.mjs";

const account={type:"chatgpt",planType:"plus"};
const limits=()=>({ordinaryUsageAllowed:true,rateLimits:{limitId:"codex",credits:{hasCredits:false,unlimited:false,balance:"0"},primary:{usedPercent:20,resetsAt:2000},secondary:{usedPercent:10,resetsAt:10000}}});
const control={repository:REPOSITORY,bootstrapCheckpoint:{artifactId:1,runId:"1",name:"bootstrap",context:{repository:REPOSITORY,runId:"1",phase:2}}};
const pending=()=>({status:'ready',pendingMessages:[],growth:{releaseCandidate:{sha:'a'.repeat(40),base:'b'.repeat(40),prNumber:11,verified:true,status:'proposed'}}});
test('pending validation requires a verified exact-base receipt and respects owner control',()=>{
 assert.equal(pendingReleaseReady(pending(),'b'.repeat(40)),true);
 for(const change of [s=>s.paused=true,s=>s.status='blocked',s=>s.status='needs_login',s=>s.status='retrying',s=>s.pendingMessages.push({text:'reconsider this proposal'}),s=>s.growth.releaseCandidate.verified=false,s=>s.growth.releaseCandidate.sha='untrusted',s=>s.growth.releaseCandidate.status='manual_review',s=>s.growth.releaseCandidate.prNumber=-1]){const state=pending();change(state);assert.equal(pendingReleaseReady(state,'b'.repeat(40)),false);}
 assert.equal(pendingReleaseReady(pending(),'c'.repeat(40)),false);
});
test('free pending checks remain separate from an exhausted model quota',()=>{
 const state=pending();state.status='waiting_quota';state.nextEligibleAt='2027-01-01T00:00:00Z';
 assert.equal(canWake(state,Date.parse('2026-10-26T00:00:00Z')),false);
 assert.equal(pendingReleaseReady(state,'b'.repeat(40)),true);
 assert.equal(state.nextEligibleAt,'2027-01-01T00:00:00Z');
});
function directory(t) {const path=mkdtempSync(join(tmpdir(),"puzzoria-agent-test-"));t.after(()=>rmSync(path,{recursive:true,force:true}));return path;}

test("old financial flags and an uncreated budget never authorize Actions",()=>{
  for(const funding of [null,{mode:"unverified"},{mode:"zero-budget",ownerDeclaration:"budget not created",verifiedAt:new Date().toISOString()},{mode:"no-payment-method",ownerDeclaration:null}])
    assert.throws(()=>assertFunding({...control,funding,PUZZORIA_FREE_ACTIONS_VERIFIED:true}));
  assert.equal(assertFunding({...control,funding:{mode:"no-payment-method",ownerDeclaration:"owner confirms no payment method",verifiedAt:"2026-10-21T00:00:00Z"}}).source,"owner-declaration");
});

test("quota waits use only blocking windows and never a non-exhausted weekly deadline",()=>{
  const snapshot=limits();snapshot.ordinaryUsageAllowed=false;snapshot.rateLimits.primary.usedPercent=100;
  assert.equal(quotaGate(account,snapshot,1000000).nextEligibleAt,new Date(2000000).toISOString());
  snapshot.rateLimits.secondary.usedPercent=100;
  assert.equal(quotaGate(account,snapshot,1000000).nextEligibleAt,new Date(10000000).toISOString());
  assert.equal(quotaGate(account,limits(),1000000).status,"ready");
});

test("paid, missing, stale and non-Plus quota states never permit inference",()=>{
  assert.equal(quotaGate({type:"apiKey"},limits()).status,"needs_login");
  for(const mutate of [s=>s.rateLimits.credits.hasCredits=true,s=>s.rateLimits.credits.balance="2",s=>s.rateLimits.credits=null,s=>s.ordinaryUsageAllowed=false,s=>s.rateLimits.primary.usedPercent=NaN]) {
    const snapshot=limits();mutate(snapshot);assert.notEqual(quotaGate(account,snapshot).status,"ready");
  }
  const stale=limits();stale.rateLimits.primary.usedPercent=100;stale.rateLimits.primary.resetsAt=1;
  assert.equal(quotaGate(account,stale,1000000).status,"blocked");
  const paid=limits();paid.rateLimits.primary.usedPercent=100;paid.rateLimits.credits.balance="1";
  assert.equal(quotaGate(account,paid,1000000).status,"blocked");
});

test("owner identity, exact issue and durable message IDs filter the inbox",()=>{
  const comment={id:5,body:"priorité libre",user:{id:42,type:"User"},issue_url:"https://api.github.com/repos/Aimericv/puzzoria/issues/7"};
  const comments=[comment,{...comment,id:6,user:{id:99,type:"User"},author_association:"OWNER"},{...comment,id:7,user:{id:42,type:"Bot"}},{...comment,id:8,issue_url:"https://api.github.com/repos/Aimericv/puzzoria/issues/8"}];
  assert.deepEqual(trustedMessages(comments,42,7).map(row=>row.id),[5]);
  assert.equal(trustedMessages(comments,42,7,5).length,0);
  assert.throws(()=>trustedMessages(comments,null,7));
  assert.equal(canWake({status:"waiting_quota",nextEligibleAt:new Date(2000).toISOString()},1000,true),false);
  assert.equal(canWake({status:"paused"},3000,true),false);
});

test("all inbox pages are fetched even when a concurrency event was replaced",async()=>{
  let pages=0;
  const comments=await readComments(async path=>{assert.match(path,/page=\d+$/);pages++;return pages===1?Array.from({length:100},(_,id)=>({id})): [{id:100}];},7);
  assert.equal(pages,2);assert.equal(comments.length,101);
});

test("publication cannot change policy, secrets, workflow, dependencies or inbox",()=>{
  for(const path of [".github/workflows/ci.yml","scripts/autonomy-agent/run.mjs","AGENTS.md","package.json","package-lock.json","agent/inbox/priority.md","docs/AUTONOMY-NEXT.fr.md","src/../scripts/escape.ts","src/.env","src/x\\y.ts","src/lib/server/analytics-reader.ts","src/app/api/agent/analytics/route.ts"])
    assert.equal(allowedCandidate(path),false,path);
  for(const path of ["src/app/[locale]/page.tsx","tests/new-feature.test.ts","docs/PRODUCT.fr.md"]) assert.equal(allowedCandidate(path),true,path);
});

function fakeStateAPI(initialHead=null) {
  let head=initialHead,sequence=0;const calls=[];
  const api=async(path,method="GET",body)=>{
    calls.push({path,method,body});
    if(path.startsWith("/git/ref/")) {if(!head){const error=new Error("not found");error.status=404;throw error;}return {object:{sha:head}};}
    if(path.startsWith("/git/commits/")&&method==="GET")return {tree:{sha:"tree"}};
    if(path==="/git/trees")return {sha:"tree-new"};
    if(path==="/git/commits")return {sha:`commit-${++sequence}`};
    if(path==="/git/refs"||path.startsWith("/git/refs/")){head=body.sha;return {};}
    throw new Error(`Unexpected fake API call ${path}`);
  };
  return {api,calls,setHead:value=>{head=value;}};
}
test("state commits advance a single parent and reject stale writers without force",async()=>{
  const fake=fakeStateAPI(),store=new StateStore(fake.api,control,"source");await store.load();
  const object=store.state;await store.save();assert.equal(store.state,object);assert.equal(object.generation,1);
  fake.setHead("another-writer");await assert.rejects(store.save(),/concurrently/);
  assert.equal(fake.calls.some(call=>call.body?.force===true),false);
});

function checkpointFixture(t) {
  const root=directory(t),authFile=join(root,"auth.json"),key=randomBytes(32).toString("base64"), artifacts=new Map(),uploads=[];
  writeFileSync(authFile,JSON.stringify({tokens:{access_token:"test-access",refresh_token:"test-refresh"}}));
  const state=initialState(control,"source");
  const store={state,save:async()=>{}};
  const api=async path=>{
    if(path.startsWith("/actions/artifacts?"))return {artifacts:[...artifacts.values()]};
    const id=Number(path.split("/").at(-1));if(artifacts.has(id))return artifacts.get(id);
    throw new Error("Unknown artifact");
  };
  const client={
    async uploadArtifact(name,files,folder,options){
      const id=uploads.length+10;uploads.push({id,name,files,folder,options});
      artifacts.set(id,{id,name,expires_at:"2027-01-01T00:00:00Z",expired:false,workflow_run:{id:2}});
      return {id,digest:"test-digest"};
    },
    async downloadArtifact(id,{path}){
      mkdirSync(path,{recursive:true});const upload=uploads.find(item=>item.id===id);
      for(const name of ["auth.enc","checkpoint.json"])copyFileSync(join(upload.folder,name),join(path,name));
      return {digestMismatch:false};
    }
  };
  const create=storeOverride=>new Checkpoints({api,store:storeOverride??store,key,runId:"2",authFile,directory:join(root,`out-${randomBytes(4).toString("hex")}`),client});
  return {root,authFile,key,artifacts,uploads,store,client,create};
}

test("renewed auth is encrypted and uploaded before the durable pointer changes",async t=>{
  const f=checkpointFixture(t),manager=f.create();let saves=0;
  f.store.save=async()=>{assert.equal(f.uploads.length,1);assert.equal(f.store.state.checkpoint.artifactId,10);saves++;};
  await Promise.all([manager.flush(),manager.flush()]);assert.equal(f.uploads.length,1);assert.equal(saves,1);
  const upload=f.uploads[0],box=readFileSync(join(upload.folder,"auth.enc"),"utf8");
  assert.equal(box.includes("test-refresh"),false);
  assert.equal(unseal(box,f.key,f.store.state.checkpoint.context).tokens.refresh_token,"test-refresh");
});

test("an unconfirmed upload never advances the checkpoint pointer",async t=>{
  const f=checkpointFixture(t),manager=f.create();f.client.uploadArtifact=async()=>{throw new Error("upload failed");};
  await assert.rejects(manager.flush(),/upload failed/);assert.equal(f.store.state.checkpoint.artifactId,1);
});

test("a crash after upload can recover the latest authenticated generation",async t=>{
  const f=checkpointFixture(t),old=structuredClone(f.store.state),manager=f.create();
  f.store.save=async()=>{throw new Error("pointer interrupted");};await assert.rejects(manager.flush(),/pointer interrupted/);
  const recoveredStore={state:old,save:async()=>{}};const recovered=await f.create(recoveredStore).restore();
  assert.equal(recovered.tokens.refresh_token,"test-refresh");assert.equal(recoveredStore.state.checkpoint.artifactId,10);
});

test("expired latest generations and checksum failures never roll back to an older login",async t=>{
  const f=checkpointFixture(t),old=structuredClone(f.store.state);await f.create().flush();f.artifacts.get(10).expired=true;
  await assert.rejects(f.create({state:old,save:async()=>{}}).restore(),/expired/);
  f.artifacts.get(10).expired=false;f.client.downloadArtifact=async()=>({digestMismatch:true});
  await assert.rejects(f.create().restore(),/digest verification/);
});

test("artifact checksum keeps the sha256 prefix required by the pinned official SDK",async t=>{
  const f=checkpointFixture(t);await f.create().flush();
  const digest="sha256:"+"a".repeat(64);f.artifacts.get(10).digest=digest;
  const original=f.client.downloadArtifact;
  f.client.downloadArtifact=async(id,options)=>{
    assert.equal(options.expectedHash,digest);
    return original(id,options);
  };
  assert.equal((await f.create().restore()).tokens.refresh_token,"test-refresh");
});

test("checkpoint recovery rejects another repository, run or generation",()=>{
  const context={repository:REPOSITORY,runId:"2",phase:"autonomous-agent",generation:3};
  const artifact={id:10,name:"puzzoria-agent-auth-2-3",workflow_run:{id:2}};
  assert.equal(recoveryPointer({context},artifact).generation,3);
  for(const other of [{...context,repository:"other/repo"},{...context,runId:"3"},{...context,generation:4}]) assert.throws(()=>recoveryPointer({context:other},artifact));
});

function workspace(t) {
  const root=directory(t),baseline=new Map();
  for(const path of ["src","tests","e2e","docs","agent/autonomy/memory"])mkdirSync(join(root,path),{recursive:true});
  symlinkSync("/opt/puzzoria-agent-deps/node_modules",join(root,"node_modules"));
  for(const [path,content] of [["package.json","{}"],["src/feature.ts","export const answer=1;"],["large.json","x".repeat(1100000)]]) {
    writeFileSync(join(root,path),content);baseline.set(path,Buffer.from(content));
  }
  return {root,baseline};
}
test("candidate collection preserves large read-only content and rejects protected edits/links",t=>{
  const {root,baseline}=workspace(t);writeFileSync(join(root,"src/feature.ts"),"export const answer=42;");
  assert.deepEqual(collectCandidate(root,baseline).map(file=>file.path),["src/feature.ts"]);
  writeFileSync(join(root,"package.json"),"bad");assert.throws(()=>collectCandidate(root,baseline),/Protected/);
  writeFileSync(join(root,"package.json"),"{}");linkSync(join(root,"package.json"),join(root,"src/leak.ts"));
  assert.throws(()=>collectCandidate(root,baseline),/Unsafe/);
});

test("untracked npm or environment configuration cannot falsify independent checks",t=>{
  const {root,baseline}=workspace(t);
  for(const path of [".npmrc",".env.local","vitest.config.mjs"]) {
    writeFileSync(join(root,path),"malicious validation override");
    assert.throws(()=>collectCandidate(root,baseline),/Unapproved workspace file/);
    rmSync(join(root,path));
  }
});

test("only standard generated Next imports can be restored, not arbitrary protected code",t=>{
  const {root,baseline}=workspace(t),original='import "./.next-e2e/dev/types/routes.d.ts";\n';
  baseline.set("next-env.d.ts",Buffer.from(original));writeFileSync(join(root,"next-env.d.ts"),'import "./.next/types/routes.d.ts";\n');
  restoreNextEnv(root,baseline);assert.equal(readFileSync(join(root,"next-env.d.ts"),"utf8"),original);
  writeFileSync(join(root,"next-env.d.ts"),'import "./evil.ts";');assert.throws(()=>restoreNextEnv(root,baseline));
});

test("continuation memory must preserve the disk-only nonce and a next mission",t=>{
  const {root}=workspace(t);
  for(const name of ["STATE.md","DECISIONS.md","EXPERIMENTS.md"])writeFileSync(join(root,"agent/autonomy/memory",name),"observed work");
  const plan=join(root,"agent/autonomy/memory/PLAN.json");writeFileSync(plan,JSON.stringify({continuityNonce:"disk-only",summary:"done",nextMission:"agent chooses",blockedReason:null}));
  assert.equal(collectMemory(root,"disk-only").plan.nextMission,"agent chooses");assert.throws(()=>collectMemory(root,"another-nonce"));
});

test("permanent activation needs recorded validation and obsolete financial gates remain rejected",()=>{
  const saved=JSON.parse(readFileSync("agent/autonomy/control.json","utf8"));assert.equal(typeof saved.permanentActivationApproved,"boolean");
  if(saved.permanentActivationApproved) {
    assert.ok(Number.isFinite(Date.parse(saved.activationAuthorization?.approvedAt)));
    assert.match(saved.activationAuthorization?.ciRunId ?? "",/^\d+$/);
    assert.equal(saved.activationAuthorization?.productionDeploymentAllowed,false);
    assert.equal(saved.activationAuthorization?.futureAutomaticMergesAllowed,false);
  }
  for(const name of ["autonomy-agent.yml","autonomy-pilot.yml","cloud-handoff-smoke.yml","ci.yml"]) {
    const workflow=readFileSync(`.github/workflows/${name}`,"utf8");
    assert.equal(workflow.includes("vars.PUZZORIA_FREE_ACTIONS_VERIFIED"),false);
    assert.doesNotMatch(workflow,/\b(?:ssh|scp|rsync)\s|docker\s+(?:compose|stack)\s+(?:up|deploy)/);
  }
  assert.match(readFileSync(".github/workflows/autonomy-agent.yml","utf8"),/vars\.PUZZORIA_AGENT_ENABLED == 'true'/);
});
