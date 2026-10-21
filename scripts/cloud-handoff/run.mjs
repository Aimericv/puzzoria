import {spawn, execFileSync} from "node:child_process";
import {readFileSync, writeFileSync, mkdirSync, mkdtempSync, renameSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {randomUUID} from "node:crypto";
import {pathToFileURL} from "node:url";
import {Rpc} from "../autonomy-pilot/rpc.mjs";
import {seal, unseal} from "../autonomy-pilot/vault.mjs";
import {assertFreeChatGPT} from "../autonomy-pilot/policy.mjs";
import {github} from "../autonomy-pilot/github.mjs";

const repository = "Aimericv/puzzoria";
export const sourceCheckpoint = {repository, runId:"39465013048", phase:2};

export function validateTarget(target) {
  if (target?.verifiedNewEnvironment !== true || !/^[A-Za-z0-9][A-Za-z0-9_.~-]{5,200}$/.test(target.environmentId ?? ""))
    throw new Error("An explicitly verified NEW cloud environment ID is required; no label or automatic selection is allowed");
  if (target.discovery?.method === "cloud_environment.environment_status") {
    const discovery = target.discovery;
    if (discovery.sourceConfigId !== target.environmentId || discovery.observationsCurrent !== true ||
        !/^ccarenv_/.test(discovery.runtimeEnvironmentId ?? "") ||
        !discovery.sourceConfigVersionId?.includes("~cecfgver_"))
      throw new Error("Native environment discovery does not identify this exact new configuration");
    return target.environmentId;
  }
  const url = new URL(target.environmentUrl);
  if (url.protocol !== "https:" || url.username || url.password || !["chatgpt.com","codex.openai.com"].includes(url.hostname))
    throw new Error("Unexpected environment settings URL");
  if (!decodeURIComponent(url.href).includes(target.environmentId))
    throw new Error("The settings URL must contain the exact environment ID");
  return target.environmentId;
}

export function verifyTask(payload, taskId, environmentId) {
  const task = payload?.tasks?.find(row => row.id === taskId);
  if (!task) return null;
  if (task.environment_id !== environmentId) throw new Error("Cloud task metadata does not match the NEW target environment");
  if (task.is_review || task.attempt_total > 1) throw new Error("Unexpected cloud task type or multiple attempts");
  return {id:task.id, environmentId:task.environment_id, status:task.status, diff:task.summary};
}

export function redact(text, secrets) {
  let result = String(text);
  for (const secret of secrets.filter(value => typeof value === "string" && value.length > 0)) result = result.split(secret).join("[redacted]");
  return result.replace(/Bearer\s+[^\s"']+/gi,"Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,"[redacted-jwt]").slice(0,2500);
}

export async function main() {
  if (process.env.GITHUB_REPOSITORY !== repository || process.env.GITHUB_RUN_ATTEMPT !== "1")
    throw new Error("Only the first attempt of this explicitly authorized repository run is allowed");
  const environmentId = validateTarget(JSON.parse(readFileSync("agent/cloud-handoff/target.json","utf8")));
  const key = process.env.CODEX_PILOT_VAULT_KEY;
  if (!key) throw new Error("Existing checkpoint vault binding is missing");
  const api = github(process.env.GITHUB_TOKEN, repository);
  const sourceArtifact = await api("/actions/artifacts/12285785640");
  if (sourceArtifact.expired || sourceArtifact.name !== "pilot-39465013048-1-session-2")
    throw new Error("The original latest authentication checkpoint is unavailable");
  for (let page=1; ;page++) {
    const {artifacts} = await api(`/actions/artifacts?per_page=100&page=${page}`);
    if (artifacts.some(artifact => /^(pilot-|cloud-handoff-)/.test(artifact.name) && artifact.created_at > sourceArtifact.created_at))
      throw new Error("A newer authentication checkpoint exists: do not reuse the source login or blindly rerun this test");
    if (artifacts.length < 100) break;
  }
  const priorEvidence = JSON.parse(readFileSync(".handoff-in/evidence.json","utf8"));
  if (priorEvidence.runId !== sourceCheckpoint.runId || priorEvidence.phase !== 2 || priorEvidence.nativeAuthRenewed !== true || priorEvidence.plan !== "plus")
    throw new Error("Unexpected source checkpoint evidence");
  const value = unseal(readFileSync(".handoff-in/auth.enc","utf8"), key, sourceCheckpoint);
  if (!value?.tokens?.access_token || !value.tokens.refresh_token || value.OPENAI_API_KEY)
    throw new Error("Existing managed ChatGPT authentication is required; no API key or seed fallback");

  const home = mkdtempSync(join(tmpdir(),"puzzoria-cloud-handoff-"));
  const authFile = join(home,"auth.json"), output = resolve(".handoff-out");
  mkdirSync(output,{recursive:true,mode:0o700});
  writeFileSync(authFile,JSON.stringify(value),{mode:0o600});
  writeFileSync(join(home,"config.toml"),'cli_auth_credentials_store="file"\nforced_login_method="chatgpt"\ncheck_for_update_on_startup=false\n');
  const cli = resolve("scripts/autonomy-pilot/runtime/node_modules/@openai/codex/bin/codex.js");
  const env = {PATH:process.env.PATH, HOME:process.env.HOME, LANG:"C.UTF-8", CODEX_HOME:home, NO_COLOR:"1"};
  const context = {repository,runId:process.env.GITHUB_RUN_ID,phase:"cloud-handoff",environmentId};
  const evidence = {schemaVersion:1,...context,sourceCheckpoint,status:"starting",recordedAt:new Date().toISOString()};
  const knownSecrets = [key,process.env.GITHUB_TOKEN,...Object.values(value.tokens)];
  let child;
  function persist() {
    const current = JSON.parse(readFileSync(authFile,"utf8"));
    if (!current.tokens?.refresh_token || current.OPENAI_API_KEY) throw new Error("Unexpected updated authentication");
    knownSecrets.push(...Object.values(current.tokens));
    writeFileSync(join(output,"auth.enc.tmp"),seal(current,key,context),{mode:0o600});
    renameSync(join(output,"auth.enc.tmp"),join(output,"auth.enc"));
    writeFileSync(join(output,"evidence.json"),JSON.stringify(evidence,null,2)+"\n",{mode:0o600});
  }
  async function accountCheck(refreshToken) {
    child = spawn(process.execPath,[cli,"app-server"],{env,stdio:["pipe","pipe","ignore"]});
    const rpc = new Rpc(child);
    try {
      await rpc.request("initialize",{clientInfo:{name:"puzzoria-cloud-handoff",version:"1"}});
      rpc.send({method:"initialized"});
      const account = (await rpc.request("account/read",{refreshToken})).account;
      persist(); // Preserve native renewal before doing anything else.
      return assertFreeChatGPT(account,await rpc.request("account/rateLimits/read"));
    } finally {
      const stopping = child;
      if (stopping.exitCode === null && stopping.signalCode === null) {
        const exited = new Promise(resolveExit => stopping.once("exit",resolveExit));
        const force = setTimeout(() => stopping.kill("SIGKILL"),5000);
        stopping.kill("SIGTERM");
        await exited;
        clearTimeout(force);
      }
      child = null;
      persist();
    }
  }
  function cloud(args) {
    try {
      return execFileSync(process.execPath,[cli,"cloud",...args],{env,encoding:"utf8",timeout:60000,maxBuffer:1024*1024,stdio:["ignore","pipe","pipe"]}).trim();
    } catch (error) {
      throw new Error(`Native cloud ${args[0]} failed: ${redact(error.stderr || error.message,knownSecrets)}`,{cause:error});
    } finally { persist(); }
  }
  try {
    evidence.quotasBefore = await accountCheck(true);
    evidence.authMethod = "chatgpt";
    evidence.plan = "plus";
    evidence.paidCredits = 0;
    evidence.cliVersion = execFileSync(process.execPath,[cli,"--version"],{env,encoding:"utf8"}).trim();
    persist();
    const nonce = randomUUID();
    evidence.nonce = nonce;
    const prompt = `Test ponctuel de transmission GitHub Actions vers le NOUVEL environnement Codex Cloud Puzzoria. Référence ${nonce}. Réponds en français. Mission en lecture seule : lis AGENTS.md et les informations de démarrage du README, affiche le chemin courant, la version Node et le HEAD Git ; vérifie SQLite intégré avec une base :memory: et SELECT 20 + 22 AS answer, puis ferme la base. Ne démarre aucun serveur. Ne modifie aucun fichier, ne crée ni commit ni PR, ne contacte pas la production et n'accède à aucun secret. Termine avec le résultat observé, les commandes exécutées et la référence du test, puis indique que le propriétaire peut poursuivre la discussion. Le nouvel environnement demandé porte l'identifiant ${environmentId} ; rapporte ton contexte réel sans inventer d'identifiant si tu ne peux pas l'observer.`;
    evidence.status = "submitting";
    persist();
    // Exact ID, exactly one attempt, explicit main branch. Never select an environment by label.
    const url = cloud(["exec","--env",environmentId,"--branch","main","--attempts","1",prompt]);
    if (!/^https:\/\/chatgpt\.com\/codex\/tasks\/[A-Za-z0-9_-]+$/.test(url))
      throw new Error("Submission returned an unexpected result; inspect before any retry to avoid duplicate tasks");
    evidence.taskUrl = url;
    evidence.taskId = url.split("/").at(-1);
    evidence.status = "submitted";
    persist();
    console.log(JSON.stringify({status:"submitted",taskUrl:url,environmentId}));
    if (process.env.GITHUB_STEP_SUMMARY)
      writeFileSync(process.env.GITHUB_STEP_SUMMARY,`## Puzzoria cloud handoff\n\n[Ouvrir la tâche Codex Cloud](${url})\n\nEnvironnement demandé : \`${environmentId}\`.\n\nLa possibilité de répondre dans l'interface reste à vérifier par le propriétaire.\n`,{flag:"a"});
    const deadline = Date.now()+120000;
    do {
      const task = verifyTask(JSON.parse(cloud(["list","--env",environmentId,"--limit","20","--json"])),evidence.taskId,environmentId);
      if (task) {
        evidence.task = task;
        evidence.targetVerified = true;
        persist();
        if (["ready","applied","error"].includes(task.status)) break;
      }
      await new Promise(resolveWait => setTimeout(resolveWait,15000));
    } while (Date.now()<deadline);
    evidence.quotasAfter = await accountCheck(false);
    if (!evidence.targetVerified) throw new Error("Task submitted, but the exact environment could not be verified in its metadata; do not resubmit");
    if (evidence.task.status === "error") throw new Error("The cloud task was created in the correct environment but its execution failed");
    evidence.status = evidence.task.status === "ready" ? "completed" : "submitted-pending";
    evidence.conversationReplyVerified = false;
  } catch (error) {
    evidence.status = "failed";
    evidence.error = redact(error.message,knownSecrets);
    process.exitCode = 1;
    console.error(evidence.error);
  } finally {
    if (child) child.kill("SIGTERM");
    try {
      persist();
      console.log(JSON.stringify(evidence));
    } finally { rmSync(home,{recursive:true,force:true}); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
