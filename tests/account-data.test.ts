import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { database, closeDatabase } from "../src/lib/server/database";
import { account, authenticate, createSession, hashPassword } from "../src/lib/server/auth";
import { issueRecoveryCode } from "../src/lib/server/recovery";
import { createRun, beginRun, submitRun } from "../src/lib/server/play";
import { createFriend } from "../src/lib/server/friends";
import { createRoom } from "../src/lib/server/number-rooms";
import { collectMeasurement } from "../src/lib/server/measurement";
import { randomToken } from "../src/lib/server/http";
import { POST } from "../src/app/api/account/route";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import { backupSqlite } from "../scripts/backup-sqlite.mjs";
import { verifyRestore } from "../scripts/verify-restore.mjs";
import { DatabaseSync } from "node:sqlite";

let directory: string;
const password = "personal export and erase passphrase";
const request = (cookie = "", body: Record<string, unknown> = {}) => new NextRequest("http://localhost/api/account", { method: "POST", headers: { cookie, origin: "http://localhost", "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  closeDatabase(); mkdirSync(".sites-runtime", { recursive: true }); directory = mkdtempSync(path.resolve(".sites-runtime/account-data-"));
  vi.stubEnv("DAILYGRID_DB_PATH", path.join(directory, "private.sqlite")); vi.stubEnv("ACCOUNT_DELETION_LOG", path.join(directory, "erased.jsonl"));
  vi.stubEnv("AUTH_ORIGIN", "http://localhost"); vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000"); vi.stubEnv("TRUST_PROXY", "false"); vi.stubEnv("ANALYTICS_ADMIN_USERNAMES", "");
});
afterEach(() => { closeDatabase(); vi.unstubAllEnvs(); if (!directory.startsWith(path.resolve(".sites-runtime") + path.sep)) throw new Error("Unsafe fixture"); rmSync(directory, { recursive: true, force: true }); });
async function setup() {
  const user = await authenticate(request(), { username: "personal_user", password }, true), response = NextResponse.json({}), guestId = randomToken();
  createSession(request(), response, user);
  const cookie = `dailygrid-session=${response.cookies.get("dailygrid-session")!.value}; dailygrid-guest=${guestId}`;
  const who = { user, guestId, owner: `u:${user.id}` }, run = await createRun({ game: "word", locale: "en", mode: "daily" }, who);
  beginRun(run.runId, who); const challenge = generateChallenge("word", "en", utcDay()); if (challenge.kind !== "word") throw new Error();
  submitRun(run.runId, who, { guesses: [challenge.answer], hints: 0 }); createFriend(run.runId, who); createRoom(who, "en");
  database().prepare("INSERT INTO snapshots VALUES(?,?,?,?)").run(user.id, "dailygrid:preferences:theme", '{"theme":"light"}', Date.now());
  database().prepare("INSERT INTO community_votes VALUES(?,?,?,?,?,?)").run(who.owner, "ranking", "fixture", '[1,2,3,4,5]', run.runId, new Date().toISOString());
  collectMeasurement(request(cookie), NextResponse.json({}), { choice: "yes", events: [{ id: crypto.randomUUID(), name: "page_view", path: "/en/word", locale: "en" }] });
  const recovery = issueRecoveryCode(user.id);
  return { user, cookie, run, recovery, guestId };
}
it("exports only the authenticated user's data after fresh password verification", async () => {
  const { user, cookie, recovery } = await setup();
  const db = database(); db.prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("other", "other_user", "Never exported", "other-private-hash", new Date().toISOString());
  const response = await POST(request(cookie, { action: "export", password, userId: "other" })); expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("content-disposition")).toContain("attachment");
  const text = await response.text(), exported = JSON.parse(text);
  expect(exported.profile.username).toBe(user.username); expect(exported.results).toHaveLength(1); expect(exported.savedDrafts).toHaveLength(1); expect(exported.visits).toHaveLength(1);
  expect(exported.savedRuns).toHaveLength(1); expect(exported.savedRuns[0]).not.toHaveProperty("state"); expect(exported.invitations).toHaveLength(1); expect(exported.duels).toHaveLength(1); expect(exported.duels[0]).not.toHaveProperty("players");
  for (const secret of [password, recovery, "password_hash", "code_hash", "token_hash", "device_hash", "owner_hash", "Never exported", "other-private-hash"]) expect(text).not.toContain(secret);
});
it("rejects wrong password, missing login, foreign origins and incorrect destructive confirmation", async () => {
  const { cookie, user } = await setup();
  for (const action of ["export", "delete"]) {
    expect((await POST(request("", { action, password, confirmUsername: user.username }))).status).toBe(401);
    expect((await POST(request(cookie, { action, password: "wrong current passphrase", confirmUsername: user.username }))).status).toBe(401);
    const foreign = request(cookie, { action, password, confirmUsername: user.username }); foreign.headers.set("origin", "https://attacker.test"); expect((await POST(foreign)).status).toBe(403);
  }
  expect((await POST(request(cookie, { action: "delete", password, confirmUsername: "other_user" }))).status).toBe(400);
  expect(account(request(cookie))?.id).toBe(user.id);
});
it("erases associated rows atomically, revokes every session and preserves unrelated guest progress", async () => {
  const { cookie, user, guestId } = await setup(), db = database();
  const guest = { user: null, guestId, owner: `g:${guestId}` }; await createRun({ game: "word", locale: "en", mode: "practice" }, guest);
  const second = NextResponse.json({}); createSession(request(), second, user);
  const response = await POST(request(cookie, { action: "delete", password, confirmUsername: user.username })); expect(response.status).toBe(200);
  for (const table of ["users", "sessions", "results", "snapshots", "community_votes", "friend_challenges", "account_recovery", "credential_versions", "number_rooms", "measurement_sessions", "measurement_events", "measurement_activity"]) expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()?.n).toBe(0);
  expect(db.prepare("SELECT owner FROM runs").all()).toEqual([expect.objectContaining({ owner: guest.owner })]);
  expect(account(request(`dailygrid-session=${second.cookies.get("dailygrid-session")!.value}`))).toBeNull(); expect(response.cookies.get("dailygrid-session")?.maxAge).toBe(0);
  expect(() => createSession(request(), NextResponse.json({}), user)).toThrow("credentialsInvalid");
  const journal = readFileSync(path.join(directory, "erased.jsonl"), "utf8"); expect(JSON.parse(journal)).toMatchObject({ userId: user.id }); expect(journal).not.toContain(password);
  expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
});
it("verifies restoration on a disposable copy and reapplies erasure without changing the original backup", async () => {
  const { cookie, user } = await setup(), backup = await backupSqlite(path.join(directory, "private.sqlite"), path.join(directory, "backups"));
  await POST(request(cookie, { action: "delete", password, confirmUsername: user.username }));
  expect(await verifyRestore(backup, path.join(directory, "erased.jsonl"))).toEqual({ integrity: "ok", erasuresReapplied: 1 });
  const copy = new DatabaseSync(backup, { readOnly: true }); try { expect(copy.prepare("SELECT COUNT(*) AS n FROM users").get()?.n).toBe(1); } finally { copy.close(); }
});
it("does not allow a deleted administrator's username to be reclaimed for dashboard access", async () => {
  const { cookie, user } = await setup(); vi.stubEnv("ANALYTICS_ADMIN_USERNAMES", user.username);
  expect((await POST(request(cookie, { action: "delete", password, confirmUsername: user.username }))).status).toBe(200);
  await expect(authenticate(request(), { username: user.username, password }, true)).rejects.toMatchObject({ code: "usernameTaken" });
});
it("supports existing string account IDs without changing their login identity", async () => {
  database().prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("legacy-account", "legacy_user", "Legacy", await hashPassword(password), new Date().toISOString());
  const user = await authenticate(request(), { username: "legacy_user", password }, false), response = NextResponse.json({}); createSession(request(), response, user);
  const cookie = `dailygrid-session=${response.cookies.get("dailygrid-session")!.value}`;
  expect((await POST(request(cookie, { action: "delete", password, confirmUsername: "legacy_user" }))).status).toBe(200);
  expect(database().prepare("SELECT * FROM users").all()).toEqual([]);
});
