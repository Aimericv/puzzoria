import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { directions, slide, tileOver } from "../src/lib/tile2048";
import { generateMines, neighbors, reveal, solveMines } from "../src/lib/mines";
import { generateSearch, searchPath } from "../src/lib/wordsearch";
import {
  gameAvailable,
  generateChallenge,
  publicChallenge,
  validateChallenge,
} from "../src/lib/challenges";
import { replayPuzzle, type PuzzleState } from "../src/lib/new-play";
import { locales, difficulties, type NewChallenge } from "../src/lib/types";
import { closeDatabase } from "../src/lib/server/database";
import {
  beginRun,
  createRun,
  getRun,
  ownedRun,
  submitRun,
} from "../src/lib/server/play";
import {
  createFriend,
  joinFriend,
  viewFriend,
} from "../src/lib/server/friends";
import { achievements, comparisonStatistics } from "../src/lib/statistics";
import { canonicalGamePath, gameMetadata } from "../src/lib/seo";
import type { Identity } from "../src/lib/server/auth";
import { friendWinner } from "../src/lib/friend-types";
const today = "2026-10-03",
  guest: Identity = {
    user: null,
    guestId: "a".repeat(43),
    owner: "g:" + "a".repeat(43),
  },
  friend: Identity = {
    user: null,
    guestId: "b".repeat(43),
    owner: "g:" + "b".repeat(43),
  };
