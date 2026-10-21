import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {initialState} from "./store.mjs";
import {REPOSITORY} from "./policy.mjs";

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),"puzzoria-preflight-"));t.after(()=>rmSync(root,{recursive:true,force:true}));
  const control={repository:REPOSITORY,permanentActivationApproved:true,funding:{mode:"no-payment-method",ownerDeclaration:"test fixture",verifiedAt:"2026-10-21T00:00:00Z"}};
  const state={...initialState(control,"test-source"),issueNumber:3,ownerId:42,status:"waiting_quota",nextEligibleAt:new Date(Date.now()+60000).toISOString()};
  mkdirSync(join(root,"agent/autonomy"),{recursive:true});
  writeFileSync(join(root,"agent/autonomy/control.json"),JSON.stringify(control));
  writeFileSync(join(root,"state.json"),JSON.stringify(state));
  writeFileSync(join(root,"event.json"),"{}");
  writeFileSync(join(root,"mock.mjs"),`
import {readFileSync,writeFileSync} from 'node:fs';
const state=JSON.parse(readFileSync('state.json','utf8'));
let head='state-head';
Date.now=()=>Number(process.env.TEST_NOW);
globalThis.fetch=async(url,options={})=>{
 const path=new URL(url).pathname.replace('/repos/Aimericv/puzzoria','');
 const body=options.body?JSON.parse(options.body):null;
 let value;
 if(path==='')value={owner:{id:42}};
 else if(path.startsWith('/git/ref/'))value={object:{sha:head}};
 else if(path.startsWith('/contents/')){const content=JSON.stringify(state);value={encoding:'base64',size:Buffer.byteLength(content),content:Buffer.from(content).toString('base64')};}
 else if(path==='/issues/3/comments'&&(options.method??'GET')==='GET')value=[{id:9,body:'Poursuis librement tes expériences',user:{id:42,type:'User'},issue_url:'https://api.github.com/repos/Aimericv/puzzoria/issues/3'}];
 else if(path.startsWith('/git/commits/')&&!body)value={tree:{sha:'tree'}};
 else if(path==='/git/trees'){writeFileSync('saved.json',body.tree[0].content);value={sha:'new-tree'};}
 else if(path==='/git/commits')value={sha:'new-head'};
 else if(path.startsWith('/git/refs/')){head=body.sha;value={};}
 else if(path==='/issues/3'||path==='/issues/3/comments')value={id:10};
 else throw Error('Unexpected network request '+path);
 return Response.json(value);
};
`);
  function run(now=Date.now()) {
    writeFileSync(join(root,"output.txt"),"");
    const result=spawnSync(process.execPath,["--import",join(root,"mock.mjs"),fileURLToPath(new URL("./preflight.mjs",import.meta.url))],{
      cwd:root,encoding:"utf8",timeout:10000,
      env:{PATH:process.env.PATH,AGENT_MODE:"autonomous",PUZZORIA_AGENT_ENABLED:"true",GITHUB_REPOSITORY:REPOSITORY,GITHUB_SHA:"test-source",GITHUB_EVENT_NAME:"schedule",GITHUB_EVENT_PATH:join(root,"event.json"),GITHUB_OUTPUT:join(root,"output.txt"),TEST_NOW:String(now)}
    });
    return {...result,output:readFileSync(join(root,"output.txt"),"utf8")};
  }
  return {root,control,state,run};
}

test("actual wake preflight preserves an owner message and refuses inference before quota reset",t=>{
  const f=fixture(t),result=f.run();
  assert.equal(result.status,0,result.stderr);assert.match(result.output,/run_model=false/);
  const saved=JSON.parse(readFileSync(join(f.root,"saved.json"),"utf8"));
  assert.equal(saved.status,"waiting_quota");assert.equal(saved.nextEligibleAt,f.state.nextEligibleAt);
  assert.equal(saved.pendingMessages[0].id,9);
});

test("actual scheduled wake becomes admissible after reset without buying credits or overriding the quota",t=>{
  const f=fixture(t),result=f.run(Date.parse(f.state.nextEligibleAt)+1);
  assert.equal(result.status,0,result.stderr);assert.match(result.output,/run_model=true/);
  assert.equal(result.stderr,"");
});

test("actual wake preflight refuses an unapproved permanent activation before any API or model call",t=>{
  const f=fixture(t);
  writeFileSync(join(f.root,"agent/autonomy/control.json"),JSON.stringify({...f.control,permanentActivationApproved:false}));
  const result=f.run();assert.notEqual(result.status,0);assert.match(result.stderr,/Permanent activation is not approved/);assert.equal(result.output,"");
});
