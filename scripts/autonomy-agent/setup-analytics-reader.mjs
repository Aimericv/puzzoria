import {execFileSync} from "node:child_process";
import {randomBytes,createHash} from "node:crypto";
import {createRequire} from "node:module";
import {github} from "../autonomy-pilot/github.mjs";
import {REPOSITORY} from "./policy.mjs";

// Operator-only bootstrap. Never print or save the raw reader credential. This
// does not enable the agent, change production, or touch the Plus checkpoint.
const rotate=process.argv[2]==="--rotate";
if(process.argv.length>3 || (process.argv[2]&&!rotate)) throw new Error("Only --rotate is supported");
const credential=execFileSync("git",["credential","fill"],{input:"protocol=https\nhost=github.com\n\n",encoding:"utf8",stdio:["pipe","pipe","ignore"],env:{...process.env,GIT_TERMINAL_PROMPT:"0",GCM_INTERACTIVE:"never"}});
const githubToken=credential.split(/\r?\n/).find(line=>line.startsWith("password="))?.slice(9);
if(!githubToken) throw new Error("Noninteractive GitHub authentication unavailable");
const api=github(githubToken,REPOSITORY),name="PUZZORIA_ANALYTICS_READ_TOKEN";
let exists=false;
try {await api(`/actions/secrets/${name}`);exists=true;} catch(error) {if(error.status!==404)throw error;}
if(exists&&!rotate) throw new Error("Reader already configured; use its existing digest or explicitly rotate and update production together");
const require=createRequire(new URL("../autonomy-pilot/runtime/package.json",import.meta.url));
const sodium=require("libsodium-wrappers");await sodium.ready;
const publicKey=await api("/actions/secrets/public-key"),reader=randomBytes(32).toString("base64url");
const encrypted_value=sodium.to_base64(sodium.crypto_box_seal(reader,sodium.from_base64(publicKey.key,sodium.base64_variants.ORIGINAL)),sodium.base64_variants.ORIGINAL);
await api(`/actions/secrets/${name}`,"PUT",{key_id:publicKey.key_id,encrypted_value});
console.log(`GitHub Secret ${name} configured. Set only this digest in the app's private runtime configuration:`);
console.log(`ANALYTICS_READER_TOKEN_SHA256=${createHash("sha256").update(reader).digest("hex")}`);
