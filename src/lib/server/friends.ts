import { randomUUID } from "node:crypto";
import { database, transaction } from "./database";
import { ApiError, randomToken, rateLimit } from "./http";
import { getRun, ownedRun, type Run } from "./play";
import { publicChallenge } from "../challenges";
import type { Challenge, Completion } from "../types";
import type { Identity } from "./auth";
import type { FriendScore, FriendView } from "../friend-types";
type Invitation = {
  id: string;
  host_run_id: string;
  created_at: string;
  expires_at: number;
};
function invitation(id: unknown) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(id))
    throw new ApiError("unavailable", 404);
  const row = database()
    .prepare("SELECT * FROM friend_challenges WHERE id=?")
    .get(id) as Invitation | undefined;
  if (!row) throw new ApiError("unavailable", 404);
  if (row.expires_at <= Date.now()) throw new ApiError("expired", 410);
  return row;
}
function hostRun(row: Invitation) {
  const run = database()
    .prepare("SELECT * FROM runs WHERE id=?")
    .get(row.host_run_id) as Run;
  if (!run?.response_json) throw new ApiError("unavailable", 404);
  return run;
}
function cloneChallenge(id: string, run: Run): Challenge {
  const original = JSON.parse(run.challenge_json) as Challenge;
  return {
    ...original,
    id: `friend:${original.kind}:${id}`,
    mode: "practice",
    friendId: id,
  };
}
function score(run: Run): FriendScore | null {
  if (!run.response_json) return null;
  const completion = JSON.parse(run.response_json).completion as
    | Completion
    | undefined;
  if (!completion) return null;
  return {
    success: completion.success,
    score: completion.score,
    duration: completion.duration,
    ...(completion.attempts !== undefined
      ? { attempts: completion.attempts }
      : {}),
  };
}
export function createFriend(runId: unknown, who: Identity) {
  rateLimit(`friend-create:${who.owner}`, 30, 3600000);
  const run = ownedRun(runId, who);
  if (!run.response_json) throw new ApiError("notFinished", 409);
  return transaction(() => {
    const previous = database()
      .prepare("SELECT * FROM friend_challenges WHERE host_run_id=?")
      .get(run.id) as Invitation | undefined;
    if (previous && previous.expires_at > Date.now())
      return { id: previous.id };
    if (previous)
      database()
        .prepare("DELETE FROM friend_challenges WHERE id=?")
        .run(previous.id);
    const id = randomToken();
    database()
      .prepare("INSERT INTO friend_challenges VALUES (?,?,?,?)")
      .run(id, run.id, new Date().toISOString(), Date.now() + 30 * 86400000);
    return { id };
  });
}
export function viewFriend(id: unknown, who?: Identity): FriendView {
  const row = invitation(id),
    host = hostRun(row),
    challenge = cloneChallenge(row.id, host);
  const isHost =
    !!who &&
    (who.user ? host.user_id === who.user.id : host.owner === who.owner);
  const mine = who
    ? (database()
        .prepare(
          "SELECT * FROM runs WHERE challenge_id=? AND (owner=? OR (user_id IS NOT NULL AND user_id=?)) ORDER BY created_at LIMIT 1",
        )
        .get(challenge.id, who.owner, who.user?.id ?? null) as Run | undefined)
    : undefined;
  const peers = isHost
    ? (
        database()
          .prepare(
            "SELECT * FROM runs WHERE challenge_id=? AND response_json IS NOT NULL ORDER BY created_at LIMIT 20",
          )
          .all(challenge.id) as Run[]
      ).flatMap((run) => {
        const result = score(run);
        return result ? [result] : [];
      })
    : [];
  return {
    id: row.id,
    challenge: publicChallenge(challenge),
    host: score(host)!,
    you: isHost ? score(host) : mine ? score(mine) : null,
    isHost,
    expiresAt: row.expires_at,
    peers,
  };
}
export function sharedResult(id: unknown) {
  const row = invitation(id),
    host = hostRun(row);
  const result = JSON.parse(host.response_json!),
    challenge = JSON.parse(host.challenge_json) as Challenge;
  return {
    view: viewFriend(id),
    rows: (result.rows ?? []) as string[][],
    completion: result.completion as Completion,
    challenge: publicChallenge(challenge),
  };
}
export function joinFriend(id: unknown, who: Identity) {
  rateLimit(`friend-join:${who.owner}`, 60, 60000);
  const row = invitation(id),
    host = hostRun(row);
  if (who.user ? host.user_id === who.user.id : host.owner === who.owner)
    return getRun(host.id, who);
  const challenge = cloneChallenge(row.id, host);
  database()
    .prepare(
      `INSERT OR IGNORE INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      randomUUID(),
      who.owner,
      who.user?.id ?? null,
      who.guestId,
      challenge.id,
      challenge.kind,
      "practice",
      JSON.stringify(challenge),
      new Date().toISOString(),
    );
  const run = database()
    .prepare(
      "SELECT * FROM runs WHERE challenge_id=? AND (owner=? OR (user_id IS NOT NULL AND user_id=?)) ORDER BY created_at LIMIT 1",
    )
    .get(challenge.id, who.owner, who.user?.id ?? null) as Run;
  return getRun(run.id, who);
}
