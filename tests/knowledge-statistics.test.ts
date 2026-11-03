import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { comparisonStatistics } from "../src/lib/statistics";
import { personalProgress, personalResultStatistics } from "../src/lib/engagement";
import { hasTimeComparison, hasResultTimeComparison } from "../src/lib/result-metrics";
import { starterComparison } from "../src/lib/server/starter-statistics";
import { GameComparison } from "../src/components/game-comparison";
import { knowledgeStatisticsCopy } from "../src/lib/knowledge-statistics-i18n";
import { kt } from "../src/lib/knowledge-i18n";
import { locales, type Completion } from "../src/lib/types";
import { closeDatabase, database } from "../src/lib/server/database";
import { createRun, beginRun, ownedRun, submitRun, compareRun } from "../src/lib/server/play";
import type { QuizChallenge } from "../src/lib/knowledge-types";

const base: Completion = { game: "quiz", challengeId: "current", runId: "current", date: "2026-11-03", locale: "fr", mode: "practice", success: true, duration: 30, score: 1000, answersFound: 8, answersTotal: 8, knowledgeSet: "quiz:planets:v1:fr", completedAt: "2026-11-03T12:00:00Z", provenance: "server" };
const peer = (i: number, fields: Partial<Completion> = {}): Completion => ({ ...base, challengeId: `peer-${i}`, runId: `peer-${i}`, completedAt: "2026-11-02T12:00:00Z", ...fields });
beforeEach(() => { closeDatabase(); vi.stubEnv("DAILYGRID_DB_PATH", ":memory:"); vi.stubEnv("COMMUNITY_STARTER_STATS", "false"); });
afterEach(() => { closeDatabase(); vi.unstubAllEnvs(); vi.useRealTimers(); });

