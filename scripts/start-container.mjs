import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, openSync, closeSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { replayErasures } from "./account-erasure.mjs";
const filename = process.env.DAILYGRID_DB_PATH;
const journal = process.env.ACCOUNT_DELETION_LOG ?? "/backups/account-deletions.jsonl";
mkdirSync(path.dirname(journal), { recursive: true, mode: 0o700 });
if (!existsSync(journal)) closeSync(openSync(journal, "ax", 0o600));
if (filename && existsSync(filename)) {
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try { db.exec("PRAGMA foreign_keys=ON"); replayErasures(db, journal); }
  finally { db.close(); }
}
const child = spawn(process.execPath, ["server.js"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child.kill(signal));
child.on("error", () => { console.error("Puzzoria startup failed"); process.exit(1); });
child.on("exit", code => process.exit(code ?? 1));
