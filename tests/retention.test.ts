import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { closeDatabase, database } from "../src/lib/server/database";
import {
  account,
  authenticate,
  createSession,
  hashPassword,
  identity,
  logout,
  verifyPassword,
  type Identity,
} from "../src/lib/server/auth";
import {
  createRun,
  beginRun,
  submitRun,
  ownedRun,
  getRun,
  requestHint,
  compareRun,
} from "../src/lib/server/play";
import {
  migrateProgress,
  saveResult,
  userResults,
  validImportedResult,
} from "../src/lib/server/results";
import { saveSnapshots, snapshots } from "../src/lib/server/sync";
import { ApiError, rateLimit, readBody } from "../src/lib/server/http";
import {
  comparisonStatistics,
  personalStatistics,
  achievements,
} from "../src/lib/statistics";
import { leaderboard } from "../src/lib/server/leaderboards";
import {
  issueRecoveryCode,
  hasRecoveryCode,
  recoverAccount,
  rotateRecoveryCode,
} from "../src/lib/server/recovery";
import { GET as accountProfile } from "../src/app/api/account/route";
import { finishedToday, streaks } from "../src/lib/stats";
import { generateChallenge, validateChallenge } from "../src/lib/challenges";
import { evaluateExpression } from "../src/lib/math";
import { solveSudoku } from "../src/lib/sudoku";
import type { Challenge, Completion } from "../src/lib/types";
import {
  snapshotBatches,
  migrateGuestProgress,
} from "../src/lib/migration-client";
const today = "2026-10-02",
  now = new Date(`${today}T12:00:00.000Z`);