it("compares quiz speed among perfect rounds only, ignores tied times and separately reports average answers", () => {
  const peers = Array.from({ length: 30 }, (_, i) => peer(i, i < 10 ? { duration: 30 } : i < 20 ? { duration: 60 } : { success: false, score: 500, answersFound: 4, duration: 5 }));
  const p = comparisonStatistics(peers, base)!;
  expect(p).toMatchObject({ successes: 20, fasterThanPercent: 50, medianTime: 45, quizAnswerSamples: 30 });
  expect(p.betterScoreThanPercent).toBeCloseTo(100 / 3);
  expect(p.quizAverageAnswers).toBeCloseTo(20 / 3);
  expect(comparisonStatistics(peers, { ...base, success: false, answersFound: 4, score: 500 })?.fasterThanPercent).toBeNull();
  expect(comparisonStatistics(peers.slice(1), base)?.fasterThanPercent).toBeNull();
});
it("keeps legacy unknown counts unknown and excludes incompatible totals from average answers", () => {
  const peers = Array.from({ length: 22 }, (_, i) => peer(i, i < 19 ? {} : i === 19 ? { answersFound: undefined } : { answersTotal: 195, answersFound: 195 }));
  expect(comparisonStatistics(peers, base)).toMatchObject({ quizAnswerSamples: 19, quizAverageAnswers: null });
});
it("compares football speed at equal winning guess counts with an independent twenty-win threshold", () => {
  const current = { ...base, game: "football" as const, attempts: 2 };
  const peers = Array.from({ length: 40 }, (_, i) => peer(i, { game: "football", attempts: i < 20 ? 2 : 1, duration: i < 10 ? 30 : i < 20 ? 60 : 5 }));
  expect(comparisonStatistics(peers, current)).toMatchObject({ footballTimeSamples: 20, footballFasterThanPercent: 50, footballMedianTime: 45 });
  expect(comparisonStatistics(peers.slice(1), current)).toMatchObject({ footballTimeSamples: 19, footballFasterThanPercent: null, footballMedianTime: null });
  expect(comparisonStatistics(peers, { ...current, success: false })).toMatchObject({ footballTimeSamples: 0, footballFasterThanPercent: null });
});
it("shows perfect completion and speed instead of a score percentile in all four languages", () => {
  const p = comparisonStatistics(Array.from({ length: 20 }, (_, i) => peer(i, { duration: 60 })), base)!;
  for (const locale of locales) {
    const html = renderToStaticMarkup(createElement(GameComparison, { completion: base, comparison: p, locale }));
    expect(html).toContain(knowledgeStatisticsCopy(locale).perfect);
    expect(html).toContain(knowledgeStatisticsCopy(locale).perfectSpeed.replace("{n}", "100"));
    expect(html).not.toContain(kt(locale).better.split("{n}")[0]);
    expect(html).toContain("data-quiz-perfect-share");expect(html).toContain("data-quiz-answer-comparison");
    const partial = renderToStaticMarkup(createElement(GameComparison, { completion: { ...base, success: false, answersFound: 4, score: 500 }, comparison: { ...p, fasterThanPercent: null }, locale }));
    expect(partial).toContain(kt(locale).better.split("{n}")[0]);expect(partial).not.toContain("data-knowledge-speed");
  }
});
it("explains missing speed samples instead of inventing a percentile or reusing all-winning football times", () => {
  const peers = Array.from({ length: 20 }, (_, i) => peer(i, { success: i < 19 }));
  const html = renderToStaticMarkup(createElement(GameComparison, { completion: base, comparison: comparisonStatistics(peers, base)!, locale: "fr" }));
  expect(html).toContain(knowledgeStatisticsCopy("fr").pendingPerfect);
  const football = { ...base, game: "football" as const, attempts: 2 };
  const p = comparisonStatistics(Array.from({ length: 20 }, (_, i) => peer(i, { game: "football", attempts: 1, duration: 100 })), football)!;
  expect(p.fasterThanPercent).toBe(100); // This broader metric must not be used in the football UI.
  const footballHtml = renderToStaticMarkup(createElement(GameComparison, { completion: football, comparison: p, locale: "fr" }));
  expect(footballHtml).toContain(knowledgeStatisticsCopy("fr").pendingFootball);
  expect(footballHtml).not.toContain(knowledgeStatisticsCopy("fr").footballSpeed.split("{n}")[0]);
  const failed = { ...football, success: false, attempts: 6 };
  const failedHtml = renderToStaticMarkup(createElement(GameComparison, { completion: failed, comparison: comparisonStatistics(peers, failed)!, locale: "fr" }));
  expect(failedHtml).not.toContain("data-knowledge-speed");
  expect(failedHtml).not.toContain(knowledgeStatisticsCopy("fr").firstGuess);
});
it("tracks perfect quiz time records only within the matching personal cohort", () => {
  const history = [peer(1, { duration: 60 }), peer(2, { success: false, score: 500, answersFound: 4, duration: 2 }), peer(3, { duration: 3, knowledgeSet: "quiz:flags:v1:fr" }), peer(4, { duration: 3, locale: "en" }), peer(5, { duration: 3, mode: "daily" })];
  expect(personalResultStatistics(history, base)).toMatchObject({ played: 3, won: 2, bestTime: 30, averageTime: 45 });
  expect(personalProgress(history, base).records).toContain("timeRecord");
  expect(personalProgress(history, { ...base, success: false }).records).not.toContain("timeRecord");
  expect(hasResultTimeComparison(base)).toBe(true);expect(hasTimeComparison("quiz")).toBe(false);
});
it("uses coherent deterministic starter metrics for small and large quiz sets without persisting population rows", () => {
  for (const [topic, total] of [["planets", 8], ["countries-world", 195]] as const) {
    const current = { ...base, knowledgeSet: `quiz:${topic}:v1:fr`, answersFound: total, answersTotal: total };
    const p = starterComparison(current);
    expect(p).toEqual(starterComparison(current));expect(p.successes).toBeGreaterThanOrEqual(20);
    expect(p.fasterThanPercent).not.toBeNull();expect(p.quizAverageAnswers).toBeLessThan(total);
    expect(database().prepare("SELECT COUNT(*) n FROM results").get()).toMatchObject({ n: 0 });
  }
});
it("selects observed server quiz cohorts, excluding the current owner, other topics/languages and a second run by one owner", async () => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const finish = async (id: string, locale = "fr", topic = "planets") => {
    const who = { user: null, guestId: id, owner: `g:${id}` }, run = await createRun({ game: "quiz", locale, mode: "practice", category: topic }, who);
    const c = JSON.parse(ownedRun(run.runId, who).challenge_json) as QuizChallenge;
    beginRun(run.runId, who);vi.setSystemTime(Date.now() + 30000);
    c.items.forEach((item, sequence) => submitRun(run.runId, who, { sequence, step: { kind: "answer", value: item.answer } }));
    return { run, who };
  };
  const current = await finish("current");
  for(let i=0;i<19;i++)await finish(`peer-${i}`);
  await finish("peer-0");await finish("foreign", "en");await finish("other-topic", "fr", "flags");
  expect(compareRun(current.run.runId,current.who)).toBeNull();
  await finish("peer-19");
  expect(compareRun(current.run.runId,current.who)).toMatchObject({ samples: 20, successes: 20, fasterThanPercent: 0, quizAverageAnswers: 8 });
});
