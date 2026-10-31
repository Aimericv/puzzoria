import {spawn,execFileSync} from "node:child_process";
import {resolve} from "node:path";

// JavaScript actions receive the injected artifact transport bindings. Keep
// them in the trusted process tree, never in a file or the model environment.
for(const name of ["ACTIONS_RUNTIME_TOKEN","ACTIONS_RESULTS_URL"])
  if(!process.env[name]) throw new Error(`Required injected artifact binding unavailable: ${name}`);
const node=execFileSync("which",["node"],{encoding:"utf8"}).trim();
const preserve="PUZZORIA_JOB_TIMEOUT,GITHUB_REPOSITORY,GITHUB_REF,GITHUB_WORKFLOW_REF,GITHUB_RUN_ID,GITHUB_RUN_ATTEMPT,GITHUB_JOB,GITHUB_WORKSPACE,GITHUB_SHA,GITHUB_TOKEN,CODEX_PILOT_VAULT_KEY,PUZZORIA_ANALYTICS_READ_TOKEN,ACTIONS_ID_TOKEN_REQUEST_URL,ACTIONS_ID_TOKEN_REQUEST_TOKEN,AGENT_MODE,PUZZORIA_AGENT_ENABLED,ACTIONS_RUNTIME_TOKEN,ACTIONS_RESULTS_URL,ACTIONS_RUNTIME_URL,GITHUB_RETENTION_DAYS,GITHUB_ACTIONS,GITHUB_SERVER_URL,PATH";
const child=spawn("sudo",[`--preserve-env=${preserve}`,node,resolve(process.env.GITHUB_WORKSPACE,"scripts/autonomy-agent/run.mjs")],{stdio:"inherit",env:process.env});
child.on("error",()=>{process.exitCode=1;});
child.on("exit",code=>{process.exitCode=code ?? 1;});
