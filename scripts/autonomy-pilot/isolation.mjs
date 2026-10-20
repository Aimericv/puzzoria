import {readFileSync,writeFileSync} from "node:fs";
import {getuid} from "node:process";
import {execFileSync} from "node:child_process";

if(getuid()===0) throw new Error("The sandbox must not run as root");
if(process.getgid()===0 || process.getgroups().includes(0)) throw new Error("Privileged groups inherited by the agent");
for(const path of ["/opt/puzzoria-pilot/auth/auth.json","/opt/puzzoria-pilot/auth/canary","/opt/puzzoria-pilot/private/canary","/etc/codex/requirements.toml"]) {
  if(path.endsWith("requirements.toml")) {
    let denied=false; try {writeFileSync(path,"INVALID");} catch {denied=true;}
    if(!denied) throw new Error("Managed policy is writable");
  } else {
    let denied=false; try {readFileSync(path);} catch {denied=true;}
    if(!denied) throw new Error("A protected path is readable");
  }
}
let sudoDenied=false;try{execFileSync("sudo",["-n","true"],{stdio:"ignore"});}catch{sudoDenied=true;}
if(!sudoDenied) throw new Error("Passwordless privilege escalation available");
let networkDenied=false;try {await fetch("https://api.github.com",{signal:AbortSignal.timeout(4000)});}catch{networkDenied=true;}
if(!networkDenied) throw new Error("Tool network isolation unavailable");
writeFileSync("/opt/puzzoria-pilot/work/.sandbox-write-test","ok");
console.log("Sandbox canaries passed");
