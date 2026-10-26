import {readFileSync,writeFileSync,readlinkSync} from "node:fs";
import {getuid} from "node:process";
import {execFileSync} from "node:child_process";

if(getuid()===0) throw new Error("The sandbox must not run as root");
if(process.getgid()!==3050 || process.getgroups().some(group=>group!==3050)) throw new Error("Unexpected groups inherited by the agent");
const hostPid=Number(process.argv[2]),hostNamespace=process.argv[3];
if(!Number.isInteger(hostPid) || !hostNamespace || readlinkSync("/proc/self/ns/pid")===hostNamespace) throw new Error("Host PID namespace inherited by tools");
for(const name of ["GITHUB_TOKEN","GH_TOKEN","OPENAI_API_KEY","CODEX_PILOT_SEED","CODEX_PILOT_VAULT_KEY","PUZZORIA_ANALYTICS_READ_TOKEN","ACTIONS_RUNTIME_TOKEN","ACTIONS_ID_TOKEN_REQUEST_URL","ACTIONS_ID_TOKEN_REQUEST_TOKEN","GOOGLE_APPLICATION_CREDENTIALS","GOOGLE_ACCESS_TOKEN"]) if(process.env[name]) throw new Error("Credential environment inherited by tools");
for(const path of ["/opt/puzzoria-pilot/auth/auth.json","/opt/puzzoria-pilot/auth/canary","/opt/puzzoria-pilot/private/canary",`/proc/${hostPid}/environ`,"/etc/codex/requirements.toml"]) {
  if(path.endsWith("requirements.toml")) {
    let denied=false; try {writeFileSync(path,"INVALID");} catch {denied=true;}
    if(!denied) throw new Error("Managed policy is writable");
  } else {
    let denied=false; try {readFileSync(path);} catch {denied=true;}
    if(!denied) throw new Error(`Protected path is readable: ${path}`);
  }
}
let sudoDenied=false;try{execFileSync("sudo",["-n","true"],{stdio:"ignore"});}catch{sudoDenied=true;}
if(!sudoDenied) throw new Error("Passwordless privilege escalation available");
let networkDenied=false;try {await fetch("https://api.github.com",{signal:AbortSignal.timeout(4000)});}catch{networkDenied=true;}
if(!networkDenied) throw new Error("Tool network isolation unavailable");
writeFileSync("/opt/puzzoria-pilot/work/.sandbox-write-test","ok");
console.log("Sandbox canaries passed");
