import {execFileSync} from "node:child_process";
import {readFileSync,existsSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {createRequire} from "node:module";
import {join} from "node:path";
import {github} from "./github.mjs";

// Operator bootstrap only. GCM's owner credential never leaves this process
// except in HTTPS requests to GitHub; it is never uploaded to the runner.
const mode=process.argv[2];
if(!["seed","enable-after-billing-check","disable","retire-seed"].includes(mode)) throw new Error("Use seed, enable-after-billing-check, disable or retire-seed");
const credential=execFileSync("git",["credential","fill"],{input:"protocol=https\nhost=github.com\n\n",encoding:"utf8",stdio:["pipe","pipe","ignore"],env:{...process.env,GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"}});
const token=credential.split(/\r?\n/).find(l=>l.startsWith("password="))?.slice(9);
if(!token) throw new Error("No noninteractive GitHub credential available");
const api=github(token,"Aimericv/puzzoria");
async function variable(name,value) {
  const vars=await api("/actions/variables?per_page=100");
  await api(vars.variables.some(v=>v.name===name)?`/actions/variables/${name}`:"/actions/variables",vars.variables.some(v=>v.name===name)?"PATCH":"POST",{name,value});
}
if(mode==="seed") {
  const existing=await api("/actions/secrets?per_page=100");
  if(existing.secrets.some(s=>s.name.startsWith("CODEX_PILOT_"))) throw new Error("Pilot secrets already exist: never overwrite rotated credentials or the vault key");
  const authHome=process.env.CODEX_PILOT_LOGIN_HOME;
  if(!authHome || !existsSync(join(authHome,"auth.json"))) throw new Error("Complete a dedicated Codex ChatGPT login first; set CODEX_PILOT_LOGIN_HOME to its private directory");
  const auth=JSON.parse(readFileSync(join(authHome,"auth.json"),"utf8"));
  if(auth.OPENAI_API_KEY || !auth.tokens?.refresh_token || !auth.tokens.access_token) throw new Error("Managed ChatGPT auth required");
  const require=createRequire(new URL("./runtime/package.json",import.meta.url));
  const sodium=require("libsodium-wrappers");await sodium.ready;
  const publicKey=await api("/actions/secrets/public-key");
  const values={CODEX_PILOT_VAULT_KEY:randomBytes(32).toString("base64"),CODEX_PILOT_SEED:JSON.stringify(auth)};
  for(const [name,value] of Object.entries(values)) {
    const encrypted_value=sodium.to_base64(sodium.crypto_box_seal(value,sodium.from_base64(publicKey.key,sodium.base64_variants.ORIGINAL)),sodium.base64_variants.ORIGINAL);
    await api(`/actions/secrets/${name}`,"PUT",{key_id:publicKey.key_id,encrypted_value});
  }
  // Needed for this repository's short-lived GITHUB_TOKEN to create the draft PR.
  await api("/actions/permissions/workflow","PUT",{default_workflow_permissions:"read",can_approve_pull_request_reviews:true});
  console.log("Dedicated ChatGPT seed and vault key stored as GitHub Secrets. No runner enabled.");
} else if(mode==="enable-after-billing-check") {
  // This flag records a HUMAN verification of GitHub's real billing hard stop;
  // it is not itself a spending limit. Do not call based on an alert alone.
  await variable("PUZZORIA_FREE_ACTIONS_VERIFIED","true");
  await variable("PUZZORIA_PILOT_ENABLED","true");
  console.log("Runner gates enabled after operator billing verification. Trigger by pushing the pilot branch.");
} else if(mode==="disable") {
  await variable("PUZZORIA_PILOT_ENABLED","false");
  await variable("PUZZORIA_FREE_ACTIONS_VERIFIED","false");
  console.log("Future CI and pilot jobs disabled. Cancel any already running jobs separately.");
} else {
  await api("/actions/secrets/CODEX_PILOT_SEED","DELETE");
  console.log("Bootstrap seed retired. Preserve the newest encrypted auth artifact and vault key.");
}
