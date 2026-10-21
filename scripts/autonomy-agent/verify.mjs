import {execFileSync} from "node:child_process";
import {mkdirSync,rmSync,symlinkSync,readFileSync} from "node:fs";
import {join} from "node:path";
import {randomUUID} from "node:crypto";

export const VERIFIER_IMAGE="node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d";
export function verifierArgs(work,dependencies,uid,command,name) {
  return ["--host=unix:///var/run/docker.sock","run","--rm","--pull=never",...(name?["--name",name]:[]),
    "--network=none","--read-only","--cap-drop=ALL","--security-opt=no-new-privileges",
    "--pids-limit=256","--memory=3g","--cpus=2","--user",`${uid}:${uid}`,
    "--tmpfs","/tmp:rw,noexec,nosuid,nodev,size=256m,mode=1777",
    "--mount",`type=bind,src=${work},dst=/work`,
    "--mount",`type=bind,src=${dependencies},dst=/work/node_modules,readonly`,
    "--workdir","/work",VERIFIER_IMAGE,"/usr/bin/env","-i",
    "PATH=/usr/local/bin:/usr/bin:/bin","HOME=/work/.tmp/home","TMPDIR=/tmp",
    "XDG_DATA_HOME=/work/.tmp/data","NEXT_TELEMETRY_DISABLED=1",...command];
}

export function verifyCandidate({work,dependencies,uid,evidence,log=console.log}) {
  // The model has stopped. Replace only its dependency symlink with a mount
  // target so Turbopack sees a real directory inside its project root.
  rmSync(join(work,"node_modules"));mkdirSync(join(work,"node_modules"));
  try {
    for(const [name,command] of [
      ["isolation",["node","-e",`const fs=require('node:fs'),net=require('node:net');if(process.getuid()===0||process.env.GITHUB_TOKEN||process.env.CODEX_PILOT_VAULT_KEY)throw Error('Unsafe verifier identity');for(const p of ['/opt/puzzoria-pilot/auth/auth.json','/var/run/docker.sock']){if(fs.existsSync(p))throw Error('Private host mount');}let denied=false;try{fs.writeFileSync('/work/node_modules/.verifier-canary','bad')}catch{denied=true}if(!denied)throw Error('Writable dependencies');const s=net.connect({host:'1.1.1.1',port:443});const t=setTimeout(()=>{s.destroy();process.exit(1)},1500);s.once('connect',()=>{clearTimeout(t);process.exit(1)});s.once('error',()=>{clearTimeout(t);s.destroy();console.log('Verifier isolation passed')});`]],
      ["lint",["npm","run","lint"]],
      ["typecheck",["npm","run","typecheck"]],
      ["unit",["npm","test","--","--configLoader=runner","--maxWorkers=2","--reporter=json","--outputFile=.agent-tests.json"]],
      ["content",["node","--import","tsx","scripts/validate-content.ts"]],
      ["build",["npm","run","build"]]
    ]) {
      log(`Independent verifier: ${name}`);
      const container=`puzzoria-check-${randomUUID()}`;
      const environment={...process.env};
      for(const selector of ["DOCKER_HOST","DOCKER_CONTEXT","DOCKER_TLS","DOCKER_TLS_VERIFY","DOCKER_CERT_PATH"]) delete environment[selector];
      try {execFileSync("docker",verifierArgs(work,dependencies,uid,command,container),{env:environment,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:240000,maxBuffer:8*1024*1024});}
      catch(error) {
        evidence.commands.push({name,status:"failed",exitCode:error.status ?? null});
        if(name==="unit") {
          try {
            const result=JSON.parse(readFileSync(join(work,".agent-tests.json"),"utf8"));
            evidence.failedTests=result.testResults.flatMap(file=>file.assertionResults.filter(test=>test.status==="failed").map(test=>test.fullName)).slice(0,10);
          } catch { /* No completed test report is not a passing suite. */ }
        }
        throw new Error(`Independent ${name} check failed (exit ${error.status ?? "timeout"})`,{cause:error});
      }
      finally {
        // A timed-out Docker client must not leave a background verifier alive.
        try {execFileSync("docker",["--host=unix:///var/run/docker.sock","rm","--force",container],{env:environment,stdio:"ignore",timeout:10000});}
        catch(cleanupError) {if(cleanupError.status!==1) throw new Error("Unable to stop the verifier container");}
      }
      evidence.commands.push({name,status:"passed"});
    }
    evidence.verifier={image:VERIFIER_IMAGE,network:"none",credentials:false,dependencies:"read-only",uid};
  } finally {
    rmSync(join(work,"node_modules"),{recursive:true,force:true});symlinkSync(dependencies,join(work,"node_modules"));
  }
}
