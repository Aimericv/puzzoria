import { randomBytes } from "node:crypto";
import { database, transaction } from "./database";
import { ApiError, rateLimit } from "./http";
import type { Identity } from "./auth";
import type { Locale, Completion } from "../types";
import type { NumberAction } from "../social-types";
import type { RoomEvent, RoomView } from "../number-room-types";
import {
  allNumbers,
  numberStep,
  validNumber,
  numberRuleSet,
} from "../number-duel";
import { saveResult } from "./results";
import { utcDay } from "../date";
type Player = {
  owner: string;
  userId: string | null;
  guestId: string;
  number: number | null;
  locale: Locale;
};
type Room = {
  rules?: "higher-lower";
  players: Player[];
  candidates: number[][];
  turn: number;
  sequence: number;
  events: RoomEvent[];
  completed: boolean;
  winner: number | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  last?: { player: number; sequence: number; action: unknown };
};
type Row = { code: string; state_json: string; expires_at: number };
const player = (who: Identity, locale: Locale): Player => ({
  owner: who.owner,
  userId: who.user?.id ?? null,
  guestId: who.guestId,
  number: null,
  locale,
});
function load(code: unknown) {
  if (typeof code !== "string" || !/^[A-Z2-9]{8}$/.test(code))
    throw new ApiError("unavailable", 404);
  const row = database()
    .prepare("SELECT * FROM number_rooms WHERE code=?")
    .get(code) as Row | undefined;
  if (!row) throw new ApiError("unavailable", 404);
  if (row.expires_at <= Date.now()) throw new ApiError("expired", 410);
  return { row, room: JSON.parse(row.state_json) as Room };
}
const seat = (room: Room, who: Identity) =>
  room.players.findIndex(
    (p) => p.owner === who.owner || (!!who.user && p.userId === who.user.id),
  );
