import { readdir, stat, statfs, unlink, readFile, writeFile, rename, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { backupSqlite } from "./backup-sqlite.mjs";
import { recentOperationErrors } from "./operational-errors.mjs";

export const backupName = /^dailygrid-\d{4}-\d{2}-\d{2}T[0-9-]+Z-[0-9a-f-]{36}\.sqlite$/;
const partialBackupName = new RegExp(backupName.source.slice(0, -1) + "\\.partial$");
export async function rotateBackups(directory, now = Date.now(), days = 14) {
  const entries = await readdir(directory, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || (!backupName.test(entry.name) && !partialBackupName.test(entry.name))) continue;
    const file = path.join(directory, entry.name), info = await stat(file);
    if (info.mtimeMs < now - (partialBackupName.test(entry.name) ? 1 : days) * 86400000) { await unlink(file); removed++; }
  }
  return removed;
}
export function purgeMeasurement(source, now = Date.now()) {
  const db = new DatabaseSync(source, { timeout: 5000 });
  try {
    db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE");
    db.prepare("DELETE FROM measurement_events WHERE at<?").run(now - 90 * 86400000);
    db.prepare("DELETE FROM measurement_sessions WHERE updated_at<?").run(now - 390 * 86400000);
    db.prepare("DELETE FROM measurement_activity WHERE until_at<?").run(now - 86400000);
    db.prepare("DELETE FROM measurement_quality WHERE day<?").run(new Date(now - 390 * 86400000).toISOString().slice(0, 10));
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
    db.prepare("DELETE FROM rate_limits WHERE resets_at<=?").run(now);
    if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='live_rooms'").get()) db.prepare("DELETE FROM live_rooms WHERE expires_at<=?").run(now);
    db.exec("COMMIT");
  } finally { db.close(); }
}
export function alertTransitions(previous, current, now = Date.now(), reminderMs = 3600000) {
  const state = { ...previous }, notifications = [];
  for (const [name, active] of Object.entries(current)) {
    const old = state[name];
    if (active && (!old?.active || now - old.notifiedAt >= reminderMs)) {
      notifications.push({ name, status: "alert" }); state[name] = { active: true, notifiedAt: now };
    } else if (!active && old?.active) {
      notifications.push({ name, status: "recovered" }); state[name] = { active: false, notifiedAt: now };
    }
  }
  return { state, notifications };
}
export async function notifyOperations(notification, webhook) {
  console.log(`Puzzoria operations: ${notification.name} ${notification.status}`);
  if (!webhook) return;
  const url = new URL(webhook);
  if (url.protocol !== "https:") throw new Error("Alerts require HTTPS");
  const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(10000), headers: { "content-type": "application/json" }, body: JSON.stringify({ text: `Puzzoria: ${notification.name} ${notification.status}` }) });
  if (!response.ok) throw new Error("Alert delivery failed");
}
async function saveState(directory, state) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const file = path.join(directory, "operations-state.json"), temporary = `${file}.partial`;
  await writeFile(temporary, JSON.stringify(state), { mode: 0o600 }); await rename(temporary, file);
}
/** @param {{source:string,directory:string,healthUrl:string,minimumFreeBytes:number,webhook:string}} config
 * @param {{lastBackup?:number,checkedAt?:number,alerts?:Record<string,{active:boolean,notifiedAt:number}>}} previous
 */
export async function operationsTick(config, previous = {}, now = Date.now()) {
  const state = { ...previous }, problems = {};
  try { problems.serverErrors = await recentOperationErrors(path.join(path.dirname(config.source), "operations"), now) >= 10; }
  catch { problems.serverErrors = true; }
  try {
    const response = await fetch(config.healthUrl, { signal: AbortSignal.timeout(5000), redirect: "error" });
    problems.availability = !response.ok || (await response.json()).status !== "ok";
  } catch { problems.availability = true; }
  if (!problems.availability && (!state.lastBackup || now - state.lastBackup >= 86400000)) {
    try {
      purgeMeasurement(config.source, now);
      await backupSqlite(config.source, config.directory);
      state.lastBackup = now;
    } catch { console.error("Puzzoria operations: backup/maintenance failed"); }
  }
  // Expired private copies are removed even if the next backup fails; retention is a hard limit.
  try { await rotateBackups(config.directory, now); problems.backupRetention = false; } catch { problems.backupRetention = true; }
  problems.backup = !state.lastBackup || now - state.lastBackup > 26 * 3600000;
  try {
    for (const directory of [path.dirname(config.source), config.directory]) {
      const space = await statfs(directory);
      if (space.bavail * space.bsize < config.minimumFreeBytes || space.bavail / space.blocks < 0.1) problems.disk = true;
    }
    problems.disk ??= false;
  } catch { problems.disk = true; }
  const transitions = alertTransitions(state.alerts ?? {}, problems, now);
  state.alerts = transitions.state;
  for (const notification of transitions.notifications) {
    try { await notifyOperations(notification, config.webhook); }
    catch { console.error("Puzzoria operations: alert delivery failed"); delete state.alerts[notification.name]; }
  }
  state.checkedAt = now;
  await saveState(config.directory, state);
  return state;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  const directory = process.env.BACKUP_DIR ?? "/backups";
  let state = {};
  try { state = JSON.parse(await readFile(path.join(directory, "operations-state.json"), "utf8")); } catch { /* First startup. */ }
  const config = { source: process.env.DAILYGRID_DB_PATH ?? "/data/dailygrid.sqlite", directory,
    healthUrl: process.env.OPERATIONS_HEALTH_URL ?? "http://app:3000/api/health", minimumFreeBytes: 1024 ** 3, webhook: process.env.OPERATIONS_WEBHOOK_URL ?? "" };
  const tick = async () => { state = await operationsTick(config, state); };
  // Sequential iterations cannot overlap a long backup.
  while (true) { try { await tick(); } catch { console.error("Puzzoria operations: check failed"); } await new Promise(resolve => setTimeout(resolve, 60000)); }
}
