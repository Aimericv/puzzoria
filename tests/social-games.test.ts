import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  generateChallenge,
  publicChallenge,
  validateChallenge,
  gameAvailable,
} from "../src/lib/challenges";
import { replaySocial } from "../src/lib/social-play";
import {
  allNumbers,
  botAction,
  numberStep,
  numberRuleSet,
} from "../src/lib/number-duel";
import {
  dilemmas,
  rankingDatasets,
  rankingPools,
  validateSocialCatalog,
} from "../src/lib/social-data";
import { closeDatabase, database } from "../src/lib/server/database";
import {
  beginRun,
  createRun,
  getRun,
  ownedRun,
  submitRun,
} from "../src/lib/server/play";
import {
  rankingAggregate,
  rankingCohort,
  socialCommunity,
  voteAggregate,
} from "../src/lib/server/community";
import {
  actRoom,
  createRoom,
  getRoom,
  joinRoom,
} from "../src/lib/server/number-rooms";
import { migrateProgress, saveResult } from "../src/lib/server/results";
import { canonicalGamePath, gameMetadata } from "../src/lib/seo";
import type { Identity } from "../src/lib/server/auth";
import type {
  SocialChallenge,
  SocialState,
  SocialAction,
} from "../src/lib/social-types";
import { locales, difficulties } from "../src/lib/types";
import { choiceThemes } from "../src/lib/social-share";
const date = "2026-10-03";
const who = (n: number): Identity => ({
  user: null,
  guestId: String(n).padStart(43, "x"),
  owner: "g:" + String(n).padStart(43, "x"),
});
beforeEach(() => {
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(date + "T12:00:00Z"));
});
afterEach(() => {
  closeDatabase();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
const challenge = (kind: SocialChallenge["kind"], difficulty = "easy") =>
  generateChallenge(kind, "fr", date, difficulty as "easy") as SocialChallenge;
async function run(kind: SocialChallenge["kind"], owner = who(0)) {
  const r = await createRun(
    { game: kind, locale: "fr", date, mode: "archive" },
    owner,
  );
  beginRun(r.runId, owner);
  return r;
}
const step = (
  runId: string,
  owner: Identity,
  sequence: number,
  action: SocialAction,
) => submitRun(runId, owner, { sequence, step: action });
it("continues a stored legacy bot run with manual proposals without rewriting its accepted proof", async () => {
  const owner = who(70),
    r = await run("guess", owner);
  const c = JSON.parse(
    ownedRun(r.runId, owner).challenge_json,
  ) as SocialChallenge;
  if (c.kind !== "guess") throw new Error();
  step(r.runId, owner, 0, { kind: "secret", value: 99 });
  step(r.runId, owner, 1, {
    kind: "question",
    predicate: { kind: "above", value: 50 },
  });
  const prior = JSON.parse(ownedRun(r.runId, owner).progress_json).actions;
  const result = step(r.runId, owner, 2, { kind: "try", value: c.secret }) as {
    completion: { success: boolean; numberRules: string };
  };
  expect(result.completion).toMatchObject({
    success: true,
    numberRules: "mixed",
  });
  expect(
    JSON.parse(ownedRun(r.runId, owner).progress_json).actions.slice(0, 2),
  ).toEqual(prior);
});
describe("social content and immutable daily inputs", () => {
  it("varies five picks from twenty-item pools while keeping published days on their original lists", () => {
    expect(rankingPools).toHaveLength(6);
    for (const pool of rankingPools) {
      expect(pool.items).toHaveLength(20);
      const seen = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const c = generateChallenge(
          "ranking",
          "fr",
          "2026-10-04",
          "easy",
          "variation-" + i,
          pool.category,
        );
        if (c.kind !== "ranking") throw new Error();
        expect(c.items).toHaveLength(5);
        expect(new Set(c.items.map((item) => item.id)).size).toBe(5);
        c.items.forEach((item) => seen.add(item.id));
      }
      expect(seen.size).toBeGreaterThan(15);
    }
    for (const day of ["2026-10-03", "2026-10-04"]) {
      const c = generateChallenge("ranking", "fr", day);
      expect(c.kind === "ranking" && c.dataset.endsWith("-v1")).toBe(true);
      const q = generateChallenge("rather", "fr", day);
      expect(
        q.kind === "rather" && q.questions.every((q) => q.id.endsWith("-v1")),
      ).toBe(true);
    }
    const next = generateChallenge("ranking", "fr", "2026-10-05");
    expect(next.kind === "ranking" && next.dataset.endsWith("-v2")).toBe(true);
  });
  it("has complete localized content and consistent daily puzzles across all languages", () => {
    validateSocialCatalog();
    expect(dilemmas).toHaveLength(60);
    expect(rankingDatasets).toHaveLength(6);
    for (const kind of ["ranking", "rather", "guess"] as const) {
      const first = generateChallenge(kind, "en", date) as SocialChallenge;
      validateChallenge(first);
      for (const locale of locales) {
        const c = generateChallenge(kind, locale, date) as SocialChallenge;
        validateChallenge(c);
        expect({ ...c, locale: "en" }).toEqual(first);
      }
      expect(gameAvailable(kind, "2026-10-02")).toBe(false);
      const generated = generateChallenge(
        kind,
        "fr",
        date,
        "easy",
        "one",
      ) as SocialChallenge;
      expect(generated.id).not.toBe(first.id);
      expect(generateChallenge(kind, "fr", date, "easy", "two").id).not.toBe(
        generated.id,
      );
    }
  });
  it("adding a future dataset leaves published daily inputs unchanged", () => {
    const before = challenge("ranking");
    rankingDatasets.push({
      ...rankingDatasets[0],
      id: "future-v1",
      availableFrom: "2026-10-10",
    });
    try {
      expect(challenge("ranking")).toEqual(before);
    } finally {
      rankingDatasets.pop();
    }
  });
  it("category selection is practice-only and rejects unknown categories", () => {
    const c = generateChallenge("ranking", "fr", date, "easy", "seed", "food");
    expect(c.kind === "ranking" && c.category).toBe("food");
    expect(() =>
      generateChallenge("rather", "fr", date, "easy", "seed", "bogus"),
    ).toThrow();
    expect(
      generateChallenge("ranking", "fr", date, "easy", undefined, "bogus"),
    ).toEqual(challenge("ranking"));
  });
  it("has canonical routes and localized SEO for all games and bot levels", () => {
    for (const locale of locales)
      for (const game of ["ranking", "rather", "guess"] as const) {
        const meta = gameMetadata(locale, game);
        expect(meta.description?.length).toBeGreaterThan(70);
        expect(meta.alternates?.languages).toHaveProperty("x-default");
        expect(canonicalGamePath(locale, game)).not.toContain("undefined");
      }
    expect(canonicalGamePath("fr", "guess", undefined, "easy")).toBe(
      "/fr/devine-le-nombre",
    );
    expect(canonicalGamePath("fr", "guess", undefined, "hard")).toBe(
      "/fr/devine-le-nombre/hard",
    );
  });
});
describe("blind ranking", () => {
  it("hides upcoming items publicly and only reveals the next after each locked placement", async () => {
    const r = await run("ranking"),
      privateC = JSON.parse(
        ownedRun(r.runId, who(0)).challenge_json,
      ) as Extract<SocialChallenge, { kind: "ranking" }>;
    expect(r.challenge.kind === "ranking" && r.challenge.items).toHaveLength(1);
    const a = step(r.runId, who(0), 0, { kind: "rank", position: 4 });
    expect(a.state?.visibleItems).toHaveLength(2);
    expect(a.state?.ranking[3]).toBe(privateC.items[0].id);
    expect(() =>
      step(r.runId, who(0), 1, { kind: "rank", position: 4 }),
    ).toThrow("invalid");
    expect(step(r.runId, who(0), 0, { kind: "rank", position: 4 })).toEqual(a);
    for (const [i, position] of [1, 2, 3, 5].entries())
      step(r.runId, who(0), i + 1, { kind: "rank", position });
    const saved = getRun(r.runId, who(0));
    expect(saved.result.completion.eligible).toBe(false);
    expect(saved.result.state.visibleItems).toHaveLength(5);
    expect(step(r.runId, who(0), 999, { kind: "rank", position: 2 })).toEqual(
      saved.result,
    );
    expect(() => getRun(r.runId, who(1))).toThrow("unavailable");
  });
  it("uses observed ranking modes, strict unusualness, and hides 19 samples", () => {
    const normal = ["a", "b", "c", "d", "e"],
      inverse = [...normal].reverse();
    expect(rankingAggregate(Array(19).fill(normal), normal, normal)).toBeNull();
    const data = rankingAggregate(
      [...Array(42).fill(normal), ...Array(8).fill(inverse)],
      inverse,
      normal,
    )!;
    expect(data.common).toEqual(normal);
    expect(data.matched).toBe(1);
    expect(data.swap).toBe(84);
    expect(data.percentages[0][0]).toBe(16);
    expect(data.unusual).toBe(84);
    expect(data.average[0]).toEqual({ item: "a", position: 1.64 });
    expect(data.hasControversy).toBe(true);
    expect(
      rankingAggregate(Array(50).fill(normal), normal, normal)?.hasControversy,
    ).toBe(false);
    expect(
      rankingAggregate(Array(50).fill(normal), normal, normal)?.unusual,
    ).toBe(0);
  });
  it("counts each other owner once across repeated runs and excludes current owner", async () => {
    const r = await run("ranking"),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "ranking" }
      >;
    const state = replaySocial(
      c,
      [1, 2, 3, 4, 5].map((position) => ({ kind: "rank", position })),
    );
    for (let i = 1; i <= 19; i++)
      database()
        .prepare("INSERT INTO community_votes VALUES (?,?,?,?,?,?)")
        .run(
          who(i).owner,
          "ranking",
          rankingCohort(c),
          JSON.stringify(state.ranking),
          r.runId,
          new Date().toISOString(),
        );
    database()
      .prepare("INSERT INTO community_votes VALUES (?,?,?,?,?,?)")
      .run(
        who(0).owner,
        "ranking",
        rankingCohort(c),
        JSON.stringify(state.ranking),
        r.runId,
        new Date().toISOString(),
      );
    expect(socialCommunity(c, state, who(0).owner)).toBeNull();
    database()
      .prepare("INSERT INTO community_votes VALUES (?,?,?,?,?,?)")
      .run(
        who(50).owner,
        "ranking",
        rankingCohort(c),
        JSON.stringify(state.ranking),
        r.runId,
        new Date().toISOString(),
      );
    expect(socialCommunity(c, state, who(0).owner)?.samples).toBe(20);
  });
});
describe("vote gating and community math", () => {
  it("allows an optional practice summary after a real vote, rejects empty or daily summaries and preserves unvoted privacy", async () => {
    const r = await createRun(
      { game: "rather", locale: "fr", mode: "practice", category: "gaming" },
      who(0),
    );
    beginRun(r.runId, who(0));
    expect(() => step(r.runId, who(0), 0, { kind: "finish" })).toThrow(
      "invalid",
    );
    step(r.runId, who(0), 0, { kind: "vote", choice: "a" });
    const result = step(r.runId, who(0), 1, { kind: "finish" });
    expect(result.completed).toBe(true);
    expect(result.state?.votes).toEqual(["a"]);
    expect(getRun(r.runId, who(0)).result.state.votes).toEqual(["a"]);
    const privateC = JSON.parse(
      ownedRun(r.runId, who(0)).challenge_json,
    ) as SocialChallenge;
    const community = socialCommunity(
      privateC,
      result.state as SocialState,
      who(0).owner,
    );
    expect(
      community?.kind === "rather" &&
        community.questions.slice(1).every((q) => q === null),
    ).toBe(true);
    const daily = await run("rather", who(1));
    step(daily.runId, who(1), 0, { kind: "vote", choice: "a" });
    expect(() => step(daily.runId, who(1), 1, { kind: "finish" })).toThrow(
      "invalid",
    );
  });
  it("does not reveal unvoted questions even when a population exists", async () => {
    const r = await run("rather"),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "rather" }
      >;
    for (let i = 1; i <= 50; i++)
      for (const q of c.questions)
        database()
          .prepare("INSERT INTO community_votes VALUES (?,?,?,?,?,?)")
          .run(
            who(i).owner,
            "rather",
            q.id,
            JSON.stringify(i <= 19 ? "a" : "b"),
            r.runId,
            new Date().toISOString(),
          );
    const empty = replaySocial(c, []);
    expect(socialCommunity(c, empty, who(0).owner)?.kind).toBe("rather");
    const before = socialCommunity(c, empty, who(0).owner);
    expect(
      before?.kind === "rather" && before.questions.every((q) => q === null),
    ).toBe(true);
    const voted = step(r.runId, who(0), 0, { kind: "vote", choice: "a" })
      .state as SocialState;
    const after = socialCommunity(c, voted, who(0).owner);
    expect(after?.kind === "rather" && after.questions[0]?.a).toBe(38);
    expect(after?.kind === "rather" && after.questions[1]).toBeNull();
    expect(() =>
      step(r.runId, who(0), 0, { kind: "vote", choice: "b" }),
    ).toThrow("invalid");
    step(r.runId, who(0), 0, { kind: "vote", choice: "a" });
    expect(
      database()
        .prepare("SELECT count(*) AS n FROM community_votes WHERE owner=?")
        .get(who(0).owner),
    ).toEqual({ n: 1 });
  });
  it("handles ties, perfect agreement and minority percentages without invented values", () => {
    expect(voteAggregate("x", Array(19).fill("a"))).toBeNull();
    expect(
      voteAggregate("x", [...Array(25).fill("a"), ...Array(25).fill("b")])
        ?.majority,
    ).toBeNull();
    expect(
      voteAggregate("x", [...Array(19).fill("a"), ...Array(31).fill("b")]),
    ).toMatchObject({ a: 38, b: 62, samples: 50, majority: "b" });
    expect(voteAggregate("x", Array(50).fill("a"))).toMatchObject({
      a: 100,
      b: 0,
    });
  });
  it("requires a full matching response set for the unusualness percentile", async () => {
    const r = await run("rather"),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "rather" }
      >;
    for (let i = 1; i <= 50; i++)
      for (const q of c.questions)
        database()
          .prepare("INSERT INTO community_votes VALUES (?,?,?,?,?,?)")
          .run(
            who(i).owner,
            "rather",
            q.id,
            JSON.stringify("a"),
            r.runId,
            new Date().toISOString(),
          );
    const state = replaySocial(
      c,
      c.questions.map(() => ({ kind: "vote", choice: "b" })),
    );
    const data = socialCommunity(c, state, who(0).owner);
    expect(data).toMatchObject({
      kind: "rather",
      matched: 0,
      unusual: 100,
      samples: 50,
    });
    expect(choiceThemes(c, state).length).toBeGreaterThan(0);
    for (let i = 20; i <= 50; i++)
      database()
        .prepare("DELETE FROM community_votes WHERE owner=? AND cohort=?")
        .run(who(i).owner, c.questions[0].id);
    expect(socialCommunity(c, state, who(0).owner)).toMatchObject({
      unusual: null,
    });
  });
});
describe("deterministic number bot", () => {
  it("requires 20 compatible winning peers, excludes current owner and uses strict turn comparisons", async () => {
    const r = await createRun(
        { game: "guess", locale: "fr", mode: "practice" },
        who(0),
      ),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "guess" }
      >;
    const state = replaySocial(c, [
      { kind: "secret", value: 42 },
      { kind: "try", value: c.secret },
    ]);
    const save = (
      n: number,
      attempts: number,
      difficulty: "easy" | "hard" = "easy",
      rules: "higher-lower" | "legacy" = "higher-lower",
    ) =>
      saveResult(
        "fixture:" + n + ":" + difficulty,
        who(n),
        {
          challengeId: "practice:guess:fixture:" + n + ":" + difficulty,
          game: "guess",
          mode: "practice",
          locale: "en",
          date,
          success: true,
          score: 900,
          attempts,
          difficulty,
          duration: 10,
          completedAt: new Date().toISOString(),
          provenance: "server",
          eligible: false,
        },
        { comparisonEligible: true, botTurns: 1, numberRules: rules },
      );
    for (let n = 1; n <= 19; n++) save(n, 2);
    save(0, 30);
    for (let n = 101; n <= 150; n++) save(n, 4, "hard");
    for (let n = 201; n <= 250; n++) save(n, 4, "easy", "legacy");
    expect(socialCommunity(c, state, who(0).owner)).toBeNull();
    save(50, 1);
    expect(socialCommunity(c, state, who(0).owner)).toMatchObject({
      kind: "guess",
      samples: 20,
      faster: 95,
    });
  });
  it("never reveals the opponent secret before the game ends", async () => {
    const r = await run("guess"),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "guess" }
      >;
    expect(publicChallenge(c)).not.toHaveProperty("secret");
    expect(publicChallenge(c)).not.toHaveProperty("botSeed");
    step(r.runId, who(0), 0, { kind: "secret", value: 99 });
    const response = step(r.runId, who(0), 1, {
      kind: "question",
      predicate: { kind: "above", value: 50 },
    });
    expect(response.state).not.toHaveProperty("opponentNumber");
    expect(response.state?.candidates).toContain(c.secret);
    expect(response.state?.botCandidates).toContain(99);
    expect(() =>
      step(r.runId, who(0), 1, { kind: "secret", value: 42 }),
    ).toThrow("invalid");
    expect(() =>
      step(r.runId, who(0), 2, {
        kind: "question",
        predicate: { kind: "above", value: 100 },
      }),
    ).toThrow("invalid");
  });
  it("has deterministic meaningful deductions and Hard outperforms Easy over all 100 secrets", () => {
    const average: Record<string, number> = {};
    for (const difficulty of difficulties) {
      let total = 0;
      for (let secret = 1; secret <= 100; secret++) {
        let candidates = allNumbers(),
          turns = 0;
        while (turns < 40) {
          const a = botAction(candidates, difficulty, "fixture:" + turns);
          expect(botAction(candidates, difficulty, "fixture:" + turns)).toEqual(
            a,
          );
          const step = numberStep(candidates, secret, a);
          expect(step.candidates).toContain(secret);
          candidates = step.candidates;
          turns++;
          if (step.action.kind === "guess" && step.answer) break;
        }
        expect(turns).toBeLessThan(40);
        if (difficulty === "hard") expect(turns).toBeLessThanOrEqual(8);
        total += turns;
      }
      average[difficulty] = total / 100;
    }
    expect(average.hard).toBeLessThan(average.easy);
  });
  it("records a verified first-guess victory and ignores client score, success and time", async () => {
    const r = await run("guess"),
      c = JSON.parse(ownedRun(r.runId, who(0)).challenge_json) as Extract<
        SocialChallenge,
        { kind: "guess" }
      >;
    step(r.runId, who(0), 0, { kind: "secret", value: 42 });
    vi.advanceTimersByTime(6000);
    const result = submitRun(r.runId, who(0), {
      sequence: 1,
      step: { kind: "guess", value: c.secret },
      score: 99999,
      duration: 0,
      success: false,
    });
    expect(result.completion).toMatchObject({
      score: 900,
      duration: 6,
      success: true,
      attempts: 1,
      difficulty: "easy",
      outcome: "win",
    });
    expect(result.state?.opponentNumber).toBe(c.secret);
    expect(result.state?.actions).toEqual([]);
  });
});
describe("manual higher/lower number duels", () => {
  it("returns correct signs and retains the secret for every possible proposal, including 1 and 100", () => {
    for (let secret = 1; secret <= 100; secret++) {
      for (let value = 1; value <= 100; value++) {
        const move = numberStep(allNumbers(), secret, { kind: "try", value });
        expect(move.direction).toBe(
          value === secret ? "found" : value < secret ? "higher" : "lower",
        );
        expect(move.answer).toBe(value === secret);
        expect(move.candidates).toContain(secret);
        expect(move.candidates.length).toBe(
          value === secret ? 1 : value < secret ? 100 - value : value - 1,
        );
      }
    }
  });
  it("accepts manually chosen numbers outside the remaining range without suggesting or correcting them", () => {
    const first = numberStep(allNumbers(), 73, { kind: "try", value: 50 });
    const again = numberStep(first.candidates, 73, { kind: "try", value: 10 });
    expect(again.direction).toBe("higher");
    expect(again.eliminated).toBe(0);
    expect(again.action).toEqual({ kind: "try", value: 10 });
    const last = numberStep(again.candidates, 73, { kind: "try", value: 90 });
    expect(last.direction).toBe("lower");
    expect(last.candidates).toContain(73);
  });
  it("rejects non-integer and out-of-bounds proposals", () => {
    for (const value of [0, -1, 101, 50.5, "50", null, undefined, Infinity])
      expect(() =>
        numberStep(allNumbers(), 73, { kind: "try", value }),
      ).toThrow("invalid");
  });
  it("requires a manually chosen secret and refuses the old questions in a fresh game", async () => {
    const r = await createRun(
      { game: "guess", locale: "fr", mode: "practice", difficulty: "hard" },
      who(0),
    );
    beginRun(r.runId, who(0));
    expect(r.challenge).toMatchObject({ rules: "higher-lower" });
    expect(getRun(r.runId, who(0)).progress?.yourNumber).toBeUndefined();
    expect(() => step(r.runId, who(0), 0, { kind: "try", value: 50 })).toThrow(
      "invalid",
    );
    step(r.runId, who(0), 0, { kind: "secret", value: 50 });
    expect(() =>
      step(r.runId, who(0), 1, {
        kind: "question",
        predicate: { kind: "above", value: 50 },
      }),
    ).toThrow("invalid");
    expect(() =>
      step(r.runId, who(0), 1, { kind: "guess", value: 50 }),
    ).toThrow("invalid");
    expect(() =>
      step(r.runId, who(0), 1, { kind: "secret", value: 42 }),
    ).toThrow("invalid");
    const puzzle = JSON.parse(
      ownedRun(r.runId, who(0)).challenge_json,
    ) as Extract<SocialChallenge, { kind: "guess" }>;
    vi.advanceTimersByTime(6000);
    const lost = step(r.runId, who(0), 1, {
      kind: "try",
      value: puzzle.secret === 1 ? 100 : 1,
    });
    expect(lost.state?.events.at(-1)).toMatchObject({
      actor: "bot",
      answer: true,
      direction: "found",
    });
    expect(lost.completion).toMatchObject({
      outcome: "loss",
      success: false,
      numberRules: "higher-lower",
      attempts: 1,
    });
  });
  it("uses only deterministic proposals at all levels and Hard solves every secret within seven turns", () => {
    const totals: Record<string, number> = {};
    for (const difficulty of difficulties) {
      let total = 0;
      for (let secret = 1; secret <= 100; secret++) {
        let candidates = allNumbers(),
          turns = 0,
          found = false;
        while (!found && turns < 30) {
          const seed = "higher-lower:" + secret + ":" + turns;
          const action = botAction(candidates, difficulty, seed, true);
          expect(action.kind).toBe("try");
          expect(botAction(candidates, difficulty, seed, true)).toEqual(action);
          const move = numberStep(candidates, secret, action);
          candidates = move.candidates;
          found = move.answer;
          turns++;
        }
        expect(found).toBe(true);
        if (difficulty === "hard") expect(turns).toBeLessThanOrEqual(7);
        total += turns;
      }
      totals[difficulty] = total;
    }
    expect(totals.hard).toBeLessThan(totals.medium);
    expect(totals.medium).toBeLessThan(totals.easy);
  });
  it("keeps old accepted guesses unchanged and excludes mixed old/new rounds from comparisons", () => {
    expect(
      numberStep(allNumbers(), 73, { kind: "guess", value: 50 }).candidates,
    ).toHaveLength(99);
    const c = challenge("guess");
    expect(c).not.toHaveProperty("rules");
    if (c.kind !== "guess") throw new Error();
    const legacy = replaySocial(c, [
      { kind: "secret", value: 99 },
      { kind: "question", predicate: { kind: "above", value: 50 } },
    ]);
    const mixed = replaySocial(c, [
      ...legacy.actions,
      { kind: "try", value: c.secret },
    ]);
    expect(mixed.events.slice(0, 2)).toEqual(legacy.events);
    expect(numberRuleSet(mixed)).toBe("mixed");
    expect(socialCommunity(c, mixed, who(0).owner)).toBeNull();
  });
  it("refuses old questions in new rooms and preserves accepted moves in older rooms", () => {
    const host = who(0),
      peer = who(1),
      r = createRoom(host, "fr");
    joinRoom(r.code, peer, "fr");
    actRoom(r.code, host, { sequence: 1, step: { kind: "secret", value: 42 } });
    actRoom(r.code, peer, { sequence: 2, step: { kind: "secret", value: 73 } });
    expect(() =>
      actRoom(r.code, host, {
        sequence: 3,
        step: { kind: "question", predicate: { kind: "above", value: 50 } },
      }),
    ).toThrow("invalid");
    const row = database()
      .prepare("SELECT state_json FROM number_rooms WHERE code=?")
      .get(r.code) as { state_json: string };
    const old = JSON.parse(row.state_json);
    delete old.rules;
    database()
      .prepare("UPDATE number_rooms SET state_json=? WHERE code=?")
      .run(JSON.stringify(old), r.code);
    const accepted = actRoom(r.code, host, {
      sequence: 3,
      step: { kind: "question", predicate: { kind: "above", value: 50 } },
    });
    const won = actRoom(r.code, peer, {
      sequence: 4,
      step: { kind: "try", value: 42 },
    });
    expect(won.events[0]).toEqual(accepted.events[0]);
    expect(won.completion).toMatchObject({
      outcome: "win",
      numberRules: "mixed",
    });
  });
});

