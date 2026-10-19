import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";

let connection: DatabaseSync | undefined;
let location: string | undefined;
export function database() {
  const filename =
    process.env.DAILYGRID_DB_PATH ??
    path.join(process.cwd(), ".data", "dailygrid.sqlite");
  if (connection && location === filename) return connection;
  connection?.close();
  connection = undefined;
  location = undefined;
  if (filename !== ":memory:")
    // Runtime databases are provisioned separately and must never enter the deployment trace.
    mkdirSync(
      path.dirname(path.resolve(/* turbopackIgnore: true */ filename)),
      { recursive: true },
    );
  const db = new DatabaseSync(filename, { timeout: 5000 });
  try {
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      display_name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, owner TEXT NOT NULL, user_id TEXT REFERENCES users(id),
      guest_id TEXT NOT NULL, challenge_id TEXT NOT NULL, game TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('daily','practice','archive')),
      challenge_json TEXT NOT NULL, started_at TEXT, created_at TEXT NOT NULL,
      progress_json TEXT NOT NULL DEFAULT '{"guesses":[],"hints":0}',
      response_json TEXT, UNIQUE(owner, challenge_id)
    );
    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id), owner TEXT NOT NULL,
      game TEXT NOT NULL, mode TEXT NOT NULL, challenge_id TEXT NOT NULL,
      date TEXT NOT NULL, locale TEXT NOT NULL, difficulty TEXT,
      started_at TEXT, completed_at TEXT NOT NULL, duration INTEGER NOT NULL,
      success INTEGER NOT NULL, score REAL NOT NULL, attempts INTEGER, errors INTEGER NOT NULL DEFAULT 0,
      provenance TEXT NOT NULL CHECK(provenance IN ('server','imported')),
      eligible INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}',
      UNIQUE(owner, challenge_id)
    );
    CREATE INDEX IF NOT EXISTS results_cohort ON results(game,mode,challenge_id,eligible);
    CREATE INDEX IF NOT EXISTS results_user_time ON results(user_id,completed_at);
    CREATE TABLE IF NOT EXISTS snapshots (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key TEXT NOT NULL, value_json TEXT NOT NULL, updated_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,key)
    );
    CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, resets_at INTEGER NOT NULL
    );
    INSERT OR IGNORE INTO schema_migrations VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS account_recovery (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      code_hash TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO schema_migrations VALUES (2, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS friend_challenges (
      id TEXT PRIMARY KEY, host_run_id TEXT NOT NULL UNIQUE REFERENCES runs(id),
      created_at TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS word_definitions (
      locale TEXT NOT NULL, word TEXT NOT NULL, value_json TEXT NOT NULL, fetched_at INTEGER NOT NULL,
      PRIMARY KEY(locale,word)
    );
    INSERT OR IGNORE INTO schema_migrations VALUES (3, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS community_votes (
      owner TEXT NOT NULL, kind TEXT NOT NULL, cohort TEXT NOT NULL,
      payload_json TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id), created_at TEXT NOT NULL,
      PRIMARY KEY(owner,kind,cohort)
    );
    CREATE INDEX IF NOT EXISTS community_cohort ON community_votes(kind,cohort);
    CREATE TABLE IF NOT EXISTS number_rooms (
      code TEXT PRIMARY KEY, state_json TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS number_room_host ON number_rooms(json_extract(state_json,'$.players[0].owner'));
    CREATE INDEX IF NOT EXISTS number_room_guest ON number_rooms(json_extract(state_json,'$.players[1].owner'));
    INSERT OR IGNORE INTO schema_migrations VALUES (4, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS measurement_sessions (
      id TEXT PRIMARY KEY, owner_hash TEXT NOT NULL, device_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, entry_page TEXT NOT NULL,
      locale TEXT NOT NULL, device TEXT NOT NULL, channel TEXT NOT NULL,
      referrer TEXT, source TEXT, medium TEXT, campaign TEXT
    );
    CREATE INDEX IF NOT EXISTS measurement_owner ON measurement_sessions(owner_hash,created_at);
    CREATE INDEX IF NOT EXISTS measurement_updated ON measurement_sessions(updated_at);
    CREATE TABLE IF NOT EXISTS measurement_events (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES measurement_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL, at INTEGER NOT NULL, page TEXT NOT NULL, game TEXT, mode TEXT,
      locale TEXT NOT NULL, puzzle_locale TEXT, difficulty TEXT, challenge_id TEXT,
      value REAL NOT NULL DEFAULT 0, detail TEXT
    );
    CREATE INDEX IF NOT EXISTS measurement_time ON measurement_events(at,game,mode,locale);
    CREATE INDEX IF NOT EXISTS measurement_session ON measurement_events(session_id,at);
    CREATE TABLE IF NOT EXISTS measurement_activity (
      device_hash TEXT PRIMARY KEY, until_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS measurement_quality (
      day TEXT NOT NULL, kind TEXT NOT NULL, count INTEGER NOT NULL, PRIMARY KEY(day,kind)
    );
    INSERT OR IGNORE INTO schema_migrations VALUES (5, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS credential_versions (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      version INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limits(resets_at);
    CREATE INDEX IF NOT EXISTS session_expiry ON sessions(expires_at);
    INSERT OR IGNORE INTO schema_migrations VALUES (6, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
    CREATE TABLE IF NOT EXISTS live_rooms (code TEXT PRIMARY KEY, state_json TEXT NOT NULL, expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS live_room_expiry ON live_rooms(expires_at);
    INSERT OR IGNORE INTO schema_migrations VALUES (7, strftime('%Y-%m-%dT%H:%M:%fZ','now'));
  `);
  } catch (error) {
    db.close();
    throw error;
  }
  connection = db;
  location = filename;
  return db;
}
export function transaction<T>(action: () => T): T {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = action();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function closeDatabase() {
  connection?.close();
  connection = undefined;
  location = undefined;
}
