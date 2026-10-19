import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { database, closeDatabase } from "../src/lib/server/database";
import {
  createRun,
  beginRun,
  submitRun,
  ownedRun,
  compareRun,
} from "../src/lib/server/play";
import {
  createFriend,
  joinFriend,
  viewFriend,
  sharedResult,
} from "../src/lib/server/friends";
import { discoverRun } from "../src/lib/server/discovery";
import {
  definitionFor,
  extractDefinition,
} from "../src/lib/server/definitions";
import {
  GET as friendGet,
  POST as friendPost,
} from "../src/app/api/friends/route";
import { friendWinner } from "../src/lib/friend-types";
import {
  completionFromRow,
  migrateProgress,
  type ResultRow,
} from "../src/lib/server/results";
import {
  beginPlay,
  resetPlayClient,
  rememberRun,
} from "../src/lib/play-client";
import { setStorageUser } from "../src/lib/browser-storage";
import { syncableKey } from "../src/lib/server/sync";
import {
  personalProgress,
  personalResultStatistics,
  activityDays,
  validPreferences,
  visitPath,
} from "../src/lib/engagement";
import { generateChallenge, validateChallenge } from "../src/lib/challenges";
import {
  generateMath,
  generateVariedMath,
  evaluateExpression,
} from "../src/lib/math";
import {
  analyzeSudoku,
  findDeduction,
  generateRatedSudoku,
  generateSudoku,
  solveSudoku,
} from "../src/lib/sudoku";
import { discoverMath } from "../src/lib/math-discovery";
import { normalizeWord } from "../src/lib/word-normalization";
import { utcDay, DAY_MS } from "../src/lib/date";
import type { Identity } from "../src/lib/server/auth";
import type { Challenge, Completion, Locale } from "../src/lib/types";

const today = "2026-10-03",
  now = new Date(`${today}T12:00:00Z`);
