import { database, transaction } from "./database";
import { ApiError } from "./http";
import type { Account } from "./auth";
export type Snapshot = { key: string; value: unknown; updatedAt: number };
export const syncableKey = (key: string) =>
  /^dailygrid:(game|session|practice|run|preferences):[A-Za-z0-9:_-]{1,220}$/.test(key);
export function snapshots(user: Account): Snapshot[] {
  return (
    database()
      .prepare(
        "SELECT key,value_json,updated_at FROM snapshots WHERE user_id=? ORDER BY updated_at",
      )
      .all(user.id) as { key: string; value_json: string; updated_at: number }[]
  ).map((r) => ({
    key: r.key,
    value: JSON.parse(r.value_json),
    updatedAt: r.updated_at,
  }));
}
export function saveSnapshots(user: Account, input: unknown) {
  if (!Array.isArray(input) || input.length > 250)
    throw new ApiError("invalid");
  const now = Date.now();
  const values = input.map((v) => {
    if (
      !v ||
      typeof v !== "object" ||
      typeof v.key !== "string" ||
      !syncableKey(v.key) ||
      !Number.isSafeInteger(v.updatedAt) ||
      v.updatedAt < 0 ||
      v.updatedAt > now + 60000
    )
      throw new ApiError("invalid");
    const value = JSON.stringify(v.value);
    if (!value || Buffer.byteLength(value) > 256000)
      throw new ApiError("invalid", 413);
    return { key: v.key, value, updatedAt: Math.min(now, v.updatedAt) };
  });
  transaction(() => {
    for (const v of values)
      database()
        .prepare(
          `INSERT INTO snapshots VALUES (?,?,?,?)
      ON CONFLICT(user_id,key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at
      WHERE excluded.updated_at>snapshots.updated_at`,
        )
        .run(user.id, v.key, v.value, v.updatedAt);
    database()
      .prepare(
        `DELETE FROM snapshots WHERE user_id=? AND key NOT IN
      (SELECT key FROM snapshots WHERE user_id=? ORDER BY updated_at DESC LIMIT 250)`,
      )
      .run(user.id, user.id);
    const rows = database()
      .prepare(
        "SELECT key,length(CAST(value_json AS BLOB)) AS bytes FROM snapshots WHERE user_id=? ORDER BY updated_at ASC,key ASC",
      )
      .all(user.id) as { key: string; bytes: number }[];
    let bytes = rows.reduce((sum, row) => sum + row.bytes, 0);
    // Keep the most recent drafts instead of letting old completed games block future sync.
    for (const row of rows) {
      if (bytes <= 4 * 1024 * 1024) break;
      database()
        .prepare("DELETE FROM snapshots WHERE user_id=? AND key=?")
        .run(user.id, row.key);
      bytes -= row.bytes;
    }
  });
}
