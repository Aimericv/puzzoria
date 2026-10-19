import { createHash } from "node:crypto";
import { mkdirSync, openSync, writeSync, fsyncSync, closeSync, readFileSync } from "node:fs";
import path from "node:path";
const validId = value => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\p{Cc}\p{Cf}]/u.test(value);

// Shared by authenticated erasure and isolated restore verification. No credentials in the journal.
export function eraseAccountRows(db, userId) {
  const owner = `u:${userId}`;
  const hash = createHash("sha256").update(owner).digest("hex");
  db.prepare("DELETE FROM measurement_activity WHERE device_hash IN (SELECT device_hash FROM measurement_sessions WHERE owner_hash=?)").run(hash);
  db.prepare("DELETE FROM measurement_sessions WHERE owner_hash=?").run(hash);
  db.prepare("DELETE FROM number_rooms WHERE json_extract(state_json,'$.players[0].owner')=? OR json_extract(state_json,'$.players[1].owner')=?").run(owner, owner);
  // Old backups can predate migration 7; replay their journal before app migrations.
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='live_rooms'").get())
    db.prepare("DELETE FROM live_rooms WHERE json_extract(state_json,'$.players[0].owner')=? OR json_extract(state_json,'$.players[1].owner')=?").run(owner, owner);
  db.prepare("DELETE FROM community_votes WHERE owner=? OR run_id IN (SELECT id FROM runs WHERE user_id=? OR owner=?)").run(owner, userId, owner);
  db.prepare("DELETE FROM friend_challenges WHERE host_run_id IN (SELECT id FROM runs WHERE user_id=? OR owner=?)").run(userId, owner);
  db.prepare("DELETE FROM results WHERE user_id=? OR owner=?").run(userId, owner);
  db.prepare("DELETE FROM runs WHERE user_id=? OR owner=?").run(userId, owner);
  db.prepare("DELETE FROM users WHERE id=?").run(userId);
}

export function recordErasure(filename, userId, now = Date.now()) {
  if (!validId(userId)) throw new Error("Invalid erasure identity");
  mkdirSync(path.dirname(path.resolve(filename)), { recursive: true, mode: 0o700 });
  const fd = openSync(filename, "a", 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify({ userId, at: now }) + "\n");
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(fd, bytes, offset, bytes.length - offset);
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

export function replayErasures(db, filename) {
  let data;
  try { data = readFileSync(filename, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return 0; throw error; }
  const rows = data.split("\n").filter(Boolean).map(line => JSON.parse(line));
  if (rows.some(r => !validId(r.userId) || !Number.isSafeInteger(r.at) || r.at < 0)) throw new Error("Invalid erasure journal");
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of rows) eraseAccountRows(db, row.userId);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return rows.length;
}
