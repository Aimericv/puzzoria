import { DatabaseSync } from "node:sqlite";
import { mkdtemp, copyFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { replayErasures } from "./account-erasure.mjs";
import { fileURLToPath } from "node:url";

// Never opens a live DB for writing: validates and restores only a disposable copy.
export async function verifyRestore(source, journal) {
  if (!source || !journal || !(await stat(source)).isFile() || !(await stat(journal)).isFile()) throw new Error("Provide a backup and the deletion journal file (empty if no erasures)");
  const temporaryRoot = path.resolve(os.tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, "puzzoria-restore-"));
  if (!path.resolve(directory).startsWith(temporaryRoot + path.sep) || !path.basename(directory).startsWith("puzzoria-restore-")) throw new Error("Unexpected restore workspace");
  try {
    const target = path.join(directory, "restored.sqlite"); await copyFile(source, target);
    const db = new DatabaseSync(target);
    try {
      db.exec("PRAGMA foreign_keys=ON");
      if (db.prepare("PRAGMA quick_check").get()?.quick_check !== "ok") throw new Error("Restore integrity failed");
      for (const table of ["users", "runs", "results", "sessions", "measurement_sessions", "credential_versions"]) db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get();
      const reapplied = replayErasures(db, journal);
      if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Restore references failed");
      return { integrity: "ok", erasuresReapplied: reapplied };
    } finally { db.close(); }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await verifyRestore(process.argv[2], process.env.ACCOUNT_DELETION_LOG ?? "/backups/account-deletions.jsonl"))); }
  catch { console.error("Restore verification failed; source and live database were not modified."); process.exitCode = 1; }
}
