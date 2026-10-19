import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { hasTimeComparison, hasWinRate } from "../src/lib/result-metrics";
import { closeDatabase } from "../src/lib/server/database";
import { createRun, ownedRun, getRun } from "../src/lib/server/play";
import { localPreviewFixture } from "../src/lib/server/dev-preview";
import type { Identity } from "../src/lib/server/auth";
const who: Identity = {user:null,guestId:"preview-owner",owner:"g:preview-owner"};
beforeEach(() => {closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));});
afterEach(() => {closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});
it("keeps old Unusual Word runs while rejecting fresh Unlimited runs after the daily-only change",async () => {
  const legacy = await createRun({game:"rareword",locale:"fr",mode:"practice"},who);
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  expect(getRun(legacy.runId,who).runId).toBe(legacy.runId);
  await expect(createRun({game:"rareword",locale:"fr",mode:"practice"},who)).rejects.toThrow();
  const first = await createRun({game:"rareword",locale:"fr",mode:"daily"},who);
  expect((await createRun({game:"rareword",locale:"fr",mode:"daily"},who)).runId).toBe(first.runId);
});
it("previews the owned puzzle and preserves existing Word guesses without completing its server run",async () => {
  const run = await createRun({game:"word",locale:"fr",mode:"practice"},who), row = ownedRun(run.runId,who);
  const c = JSON.parse(row.challenge_json), guess = c.answer === "AIMER" ? "OUTIL" : "AIMER";
  const fixture = localPreviewFixture("word","fr","easy","practice",c,{guesses:[guess]});
  expect(fixture.wordGuesses).toEqual([guess,c.answer]); expect(fixture.completion.attempts).toBe(2);
  expect(fixture.challenge.id).toBe(c.id);expect(getRun(run.runId,who).result).toBeUndefined();
});
it("does not define wins for non-failable games or speed comparisons for opinion games",() => {
  for (const game of ["wordsearch","sudoku","ranking","rather"] as const) expect(hasWinRate(game)).toBe(false);
  for (const game of ["ranking","rather","2048"] as const) expect(hasTimeComparison(game)).toBe(false);
  expect(hasWinRate("mines")).toBe(true);expect(hasTimeComparison("wordsearch")).toBe(true);
});