function guest(letter = "a"): Identity {
  return {
    user: null,
    guestId: letter.repeat(43),
    owner: `g:${letter.repeat(43)}`,
  };
}
beforeEach(() => {
  resetPlayClient();
  setStorageUser(null);
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
});
afterEach(() => {
  resetPlayClient();
  setStorageUser(null);
  closeDatabase();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function proof(challenge: Challenge) {
  return challenge.kind === "word"
    ? { guesses: [challenge.answer] }
    : challenge.kind === "sudoku"
      ? { grid: challenge.solution }
      : challenge.kind === "math"
        ? { expression: challenge.reference }
        : (() => {
            throw new Error("Use the classic game replay proof");
          })();
}
function finish(id: string, who: Identity) {
  const challenge = JSON.parse(ownedRun(id, who).challenge_json) as Challenge;
  beginRun(id, who);
  vi.setSystemTime(Date.now() + 60000);
  return submitRun(id, who, {
    ...proof(challenge),
    score: 999999,
    duration: 0,
  });
}
function record(
  index: number,
  overrides: Partial<Completion> = {},
): Completion {
  return {
    challengeId: `practice:word:${index}:fr`,
    game: "word",
    mode: "practice",
    locale: "fr",
    date: today,
    completedAt: new Date(now.getTime() + index * 1000).toISOString(),
    success: true,
    duration: 50,
    attempts: 3,
    score: 600,
    provenance: "server",
    ...overrides,
  };
}

describe("real invitations and private post-game explanations", () => {
  it("rejoins the invitation when local run storage is missing or belongs to a different owner", async () => {
    const author = guest(),
      player = guest("b"),
      nextPlayer = guest("c");
    const original = await createRun(
      { game: "math", locale: "fr", mode: "practice" },
      author,
    );
    finish(original.runId, author);
    const { id } = createFriend(original.runId, author),
      challenge = viewFriend(id).challenge;
    vi.stubGlobal("window", new EventTarget());
    let active = player;
    const mock = vi.fn(async (url: string, options: RequestInit) => {
      const body = JSON.parse(String(options.body));
      if (url === "/api/friends") {
        expect(body).toEqual({ action: "join", id });
        return Response.json(joinFriend(id, active));
      }
      expect(body.action).toBe("start");
      try {
        return Response.json(beginRun(body.runId, active));
      } catch {
        return Response.json({ error: "unavailable" }, { status: 404 });
      }
    });
    vi.stubGlobal("fetch", mock);
    const first = await beginPlay(challenge);
    expect(first.challenge).toEqual(challenge);
    expect(mock).toHaveBeenCalledTimes(2);
    resetPlayClient();
    active = nextPlayer;
    rememberRun(challenge, first.runId);
    const next = await beginPlay(challenge);
    expect(next.challenge).toEqual(challenge);
    expect(next.runId).not.toBe(first.runId);
    expect(
      mock.mock.calls.filter(([url]) => url === "/api/friends"),
    ).toHaveLength(2);
  });
  it("keeps invitations owned by the same account after claiming guest progress", async () => {
    const author = guest(),
      peer = guest("b");
    const original = await createRun({ game: "word", locale: "fr" }, author);
    finish(original.runId, author);
    const { id } = createFriend(original.runId, author);
    const joined = joinFriend(id, peer);
    finish(joined.runId, peer);
    const user = {
      id: "claimed",
      username: "claimed",
      displayName: "Private name",
    };
    database()
      .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
      .run(
        user.id,
        user.username,
        user.displayName,
        "fixture-hash",
        now.toISOString(),
      );
    migrateProgress(user, author.guestId, []);
    const who = { user, guestId: "d".repeat(43), owner: `u:${user.id}` };
    expect(createFriend(original.runId, who).id).toBe(id);
    expect(viewFriend(id, who).isHost).toBe(true);
    expect(viewFriend(id, who).peers).toHaveLength(1);
    expect(() => createFriend(original.runId, author)).toThrow("unavailable");
    expect(JSON.stringify(viewFriend(id))).not.toContain(user.displayName);
  });
  it.each(["word", "sudoku", "math"] as const)(
    "clones the exact %s puzzle, keeps secrets private and scores on the server",
    async (game) => {
      const author = guest(),
        player = guest("b"),
        third = guest("c");
      const original = await createRun(
        { game, locale: "fr", mode: "practice", difficulty: "medium" },
        author,
      );
      expect(() => createFriend(original.runId, author)).toThrow("notFinished");
      await expect(discoverRun(original.runId, author)).rejects.toThrow(
        "notFinished",
      );
      finish(original.runId, author);
      const { id } = createFriend(original.runId, author);
      expect(createFriend(original.runId, author).id).toBe(id);
      const joined = joinFriend(id, player);
      expect(joinFriend(id, player).runId).toBe(joined.runId);
      const privateHost = JSON.parse(
        ownedRun(original.runId, author).challenge_json,
      );
      const privatePeer = JSON.parse(
        ownedRun(joined.runId, player).challenge_json,
      );
      expect(privatePeer).toEqual({
        ...privateHost,
        id: `friend:${game}:${id}`,
        mode: "practice",
        friendId: id,
      });
      const publicView = viewFriend(id);
      expect(publicView.you).toBeNull();
      expect(publicView.peers).toEqual([]);
      for (const key of [
        "answer",
        "solution",
        "reference",
        "runId",
        "owner",
        "guestId",
        "guesses",
      ])
        expect(JSON.stringify(publicView)).not.toContain(`"${key}"`);
      expect(() => createFriend(original.runId, player)).toThrow("unavailable");
      await expect(discoverRun(joined.runId, author)).rejects.toThrow(
        "unavailable",
      );
      await expect(discoverRun(joined.runId, player)).rejects.toThrow(
        "notFinished",
      );
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("offline fixture");
        }),
      );
      const result = finish(joined.runId, player);
      expect(result.completion).toMatchObject({
        friendId: id,
        mode: "practice",
        eligible: false,
        provenance: "server",
        duration: 60,
      });
      expect(result.completion.score).not.toBe(999999);
      expect(viewFriend(id, player).you).toMatchObject({
        success: true,
        duration: 60,
      });
      expect(viewFriend(id, author).peers).toHaveLength(1);
      expect(viewFriend(id, third).you).toBeNull();
      expect(viewFriend(id, third).peers).toEqual([]);
      expect(compareRun(joined.runId, player)).toBeNull();
      const row = database()
        .prepare("SELECT * FROM results WHERE id=?")
        .get(joined.runId) as ResultRow;
      expect(completionFromRow(row).friendId).toBe(id);
      expect((await discoverRun(joined.runId, player)).kind).toBe(game);
      const image = sharedResult(id);
      expect(image.challenge).not.toHaveProperty("answer");
      expect(image.challenge).not.toHaveProperty("solution");
      expect(image.challenge).not.toHaveProperty("reference");
      if (game === "word")
        expect(image.rows).toEqual([
          ["correct", "correct", "correct", "correct", "correct"],
        ]);
    },
  );
  it("keeps a daily slot free, resumes across midnight and expires invitations after 30 days", async () => {
    const author = guest(),
      player = guest("b");
    const original = await createRun({ game: "word", locale: "en" }, author);
    finish(original.runId, author);
    const { id } = createFriend(original.runId, author);
    const daily = await createRun({ game: "word", locale: "en" }, player);
    const friendly = joinFriend(id, player);
    expect(friendly.runId).not.toBe(daily.runId);
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    expect(joinFriend(id, player).runId).toBe(friendly.runId);
    expect(finish(friendly.runId, player).completion.eligible).toBe(false);
    expect(ownedRun(daily.runId, player).response_json).toBeNull();
    vi.setSystemTime(now.getTime() + 31 * DAY_MS);
    expect(() => viewFriend(id)).toThrow("expired");
    expect(() => joinFriend(id, player)).toThrow("expired");
    expect(() => sharedResult(id)).toThrow("expired");
    expect(createFriend(original.runId, author).id).not.toBe(id);
    expect(() => viewFriend("predictable-or-invalid")).toThrow("unavailable");
  });
  it("rejects cross-origin invitation writes and does not create a cookie on public reads", async () => {
    const denied = await friendPost(
      new NextRequest("http://localhost:3000/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "https://foreign.example",
        },
        body: JSON.stringify({ action: "join", id: "a".repeat(43) }),
      }),
    );
    expect(denied.status).toBe(403);
    const original = await createRun({ game: "math", locale: "fr" }, guest());
    finish(original.runId, guest());
    const { id } = createFriend(original.runId, guest());
    const response = await friendGet(
      new NextRequest(`http://localhost:3000/api/friends?id=${id}`),
    );
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).not.toHaveProperty("runId");
  });
  it("compares wins, Word guesses and math scores before using elapsed time", () => {
    const score = { success: true, score: 900, attempts: 3, duration: 50 };
    expect(
      friendWinner("word", score, { ...score, attempts: 2, duration: 100 }),
    ).toBe("you");
    expect(
      friendWinner("word", score, { ...score, success: false, duration: 1 }),
    ).toBe("friend");
    expect(
      friendWinner("math", score, { ...score, score: 1000, duration: 100 }),
    ).toBe("you");
    expect(friendWinner("sudoku", score, { ...score })).toBe("draw");
  });
});
describe("personal progress without population claims or completion pressure", () => {
  it("uses comparable server results, excludes imports, languages, modes and future results", () => {
    const current = record(10, { attempts: 1, duration: 35 });
    const before = [
      record(1),
      record(2),
      record(3),
      record(4, { locale: "en", attempts: 1 }),
      record(5, { mode: "daily", attempts: 1 }),
      record(6, { provenance: "imported", attempts: 1 }),
      record(11, { attempts: 1 }),
      current,
    ];
    const progress = personalProgress(before, current);
    expect(progress.records).toEqual(["timeRecord", "attemptsRecord"]);
    expect(progress.attemptsImprovement).toBe(2);
    expect(progress.timeImprovement).toBe(15);
    expect(progress.history).toEqual([
      before[0],
      before[1],
      before[2],
      current,
    ]);
    expect(progress.badges).not.toContain("firstWin");
    expect(personalProgress([], current).badges).toContain("firstWin");
    expect(
      personalProgress([record(1)], current).attemptsImprovement,
    ).toBeNull();
  });
  it("compares Sudoku levels separately, handles losses and caps history at ten", () => {
    const current = record(20, {
      game: "sudoku",
      difficulty: "hard",
      duration: 80,
    });
    const easy = record(1, {
      game: "sudoku",
      difficulty: "easy",
      duration: 30,
    });
    expect(personalProgress([easy], current).first).toBe(true);
    const previous = Array.from({ length: 15 }, (_, i) =>
      record(i, { game: "sudoku", difficulty: "hard", duration: 100 }),
    );
    expect(personalProgress(previous, current).history).toHaveLength(10);
    expect(
      personalProgress(previous, { ...current, success: false }).records,
    ).toEqual([]);
    expect(
      personalProgress(previous, { ...current, duration: 0 }).records,
    ).toEqual([]);
  });
  it("includes the first verified result immediately and counts it once after storage catches up", () => {
    const current = record(1, { attempts: 3, duration: 24 });
    expect(personalResultStatistics([], current)).toMatchObject({
      played: 1,
      won: 1,
      winRate: 100,
      averageAttempts: 3,
      averageTime: 24,
    });
    expect(personalResultStatistics([current, current], current).played).toBe(
      1,
    );
  });
  it("keeps imported results, other word languages and game modes out of the result summary", () => {
    const current = record(4, { mode: "practice", locale: "fr", attempts: 2 });
    const before = [
      record(0, { mode: "daily" }),
      record(1, { mode: "practice", locale: "en" }),
      record(2, { mode: "practice", provenance: "imported" }),
      record(3, { mode: "practice", success: false }),
    ];
    expect(personalResultStatistics(before, current)).toMatchObject({
      played: 2,
      won: 1,
      winRate: 50,
      averageAttempts: 2,
    });
  });
  it("keeps number strategies and rule versions separate in personal result summaries", () => {
    const current = record(6, {
      game: "guess",
      mode: "practice",
      difficulty: "hard",
      numberRules: "higher-lower",
    });
    const before = [
      record(0, {
        game: "guess",
        mode: "practice",
        difficulty: "easy",
        numberRules: "higher-lower",
      }),
      record(1, { game: "guess", mode: "practice", difficulty: "hard" }),
      record(2, {
        game: "guess",
        mode: "practice",
        difficulty: "hard",
        numberRules: "mixed",
      }),
    ];
    expect(personalResultStatistics(before, current).played).toBe(1);
    expect(personalProgress(before, current).history).toEqual([current]);
  });
  it("records days across unlimited and archives using completion date in UTC", () => {
    const results = [
      record(1, {
        completedAt: "2026-10-03T01:00:00+02:00",
        mode: "archive",
        date: "2026-09-05",
      }),
      record(2, { mode: "practice", completedAt: "2026-10-03T04:00:00Z" }),
    ];
    const days = activityDays(results, today);
    expect(days).toHaveLength(28);
    expect(days.filter((d) => d.played).map((d) => d.date)).toEqual([
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(activityDays(results, today, "math").some((d) => d.played)).toBe(
      false,
    );
  });
  it("validates preferences and permits account sync without accepting arbitrary links", () => {
    const last = {
      game: "sudoku" as const,
      mode: "practice" as const,
      locale: "fr" as const,
      date: today,
      difficulty: "hard" as const,
    };
    expect(validPreferences({ favorite: "sudoku", last })).toBe(true);
    expect(syncableKey("dailygrid:preferences:v1")).toBe(true);
    expect(validPreferences({ favorite: "unknown", last: null })).toBe(false);
    expect(
      validPreferences({
        favorite: null,
        last: { ...last, date: "2026-02-30" },
      }),
    ).toBe(false);
    expect(
      validPreferences({
        favorite: null,
        last: { ...last, friendId: "https://foreign.example" },
      }),
    ).toBe(false);
    expect(visitPath(last, "de")).toBe("/de/sudoku/practice/hard");
    expect(
      visitPath(
        { ...last, game: "2048", mode: "daily", difficulty: undefined },
        "fr",
      ),
    ).toBe(`/fr/2048/archive/${today}`);
    expect(visitPath({ ...last, friendId: "a".repeat(43) }, "en")).toBe(
      `/en/friend/${"a".repeat(43)}`,
    );
  });
});
describe("varied puzzles and truthful explanations", () => {
  it.each(["en", "fr", "es", "de"] as Locale[])(
    "avoids repeated daily %s answers for 30 days",
    (locale) => {
      const answers = Array.from({ length: 30 }, (_, i) => {
        const c = generateChallenge(
          "word",
          locale,
          utcDay(new Date(Date.parse("2026-10-04") + i * DAY_MS)),
        );
        if (c.kind !== "word") throw new Error();
        validateChallenge(c);
        return normalizeWord(c.answer);
      });
      expect(new Set(answers).size).toBe(30);
    },
  );
  it("preserves old published Sudoku and math generation", () => {
    const math = generateChallenge("math", "fr", today),
      sudoku = generateChallenge("sudoku", "fr", today, "medium");
    expect(math).toMatchObject(generateMath(math.id));
    expect(sudoku).toMatchObject(generateSudoku(sudoku.id, "medium"));
  });
  it("generates reproducible math references with varied operations and valid number use", () => {
    const ops = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const puzzle = generateVariedMath(`quality-${i}`);
      expect(puzzle).toEqual(generateVariedMath(`quality-${i}`));
      expect(
        evaluateExpression(puzzle.reference, puzzle.numbers, puzzle.target)
          .distance,
      ).toBe(0);
      for (const op of puzzle.reference.match(/[+×÷-]/g) ?? []) ops.add(op);
    }
    expect([...ops].sort()).toEqual(["+", "-", "×", "÷"]);
  });
  it("finds a different calculation, validates every step and honestly falls back within a bounded search", () => {
    const result = discoverMath([25, 2, 3, 4, 5, 6], 60, "25*2+4+6");
    expect(result.alternative).toBe(true);
    expect(
      evaluateExpression(result.expression, [25, 2, 3, 4, 5, 6], 60).distance,
    ).toBe(0);
    expect(
      result.steps.every(
        (step) => Number.isInteger(step.value) && step.value > 0,
      ),
    ).toBe(true);
    expect(discoverMath([2, 3], 5, "2+3").alternative).toBe(false);
    expect(discoverMath([2, 3], 5, "2+3", 0)).toMatchObject({
      alternative: false,
      searchLimited: true,
      expression: "2+3",
    });
  });
  it.each(["easy", "medium", "hard"] as const)(
    "selects unique reproducible %s Sudoku and gives a sound starting deduction",
    (difficulty) => {
      const puzzle = generateRatedSudoku("quality", difficulty);
      expect(puzzle).toEqual(generateRatedSudoku("quality", difficulty));
      expect(solveSudoku(puzzle.grid).count).toBe(1);
      const analysis = analyzeSudoku(puzzle.grid);
      if (analysis.first) {
        expect(puzzle.grid[analysis.first.index]).toBe(0);
        expect(analysis.first.digit).toBe(
          puzzle.solution[analysis.first.index],
        );
      }
      expect(analysis.naked + analysis.hidden + analysis.remaining).toBe(
        puzzle.grid.filter((n) => !n).length,
      );
      const almost = [...puzzle.solution];
      almost[0] = 0;
      expect(findDeduction(almost)).toMatchObject({
        kind: "naked",
        index: 0,
        digit: puzzle.solution[0],
      });
      expect(findDeduction(Array(81).fill(0))).toBeNull();
      expect(puzzle.grid).toEqual(
        generateRatedSudoku("quality", difficulty).grid,
      );
    },
  );
});
describe("localized dictionary excerpts", () => {
  it.each([
    [
      "fr",
      "<h2>Français</h2><ol><li>Instrument pour effectuer un travail.<ul><li>Un exemple à ignorer.</li></ul></li></ol>",
      "Instrument pour effectuer un travail.",
    ],
    [
      "en",
      "<h2>French</h2><ol><li>Wrong language definition.</li></ol><h2>English</h2><ol><li>A round fruit from an apple tree.<script>bad()</script></li></ol>",
      "A round fruit from an apple tree.",
    ],
    [
      "es",
      "<h2>Español</h2><dl><dt>1</dt><dd>Animal doméstico de la familia de los cánidos.</dd></dl>",
      "Animal doméstico de la familia de los cánidos.",
    ],
    [
      "de",
      "<h2>Apfel (Deutsch)</h2><p>Bedeutungen:</p><dl><dd>[1] Frucht eines Apfelbaumes mit rundlicher Form.</dd></dl>",
      "Frucht eines Apfelbaumes mit rundlicher Form.",
    ],
  ] as const)(
    "extracts a %s definition as plain text",
    (locale, html, expected) => {
      expect(extractDefinition(html, locale)).toBe(expected);
    },
  );
  it("does not substitute another language and limits the excerpt to 25 words", () => {
    expect(
      extractDefinition(
        "<h2>English</h2><ol><li>A valid English definition.</li></ol>",
        "fr",
      ),
    ).toBeNull();
    const excerpt = extractDefinition(
      `<h2>Français</h2><ol><li>${Array(40).fill("mot").join(" ")}</li></ol>`,
      "fr",
    )!;
    expect(excerpt.split(" ")).toHaveLength(25);
    expect(excerpt.endsWith("…")).toBe(true);
  });
  it("caches definitions, credits their page and falls back without inventing text during outages", async () => {
    const mock = vi.fn(async (url: URL) => {
      expect(url.origin).toBe("https://fr.wiktionary.org");
      return Response.json({
        parse: {
          title: "outil",
          text: {
            "*": "<h2>Français</h2><ol><li>Instrument pour effectuer un travail.</li></ol>",
          },
        },
      });
    });
    vi.stubGlobal("fetch", mock);
    expect(await definitionFor("OUTIL", "fr")).toMatchObject({
      title: "outil",
      source: "https://fr.wiktionary.org/wiki/outil",
    });
    await definitionFor("outil", "fr");
    expect(mock).toHaveBeenCalledTimes(1);
    mock.mockImplementation(async () => {
      throw new Error("outage");
    });
    expect(await definitionFor("ADULE", "fr")).toBeNull();
    expect(await definitionFor("adule", "fr")).toBeNull();
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
