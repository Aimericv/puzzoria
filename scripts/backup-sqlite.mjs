import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, stat, chmod, rename, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function backupSqlite(source, destinationDirectory) {
  if (!source || source === ":memory:" || !destinationDirectory) throw new Error("Provide a database file and private backup directory.");
  const filename = path.resolve(source), directory = path.resolve(destinationDirectory);
  if (!(await stat(filename)).isFile()) throw new Error("Database source must be a file.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(directory, `dailygrid-${stamp}-${randomUUID()}.sqlite`);
  const temporary = `${destination}.partial`;
  const db = new DatabaseSync(filename, { readOnly: true, timeout: 5000 });
  try {
    await backup(db, temporary);
    const verification = new DatabaseSync(temporary, { readOnly: true });
    try {
      if (verification.prepare("PRAGMA quick_check").get()?.quick_check !== "ok") throw new Error("Backup integrity check failed.");
    } finally { verification.close(); }
    await chmod(temporary, 0o600);
    await rename(temporary, destination);
    return destination;
  } finally {
    db.close();
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  try {
    const destination = await backupSqlite(process.env.DAILYGRID_DB_PATH ?? path.join(process.cwd(), ".data", "dailygrid.sqlite"), process.env.BACKUP_DIR ?? path.join(process.cwd(), ".data", "backups"));
    console.log(`SQLite backup verified: ${destination}`);
  } catch {
    console.error("SQLite backup failed. Check the private source, destination and filesystem permissions.");
    process.exitCode = 1;
  }
}
