import {afterEach, describe, expect, it, vi} from "vitest";
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, linkSync, renameSync, symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {EventEmitter} from "node:events";
import {PassThrough} from "node:stream";
import {seal,unseal} from "../scripts/autonomy-pilot/vault.mjs";
import {assertFreeChatGPT,allowedOutput} from "../scripts/autonomy-pilot/policy.mjs";
import {collectOutputs} from "../scripts/autonomy-pilot/outputs.mjs";
import {publish} from "../scripts/autonomy-pilot/github.mjs";
import {Rpc} from "../scripts/autonomy-pilot/rpc.mjs";

const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0)) rmSync(directory,{recursive:true,force:true});});
const account={type:"chatgpt",planType:"plus"};
const limits=()=>({ordinaryUsageAllowed:true,rateLimits:{limitId:"codex",credits:{hasCredits:false,unlimited:false,balance:"0"},primary:{usedPercent:20},secondary:{usedPercent:5}}});

describe("pilot auth and free quota boundary",()=>{
  it("authenticates both ciphertext and checkpoint provenance with fresh nonces",()=>{
    const key=randomBytes(32).toString("base64"), context={repository:"Aimericv/puzzoria",runId:"12",phase:1};
    const value={tokens:{refresh_token:"test-only"}};
    const box=seal(value,key,context);
    expect(unseal(box,key,context)).toEqual(value);
    expect(seal(value,key,context)).not.toBe(box);
    expect(()=>unseal(box,randomBytes(32).toString("base64"),context)).toThrow();
    expect(()=>unseal(box,key,{...context,runId:"13"})).toThrow();
    const altered=JSON.parse(box);altered.context.phase=2;
    expect(()=>unseal(JSON.stringify(altered),key,{...context,phase:2})).toThrow();
    altered.context=context;altered.ciphertext=Buffer.from("tampered").toString("base64");
    expect(()=>unseal(JSON.stringify(altered),key,context)).toThrow();
    expect(()=>seal(value,"invalid",context)).toThrow();
  });
  it("accepts only observable Plus included usage with zero credits",()=>{
    expect(assertFreeChatGPT(account,limits())).toHaveLength(1);
    expect(()=>assertFreeChatGPT({type:"apiKey"},limits())).toThrow();
    expect(()=>assertFreeChatGPT({...account,planType:"pro"},limits())).toThrow();
    expect(()=>assertFreeChatGPT(account,{...limits(),ordinaryUsageAllowed:false})).toThrow();
    expect(()=>assertFreeChatGPT(account,{rateLimits:null})).toThrow();
    for(const credits of [null,{hasCredits:true,unlimited:false,balance:"1"},{hasCredits:false,unlimited:true,balance:"0"},{hasCredits:false,unlimited:false,balance:null},{hasCredits:false,unlimited:false,balance:"NaN"}]) {
      const snapshot=limits();Object.assign(snapshot.rateLimits,{credits});
      expect(()=>assertFreeChatGPT(account,snapshot)).toThrow();
    }
    const exhausted=limits();exhausted.rateLimits.primary.usedPercent=100;
    expect(()=>assertFreeChatGPT(account,exhausted)).toThrow();
  });
});

function workspace() {
  const root=mkdtempSync(join(tmpdir(),"puzzoria-pilot-test-"));directories.push(root);
  mkdirSync(join(root,"agent/pilot/task"),{recursive:true});
  mkdirSync(join(root,"agent/pilot/memory"),{recursive:true});
  writeFileSync(join(root,"agent/pilot/task/utc-window.mjs"),"export const test = true;\n");
  writeFileSync(join(root,"agent/pilot/memory/STATE.json"),"{}");
  return root;
}
describe("trusted publication boundary",()=>{
  it("rejects traversal, workflows, application changes and credentials before publishing",async()=>{
    for(const path of ["AGENTS.md","src/app/page.tsx",".github/workflows/ci.yml","agent/pilot/task/../../auth.json","agent/pilot/task/.env","agent/pilot/task/UPPER.mjs"]) {
      expect(allowedOutput(path)).toBe(false);
      const api=vi.fn();await expect(publish(api,"parent",[{path,content:"x"}],1,{})).rejects.toThrow();expect(api).not.toHaveBeenCalled();
    }
  });
  it("refuses hardlinks and linked directories instead of following privileged paths",()=>{
    const root=workspace();expect(collectOutputs(root)).toHaveLength(2);
    writeFileSync(join(root,"private"),"test-only secret");
    linkSync(join(root,"private"),join(root,"agent/pilot/task/leak.mjs"));
    expect(()=>collectOutputs(root)).toThrow();
    rmSync(join(root,"agent/pilot/task/leak.mjs"));
    renameSync(join(root,"agent/pilot/task"),join(root,"other"));
    symlinkSync(join(root,"other"),join(root,"agent/pilot/task"),process.platform==="win32"?"junction":"dir");
    expect(()=>collectOutputs(root)).toThrow();
  });
  it("opens a draft proof PR against the pilot branch and never writes main",async()=>{
    const api=vi.fn(async(...args:unknown[])=>{
      const path=String(args[0]);
      if(path==="/git/commits/parent") return {tree:{sha:"old-tree"}};
      if(path==="/git/trees") return {sha:"new-tree"};
      if(path==="/git/commits") return {sha:"new-commit"};
      if(path==="/pulls") return {number:1,html_url:"https://github.com/Aimericv/puzzoria/pull/1"};
      return {};
    });
    await publish(api,"parent",[{path:"agent/pilot/task/utc-window.mjs",content:"test"}],1,{runId:"12"});
    expect(api).toHaveBeenCalledWith("/git/refs","POST",{ref:"refs/heads/codex/autonomy-proof",sha:"new-commit"});
    expect(api).toHaveBeenCalledWith("/pulls","POST",expect.objectContaining({base:"codex/autonomy-pilot",draft:true}));
    expect(JSON.stringify(api.mock.calls)).not.toContain('"main"');
  });
  it("does not overwrite a proof branch changed by another writer",async()=>{
    const api=vi.fn(async(...args:unknown[])=>{
      const path=String(args[0]);
      if(path==="/git/commits/parent") return {tree:{sha:"tree"}};
      if(path.includes("/git/ref/")) return {object:{sha:"other-parent"}};
      return {sha:"new"};
    });
    await expect(publish(api,"parent",[],2,{})).rejects.toThrow("concurrently");
    expect(api.mock.calls.some(call=>String(call[1])==="PATCH")).toBe(false);
  });
});

it("denies unexpected RPC approval requests and handles completion before the start response",async()=>{
  const child=Object.assign(new EventEmitter(),{stdout:new PassThrough(),stdin:new PassThrough()});
  const sent:Record<string,unknown>[]=[];
  child.stdin.on("data",chunk=>{
    const message=JSON.parse(chunk.toString());sent.push(message);
    if(message.method==="turn/start") {
      child.stdout.write(JSON.stringify({method:"turn/completed",params:{threadId:"fresh",turn:{status:"completed"}}})+"\n");
      child.stdout.write(JSON.stringify({id:message.id,result:{}})+"\n");
    }
  });
  const rpc=new Rpc(child);
  child.stdout.write(JSON.stringify({id:900,method:"item/commandExecution/requestApproval",params:{}})+"\n");
  await rpc.turn("fresh","perform bounded task");
  expect(sent).toContainEqual({id:900,error:{code:-32601,message:"Unavailable in the bounded pilot"}});
  expect(rpc.listeners).toHaveLength(0);
  child.emit("exit",0);child.stdout.end();child.stdin.end();
});