function completion(code: string, room: Room, index: number): Completion {
  const p = room.players[index],
    turns = room.events.filter((e) => e.player === index).length;
  return {
    numberRules: numberRuleSet(room),
    outcome:
      room.winner === null ? "draw" : room.winner === index ? "win" : "loss",
    challengeId: "duel:guess:" + code,
    game: "guess",
    mode: "practice",
    locale: p.locale,
    date: utcDay(new Date(room.createdAt)),
    success: room.winner === index,
    score: room.winner === index ? Math.max(0, (31 - turns) * 30) : 0,
    attempts: turns,
    startedAt: room.startedAt!,
    completedAt: room.completedAt!,
    duration: Math.max(
      0,
      Math.floor(
        (Date.parse(room.completedAt!) - Date.parse(room.startedAt!)) / 1000,
      ),
    ),
    provenance: "server",
    eligible: false,
  };
}
function view(row: Row, room: Room, who: Identity): RoomView {
  const you = seat(room, who);
  if (you === -1) throw new ApiError("unavailable", 404);
  return {
    code: row.code,
    ...(room.rules ? { rules: room.rules } : {}),
    sequence: room.sequence,
    you,
    ready: [room.players[0]?.number != null, room.players[1]?.number != null],
    number: room.players[you].number,
    turn: room.turn,
    completed: room.completed,
    winner: room.winner,
    candidates: room.candidates[you],
    opponentCandidates: room.candidates[1 - you],
    events: room.events,
    expiresAt: row.expires_at,
    ...(room.completed
      ? {
          numbers: room.players.map((p) => p.number!),
          completion: completion(row.code, room, you),
        }
      : {}),
  };
}
export function getRoom(code: unknown, who: Identity) {
  const { row, room } = load(code);
  return view(row, room, who);
}
export function createRoom(who: Identity, locale: Locale) {
  rateLimit("room-create:" + who.owner, 20, 3600000);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code: string;
  do {
    code = [...randomBytes(8)]
      .map((n) => alphabet[n % alphabet.length])
      .join("");
  } while (
    database().prepare("SELECT 1 FROM number_rooms WHERE code=?").get(code)
  );
  const room: Room = {
    rules: "higher-lower",
    players: [player(who, locale)],
    candidates: [allNumbers(), allNumbers()],
    turn: 0,
    sequence: 0,
    events: [],
    completed: false,
    winner: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  };
  const row: Row = {
    code,
    state_json: JSON.stringify(room),
    expires_at: Date.now() + 7 * 86400000,
  };
  database()
    .prepare("INSERT INTO number_rooms VALUES (?,?,?)")
    .run(code, row.state_json, row.expires_at);
  return view(row, room, who);
}
export function joinRoom(code: unknown, who: Identity, locale: Locale) {
  rateLimit("room-join:" + who.owner, 60, 3600000);
  return transaction(() => {
    const { row, room } = load(code);
    if (seat(room, who) !== -1) return view(row, room, who);
    if (room.players.length >= 2) throw new ApiError("roomFull", 409);
    room.players.push(player(who, locale));
    room.sequence++;
    database()
      .prepare("UPDATE number_rooms SET state_json=? WHERE code=?")
      .run(JSON.stringify(room), row.code);
    return view(row, room, who);
  });
}
export function actRoom(
  code: unknown,
  who: Identity,
  body: Record<string, unknown>,
) {
  rateLimit("room-action:" + who.owner, 120, 60000);
  return transaction(() => {
    const { row, room } = load(code),
      index = seat(room, who);
    if (index === -1) throw new ApiError("unavailable", 404);
    if (room.completed) return view(row, room, who);
    if (
      room.last &&
      room.last.sequence === body.sequence &&
      room.last.player === index &&
      JSON.stringify(room.last.action) === JSON.stringify(body.step)
    )
      return view(row, room, who);
    if (body.sequence !== room.sequence) throw new ApiError("conflict", 409);
    const step = body.step as { kind?: string; value?: number } | undefined;
    if (step?.kind === "secret") {
      if (room.players[index].number !== null || !validNumber(step.value))
        throw new ApiError("invalid");
      room.players[index].number = step.value;
      if (
        room.players.length === 2 &&
        room.players.every((p) => p.number !== null)
      )
        room.startedAt = new Date().toISOString();
    } else {
      if (!room.startedAt || room.turn !== index)
        throw new ApiError("notYourTurn", 409);
      let move: ReturnType<typeof numberStep>;
      try {
        if (room.rules === "higher-lower" && step?.kind !== "try")
          throw new Error("invalid");
        move = numberStep(
          room.candidates[index],
          room.players[1 - index].number!,
          body.step,
        );
      } catch {
        throw new ApiError("invalid");
      }
      room.candidates[index] = move.candidates;
      room.events.push({
        player: index,
        action: move.action as NumberAction,
        answer: move.answer,
        ...("direction" in move ? { direction: move.direction } : {}),
        eliminated: move.eliminated,
        remaining: move.candidates.length,
      });
      if (move.action.kind !== "question" && move.answer) {
        room.completed = true;
        room.winner = index;
      }
      if (room.events.length >= 60) room.completed = true;
      if (!room.completed) room.turn = 1 - index;
      else {
        room.completedAt = new Date().toISOString();
        room.players.forEach((p, i) =>
          saveResult(
            "duel:" + row.code + ":" + i,
            {
              owner: p.owner,
              guestId: p.guestId,
              user: p.userId
                ? { id: p.userId, username: "", displayName: "" }
                : null,
            },
            completion(row.code, room, i),
            {
              comparisonEligible: false,
              numberRules: numberRuleSet(room),
              room: row.code,
              outcome:
                room.winner === null
                  ? "draw"
                  : room.winner === i
                    ? "win"
                    : "loss",
            },
          ),
        );
      }
    }
    room.last = { player: index, sequence: room.sequence, action: body.step };
    room.sequence++;
    database()
      .prepare("UPDATE number_rooms SET state_json=? WHERE code=?")
      .run(JSON.stringify(room), row.code);
    return view(row, room, who);
  });
}