const guest: Identity = {
  user: null,
  guestId: "a".repeat(43),
  owner: `g:${"a".repeat(43)}`,
};
const request = (
  cookie = "",
  body: unknown = {},
  origin = "http://127.0.0.1:3000",
) =>
  new NextRequest("http://127.0.0.1:3000/api/account", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      cookie,
      origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
function user(id = "player", displayName = "Player"): Identity {
  database()
    .prepare("INSERT OR IGNORE INTO users VALUES (?,?,?,?,?)")
    .run(id, id, displayName, "test-fixture", now.toISOString());
  return {
    user: { id, username: id, displayName },
    guestId: `${id}${"b".repeat(43)}`.slice(0, 43),
    owner: `u:${id}`,
  };
}
function record(overrides: Partial<Completion> = {}): Completion {
  return {
    challengeId: "word:2026-10-02:fr",
    game: "word",
    locale: "fr",
    date: today,
    mode: "daily",
    success: true,
    duration: 20,
    score: 750,
    attempts: 2,
    completedAt: now.toISOString(),
    startedAt: new Date(now.getTime() - 20000).toISOString(),
    provenance: "server",
    eligible: true,
    ...overrides,
  };
}
beforeEach(() => {
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  closeDatabase();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("accounts, sessions and local migration", () => {
  it("keeps one new Daily Sudoku, all Practice levels, and published archive levels", async () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    for (const difficulty of ["medium", "hard"] as const) {
      await expect(createRun({game: "sudoku", locale: "fr", mode: "daily", difficulty}, guest)).rejects.toThrow();
      const practice = await createRun({game: "sudoku", locale: "fr", mode: "practice", difficulty}, guest);
      expect(practice.challenge).toMatchObject({mode: "practice", difficulty});
    }
    const daily = await createRun({game: "sudoku", locale: "fr", mode: "daily"}, guest);
    expect(daily.challenge).toMatchObject({difficulty: "easy", id: "sudoku:2026-10-05:universal:easy"});
    const archived = await createRun({game: "sudoku", locale: "fr", mode: "archive", date: "2026-10-04", difficulty: "hard"}, guest);
    expect(archived.challenge).toMatchObject({difficulty: "hard", id: "sudoku:2026-10-04:universal:hard"});
    await expect(createRun({game: "sudoku", locale: "fr", mode: "archive", date: "2026-10-05", difficulty: "hard"}, guest)).rejects.toThrow();
  });
  it("stores only a hash of a strong recovery code and omits it from account profiles", async () => {
    const created = await authenticate(
      request(),
      { username: "recover_user", password: "original safe password" },
      true,
    );
    const code = issueRecoveryCode(created.id);
    expect(code).toMatch(/^DG(?:-[A-F0-9]{4}){10}$/);
    expect(hasRecoveryCode(created.id)).toBe(true);
    const row = database()
      .prepare("SELECT * FROM account_recovery WHERE user_id=?")
      .get(created.id) as { code_hash: string };
    expect(row.code_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(row)).not.toContain(code);
    const session = NextResponse.json({});
    createSession(request(), session, created);
    const token = session.cookies.get("dailygrid-session")!.value;
    const response = await accountProfile(
      new NextRequest("http://127.0.0.1:3000/api/account", {
        headers: { cookie: `dailygrid-session=${token}` },
      }),
    );
    const body = await response.json();
    expect(body.recoveryEnabled).toBe(true);
    expect(JSON.stringify(body)).not.toContain(code);
    expect(JSON.stringify(body)).not.toContain(row.code_hash);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(
      database()
        .prepare("SELECT version FROM schema_migrations WHERE version=2")
        .get(),
    ).toBeTruthy();
  });
  it("recovers without email, consumes the code, revokes all sessions and preserves history", async () => {
    const body = {
      username: "recover_user",
      password: "original safe password",
    };
    const created = await authenticate(request(), body, true);
    const who: Identity = { ...guest, user: created, owner: `u:${created.id}` };
    saveResult("preserved-history", who, record());
    const sessions = [NextResponse.json({}), NextResponse.json({})];
    sessions.forEach((response) => createSession(request(), response, created));
    const code = issueRecoveryCode(created.id);
    const reset = {
      username: "RECOVER_USER",
      recoveryCode: code.toLowerCase().replaceAll("-", " "),
      password: "new safe password",
      confirmPassword: "new safe password",
    };
    const recovered = await recoverAccount(request(), reset);
    expect(recovered.recoveryCode).not.toBe(code);
    expect(recovered.recovered).toBe(true);
    sessions.forEach((response) =>
      expect(
        account(
          request(
            `dailygrid-session=${response.cookies.get("dailygrid-session")!.value}`,
          ),
        ),
      ).toBeNull(),
    );
    expect(userResults(created.id)).toHaveLength(1);
    await expect(authenticate(request(), body, false)).rejects.toMatchObject({
      code: "credentialsInvalid",
    });
    await expect(
      authenticate(request(), { ...body, password: reset.password }, false),
    ).resolves.toMatchObject({ id: created.id });
    await expect(recoverAccount(request(), reset)).rejects.toMatchObject({
      code: "recoveryInvalid",
    });
    await expect(
      recoverAccount(request(), {
        ...reset,
        recoveryCode: recovered.recoveryCode,
      }),
    ).resolves.toMatchObject({ recovered: true });
  });
  it("requires the current password to replace a code and leaves accounts untouched on invalid recovery", async () => {
    const created = await authenticate(
      request(),
      { username: "rotate_user", password: "original safe password" },
      true,
    );
    const code = issueRecoveryCode(created.id);
    await expect(
      rotateRecoveryCode(request(), created, {
        password: "wrong safe password",
      }),
    ).rejects.toMatchObject({ code: "credentialsInvalid" });
    const next = await rotateRecoveryCode(request(), created, {
      password: "original safe password",
    });
    expect(next).not.toBe(code);
    const body = {
      username: "rotate_user",
      recoveryCode: code,
      password: "new safe password",
      confirmPassword: "new safe password",
    };
    await expect(recoverAccount(request(), body)).rejects.toMatchObject({
      code: "recoveryInvalid",
    });
    await expect(
      recoverAccount(request(), { ...body, username: "unknown_user" }),
    ).rejects.toMatchObject({ code: "recoveryInvalid" });
    await expect(
      recoverAccount(request(), {
        ...body,
        recoveryCode: next,
        confirmPassword: "does not match",
      }),
    ).rejects.toMatchObject({ code: "passwordMismatch" });
    await expect(
      authenticate(
        request(),
        { username: "rotate_user", password: "original safe password" },
        false,
      ),
    ).resolves.toMatchObject({ id: created.id });
  });
  it("allows only one concurrent consumption of a recovery code", async () => {
    const created = await authenticate(
      request(),
      { username: "race_recovery", password: "original safe password" },
      true,
    );
    const recoveryCode = issueRecoveryCode(created.id);
    const passwords = ["first new safe password", "second new safe password"];
    const results = await Promise.allSettled(
      passwords.map((password) =>
        recoverAccount(request(), {
          username: created.username,
          recoveryCode,
          password,
          confirmPassword: password,
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
    const winner = results.findIndex((r) => r.status === "fulfilled");
    await expect(
      authenticate(
        request(),
        { username: created.username, password: passwords[winner] },
        false,
      ),
    ).resolves.toMatchObject({ id: created.id });
    await expect(
      authenticate(
        request(),
        { username: created.username, password: passwords[1 - winner] },
        false,
      ),
    ).rejects.toMatchObject({ code: "credentialsInvalid" });
  });
  it("rate-limits recovery attempts without changing the password or consuming the saved code", async () => {
    const created = await authenticate(
      request(),
      { username: "limited_recovery", password: "original safe password" },
      true,
    );
    const code = issueRecoveryCode(created.id);
    const body = {
      username: created.username,
      recoveryCode: "invalid",
      password: "new safe password",
      confirmPassword: "new safe password",
    };
    for (let i = 0; i < 5; i++)
      await expect(recoverAccount(request(), body)).rejects.toMatchObject({
        code: "recoveryInvalid",
        status: 401,
      });
    await expect(
      recoverAccount(request(), { ...body, recoveryCode: code }),
    ).rejects.toMatchObject({ code: "rateLimited", status: 429 });
    await expect(
      authenticate(
        request(),
        { username: created.username, password: "original safe password" },
        false,
      ),
    ).resolves.toMatchObject({ id: created.id });
    vi.setSystemTime(new Date(now.getTime() + 15 * 60000));
    await expect(
      recoverAccount(request(), { ...body, recoveryCode: code }),
    ).resolves.toMatchObject({ recovered: true });
  });
  it("sends the entire old history across bounded batches without a total-history cutoff", async () => {
    const history = Array.from({ length: 2501 }, (_, i) =>
        record({ challengeId: `practice:old-${i}`, mode: "practice" }),
      ),
      sent: Completion[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        sent.push(...body.completions);
        expect(body.completions.length).toBeLessThanOrEqual(500);
        expect(
          new TextEncoder().encode(String(init.body)).byteLength,
        ).toBeLessThan(768000);
        return new Response(
          JSON.stringify({ migrated: body.completions.length }),
          { status: 200 },
        );
      }),
    );
    expect(
      await migrateGuestProgress({ completions: history, snapshots: [] }),
    ).toBe(2501);
    expect(sent).toEqual(history);
  });
  it("keeps long personal games migratable and rejects malformed optional SQL fields", () => {
    const who = user(),
      long = record({
        duration: 172800,
        mode: "practice",
        challengeId: "practice:long",
        startedAt: "2026-09-30T12:00:00Z",
        completedAt: "2026-10-02T12:00:00Z",
      });
    expect(validImportedResult(long)).toBe(true);
    expect(migrateProgress(who.user!, guest.guestId, [long])).toBe(1);
    expect(userResults(who.user!.id)[0]).toMatchObject({
      duration: 172800,
      eligible: false,
      provenance: "imported",
    });
    expect(
      validImportedResult({ ...record(), startedAt: { invalid: true } }),
    ).toBe(false);
    expect(validImportedResult({ ...record(), errors: "invalid" })).toBe(false);
    expect(
      validImportedResult({ ...record(), completedAt: "2099-01-01T00:00:00Z" }),
    ).toBe(false);
  });
  it("batches large migration snapshots using actual UTF-8 byte sizes", () => {
    const values = Array.from({ length: 7 }, (_, i) => ({
      key: `dailygrid:game:${i}`,
      value: "é".repeat(50000),
      updatedAt: Date.now(),
    }));
    const batches = snapshotBatches(values);
    expect(batches).toHaveLength(2);
    expect(batches.flat()).toEqual(values);
    for (const batch of batches)
      expect(
        batch.reduce(
          (sum, v) =>
            sum + new TextEncoder().encode(JSON.stringify(v)).byteLength,
          0,
        ),
      ).toBeLessThanOrEqual(512000);
  });
  it("prunes the oldest large drafts while preserving results and allowing new sync", () => {
    const who = user();
    saveResult("official", who, record());
    const values = Array.from({ length: 19 }, (_, i) => ({
      key: `dailygrid:game:quota-${i}`,
      value: "x".repeat(240000),
      updatedAt: Date.now() - 2000 + i * 50,
    }));
    expect(() => saveSnapshots(who.user!, values)).not.toThrow();
    const stored = snapshots(who.user!);
    expect(stored).toHaveLength(17);
    expect(stored.some((v) => v.key === "dailygrid:game:quota-18")).toBe(true);
    expect(stored.some((v) => v.key === "dailygrid:game:quota-0")).toBe(false);
    expect(userResults(who.user!.id)).toHaveLength(1);
  });
  it("hashes passwords with random salts and verifies only the original password", async () => {
    const a = await hashPassword("a very long password"),
      b = await hashPassword("a very long password");
    expect(a).not.toBe(b);
    expect(a).not.toContain("a very long password");
    expect(await verifyPassword("a very long password", a)).toBe(true);
    expect(await verifyPassword("different password", a)).toBe(false);
  });
  it("signs up, logs in, rotates opaque HttpOnly sessions, expires and revokes them", async () => {
    const body = {
      username: "test_user",
      displayName: "Public player",
      password: "a safe test password",
    };
    const created = await authenticate(request(), body, true);
    expect(created.displayName).toBe("Public player");
    const response = NextResponse.json({});
    createSession(request(), response, created);
    const token = response.cookies.get("dailygrid-session")!.value;
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(account(request(`dailygrid-session=${token}`))).toEqual(created);
    expect(
      (
        database().prepare("SELECT token_hash FROM sessions").get() as {
          token_hash: string;
        }
      ).token_hash,
    ).not.toBe(token);
    const signedIn = await authenticate(request(), body, false);
    expect(signedIn.id).toBe(created.id);
    await expect(
      authenticate(
        request(),
        { ...body, password: "wrong long password" },
        false,
      ),
    ).rejects.toMatchObject({ status: 401 });
    const next = NextResponse.json({});
    createSession(request(`dailygrid-session=${token}`), next, created);
    expect(account(request(`dailygrid-session=${token}`))).toBeNull();
    const nextToken = next.cookies.get("dailygrid-session")!.value;
    logout(request(`dailygrid-session=${nextToken}`), NextResponse.json({}));
    expect(account(request(`dailygrid-session=${nextToken}`))).toBeNull();
    createSession(request(), response, created);
    const expires = response.cookies.get("dailygrid-session")!.value;
    vi.setSystemTime(new Date(now.getTime() + 31 * 86400000));
    expect(account(request(`dailygrid-session=${expires}`))).toBeNull();
  });
  it("rejects duplicate usernames, malformed usernames, short passwords and markup public names", async () => {
    const body = {
      username: "hello_user",
      displayName: "Hello",
      password: "long test password",
    };
    await authenticate(request(), body, true);
    await expect(authenticate(request(), body, true)).rejects.toMatchObject({
      code: "usernameTaken",
    });
    for (const invalid of [
      { ...body, username: "a" },
      { ...body, username: "other", password: "short" },
      { ...body, username: "other", displayName: "<script>" },
    ])
      await expect(
        authenticate(request(), invalid, true),
      ).rejects.toBeInstanceOf(ApiError);
  });
  it("accepts a username/password-only signup and preserves display capitalization", async () => {
    const created = await authenticate(
      request(),
      { username: "SimpleUser", password: "long safe password" },
      true,
    );
    expect(created).toMatchObject({
      username: "simpleuser",
      displayName: "SimpleUser",
    });
    expect(
      (
        await authenticate(
          request(),
          { username: "SIMPLEUSER", password: "long safe password" },
          false,
        )
      ).id,
    ).toBe(created.id);
  });
  it("limits signups by trusted IP without limiting another household or ordinary logins", async () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const fromIp = (ip: string) => {
      const req = request();
      req.headers.set("x-forwarded-for", ip);
      return req;
    };
    for (let i = 0; i < 5; i++)
      await authenticate(
        fromIp("192.0.2.1"),
        { username: `household_${i}`, password: "long safe password" },
        true,
      );
    await expect(
      authenticate(
        fromIp("192.0.2.1"),
        { username: "overflow", password: "long safe password" },
        true,
      ),
    ).rejects.toMatchObject({ code: "rateLimited", status: 429 });
    await expect(
      authenticate(
        fromIp("192.0.2.1"),
        { username: "household_0", password: "long safe password" },
        false,
      ),
    ).resolves.toMatchObject({ username: "household_0" });
    await expect(
      authenticate(
        fromIp("192.0.2.2"),
        { username: "neighbor", password: "long safe password" },
        true,
      ),
    ).resolves.toMatchObject({ username: "neighbor" });
    vi.setSystemTime(new Date(now.getTime() + 3600000));
    await expect(
      authenticate(
        fromIp("192.0.2.1"),
        { username: "after_reset", password: "long safe password" },
        true,
      ),
    ).resolves.toMatchObject({ username: "after_reset" });
  });
  it("enforces a daily signup cap and a separate browser-device cap", async () => {
    vi.stubEnv("TRUST_PROXY", "true");
    const req = request();
    req.headers.set("x-forwarded-for", "192.0.2.3");
    for (let i = 0; i < 20; i++)
      rateLimit("signup-day:192.0.2.3", 20, 86400000);
    await expect(
      authenticate(
        req,
        { username: "day_overflow", password: "long safe password" },
        true,
      ),
    ).rejects.toMatchObject({ code: "rateLimited" });
    for (let i = 0; i < 3; i++)
      await authenticate(
        request(`dailygrid-guest=${guest.guestId}`),
        { username: `device_${i}`, password: "long safe password" },
        true,
      );
    await expect(
      authenticate(
        request(`dailygrid-guest=${guest.guestId}`),
        { username: "device_overflow", password: "long safe password" },
        true,
      ),
    ).rejects.toMatchObject({ code: "rateLimited" });
    vi.setSystemTime(new Date(now.getTime() + 86400000));
    await expect(
      authenticate(
        req,
        { username: "day_reset", password: "long safe password" },
        true,
      ),
    ).resolves.toMatchObject({ username: "day_reset" });
  });
  it("merges verified guest runs and old local records idempotently without promoting local records", async () => {
    const who = user(),
      server = record();
    saveResult("guest-result", guest, server, { comparisonEligible: true });
    const imported = record({
      challengeId: "math:2026-10-01:universal",
      game: "math",
      date: "2026-10-01",
      completedAt: "2026-10-01T12:00:00Z",
      startedAt: undefined,
      runId: undefined,
    });
    expect(migrateProgress(who.user!, guest.guestId, [imported, server])).toBe(
      2,
    );
    expect(migrateProgress(who.user!, guest.guestId, [imported, server])).toBe(
      0,
    );
    const results = userResults(who.user!.id);
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.game === "word")).toMatchObject({
      provenance: "server",
      eligible: true,
    });
    expect(results.find((r) => r.game === "math")).toMatchObject({
      provenance: "imported",
      eligible: false,
    });
    expect(
      leaderboard("math", "fr", "easy", "all", "performance"),
    ).toHaveLength(0);
    expect(
      leaderboard("word", "fr", "easy", "today", "performance")[0].displayName,
    ).toBe("Player");
  });
  it("keeps existing account results instead of replacing them with a better local result", () => {
    const who = user();
    saveResult("official", who, record({ score: 150, attempts: 6 }));
    migrateProgress(who.user!, guest.guestId, [
      record({ score: 1000, attempts: 1, duration: 0 }),
    ]);
    expect(userResults(who.user!.id)[0].score).toBe(150);
    expect(() =>
      migrateProgress(who.user!, guest.guestId, [
        { ...record(), duration: -1 },
      ]),
    ).toThrow(ApiError);
  });
  it("syncs only private UI drafts and never allows result-table writes through snapshots", () => {
    const who = user();
    const key = "dailygrid:game:word:2026-10-02:fr";
    saveSnapshots(who.user!, [
      { key, value: { input: "OUTIL" }, updatedAt: Date.now() },
    ]);
    saveSnapshots(who.user!, [
      { key, value: { input: "OLD" }, updatedAt: Date.now() - 1000 },
    ]);
    expect(snapshots(who.user!)[0].value).toEqual({ input: "OUTIL" });
    expect(userResults(who.user!.id)).toEqual([]);
    expect(() =>
      saveSnapshots(who.user!, [
        { key: "dailygrid:stats:v1", value: [record()], updatedAt: Date.now() },
      ]),
    ).toThrow(ApiError);
    expect(() =>
      saveSnapshots(who.user!, [
        { key, value: {}, updatedAt: Date.now() + 120000 },
      ]),
    ).toThrow(ApiError);
  });
});
describe("authoritative runs and all three Unlimited generators", () => {
  it.each(["word", "sudoku", "math"] as const)(
    "creates distinct valid %s practice challenges without a limit or answer leaks",
    async (game) => {
      const a = await createRun(
          { game, locale: "fr", mode: "practice", difficulty: "hard" },
          guest,
        ),
        b = await createRun(
          { game, locale: "fr", mode: "practice", difficulty: "hard" },
          guest,
        );
      expect(a.challenge.id).not.toBe(b.challenge.id);
      expect(a.challenge.mode).toBe("practice");
      expect(a.challenge).not.toHaveProperty("answer");
      expect(a.challenge).not.toHaveProperty("solution");
      expect(a.challenge).not.toHaveProperty("reference");
      const full = JSON.parse(
        ownedRun(a.runId, guest).challenge_json,
      ) as Challenge;
      validateChallenge(full);
      if (full.kind === "sudoku") expect(solveSudoku(full.grid).count).toBe(1);
      if (full.kind === "math")
        expect(
          evaluateExpression(full.reference, full.numbers, full.target)
            .distance,
        ).toBe(0);
    },
  );
  it("preserves dictionaries per language in practice", () => {
    for (const locale of ["en", "fr", "es", "de"] as const)
      validateChallenge(
        generateChallenge("word", locale, today, "easy", `practice-${locale}`),
      );
  });
  it("deduplicates official Daily runs and forbids other owners, invalid dates and unfinished starts", async () => {
    const a = await createRun({ game: "word", locale: "fr" }, guest),
      b = await createRun({ game: "word", locale: "fr" }, guest);
    expect(a.runId).toBe(b.runId);
    expect(() => getRun(a.runId, { ...guest, owner: "g:intruder" })).toThrow(
      ApiError,
    );
    expect(() =>
      submitRun(a.runId, guest, { guesses: ["OUTIL"] }),
    ).toThrowError("notStarted");
    await expect(
      createRun({ game: "word", locale: "fr", date: "2099-01-01" }, guest),
    ).rejects.toBeInstanceOf(ApiError);
    await expect(
      createRun(
        { game: "word", locale: "fr", date: "2026-10-01", mode: "daily" },
        guest,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
  it("uses server timestamps and engine scores; repeated completion cannot change a result", async () => {
    const who = user(),
      a = await createRun({ game: "word", locale: "fr" }, who);
    const full = JSON.parse(ownedRun(a.runId, who).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    beginRun(a.runId, who);
    vi.setSystemTime(new Date(now.getTime() + 10000));
    const body = {
      guesses: [full.answer],
      score: 999999,
      duration: 0,
      success: false,
      startedAt: "2000-01-01",
      userId: "somebody_else",
    };
    const result = submitRun(a.runId, who, body);
    expect(result.completion).toMatchObject({
      duration: 10,
      score: 600,
      success: true,
      attempts: 1,
      eligible: true,
    });
    vi.setSystemTime(new Date(now.getTime() + 20000));
    expect(submitRun(a.runId, who, { guesses: ["ZZZZZ"] })).toEqual(result);
    expect(userResults(who.user!.id)).toHaveLength(1);
    expect(userResults(who.user!.id)[0].duration).toBe(10);
  });
  it("keeps very fast and recovered games personal and out of leaderboards/comparisons", async () => {
    const who = user(),
      a = await createRun({ game: "word", locale: "fr" }, who);
    const full = JSON.parse(ownedRun(a.runId, who).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    beginRun(a.runId, who);
    const result = submitRun(a.runId, who, { guesses: [full.answer] });
    expect(result.completion.eligible).toBe(false);
    expect(leaderboard("word", "fr", "easy", "today", "performance")).toEqual(
      [],
    );
    expect(compareRun(a.runId, who)).toBeNull();
    const second = user("second"),
      b = await createRun({ game: "word", locale: "fr" }, second);
    beginRun(b.runId, second);
    vi.setSystemTime(new Date(now.getTime() + 20000));
    const wrong = full.answer === "OUTIL" ? "ADULE" : "OUTIL";
    const restored = submitRun(b.runId, second, {
      guesses: [wrong, full.answer],
    });
    expect(restored.completion.eligible).toBe(false);
  });
  it("validates guess sequence with idempotent retries, counts errors, and cannot remove old guesses", async () => {
    const a = await createRun({ game: "word", locale: "fr" }, guest);
    beginRun(a.runId, guest);
    const full = JSON.parse(ownedRun(a.runId, guest).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    const wrong = full.answer === "OUTIL" ? "ADULE" : "OUTIL";
    expect(() =>
      submitRun(a.runId, guest, { guesses: ["ZZZZZ"] }),
    ).toThrowError("invalidWord");
    const first = submitRun(a.runId, guest, { guesses: [wrong] });
    expect(first).not.toHaveProperty("answer");
    expect(submitRun(a.runId, guest, { guesses: [wrong] })).toEqual(first);
    expect(() =>
      submitRun(a.runId, guest, { guesses: [full.answer] }),
    ).toThrowError("invalid");
    vi.setSystemTime(new Date(now.getTime() + 20000));
    expect(
      submitRun(a.runId, guest, { guesses: [wrong, full.answer] }).completion
        .errors,
    ).toBe(1);
  });
  it("validates Sudoku givens and math inventory; failures cannot create results", async () => {
    for (const game of ["sudoku", "math"] as const) {
      const a = await createRun({ game, locale: "fr" }, guest);
      beginRun(a.runId, guest);
      expect(() =>
        submitRun(
          a.runId,
          guest,
          game === "sudoku"
            ? { grid: Array(81).fill(1) }
            : { expression: "99999 * 99999" },
        ),
      ).toThrow(ApiError);
    }
    expect(
      (
        database().prepare("SELECT count(*) AS n FROM results").get() as {
          n: number;
        }
      ).n,
    ).toBe(0);
  });
  it("gives one practice hint, excludes assisted comparisons, and never hints an official Daily game", async () => {
    const a = await createRun(
      { game: "word", locale: "fr", mode: "practice" },
      guest,
    );
    beginRun(a.runId, guest);
    expect(requestHint(a.runId, guest)).toMatchObject({
      kind: "word",
      index: 0,
    });
    expect(() => requestHint(a.runId, guest)).toThrowError("hintUnavailable");
    const full = JSON.parse(ownedRun(a.runId, guest).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    vi.setSystemTime(new Date(now.getTime() + 20000));
    const result = submitRun(a.runId, guest, { guesses: [full.answer] });
    expect(result.completion.mode).toBe("practice");
    expect(compareRun(a.runId, guest)).toBeNull();
    expect(streaks([result.completion])).toEqual({ current: 0, best: 0 });
    const daily = await createRun({ game: "word", locale: "en" }, guest);
    beginRun(daily.runId, guest);
    expect(() => requestHint(daily.runId, guest)).toThrowError(
      "hintUnavailable",
    );
  });
});
describe("statistics, comparisons and competition", () => {
  it("isolates Daily days from unlimited and archive results, and calculates win-only averages", () => {
    const records = [
      record({ duration: 20, attempts: 2 }),
      record({
        challengeId: "practice:1",
        mode: "practice",
        duration: 10,
        attempts: 1,
      }),
      record({
        challengeId: "practice:2",
        mode: "practice",
        duration: 30,
        attempts: 3,
      }),
      record({
        challengeId: "practice:3",
        mode: "practice",
        success: false,
        duration: 100,
        attempts: 6,
      }),
    ];
    expect(streaks(records, today).current).toBe(1);
    expect(streaks(records.slice(1), today).current).toBe(0);
    expect(finishedToday(records.slice(1), today)).toEqual([]);
    expect(personalStatistics(records, "word", "practice")).toMatchObject({
      played: 3,
      won: 2,
      averageTime: 20,
      bestTime: 10,
      averageAttempts: 2,
      currentStreak: 0,
      bestStreak: 2,
    });
    expect(personalStatistics([], "math", "daily").averageTime).toBeNull();
    expect(achievements(records).firstWin).toBe(true);
  });
  it("hides insufficient samples, excludes self, handles ties and losses correctly", () => {
    const current = record({ runId: "self", duration: 20 });
    const samples = Array.from({ length: 50 }, (_, i) =>
      record({
        runId: `sample-${i}`,
        duration: i < 10 ? 10 : i < 25 ? 20 : 30,
        attempts: i < 25 ? 2 : 3,
      }),
    );
    expect(comparisonStatistics(samples.slice(0, 19), current)).toBeNull();
    expect(comparisonStatistics([...samples, current], current)).toMatchObject({
      samples: 50,
      fasterThanPercent: 50,
      averageTime: 23,
      commonAttempts: [2, 3],
      successRate: 100,
      fewerAttemptsThanAverage: 0.5,
    });
    expect(
      comparisonStatistics(
        samples.map((r, i) => ({ ...r, success: i === 0 })),
        current,
      ),
    ).toMatchObject({
      successRate: 2,
      fasterThanPercent: null,
      averageTime: null,
      commonAttempts: [],
      fewerAttemptsThanAverage: null,
    });
  });
  it("compares real server records only within the exact Daily puzzle cohort", async () => {
    const who = user(),
      a = await createRun({ game: "word", locale: "fr" }, who);
    beginRun(a.runId, who);
    const full = JSON.parse(ownedRun(a.runId, who).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    vi.setSystemTime(new Date(now.getTime() + 20000));
    submitRun(a.runId, who, { guesses: [full.answer] });
    for (let i = 0; i < 50; i++)
      saveResult(
        `sample${i}`,
        { ...guest, owner: `g:sample${i}` },
        record({ duration: 30 }),
        { comparisonEligible: true },
      );
    saveResult(
      "wrong-locale",
      { ...guest, owner: "g:wrong" },
      record({ locale: "en", challengeId: "word:2026-10-02:en" }),
      { comparisonEligible: true },
    );
    expect(compareRun(a.runId, who)).toMatchObject({
      samples: 50,
      fasterThanPercent: 100,
    });
  });
  it("counts distinct practice owners rather than repeated games toward the 20-player threshold", async () => {
    const who = user(),
      a = await createRun(
        { game: "word", locale: "fr", mode: "practice" },
        who,
      );
    beginRun(a.runId, who);
    const full = JSON.parse(ownedRun(a.runId, who).challenge_json) as Extract<
      Challenge,
      { kind: "word" }
    >;
    vi.setSystemTime(new Date(now.getTime() + 20000));
    submitRun(a.runId, who, { guesses: [full.answer] });
    for (let i = 0; i < 19; i++)
      for (let n = 0; n < 2; n++)
        saveResult(
          `p-${i}-${n}`,
          { ...guest, owner: `g:peer-${i}` },
          record({
            mode: "practice",
            challengeId: `practice:peer-${i}-${n}`,
            duration: 30,
          }),
          { comparisonEligible: true },
        );
    expect(compareRun(a.runId, who)).toBeNull();
    saveResult(
      "fiftieth",
      { ...guest, owner: "g:fiftieth" },
      record({
        mode: "practice",
        challengeId: "practice:fiftieth",
        duration: 30,
      }),
      { comparisonEligible: true },
    );
    expect(compareRun(a.runId, who)).toMatchObject({
      samples: 20,
      fasterThanPercent: 100,
      fewerAttemptsThanAverage: 1,
    });
  });
  it("requires registered, verified, eligible Daily results and filters locale, period and difficulty", () => {
    const who = user("first", "Visible name");
    saveResult("good", who, record());
    saveResult("guest", guest, record());
    saveResult(
      "imported",
      user("import"),
      record({ provenance: "imported", eligible: true }),
    );
    saveResult(
      "practice",
      user("practice"),
      record({ mode: "practice", eligible: true }),
    );
    saveResult("fast", user("fast"), record({ eligible: false }));
    saveResult("otherlang", user("lang"), record({ locale: "en" }));
    saveResult(
      "yesterday",
      user("older"),
      record({ date: "2026-10-01", completedAt: "2026-10-01T12:00:00Z" }),
    );
    expect(leaderboard("word", "fr", "easy", "today", "performance")).toEqual([
      { displayName: "Visible name", played: 1, value: 500, rank: 1 },
    ]);
    expect(
      leaderboard("word", "fr", "easy", "week", "performance"),
    ).toHaveLength(2);
    expect(leaderboard("word", "fr", "easy", "all", "winRate")).toEqual([]);
    saveResult(
      "hard",
      who,
      record({
        game: "sudoku",
        challengeId: "sudoku:2026-10-02:universal:hard",
        difficulty: "hard",
        attempts: undefined,
      }),
    );
    expect(leaderboard("sudoku", "en", "easy", "today", "speed")).toEqual([]);
    expect(leaderboard("sudoku", "de", "hard", "today", "speed")).toHaveLength(
      1,
    );
  });
  it("uses averages instead of cumulative account age and enforces minimum games for win rates", () => {
    const older = user("older", "Older"),
      newer = user("newer", "Newer");
    for (let i = 0; i < 10; i++)
      saveResult(
        `older${i}`,
        older,
        record({
          challengeId: `word:2026-09-${String(21 + i).padStart(2, "0")}:fr`,
          date: `2026-09-${String(21 + i).padStart(2, "0")}`,
          completedAt: `2026-09-${String(21 + i).padStart(2, "0")}T12:00:00Z`,
          attempts: 5,
          duration: 100,
        }),
      );
    saveResult("newer", newer, record({ attempts: 1, duration: 10 }));
    expect(
      leaderboard("word", "fr", "easy", "all", "performance")[0].displayName,
    ).toBe("Newer");
    expect(
      leaderboard("word", "fr", "easy", "all", "speed")[0].displayName,
    ).toBe("Newer");
    expect(leaderboard("word", "fr", "easy", "month", "winRate")).toEqual([
      { displayName: "Older", played: 10, value: 100, rank: 1 },
    ]);
  });
  it("enforces request rate windows and same-origin JSON writes", async () => {
    rateLimit("test", 2, 1000);
    rateLimit("test", 2, 1000);
    expect(() => rateLimit("test", 2, 1000)).toThrowError("rateLimited");
    vi.setSystemTime(new Date(now.getTime() + 1001));
    expect(() => rateLimit("test", 2, 1000)).not.toThrow();
    await expect(
      readBody(request("", {}, "https://evil.example")),
    ).rejects.toMatchObject({ status: 403 });
    expect(await readBody(request("", { action: "test" }))).toEqual({
      action: "test",
    });
    await expect(
      readBody(request("", { huge: "x".repeat(10000) }), 100),
    ).rejects.toMatchObject({ status: 413 });
    expect(identity(request()).user).toBeNull();
  });
});
