import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/dev-preview/route";
import { gameIds, locales } from "../src/lib/types";
import { normalizeWord } from "../src/lib/word-normalization";
import { database, closeDatabase } from "../src/lib/server/database";

beforeEach(() => {
  closeDatabase();
  vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
});
afterEach(() => {
  closeDatabase();
  vi.unstubAllEnvs();
});

it("has no production or remote-host finish endpoint", async () => {
  vi.stubEnv("NODE_ENV", "production");
  expect((await GET(new NextRequest("http://127.0.0.1/api/dev-preview?game=word&locale=fr"))).status).toBe(404);
  vi.stubEnv("NODE_ENV", "development");
  expect((await GET(new NextRequest("https://daily.example/api/dev-preview?game=word&locale=fr"))).status).toBe(404);
  expect((await GET(new NextRequest("http://localhost/api/dev-preview?game=invalid&locale=fr"))).status).toBe(400);
});

it("previews every game and language without recording runs, results or community votes", async () => {
  vi.stubEnv("NODE_ENV", "development");
  const db = database();
  for (const game of gameIds) for (const locale of locales) {
    const response = await GET(new NextRequest(`http://localhost/api/dev-preview?game=${game}&locale=${locale}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const data = await response.json();
    expect(data.completion).toMatchObject({game, locale, success: true, eligible: false});
    expect(data.completion.challengeId).toMatch(/^dev-preview:/);
    expect(data.completion).not.toHaveProperty("runId");
    expect(data.challenge).not.toHaveProperty("solution");
    expect(data.challenge).not.toHaveProperty("answer");
    expect(data.challenge).not.toHaveProperty("secret");
    expect(data.comparison.successRate).toBeGreaterThanOrEqual(game === "quiz" ? 0 : 60);
    expect(data.comparison.successRate).toBeLessThanOrEqual(100);
    if (game === "quiz") {
      expect(data.comparison.successRate).toBeCloseTo(data.comparison.successes * 100 / data.comparison.samples);
      expect(data.comparison.quizAverageAnswers).toBeLessThanOrEqual(data.completion.answersTotal);
      expect(data.comparison.successes).toBeGreaterThanOrEqual(20);
    }
    if (game === "rareword") expect(normalizeWord(data.discovery.word)).toBe(normalizeWord(data.answer));
    if (["ranking", "rather", "guess"].includes(game)) expect(data.state.completed).toBe(true);
  }
  for (const table of ["runs", "results", "community_votes"])
    expect(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()).toMatchObject({count: 0});
});