describe("two-device private number duels", () => {
  it("has separate secrets, clear turns, idempotent moves, immutable outcome and private projections", () => {
    const host = who(0),
      friend = who(1),
      outsider = who(2),
      room = createRoom(host, "fr");
    expect(room.code).toMatch(/^[A-Z2-9]{8}$/);
    actRoom(room.code, host, {
      sequence: 0,
      step: { kind: "secret", value: 42 },
    });
    joinRoom(room.code, friend, "en");
    const joined = getRoom(room.code, friend);
    expect(joined.number).toBeNull();
    expect(joined).not.toHaveProperty("numbers");
    expect(joined).not.toHaveProperty("players");
    expect(joined).not.toHaveProperty("opponentNumber");
    expect(joined.candidates).toEqual(allNumbers());
    expect(() => getRoom(room.code, outsider)).toThrow("unavailable");
    expect(() => joinRoom(room.code, outsider, "fr")).toThrow("roomFull");
    const sealed = actRoom(room.code, friend, {
      sequence: joined.sequence,
      step: { kind: "secret", value: 73 },
    });
    expect(sealed.turn).toBe(0);
    expect(sealed.ready).toEqual([true, true]);
    expect(() =>
      actRoom(room.code, friend, {
        sequence: sealed.sequence,
        step: { kind: "try", value: 42 },
      }),
    ).toThrow("notYourTurn");
    const next = actRoom(room.code, host, {
      sequence: sealed.sequence,
      step: { kind: "try", value: 50 },
    });
    expect(next.candidates).toHaveLength(50);
    expect(next.events.at(-1)?.direction).toBe("higher");
    expect(next.turn).toBe(1);
    expect(
      actRoom(room.code, host, {
        sequence: sealed.sequence,
        step: { kind: "try", value: 50 },
      }),
    ).toEqual(next);
    const win = actRoom(room.code, friend, {
      sequence: next.sequence,
      step: { kind: "try", value: 42 },
    });
    expect(win.winner).toBe(1);
    expect(win.numbers).toEqual([42, 73]);
    expect(win.completion).toMatchObject({
      success: true,
      eligible: false,
      attempts: 1,
      outcome: "win",
    });
    expect(
      actRoom(room.code, host, {
        sequence: 999,
        step: { kind: "try", value: 73 },
      }).winner,
    ).toBe(1);
    expect(
      database()
        .prepare("SELECT count(*) AS n FROM results WHERE game=?")
        .get("guess"),
    ).toEqual({ n: 2 });
  });
  it("supports account migration without counting a guest vote twice or losing a room", async () => {
    const guest = who(0),
      r = await run("rather", guest);
    step(r.runId, guest, 0, { kind: "vote", choice: "a" });
    const room = createRoom(guest, "fr");
    database()
      .prepare("INSERT INTO users VALUES (?,?,?,?,?)")
      .run("account", "name", "Name", "unused", new Date().toISOString());
    const user = { id: "account", username: "name", displayName: "Name" };
    migrateProgress(user, guest.guestId, []);
    migrateProgress(user, guest.guestId, []);
    expect(
      database().prepare("SELECT owner FROM community_votes").all(),
    ).toEqual([{ owner: "u:account" }]);
    expect(
      getRoom(room.code, { user, guestId: guest.guestId, owner: "u:account" })
        .you,
    ).toBe(0);
    expect(() => getRoom(room.code, guest)).toThrow("unavailable");
  });
  it("expires duels and bounds reads and actions to authorized participants", () => {
    const room = createRoom(who(0), "fr");
    vi.advanceTimersByTime(7 * 86400000 + 1);
    expect(() => getRoom(room.code, who(0))).toThrow("expired");
    expect(() => joinRoom("BAD", who(1), "en")).toThrow("unavailable");
  });
});
