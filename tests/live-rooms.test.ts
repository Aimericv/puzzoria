import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  createLive,
  liveAction,
  readLive,
  liveRun,
  submitLive,
  draftLive,
} from "../src/lib/server/live-rooms";
import { database, closeDatabase } from "../src/lib/server/database";
import {
  getRun,
  beginRun,
  submitRun,
  compareRun,
} from "../src/lib/server/play";
import { liveGames, type LiveGame } from "../src/lib/live-types";
import type { Challenge, WordChallenge } from "../src/lib/types";
import { dictionaries, normalizeWord } from "../src/lib/word";
import { directions, slide } from "../src/lib/tile2048";
import { eraseAccountRows } from "../scripts/account-erasure.mjs";
const who = (i: number) => ({
  user: null,
  guestId: `live-guest-${i}`,
  owner: `g:live-guest-${i}`,
});
beforeEach(() => {
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T12:00:00Z"));
});
afterEach(() => {
  closeDatabase();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function tick(ms: number) {
  vi.setSystemTime(Date.now() + ms);
}
function match(game: LiveGame) {
  const r = createLive({ game, locale: "fr" }, who(0));
  liveAction(r.code, who(1), { action: "join", name: "Ami" });
  if (game === "guess") {
    liveAction(r.code, who(0), { action: "secret", value: 73 });
    liveAction(r.code, who(1), { action: "secret", value: 42 });
  }
  liveAction(r.code, who(0), { action: "ready", ready: true });
  const countdown = liveAction(r.code, who(1), {
    action: "ready",
    ready: true,
  });
  expect(countdown.phase).toBe("countdown");
  expect(countdown.challenge).toBeUndefined();
  tick(3000);
  return readLive(r.code, who(0), true);
}
function privateChallenge(id: string) {
  return JSON.parse(
    database().prepare("SELECT challenge_json FROM runs WHERE id=?").get(id)!
      .challenge_json as string,
  ) as Challenge;
}
it.each(liveGames)(
  "starts %s together with an identical fresh puzzle, guarded runs and no secret exposure",
  (game) => {
    const r = match(game),
      peer = readLive(r.code, who(1), true),
      c = privateChallenge(r.runId!);
    expect(peer.challenge).toEqual(r.challenge);
    expect(peer.startAt).toBe(r.startAt);
    expect(r.challenge?.friendId).toBe(`live:${r.code}`);
    expect(r.challenge?.roomId).toBe(r.code);
    expect(JSON.stringify(r)).not.toContain("owner");
    expect(r.challenge).not.toHaveProperty("answer");
    expect(r.challenge).not.toHaveProperty("solution");
    expect(r.challenge).not.toHaveProperty("mines");
    expect(r.challenge).not.toHaveProperty("spawnSeed");
    expect(r.challenge).not.toHaveProperty("botSeed");
    expect(c.id).toContain("live:");
    expect(() => getRun(r.runId, who(0))).toThrow("forbidden");
    expect(() => beginRun(r.runId, who(0))).toThrow("forbidden");
    expect(() => submitRun(r.runId, who(0), {})).toThrow("forbidden");
    expect(() => liveRun(r.code, who(1), r.runId)).toThrow("unavailable");
    const outsider = readLive(r.code, who(2));
    expect(outsider.challenge).toBeUndefined();
    expect(outsider.runId).toBeUndefined();
    expect(outsider.ownSecret).toBeUndefined();
    expect(() => liveAction(r.code, who(2), { action: "join" })).toThrow(
      "roomFull",
    );
  },
);
it("hides the puzzle and refuses proof submission before the common start", () => {
  const r = createLive({ game: "word", locale: "fr" }, who(0));
  expect(() => liveRun(r.code, who(0))).toThrow("notStarted");
  liveAction(r.code, who(1), { action: "join" });
  liveAction(r.code, who(0), { action: "ready", ready: true });
  const ready = liveAction(r.code, who(1), { action: "ready", ready: true });
  expect(ready.challenge).toBeUndefined();
  const id = database()
    .prepare("SELECT id FROM runs WHERE owner=?")
    .get(who(0).owner)!.id;
  expect(() =>
    submitLive(r.code, who(0), { runId: id, guesses: ["OUTIL"] }),
  ).toThrow("notStarted");
});
it("Wordle awards fewer attempts before speed and a rematch needs both players and changes the puzzle", () => {
  const r = match("word"),
    p = readLive(r.code, who(1), true),
    c = privateChallenge(r.runId!) as WordChallenge;
  const wrong = dictionaries.fr.allowed.find((w) => w !== c.answer)!;
  submitLive(r.code, who(0), { runId: r.runId, guesses: [wrong] });
  tick(2000);
  submitLive(r.code, who(0), { runId: r.runId, guesses: [wrong, c.answer] });
  expect(readLive(r.code, who(0), true).phase).toBe("playing");
  expect(readLive(r.code, who(0), true).wordAnswer).toBeUndefined();
  tick(1000);
  submitLive(r.code, who(1), { runId: p.runId, guesses: [c.answer] });
  const end = readLive(r.code, who(0), true);
  expect(end.winner).toBe(1);
  expect(end.wordAnswer).toBe(normalizeWord(c.answer));
  expect(end.players.map((p) => p.attempts)).toEqual([2, 1]);
  expect(compareRun(r.runId, who(0))).toBeNull();
  expect(
    submitLive(r.code, who(1), { runId: p.runId, guesses: [c.answer] })
      .completion.attempts,
  ).toBe(1);
  expect(liveAction(r.code, who(0), { action: "rematch" }).phase).toBe(
    "finished",
  );
  const next = liveAction(r.code, who(1), { action: "rematch" });
  expect(next.phase).toBe("lobby");
  expect(next.round).toBe(2);
  expect(next.challenge).toBeUndefined();
  liveAction(r.code, who(0), { action: "ready", ready: true });
  liveAction(r.code, who(1), { action: "ready", ready: true });
  tick(3000);
  expect(readLive(r.code, who(0)).challenge!.id).not.toBe(c.id);
});
it("rejects recovered Wordle batches in duels", () => {
  const r = match("word"),
    c = privateChallenge(r.runId!) as WordChallenge;
  expect(() =>
    submitLive(r.code, who(0), {
      runId: r.runId,
      guesses: ["OUTIL", c.answer],
    }),
  ).toThrow("invalid");
});
it("both number players choose secrets and propose independently; guesses never reveal the opponent's secret", () => {
  const r = match("guess"),
    p = readLive(r.code, who(1), true);
  expect(r.ownSecret).toBe(73);
  expect(r.opponentSecret).toBeUndefined();
  expect(() =>
    liveAction(r.code, who(0), { action: "secret", value: 1 }),
  ).toThrow("invalid");
  submitLive(r.code, who(0), { runId: r.runId, value: 10, sequence: 0 });
  submitLive(r.code, who(0), { runId: r.runId, value: 10, sequence: 0 });
  expect(readLive(r.code, who(0)).guesses).toEqual([
    { value: 10, direction: "higher" },
  ]);
  expect(readLive(r.code, who(1)).guesses).toEqual([]);
  submitLive(r.code, who(0), { runId: r.runId, value: 42, sequence: 1 });
  expect(readLive(r.code, who(0)).phase).toBe("playing");
  tick(1000);
  submitLive(r.code, who(1), { runId: p.runId, value: 73, sequence: 0 });
  const end = readLive(r.code, who(0));
  expect(end.winner).toBe(1);
  expect(end.opponentSecret).toBe(42);
  expect(
    database()
      .prepare("SELECT COUNT(*) AS n FROM results WHERE eligible=1")
      .get()!.n,
  ).toBe(0);
});
it("Sudoku reports filled cells without correctness leaks, preserves clues and awards the first valid finish", () => {
  const r = match("sudoku"),
    c = privateChallenge(r.runId!);
  if (c.kind !== "sudoku") throw new Error();
  const grid = [...c.grid],
    empty = grid.findIndex((n) => !n);
  grid[empty] = 1;
  draftLive(r.code, who(0), { grid });
  expect(readLive(r.code, who(1)).players[0].progress).toBe(
    c.grid.filter(Boolean).length + 1,
  );
  const bad = [...grid];
  bad[c.grid.findIndex(Boolean)] = 0;
  expect(() => draftLive(r.code, who(0), { grid: bad })).toThrow("invalid");
  tick(1000);
  submitLive(r.code, who(0), { runId: r.runId, grid: c.solution });
  expect(readLive(r.code, who(1)).winner).toBe(0);
  expect(() => submitLive(r.code, who(1), { grid: c.solution })).toThrow(
    "matchFinished",
  );
});

it("commits a number proposal, its result and the room state atomically", () => {
  const r = match("guess");
  database().exec(`CREATE TRIGGER fail_room_save BEFORE UPDATE ON live_rooms
    WHEN json_extract(NEW.state_json,'$.players[0].completion.runId') IS NOT NULL
    BEGIN SELECT RAISE(ABORT,'test_room_save_failure'); END;`);
  expect(() =>
    submitLive(r.code, who(0), { runId: r.runId, sequence: 0, value: 42 }),
  ).toThrow("test_room_save_failure");
  expect(
    database().prepare("SELECT COUNT(*) n FROM results").get(),
  ).toMatchObject({ n: 0 });
  expect(
    database()
      .prepare("SELECT response_json FROM runs WHERE id=?")
      .get(r.runId!),
  ).toMatchObject({ response_json: null });
  expect(readLive(r.code, who(0)).guesses).toEqual([]);
  database().exec("DROP TRIGGER fail_room_save");
  expect(
    submitLive(r.code, who(0), { runId: r.runId, sequence: 0, value: 42 })
      .completion?.attempts,
  ).toBe(1);
});
it("Math ranks exact distance before time", () => {
  const r = match("math"),
    c = privateChallenge(r.runId!);
  if (c.kind !== "math") throw new Error();
  const p = readLive(r.code, who(1));
  submitLive(r.code, who(0), { expression: String(c.numbers[0]) });
  tick(2000);
  submitLive(r.code, who(1), { runId: p.runId, expression: c.reference });
  expect(readLive(r.code, who(0)).winner).toBe(1);
});
it.each(["ranking", "rather"] as const)(
  "%s locks choices and reveals both only after completion",
  (game) => {
    const r = match(game),
      p = readLive(r.code, who(1)),
      c = privateChallenge(r.runId!);
    const n =
      game === "ranking" ? 5 : c.kind === "rather" ? c.questions.length : 0;
    for (let i = 0; i < n; i++)
      submitLive(r.code, who(0), {
        sequence: i,
        step:
          game === "ranking"
            ? { kind: "rank", position: i + 1 }
            : { kind: "vote", choice: "a" },
      });
    expect(readLive(r.code, who(1)).choices).toBeUndefined();
    expect(readLive(r.code, who(1)).rankingItems).toBeUndefined();
    for (let i = 0; i < n; i++)
      submitLive(r.code, who(1), {
        runId: p.runId,
        sequence: i,
        step:
          game === "ranking"
            ? { kind: "rank", position: 5 - i }
            : { kind: "vote", choice: "b" },
      });
    const end = readLive(r.code, who(0));
    expect(end.phase).toBe("finished");
    expect(end.winner).toBeNull();
    expect(end.choices).toHaveLength(2);
    if (game === "ranking") expect(end.rankingItems).toHaveLength(5);
    expect(
      database().prepare("SELECT COUNT(*) AS n FROM community_votes").get()!.n,
    ).toBe(0);
  },
);
it("2048 closes at exactly three minutes with verified scores and blocks late moves", () => {
  const r = match("2048");
  let s = liveRun(r.code, who(0));
  const c = s.challenge;
  if (c.kind !== "2048") throw new Error();
  let grid = c.grid;
  for (let i = 0; i < 8; i++) {
    const direction = directions.find((d) => slide(grid, d).changed)!;
    const res = submitLive(r.code, who(0), {
      sequence: i,
      step: { kind: "move", direction },
    });
    grid = res.state.grid;
  }
  for (let i = 0; i < 6; i++) {
    tick(30000);
    readLive(r.code, who(0), true);
    readLive(r.code, who(1), true);
  }
  readLive(r.code, who(0), true);
  const end = readLive(r.code, who(1));
  expect(end.winner).toBe(0);
  expect(end.completion).toBeUndefined();
  expect(readLive(r.code, who(0)).completion?.duration).toBe(180);
  expect(() =>
    submitLive(r.code, who(1), {
      step: { kind: "move", direction: "left" },
      sequence: 0,
    }),
  ).toThrow("matchFinished");
  s = liveRun(r.code, who(0));
  expect(s.result!.completion.duration).toBe(180);
});
it("a reconnect within grace resumes, an overdue reconnect cannot erase a forfeit, expiry hides rooms", () => {
  const r = match("word");
  tick(14000);
  readLive(r.code, who(0), true);
  expect(readLive(r.code, who(1), true).phase).toBe("playing");
  tick(61000);
  const end = readLive(r.code, who(0), true);
  expect(end.reason).toBe("forfeit");
  expect(end.winner).toBeNull();
  tick(86400000);
  expect(() => readLive(r.code, who(0))).toThrow("expired");
});
it("account erasure removes the private room while preserving the other guest's run", () => {
  database()
    .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
    .run("account", "Account", "Account", "test", new Date().toISOString());
  const owner = {
    owner: "u:account",
    guestId: "guest-account",
    user: { id: "account", username: "Account", displayName: "Account" },
  };
  const r = createLive({ game: "word", locale: "fr" }, owner);
  liveAction(r.code, who(1), { action: "join" });
  liveAction(r.code, owner, { action: "ready", ready: true });
  liveAction(r.code, who(1), { action: "ready", ready: true });
  tick(3000);
  const p = readLive(r.code, who(1));
  eraseAccountRows(database(), "account");
  expect(
    database().prepare("SELECT COUNT(*) AS n FROM live_rooms").get()!.n,
  ).toBe(0);
  expect(
    database().prepare("SELECT id FROM runs WHERE id=?").get(p.runId!),
  ).toBeTruthy();
});
it.each(["mines", "wordsearch"] as const)(
  "%s validates the existing adapter and settles the race at the first correct finish",
  (game) => {
    const r = match(game),
      c = privateChallenge(r.runId!);
    let moves = 0;
    if (c.kind === "wordsearch")
      for (const p of c.placements)
        submitLive(r.code, who(0), {
          sequence: moves++,
          step: { kind: "select", ...p },
        });
    else if (c.kind === "mines") {
      let result = submitLive(r.code, who(0), {
        sequence: moves++,
        step: { kind: "reveal", index: c.start },
      });
      while (!result.completed) {
        const index = result.state.grid.findIndex(
          (n: number, i: number) => n === -1 && !c.mines.includes(i),
        );
        result = submitLive(r.code, who(0), {
          sequence: moves++,
          step: { kind: "reveal", index },
        });
      }
    }
    expect(readLive(r.code, who(1)).winner).toBe(0);
    expect(readLive(r.code, who(0)).completion?.success).toBe(true);
  },
);
it("changing difficulty/category cancels readiness, and only the host can configure a waiting room", () => {
  const r = createLive({ game: "ranking", locale: "fr" }, who(0));
  liveAction(r.code, who(1), { action: "join" });
  liveAction(r.code, who(1), { action: "ready", ready: true });
  expect(() =>
    liveAction(r.code, who(1), { action: "configure", category: "gaming" }),
  ).toThrow("forbidden");
  const next = liveAction(r.code, who(0), {
    action: "configure",
    category: "gaming",
  });
  expect(next.players.every((p) => !p.ready)).toBe(true);
  expect(next.category).toBe("gaming");
});
