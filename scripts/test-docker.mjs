import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { generateChallenge } from "../src/lib/challenges.ts";
import { utcDay } from "../src/lib/date.ts";
import { normalizeWord } from "../src/lib/word-normalization.ts";
import { chromium } from "@playwright/test";
import { runLoadScenario } from "./load-scenario.mjs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// Every stateful check lives in a freshly named Compose project, never the dev DB.
const suffix = randomUUID().slice(0,8), project = `dailygrid-smoke-${suffix}`;
const imageTag = `smoke-${suffix}`, image = `dailygrid:${imageTag}`;
const listener = createServer();
await new Promise((resolve) => listener.listen(0,"127.0.0.1",resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const env = {...process.env, NEXT_PUBLIC_SITE_URL:origin, APP_PORT:String(port), IMAGE_TAG:imageTag, TRUST_PROXY:"false", ANALYTICS_ADMIN_USERNAMES:""};
const base = ["compose","--env-file",".env.docker.example","-p",project];
const docker = (args, silent=false) => execFileSync("docker",args,{env,encoding:"utf8",stdio:["ignore",silent?"pipe":"inherit","inherit"]});
const compose = (args,silent=false) => docker([...base,...args],silent);
const cookies = new Map();
async function api(path,body) {
  // A fresh connection avoids reusing an old container's pooled socket after recreation.
  return new Promise((resolve,reject)=>{
    const request=httpRequest(`http://127.0.0.1:${port}${path}`,{agent:false,method:body?"POST":"GET",timeout:10000,headers:{...(body?{"content-type":"application/json",origin}:{}),cookie:[...cookies].map(([k,v])=>`${k}=${v}`).join("; ")}},response=>{
      const chunks=[];
      response.on("data",chunk=>chunks.push(chunk));response.on("error",reject);
      response.on("end",()=>{
        try{
          for(const line of response.headers["set-cookie"]??[]){const pair=line.split(";",1)[0],i=pair.indexOf("=");cookies.set(pair.slice(0,i),pair.slice(i+1));}
          assert.equal(response.statusCode>=200&&response.statusCode<300,true,`Unexpected API status ${response.statusCode} on ${path.split("?")[0]}`);
          resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        }catch(error){reject(error);}
      });
    });
    request.on("error",reject);request.on("timeout",()=>request.destroy(new Error("Docker API timeout")));
    request.end(body?JSON.stringify(body):undefined);
  });
}
let initialized=false,built=false;
try {
  compose(["build","app"]);
  built=true;
  initialized=true;
  compose(["up","-d","--no-build","--wait","--wait-timeout","60"]);
  const uid=compose(["exec","-T","app","node","-e","console.log(process.getuid())"],true).trim();assert.notEqual(uid,"0");
  assert.deepEqual(await api("/api/health"),{status:"ok"});
  for(const locale of ["fr","en","es","de"]){const r=await fetch(`http://127.0.0.1:${port}/${locale}`);assert.equal(r.status,200);assert.match(await r.text(),/noindex/);}
  const browser=await chromium.launch();
  try {
    const page=await browser.newPage();
    // Inject untrusted markup into the server HTML, not through a DevTools evaluation.
    await page.route(`${origin}/en`,async route=>{
      const response=await route.fetch();
      const html=await response.text();
      await route.fulfill({response,body:html.replace("</head>","<script>window.__securityProbe=1</script></head>")});
    });
    const response=await page.goto(`${origin}/en`);
    const csp=response.headers()["content-security-policy"];
    assert.match(csp,/frame-ancestors 'none'/);assert.doesNotMatch(csp,/unsafe-eval/);
    const nonce=csp.match(/'nonce-([^']+)'/)[1];
    assert.equal(await page.locator("script[src]").first().evaluate(node=>node.nonce),nonce);
    await page.locator(".measurement-notice").waitFor();
    await page.getByRole("button",{name:"No thanks",exact:true}).click();
    await page.locator(".measurement-notice").waitFor({state:"hidden"});
    assert.equal(await page.evaluate(()=>window.__securityProbe),undefined);
    await page.goto(`${origin}/en/word/practice`);
    await page.locator(".touch-keyboard .wide-key").first().waitFor();
    await page.locator(".word-board").focus();await page.keyboard.type("hello");
    assert.match(await page.locator(".word-board").textContent(),/H/);
  } finally {await browser.close();}
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/dev-preview?game=word&locale=en`)).status,404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/api/admin/analytics`)).status,404);
  const smokePassword=randomUUID()+randomUUID();
  await api("/api/account",{action:"signup",username:`smoke_${suffix}`,password:smokePassword});
  assert.equal((await api("/api/measurement",{choice:"yes",events:[{id:randomUUID(),name:"page_view",path:"/en/word",locale:"en"}],source:"docker-smoke"})).accepted,1);
  const run=await api("/api/play",{action:"new",game:"word",locale:"en",mode:"daily"});
  await api("/api/play",{action:"start",runId:run.runId});
  const challenge=generateChallenge("word","en",utcDay());assert.equal(challenge.kind,"word");
  const result=await api("/api/play",{action:"submit",runId:run.runId,guesses:[normalizeWord(challenge.answer)],hints:0});assert.equal(result.completion.success,true);
  compose(["exec","-T","app","node","scripts/backup-sqlite.mjs"]);
  const check=`const fs=require('node:fs');const {DatabaseSync}=require('node:sqlite');const file=fs.readdirSync('/backups').filter(f=>f.endsWith('.sqlite')).sort().at(-1);const db=new DatabaseSync('/backups/'+file,{readOnly:true});const counts={users:db.prepare('SELECT COUNT(*) AS n FROM users').get().n,results:db.prepare('SELECT COUNT(*) AS n FROM results').get().n,integrity:db.prepare('PRAGMA quick_check').get().quick_check};db.close();for(const forbidden of ['.env','.env.local','.data','.sites-runtime','test-results'])if(fs.existsSync('/app/'+forbidden))throw Error('Private build artifact');console.log(JSON.stringify(counts));`;
  assert.deepEqual(JSON.parse(compose(["exec","-T","app","node","-e",check],true)),{users:1,results:1,integrity:"ok"});
  compose(["up","-d","--no-build","--force-recreate","--wait","--wait-timeout","60"]);
  const restored=await api(`/api/play?runId=${run.runId}`);assert.equal(restored.result.completion.success,true);
  const profile=await api("/api/account");assert.equal(profile.user.username,`smoke_${suffix}`);
  assert.equal(profile.completions.length,1);
  const measured=JSON.parse(compose(["exec","-T","app","node","-e","const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('/data/dailygrid.sqlite',{readOnly:true});console.log(JSON.stringify(db.prepare('SELECT name,COUNT(*) AS n FROM measurement_events GROUP BY name').all()));db.close();"],true));
  assert.deepEqual(measured.map(e=>e.name).sort(),["page_view","run_finished","run_started"]);
  const exported=await api("/api/account",{action:"export",password:smokePassword});assert.equal(exported.results.length,1);assert.equal(exported.profile.username,`smoke_${suffix}`);
  assert.equal((await api("/api/account",{action:"delete",password:smokePassword,confirmUsername:`smoke_${suffix}`})).deleted,true);
  assert.equal((await api("/api/account")).user,null);
  const verify=`const fs=require('node:fs');const {execFileSync}=require('node:child_process');const file=fs.readdirSync('/backups').filter(f=>f.endsWith('.sqlite')).sort().at(-1);console.log(execFileSync(process.execPath,['scripts/verify-restore.mjs','/backups/'+file],{encoding:'utf8'}));`;
  assert.deepEqual(JSON.parse(compose(["exec","-T","app","node","-e",verify],true)),{integrity:"ok",erasuresReapplied:1});
  assert.equal(JSON.parse(compose(["exec","-T","app","node","-e","const fs=require('node:fs');console.log(JSON.stringify(!!JSON.parse(fs.readFileSync('/backups/operations-state.json')).lastBackup));"],true)),true);
  if(process.argv.includes("--load")) {
    const report=await runLoadScenario(origin,50);
    await mkdir(".sites-runtime",{recursive:true});await writeFile(path.join(".sites-runtime","load-report.json"),JSON.stringify(report,null,2));
    console.log(`Load validation: ${JSON.stringify(report)}`);
    assert.equal(report.errors,0);assert.ok(report.gameplay.p95Milliseconds<1500,"Gameplay p95 exceeded the local 1500ms budget");
  }
  console.log("Docker smoke passed: non-root, four locales, production CSP and browser hydration, guards, verified result, private measurement, live SQLite backup and persistence after recreation.");
} finally {
  assert.match(project,/^dailygrid-smoke-[a-f0-9]{8}$/);
  // Only the uniquely named resources created above are removed.
  if(initialized)compose(["down","--volumes","--remove-orphans"]);
  if(built)docker(["image","rm",image]);
}