beforeEach(() => {
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(today + "T12:00:00Z"));
});
afterEach(() => {
  closeDatabase();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("2048 engine", () => {
  it("merges each tile once, scores all merges and preserves total mass", () => {
    const grid = [2, 2, 4, 0, 2, 2, 2, 2, 0, 0, 0, 0, 4, 4, 8, 8],
      result = slide(grid, "left");
    expect(result.grid).toEqual([
      4, 4, 0, 0, 4, 4, 0, 0, 0, 0, 0, 0, 8, 16, 0, 0,
    ]);
    expect(result.gain).toBe(36);
    expect(grid[0]).toBe(2);
    expect(result.grid.reduce((a, b) => a + b)).toBe(
      grid.reduce((a, b) => a + b),
    );
  });
  it("handles all directions and detects real game over and no-op moves", () => {
    for (const d of directions)
      expect(
        slide([2, 0, 0, 2, ...Array(12).fill(0)], d).grid.filter(Boolean)
          .length,
      ).toBe(d === "left" || d === "right" ? 1 : 2);
    expect(slide([2, ...Array(15).fill(0)], "left").changed).toBe(false);
    expect(tileOver([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2])).toBe(
      true,
    );
    expect(tileOver([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 4])).toBe(
      false,
    );
  });
  it("daily content is universal, practice has a fresh seed and no daily budget", () => {
    const first = generateChallenge("2048", "fr", today);
    expect(first.kind).toBe("2048");
    if (first.kind !== "2048") throw new Error();
    for (const locale of locales) {
      const c = generateChallenge("2048", locale, today);
      expect(c.id).toBe(first.id);
      expect(c.kind === "2048" && c.grid).toEqual(first.grid);
    }
    const practice = generateChallenge(
      "2048",
      "fr",
      today,
      "easy",
      "different",
    );
    expect(practice.kind === "2048" && practice.moveLimit).toBeNull();
    expect(publicChallenge(first)).not.toHaveProperty("spawnSeed");
    validateChallenge(first);
  });
});
describe("logical minefields", () => {
  it.each(difficulties)(
    "generates deterministic, safe and logically solvable %s boards across seeds",
    (level) => {
      for (let seed = 0; seed < 12; seed++) {
        const c = generateMines("test:" + seed, level);
        expect(new Set(c.mines).size).toBe(c.mineCount);
        expect(solveMines(c.size, c.mines, c.start)).toBe(true);
        expect(
          [c.start, ...neighbors(c.start, c.size)].some((i) =>
            c.mines.includes(i),
          ),
        ).toBe(false);
        expect(generateMines("test:" + seed, level)).toEqual(c);
        expect(
          reveal(c.start, c.size, c.mines, Array(c.size ** 2).fill(-1))[
            c.start
          ],
        ).toBe(0);
      }
    },
  );
  it("keeps hidden mines off public payloads and validates completed boards", () => {
    const c = generateChallenge("mines", "fr", today);
    if (c.kind !== "mines") throw new Error();
    expect(publicChallenge(c)).not.toHaveProperty("mines");
    validateChallenge(c);
    expect(() =>
      replayPuzzle(c, [{ kind: "reveal", index: c.mines[0] }]),
    ).toThrow();
    const start = replayPuzzle(c, [{ kind: "reveal", index: c.start }]);
    expect(start.mines).toBeUndefined();
    const loss = replayPuzzle(c, [
      ...start.actions,
      { kind: "reveal", index: c.mines[0] },
    ]);
    expect(loss.completed).toBe(true);
    expect(loss.success).toBe(false);
    expect(loss.mines).toEqual(c.mines);
    expect(() =>
      replayPuzzle(c, [...loss.actions, { kind: "flag", index: c.mines[1] }]),
    ).toThrow();
  });
});
describe("localised word searches", () => {
  it.each(locales)(
    "places all eight %s words on valid paths across multiple seeds",
    (locale) => {
      for (let seed = 0; seed < 20; seed++) {
        const c = generateSearch("search-test:" + seed, locale);
        expect(c.grid).toHaveLength(144);
        expect(new Set(c.words).size).toBe(8);
        c.words.forEach((w, i) =>
          expect(
            searchPath(c.placements[i].from, c.placements[i].to, c.size)
              .map((n) => c.grid[n])
              .join(""),
          ).toBe(w),
        );
        expect(generateSearch("search-test:" + seed, locale)).toEqual(c);
      }
    },
  );
  it("accepts reverse selections and refuses non-straight, repeated and out-of-bounds paths", () => {
    const c = generateChallenge("wordsearch", "fr", today);
    if (c.kind !== "wordsearch") throw new Error();
    const first = c.placements[0],
      step = { kind: "select", from: first.to, to: first.from };
    expect(replayPuzzle(c, [step]).found).toEqual([c.words[0]]);
    expect(() => replayPuzzle(c, [step, step])).toThrow();
    expect(searchPath(0, 14, 12)).toEqual([]);
    expect(searchPath(-1, 2, 12)).toEqual([]);
    const result = replayPuzzle(
      c,
      c.placements.map((p) => ({ kind: "select", ...p })),
    );
    expect(result.success).toBe(true);
    expect(result.score).toBe(1000);
    expect(publicChallenge(c)).not.toHaveProperty("placements");
    validateChallenge(c);
  });
});
describe("authoritative runs, restored progress and private invitations", () => {
  it("disables new daily runs for five games, keeps unlimited play and preserves published archives", async () => {
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    for (const game of [
      "2048",
      "wordsearch",
      "ranking",
      "guess",
      "rather",
    ] as const) {
      await expect(createRun({ game, locale: "fr" }, guest)).rejects.toThrow(
        "invalid",
      );
      await expect(
        createRun({ game, locale: "fr", mode: "daily" }, guest),
      ).rejects.toThrow("invalid");
      await expect(
        createRun(
          { game, locale: "fr", mode: "archive", date: "2026-10-05" },
          guest,
        ),
      ).rejects.toThrow("invalid");
      const first = await createRun(
        { game, locale: "fr", mode: "practice" },
        guest,
      );
      const second = await createRun(
        { game, locale: "fr", mode: "practice" },
        guest,
      );
      expect(first.challenge.mode).toBe("practice");
      expect(first.challenge.id).not.toBe(second.challenge.id);
      const archived = await createRun(
        { game, locale: "fr", mode: "archive", date: "2026-10-03" },
        guest,
      );
      expect(archived.challenge.mode).toBe("archive");
      expect(archived.challenge.id).toBe(
        generateChallenge(game, "fr", "2026-10-03").id,
      );
    }
    for (const game of ["word", "sudoku", "math", "mines"] as const) {
      expect(
        (await createRun({ game, locale: "fr" }, guest)).challenge.mode,
      ).toBe("daily");
    }
  });
  it("validates sequential moves, refuses rewritten traces and makes retries idempotent", async () => {
    const run = await createRun(
        { game: "2048", locale: "fr", mode: "practice" },
        guest,
      ),
      c = JSON.parse(ownedRun(run.runId, guest).challenge_json) as NewChallenge;
    beginRun(run.runId, guest);
    vi.setSystemTime(Date.now() + 15000);
    const direction = directions.find(
      (d) => slide(c.kind === "2048" ? c.grid : [], d).changed,
    )!;
    const step = { kind: "move", direction },
      result = submitRun(run.runId, guest, { step, sequence: 0 }) as {
        state: PuzzleState;
      };
    expect(result.state.moves).toBe(1);
    expect(result.state.actions).toEqual([]);
    expect(result.state).toEqual(getRun(run.runId, guest).progress);
    expect(submitRun(run.runId, guest, { step, sequence: 0 })).toEqual({
      state: result.state,
      score: result.state.score,
      success: result.state.success,
      completed: false,
    });
    expect(() => submitRun(run.runId, guest, { step, sequence: 5 })).toThrow();
    const finished = submitRun(run.runId, guest, {
      bank: true,
      sequence: 1,
      score: 999999,
      success: true,
    });
    expect(finished.completion?.score).toBe(result.state.score);
    expect(finished.completion?.success).toBe(false);
    expect(finished.completion?.mode).toBe("practice");
    expect(() => getRun(run.runId, friend)).toThrow();
    expect(getRun(run.runId, guest).challenge).not.toHaveProperty("spawnSeed");
    expect(submitRun(run.runId, guest, { bank: true, sequence: 1 })).toEqual(
      finished,
    );
  });
  it("saves a real word-search victory, restores it and shares an identical private puzzle", async () => {
    const run = await createRun(
        { game: "wordsearch", locale: "de", mode: "practice" },
        guest,
      ),
      c = JSON.parse(ownedRun(run.runId, guest).challenge_json) as NewChallenge;
    if (c.kind !== "wordsearch") throw new Error();
    beginRun(run.runId, guest);
    vi.setSystemTime(Date.now() + 60000);
    c.placements.forEach((p, i) =>
      submitRun(run.runId, guest, {
        step: { kind: "select", ...p },
        sequence: i,
      }),
    );
    expect(getRun(run.runId, guest).result.completion).toMatchObject({
      success: true,
      score: 1000,
      eligible: false,
      game: "wordsearch",
    });
    const invite = createFriend(run.runId, guest),
      joined = joinFriend(invite.id, friend),
      copy = JSON.parse(
        ownedRun(joined.runId, friend).challenge_json,
      ) as NewChallenge;
    expect(copy).toMatchObject({
      grid: c.grid,
      words: c.words,
      placements: c.placements,
      friendId: invite.id,
      mode: "practice",
    });
    expect(viewFriend(invite.id, friend).challenge).not.toHaveProperty(
      "placements",
    );
    expect(viewFriend(invite.id, friend)).not.toHaveProperty("owner");
  });
  it("starts every minefield on the fixed safe cell and preserves difficulty in the result", async () => {
    const run = await createRun(
        { game: "mines", locale: "en", difficulty: "medium" },
        guest,
      ),
      c = JSON.parse(ownedRun(run.runId, guest).challenge_json) as NewChallenge;
    if (c.kind !== "mines") throw new Error();
    beginRun(run.runId, guest);
    vi.setSystemTime(Date.now() + 45000);
    const first = submitRun(run.runId, guest, {
      step: { kind: "reveal", index: c.start },
      sequence: 0,
    });
    expect(first.state?.grid[c.start]).toBe(0);
    expect(first.state).not.toHaveProperty("mines");
    let seq = 1,
      state = first.state!;
    for (let index = 0; index < c.size ** 2 && !state.completed; index++)
      if (state.grid[index] === -1 && !c.mines.includes(index)) {
        const result = submitRun(run.runId, guest, {
          step: { kind: "reveal", index },
          sequence: seq++,
        });
        state = result.state!;
      }
    expect(getRun(run.runId, guest).result.completion).toMatchObject({
      success: true,
      difficulty: "medium",
      score: 1000,
    });
  });
  it("does not create daily or archive runs for the new games before launch", async () => {
    for (const game of ["2048", "mines", "wordsearch"] as const) {
      expect(gameAvailable(game, "2026-10-02")).toBe(false);
      await expect(
        createRun(
          { game, locale: "en", mode: "archive", date: "2026-10-02" },
          guest,
        ),
      ).rejects.toThrow();
    }
    expect(gameAvailable("word", "2026-10-02")).toBe(true);
  });
});
describe("six-game SEO and comparisons", () => {
  it("has reciprocal localised alternatives and level-free easy minefield canonicals", () => {
    expect(canonicalGamePath("fr", "mines", undefined, "easy")).toBe(
      "/fr/demineur",
    );
    expect(
      gameMetadata("fr", "mines", undefined, "hard").alternates?.languages,
    ).toEqual({
      fr: "/fr/demineur/hard",
      en: "/en/minesweeper/hard",
      es: "/es/buscaminas/hard",
      de: "/de/minesweeper/hard",
      "x-default": "/en/minesweeper/hard",
    });
    expect(gameMetadata("de", "wordsearch").alternates?.languages?.fr).toBe(
      "/fr/mots-meles",
    );
  });
  it("retains explorer after the fourth successful game and compares 2048 scores above the 20-sample threshold", () => {
    const base = {
      challengeId: "x",
      game: "2048" as const,
      locale: "fr" as const,
      date: today,
      success: true,
      duration: 60,
      score: 100,
      completedAt: today + "T12:00:00Z",
    };
    expect(
      achievements([
        base,
        { ...base, game: "word" },
        { ...base, game: "math" },
        { ...base, game: "mines" },
      ]).explorer,
    ).toBe(true);
    const samples = Array.from({ length: 50 }, (_, i) => ({
      ...base,
      score: i < 25 ? 90 : 100,
    }));
    expect(comparisonStatistics(samples.slice(0, 19), base)).toBeNull();
    const comparison = comparisonStatistics(samples, base);
    expect(comparison?.betterScoreThanPercent).toBe(50);
    expect(comparison?.fasterThanPercent).toBeNull();
    expect(
      friendWinner(
        "2048",
        { success: true, score: 900, duration: 50 },
        { success: false, score: 1000, duration: 100 },
      ),
    ).toBe("you");
  });
});
