import { randomUUID } from "node:crypto";
import { database, transaction } from "./database";
import type { Completion } from "../types";
import { isDifficulty, isGameId, isLocale } from "../types";
import { publishedDate, utcDay, validDate } from "../date";
import { modeOf } from "../statistics";
import { ApiError } from "./http";
import type { Account, Identity } from "./auth";
import { readResultDetails } from "../result-details";

export type ResultRow = {
  id: string;
  user_id: string | null;
  owner: string;
  game: Completion["game"];
  mode: NonNullable<Completion["mode"]>;
  challenge_id: string;
  date: string;
  locale: Completion["locale"];
  difficulty: Completion["difficulty"] | null;
  started_at: string | null;
  completed_at: string;
  duration: number;
  success: number;
  score: number;
  attempts: number | null;
  errors: number;
  provenance: NonNullable<Completion["provenance"]>;
  eligible: number;
  metadata_json: string;
};
export function completionFromRow(row: ResultRow): Completion {
  const metadata = JSON.parse(row.metadata_json);
  return {
    ...(typeof metadata.roomId === "string" ? { roomId: metadata.roomId } : {}),
    ...readResultDetails(row.game, metadata.details),
    ...(["higher-lower", "legacy", "mixed"].includes(metadata.numberRules)
      ? { numberRules: metadata.numberRules as Completion["numberRules"] }
      : {}),
    ...(metadata.outcome
      ? { outcome: metadata.outcome as Completion["outcome"] }
      : {}),
    ...(Number.isInteger(metadata.wordLength) && metadata.wordLength >= 5 && metadata.wordLength <= 10 && [6,8,10].includes(metadata.maxAttempts) ? {wordLength: metadata.wordLength, maxAttempts: metadata.maxAttempts} : {}),
    challengeId: row.challenge_id,
    game: row.game,
    mode: row.mode,
    date: row.date,
    locale: row.locale,
    difficulty: row.difficulty ?? undefined,
    startedAt: row.started_at ?? undefined,
    completedAt: row.completed_at,
    duration: row.duration,
    success: !!row.success,
    score: row.score,
    attempts: row.attempts ?? undefined,
    errors: row.errors,
    provenance: row.provenance,
    eligible: !!row.eligible,
    ...(row.provenance === "server" ? { runId: row.id } : {}),
    ...(typeof metadata.friendId === "string"
      ? { friendId: metadata.friendId }
      : {}),
    ...(typeof metadata.relatedContentId === "string"
      ? { relatedContentId: metadata.relatedContentId }
      : {}),
    ...(typeof metadata.learnMoreUrl === "string"
      ? { learnMoreUrl: metadata.learnMoreUrl }
      : {}),
  };
}
export function saveResult(
  id: string,
  identity: Identity,
  result: Completion,
  metadata: Record<string, unknown> = {},
) {
  database()
    .prepare(
      `INSERT OR IGNORE INTO results
    (id,user_id,owner,game,mode,challenge_id,date,locale,difficulty,started_at,completed_at,duration,success,score,attempts,errors,provenance,eligible,metadata_json)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      id,
      identity.user?.id ?? null,
      identity.owner,
      result.game,
      modeOf(result),
      result.challengeId,
      result.date,
      result.locale,
      result.difficulty ?? null,
      result.startedAt ?? null,
      result.completedAt,
      result.duration,
      Number(result.success),
      result.score,
      result.attempts ?? null,
      result.errors ?? 0,
      result.provenance ?? "server",
      Number(result.eligible ?? false),
      JSON.stringify(metadata),
    );
}
export function userResults(userId: string): Completion[] {
  return (
    database()
      .prepare("SELECT * FROM results WHERE user_id=? ORDER BY completed_at")
      .all(userId) as ResultRow[]
  ).map(completionFromRow);
}
export function validImportedResult(v: unknown): v is Completion {
  if (!v || typeof v !== "object") return false;
  const c = v as Completion;
  return (
    typeof c.challengeId === "string" &&
    c.challengeId.length <= 200 &&
    isGameId(c.game) &&
    isLocale(c.locale) &&
    typeof c.date === "string" &&
    validDate(c.date) &&
    publishedDate(c.date) &&
    typeof c.success === "boolean" &&
    Number.isSafeInteger(c.duration) &&
    c.duration >= 0 &&
    c.duration <= 315360000 &&
    Number.isFinite(c.score) &&
    c.score >= 0 &&
    c.score <= (c.game === "2048" ? 10000000 : 1000) &&
    (c.game !== "rareword" || (Number.isInteger(c.wordLength) && (c.wordLength ?? 0) >= 7 && (c.wordLength ?? 0) <= 10 && c.maxAttempts === ((c.wordLength ?? 0) <= 8 ? 8 : 10))) &&
    (c.attempts === undefined ||
      (Number.isInteger(c.attempts) &&
        c.attempts >= (c.game === "guess" ? 0 : 1) &&
        c.attempts <= (c.game === "guess" ? 30 : c.game === "rareword" ? (c.maxAttempts ?? 10) : 6))) &&
    (c.mode === undefined ||
      ["daily", "practice", "archive"].includes(c.mode)) &&
    (c.difficulty === undefined || isDifficulty(c.difficulty)) &&
    (c.errors === undefined ||
      (Number.isSafeInteger(c.errors) &&
        c.errors >= 0 &&
        c.errors <= 2147483647)) &&
    (c.startedAt === undefined ||
      (typeof c.startedAt === "string" &&
        Number.isFinite(Date.parse(c.startedAt)) &&
        Date.parse(c.startedAt) <= Date.parse(c.completedAt))) &&
    typeof c.completedAt === "string" &&
    Number.isFinite(Date.parse(c.completedAt)) &&
    Date.parse(c.completedAt) <= Date.now() &&
    utcDay(new Date(c.completedAt)) >= c.date
  );
}
export function migrateProgress(
  user: Account,
  guestId: string,
  input: unknown,
) {
  if (
    !Array.isArray(input) ||
    input.length > 2000 ||
    !input.every(validImportedResult)
  )
    throw new ApiError("invalid");
  return transaction(() => {
    const db = database(),
      owner = `u:${user.id}`,
      guestOwner = `g:${guestId}`;
    db.prepare(
      `INSERT OR IGNORE INTO community_votes(owner,kind,cohort,payload_json,run_id,created_at) SELECT ?,kind,cohort,payload_json,run_id,created_at FROM community_votes WHERE owner=?`,
    ).run(owner, guestOwner);
    db.prepare("DELETE FROM community_votes WHERE owner=?").run(guestOwner);
    for (const table of ["number_rooms", "live_rooms"]) {
    const rooms = db
      .prepare(
        `SELECT code,state_json FROM ${table} WHERE expires_at>? AND (json_extract(state_json,'$.players[0].owner')=? OR json_extract(state_json,'$.players[1].owner')=?)`,
      )
      .all(Date.now(), guestOwner, guestOwner) as {
      code: string;
      state_json: string;
    }[];
    for (const row of rooms) {
      const state = JSON.parse(row.state_json);
      let changed = false;
      for (const p of state.players)
        if (
          p.owner === guestOwner &&
          !state.players.some(
            (other: { owner: string }) => other !== p && other.owner === owner,
          )
        ) {
          p.owner = owner;
          p.userId = user.id;
          changed = true;
        }
      if (changed)
        db.prepare(`UPDATE ${table} SET state_json=? WHERE code=?`).run(
          JSON.stringify(state),
          row.code,
        );
    }
    }
    const before = Number(
      (
        db
          .prepare("SELECT count(*) AS n FROM results WHERE user_id=?")
          .get(user.id) as { n: number }
      ).n,
    );
    const guestResults = db
      .prepare("SELECT * FROM results WHERE owner=?")
      .all(guestOwner) as ResultRow[];
    for (const row of guestResults) {
      const duplicate = db
        .prepare("SELECT id FROM results WHERE owner=? AND challenge_id=?")
        .get(owner, row.challenge_id);
      if (!duplicate)
        db.prepare("UPDATE results SET owner=?,user_id=? WHERE id=?").run(
          owner,
          user.id,
          row.id,
        );
    }
    // Claimed runs stay usable on another device. A duplicate Daily run never replaces the account's result.
    const runs = db
      .prepare("SELECT id,challenge_id FROM runs WHERE owner=?")
      .all(guestOwner) as { id: string; challenge_id: string }[];
    for (const run of runs) {
      const duplicate = db
        .prepare("SELECT id FROM runs WHERE owner=? AND challenge_id=?")
        .get(owner, run.challenge_id);
      db.prepare("UPDATE runs SET user_id=?,owner=? WHERE id=?").run(
        user.id,
        duplicate ? guestOwner : owner,
        run.id,
      );
    }
    const target: Identity = { user, guestId, owner };
    for (const c of input)
      saveResult(`import:${randomUUID()}`, target, {
        ...c,
        mode: modeOf(c),
        provenance: "imported",
        eligible: false,
      }, c.game === "rareword" ? {wordLength:c.wordLength, maxAttempts:c.maxAttempts} : {});
    const after = Number(
      (
        db
          .prepare("SELECT count(*) AS n FROM results WHERE user_id=?")
          .get(user.id) as { n: number }
      ).n,
    );
    return after - before;
  });
}
