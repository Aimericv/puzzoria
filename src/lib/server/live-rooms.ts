import { randomUUID } from "node:crypto";
import {
  generateChallenge,
  publicChallenge,
  validateChallenge,
} from "../challenges";
import { utcDay } from "../date";
import {
  isDifficulty,
  isLocale,
  type Challenge,
  type Completion,
} from "../types";
import {
  liveGames,
  opinionGame,
  type LiveGame,
  type LiveView,
} from "../live-types";
import { validSocialCategory } from "../social-categories";
import { validNumber } from "../number-duel";
import { normalizeWord } from "../word-normalization";
import { database, transaction } from "./database";
import type { Identity } from "./auth";
import { ApiError, randomToken, rateLimit } from "./http";
import { getRun, submitRun, type Run } from "./play";
import { saveResult } from "./results";

type Player = {
  owner: string;
  userId: string | null;
  guestId: string;
  name: string;
  ready: boolean;
  seen: number;
  rematch: boolean;
  runId: string | null;
  secret: number | null;
  guesses: { value: number; direction: "higher" | "lower" | "found" }[];
  finishedAt: number | null;
  forfeit: boolean;
  completion?: Completion;
  draft?: number[];
};
type Room = {
  game: LiveGame;
  locale: LiveView["locale"];
  difficulty: LiveView["difficulty"];
  category: string;
  round: number;
  players: Player[];
  challenge: Challenge | null;
  startAt: number | null;
  endAt: number | null;
  resolvedAt: number | null;
  done: boolean;
  winner: number | null;
  reason: LiveView["reason"];
};
const identityOf = (p: Player): Identity => ({
  owner: p.owner,
  guestId: p.guestId,
  user: p.userId ? { id: p.userId, username: "", displayName: p.name } : null,
});
const player = (who: Identity, name: unknown): Player => ({
  owner: who.owner,
  userId: who.user?.id ?? null,
  guestId: who.guestId,
  name:
    who.user?.displayName ??
    (typeof name === "string" && /^[\p{L}\p{N} _.-]{1,24}$/u.test(name.trim())
      ? name.trim()
      : "Player"),
  ready: false,
  seen: Date.now(),
  rematch: false,
  runId: null,
  secret: null,
  guesses: [],
  finishedAt: null,
  forfeit: false,
});
function load(code: unknown) {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code))
    throw new ApiError("unavailable", 404);
  const row = database()
    .prepare("SELECT state_json,expires_at FROM live_rooms WHERE code=?")
    .get(code) as { state_json: string; expires_at: number } | undefined;
  if (!row || row.expires_at <= Date.now()) throw new ApiError("expired", 410);
  return { code, room: JSON.parse(row.state_json) as Room };
}
const write = (code: string, room: Room) =>
  database()
    .prepare("UPDATE live_rooms SET state_json=? WHERE code=?")
    .run(JSON.stringify(room), code);
const seat = (room: Room, who: Identity) =>
  room.players.findIndex((p) => p.owner === who.owner);
