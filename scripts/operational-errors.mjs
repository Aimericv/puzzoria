import { mkdirSync, appendFileSync, statSync } from "node:fs";
import { readdir, readFile, unlink } from "node:fs/promises";
import path from "node:path";
export function recordOperationError(directory, now = Date.now()) {
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const file = path.join(directory, `errors-${new Date(now).toISOString().slice(0, 10)}.log`);
    let bytes = 0; try { bytes = statSync(file).size; } catch { /* New day. */ }
    // Only timestamps, bounded to 1 MiB/day. No paths, messages, cookies or user identifiers.
    if (bytes < 1024 * 1024) appendFileSync(file, `${now}\n`, { mode: 0o600 });
  } catch { /* Operational telemetry must never fail a request. */ }
}
export async function recentOperationErrors(directory, now = Date.now()) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
  let total = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^errors-\d{4}-\d{2}-\d{2}\.log$/.test(entry.name)) continue;
    const day = Date.parse(entry.name.slice(7, 17)), file = path.join(directory, entry.name);
    if (day < now - 7 * 86400000) { await unlink(file); continue; }
    if (day + 86400000 < now - 300000) continue;
    const data = await readFile(file, "utf8");
    total += data.split("\n").filter(line => line && Number(line) >= now - 300000 && Number(line) <= now).length;
  }
  return total;
}