function run(p: Player) {
  return p.runId
    ? (database().prepare("SELECT * FROM runs WHERE id=?").get(p.runId) as
        | Run
        | undefined)
    : undefined;
}
function progress(p: Player, room: Room) {
  const r = run(p),
    data = r ? JSON.parse(r.progress_json) : {},
    s = data.state;
  if (room.game === "word") return [data.guesses?.length ?? 0, 6];
  if (room.game === "sudoku")
    return [
      p.completion
        ? 81
        : (
            p.draft ??
            (room.challenge?.kind === "sudoku" ? room.challenge.grid : [])
          ).filter(Boolean).length,
      81,
    ];
  if (room.game === "wordsearch")
    return [
      s?.found?.length ?? 0,
      room.challenge?.kind === "wordsearch" ? room.challenge.words.length : 0,
    ];
  if (room.game === "mines")
    return [
      s?.grid?.filter((n: number) => n >= 0).length ?? 0,
      room.challenge?.kind === "mines"
        ? room.challenge.size ** 2 - room.challenge.mineCount
        : 0,
    ];
  if (room.game === "rather")
    return [
      s?.votes?.length ?? 0,
      room.challenge?.kind === "rather" ? room.challenge.questions.length : 0,
    ];
  if (room.game === "ranking")
    return [s?.ranking?.filter(Boolean).length ?? 0, 5];
  if (room.game === "guess") return [p.guesses.length, 30];
  return [p.completion ? 1 : 0, 1];
}
function settle(room: Room, now: number) {
  if (room.done || room.startAt === null || now < room.startAt) return;
  for (const p of room.players) {
    const r = run(p);
    if (r?.response_json && !p.completion) {
      p.completion = JSON.parse(r.response_json).completion;
      p.finishedAt = Date.parse(p.completion!.completedAt);
    }
    if (!p.finishedAt && !p.forfeit && now - p.seen > 60000) p.forfeit = true;
  }
  const timeout = now >= room.endAt!;
  if (timeout && room.game === "2048")
    for (const p of room.players) {
      const r = run(p),
        data = r ? JSON.parse(r.progress_json) : null;
      if (r && !p.completion && data?.actions?.length) {
        const result = submitRun(
          r.id,
          identityOf(p),
          { bank: true, sequence: data.actions.length },
          room.endAt!,
        );
        p.completion = result.completion;
        p.finishedAt = room.endAt;
      }
    }
  const first = room.players.findIndex(
    (p) => p.completion?.success && !p.forfeit,
  );
  const race = ["sudoku", "wordsearch", "mines"].includes(room.game);
  const forfeits = room.players.some((p) => p.forfeit);
  if (
    !(
      timeout ||
      forfeits ||
      room.players.every((p) => p.finishedAt !== null) ||
      (race && first !== -1)
    )
  )
    return;
  room.done = true;
  room.resolvedAt = timeout ? room.endAt : now;
  room.reason = forfeits ? "forfeit" : timeout ? "timeout" : "completed";
  if (opinionGame(room.game)) return;
  const value = (p: Player): number[] => {
    if (p.forfeit) return [-2];
    if (room.game === "2048") return [p.completion?.score ?? 0];
    if (!p.completion?.success && room.game !== "math") return [-1];
    if (room.game === "math")
      return p.completion
        ? [
            1,
            -(p.completion.mathDistance ?? Infinity),
            -(p.finishedAt! - room.startAt!),
          ]
        : [-1];
    return [
      1,
      ...(["word", "guess"].includes(room.game)
        ? [-(p.completion?.attempts ?? Infinity)]
        : []),
      -(p.finishedAt! - room.startAt!),
    ];
  };
  const a = value(room.players[0]),
    b = value(room.players[1]);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    room.winner = (a[i] ?? 0) > (b[i] ?? 0) ? 0 : 1;
    break;
  }
}
function view(code: string, room: Room, who: Identity): LiveView {
  const now = Date.now(),
    index = seat(room, who),
    me = room.players[index];
  const revealed = index !== -1 && room.startAt !== null && now >= room.startAt;
  const result: LiveView = {
    code,
    game: room.game,
    locale: room.locale,
    difficulty: room.difficulty,
    category: room.category,
    round: room.round,
    you: index,
    phase: room.done
      ? "finished"
      : room.startAt === null
        ? "lobby"
        : now < room.startAt
          ? "countdown"
          : "playing",
    serverNow: now,
    startAt: room.startAt,
    endAt: room.endAt,
    resolvedAt: room.resolvedAt,
    winner: room.winner,
    reason: room.reason,
    players: room.players.map((p) => {
      const r = run(p),
        s = r ? JSON.parse(r.progress_json).state : null,
        [n, total] = progress(p, room);
      return {
        name: p.name,
        ready: p.ready,
        online: now - p.seen < 15000,
        finished: !!p.finishedAt,
        forfeit: p.forfeit,
        progress: revealed ? n : 0,
        total: revealed ? total : 0,
        score: revealed ? (p.completion?.score ?? s?.score ?? 0) : 0,
        distance: p.completion?.mathDistance ?? null,
        attempts:
          room.game === "guess"
            ? p.guesses.length
            : (p.completion?.attempts ?? 0),
        duration:
          p.finishedAt && room.startAt !== null
            ? Math.max(0, Math.floor((p.finishedAt - room.startAt) / 1000))
            : null,
        rematch: p.rematch,
        secretReady: p.secret !== null,
      };
    }),
  };
  if (revealed && room.challenge && me) {
    result.challenge = publicChallenge(room.challenge);
    result.runId = me.runId!;
    result.completion = me.completion;
    if (room.done && room.challenge.kind === "word")
      result.wordAnswer = normalizeWord(room.challenge.answer);
    if (room.done && room.challenge.kind === "ranking")
      result.rankingItems = room.challenge.items;
    if (room.game === "guess") {
      result.ownSecret = me.secret;
      result.guesses = me.guesses;
      if (room.done) result.opponentSecret = room.players[1 - index].secret;
    }
    if (room.done && opinionGame(room.game))
      result.choices = room.players.map((p) => {
        const r = run(p),
          s = r ? JSON.parse(r.progress_json).state : null;
        return { ranking: s?.ranking ?? [], votes: s?.votes ?? [] };
      });
  } else if (me && room.game === "guess") result.ownSecret = me.secret;
  return result;
}
export function createLive(body: Record<string, unknown>, who: Identity) {
  rateLimit("live-create:" + who.owner, 20, 3600000);
  const game = body.game,
    locale = body.locale,
    difficulty = body.difficulty ?? "easy",
    category = body.category ?? "all";
  if (
    !liveGames.includes(game as LiveGame) ||
    typeof locale !== "string" ||
    !isLocale(locale) ||
    typeof difficulty !== "string" ||
    !isDifficulty(difficulty) ||
    typeof category !== "string" ||
    (opinionGame(String(game)) &&
      !validSocialCategory(category, game as "ranking" | "rather"))
  )
    throw new ApiError("invalid");
  const room: Room = {
    game: game as LiveGame,
    locale,
    difficulty,
    category,
    round: 1,
    players: [player(who, body.name)],
    challenge: null,
    startAt: null,
    endAt: null,
    resolvedAt: null,
    done: false,
    winner: null,
    reason: null,
  };
  const code = randomToken();
  database()
    .prepare("DELETE FROM live_rooms WHERE expires_at<=?")
    .run(Date.now());
  database()
    .prepare("INSERT INTO live_rooms VALUES(?,?,?)")
    .run(code, JSON.stringify(room), Date.now() + 86400000);
  return view(code, room, who);
}
export function readLive(code: unknown, who: Identity, heartbeat = false) {
  const loaded = load(code),
    { room } = loaded,
    index = seat(room, who);
  // Do not let a returning connection erase an already elapsed grace period.
  settle(room, Date.now());
  if (heartbeat && index !== -1) room.players[index].seen = Date.now();
  write(loaded.code, room);
  return view(loaded.code, room, who);
}
function start(code: string, room: Room) {
  const now = Date.now();
  if (
    room.players.length !== 2 ||
    !room.players.every(
      (p) =>
        p.ready &&
        now - p.seen < 15000 &&
        (room.game !== "guess" || p.secret !== null),
    )
  )
    return;
  transaction(() => {
    room.startAt = now + 3000;
    room.endAt =
      room.startAt +
      (room.game === "2048"
        ? 180
        : room.game === "sudoku"
          ? 1800
          : room.game === "guess"
            ? 300
            : 600) *
        1000;
    const c = generateChallenge(
      room.game,
      room.locale,
      utcDay(),
      room.difficulty,
      randomUUID(),
      room.category,
    );
    c.id = `live:${room.game}:${code}:${room.round}`;
    c.mode = "practice";
    c.roomId = code;
    c.roomStartedAt = new Date(room.startAt).toISOString();
    c.friendId = `live:${code}`;
    validateChallenge(c);
    room.challenge = c;
    for (const p of room.players) {
      p.runId = randomUUID();
      database()
        .prepare(
          "INSERT INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,created_at,started_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
        )
        .run(
          p.runId,
          p.owner,
          p.userId,
          p.guestId,
          c.id,
          c.kind,
          "practice",
          JSON.stringify(c),
          new Date(now).toISOString(),
          c.roomStartedAt,
        );
    }
    write(code, room);
  });
}
export function liveAction(
  code: unknown,
  who: Identity,
  body: Record<string, unknown>,
) {
  rateLimit("live-action:" + who.owner, 600, 60000);
  const loaded = load(code),
    room = loaded.room;
  settle(room, Date.now());
  let index = seat(room, who);
  if (body.action === "join" && index === -1) {
    if (room.players.length >= 2 || room.startAt !== null)
      throw new ApiError("roomFull", 409);
    room.players.push(player(who, body.name));
    index = room.players.length - 1;
  }
  if (index === -1) throw new ApiError("forbidden", 403);
  const p = room.players[index];
  p.seen = Date.now();
  if (body.action === "configure") {
    if (index !== 0 || room.startAt !== null)
      throw new ApiError("forbidden", 403);
    if (body.difficulty !== undefined) {
      if (typeof body.difficulty !== "string" || !isDifficulty(body.difficulty))
        throw new ApiError("invalid");
      room.difficulty = body.difficulty;
    }
    if (body.category !== undefined) {
      if (
        !opinionGame(room.game) ||
        typeof body.category !== "string" ||
        !validSocialCategory(body.category, room.game as "ranking" | "rather")
      )
        throw new ApiError("invalid");
      room.category = body.category;
    }
    room.players.forEach((p) => (p.ready = false));
  } else if (body.action === "rename") {
    if (
      room.startAt !== null ||
      typeof body.name !== "string" ||
      !/^[\p{L}\p{N} _.-]{1,24}$/u.test(body.name.trim())
    )
      throw new ApiError("invalid");
    p.name = body.name.trim();
  } else if (body.action === "ready") {
    if (room.startAt !== null) throw new ApiError("conflict", 409);
    p.ready = body.ready === true;
    start(loaded.code, room);
  } else if (body.action === "secret") {
    if (
      room.game !== "guess" ||
      room.startAt !== null ||
      p.secret !== null ||
      !validNumber(body.value)
    )
      throw new ApiError("invalid");
    p.secret = body.value as number;
  } else if (body.action === "resign") {
    if (room.startAt === null) {
      p.ready = false;
      p.seen = 0;
    } else {
      p.forfeit = true;
      settle(room, Date.now());
    }
  } else if (body.action === "rematch") {
    if (!room.done) throw new ApiError("conflict", 409);
    p.rematch = true;
    if (room.players.every((p) => p.rematch)) {
      room.round++;
      room.challenge = null;
      room.startAt = null;
      room.endAt = null;
      room.resolvedAt = null;
      room.done = false;
      room.winner = null;
      room.reason = null;
      for (const v of room.players) {
        v.ready = false;
        v.rematch = false;
        v.runId = null;
        v.secret = null;
        v.guesses = [];
        v.finishedAt = null;
        v.forfeit = false;
        delete v.completion;
        delete v.draft;
      }
    }
  } else if (
    !["join", "ready", "secret", "resign", "rematch"].includes(
      String(body.action),
    )
  )
    throw new ApiError("invalid");
  write(loaded.code, room);
  return view(loaded.code, room, who);
}
function playing(code: unknown, who: Identity, runId?: unknown) {
  const loaded = load(code);
  settle(loaded.room, Date.now());
  write(loaded.code, loaded.room);
  const p = loaded.room.players[seat(loaded.room, who)];
  if (!p || (runId !== undefined && runId !== p.runId))
    throw new ApiError("unavailable", 404);
  if (loaded.room.startAt === null || Date.now() < loaded.room.startAt)
    throw new ApiError("notStarted", 409);
  p.seen = Date.now();
  write(loaded.code, loaded.room);
  return { ...loaded, p };
}
export function liveRun(code: unknown, who: Identity, runId?: unknown) {
  const { p } = playing(code, who, runId);
  return getRun(p.runId, who, true);
}
export function submitLive(
  code: unknown,
  who: Identity,
  body: Record<string, unknown>,
) {
  const loaded = playing(code, who, body.runId),
    { room, p } = loaded;
  const stored = run(p);
  if (stored?.response_json) return JSON.parse(stored.response_json);
  if (room.done || p.forfeit) throw new ApiError("matchFinished", 409);
  let result;
  if (room.game === "guess") {
    return transaction(() => {
      const value = body.value;
      if (
        body.sequence === p.guesses.length - 1 &&
        p.guesses.at(-1)?.value === value
      )
        return { completion: p.completion };
      if (
        !validNumber(value) ||
        p.finishedAt ||
        body.sequence !== p.guesses.length ||
        p.guesses.length >= 30
      )
        throw new ApiError("invalid");
      const secret = room.players[1 - seat(room, who)].secret!;
      p.guesses.push({
        value: value as number,
        direction:
          value === secret
            ? "found"
            : Number(value) < secret
              ? "higher"
              : "lower",
      });
      if (value === secret || p.guesses.length === 30) {
        p.finishedAt = Date.now();
        const c = room.challenge!,
          completion: Completion = {
            challengeId: c.id,
            game: "guess",
            mode: "practice",
            locale: room.locale,
            date: c.date,
            success: value === secret,
            score: value === secret ? 1000 : 0,
            duration: Math.floor((p.finishedAt - room.startAt!) / 1000),
            attempts: p.guesses.length,
            completedAt: new Date(p.finishedAt).toISOString(),
            startedAt: c.roomStartedAt,
            provenance: "server",
            eligible: false,
            friendId: c.friendId,
            roomId: loaded.code,
            numberRules: "higher-lower",
            runId: p.runId!,
          };
        p.completion = completion;
        saveResult(p.runId!, who, completion, {
          friendId: c.friendId,
          roomId: loaded.code,
          numberRules: "higher-lower",
          comparisonEligible: false,
        });
        database()
          .prepare("UPDATE runs SET response_json=? WHERE id=?")
          .run(JSON.stringify({ completion }), p.runId!);
      }
      settle(room, Date.now());
      write(loaded.code, room);
      return { completion: p.completion };
    });
  } else {
    if (
      room.game === "rather" &&
      (body.step as { kind?: string } | undefined)?.kind === "finish"
    )
      throw new ApiError("invalid");
    if (room.game === "word") {
      const r = run(p)!,
        prior = JSON.parse(r.progress_json).guesses;
      if (
        !Array.isArray(body.guesses) ||
        body.guesses.length > prior.length + 1
      )
        throw new ApiError("invalid");
    }
    // Freeze every accepted proof through the existing authoritative adapter.
    result = submitRun(p.runId, who, body, true);
  }
  settle(room, Date.now());
  write(loaded.code, room);
  return result;
}
export function draftLive(
  code: unknown,
  who: Identity,
  body: Record<string, unknown>,
) {
  const { room, p, code: token } = playing(code, who, body.runId);
  const c = room.challenge;
  const grid = body.grid;
  if (
    room.done ||
    c?.kind !== "sudoku" ||
    !Array.isArray(grid) ||
    grid.length !== 81 ||
    !grid.every((n) => Number.isInteger(n) && n >= 0 && n <= 9) ||
    c.grid.some((n, i) => n && grid[i] !== n)
  )
    throw new ApiError("invalid");
  p.draft = body.grid as number[];
  write(token, room);
  return { saved: true };
}
