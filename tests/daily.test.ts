import { describe, it, expect } from "vitest";
import {
  utcDay,
  previousDay,
  publishedDate,
  validDate,
  archiveDates,
} from "../src/lib/date";
import { streaks, finishedToday, addCompletion } from "../src/lib/stats";
import { detectLocale } from "../src/lib/i18n";
import { shareSummary } from "../src/lib/share";
import type { Completion } from "../src/lib/types";
const completion = (
  date: string,
  completedAt = `${date}T12:00:00Z`,
  game: Completion["game"] = "word",
): Completion => ({
  challengeId: `${game}:${date}`,
  game,
  date,
  locale: "fr",
  success: true,
  duration: 90,
  score: 1000,
  attempts: 2,
  completedAt,
});
describe("publication and UTC calendar", () => {
  it("uses UTC across browser timezone offsets and DST", () => {
    expect(utcDay(new Date("2026-10-01T01:00:00+02:00"))).toBe("2026-09-30");
    expect(utcDay(new Date("2026-10-01T23:30:00-07:00"))).toBe("2026-10-02");
    expect(utcDay(new Date("2026-03-29T03:30:00+02:00"))).toBe("2026-03-29");
  });
  it("handles leap days and year changes", () => {
    expect(previousDay("2028-03-01")).toBe("2028-02-29");
    expect(previousDay("2027-01-01")).toBe("2026-12-31");
    expect(validDate("2026-02-29")).toBe(false);
  });
  it("blocks future, nonexistent and prelaunch days", () => {
    expect(publishedDate("2026-10-01", "2026-10-01")).toBe(true);
    expect(publishedDate("2026-10-02", "2026-10-01")).toBe(false);
    expect(publishedDate("2026-08-31", "2026-10-01")).toBe(false);
    expect(publishedDate("../../secret", "2026-10-01")).toBe(false);
  });
  it("limits archive to published dates", () => {
    expect(archiveDates("2026-09-01")).toEqual([]);
    expect(archiveDates("2026-10-01")).toHaveLength(30);
    expect(archiveDates("2026-10-31")).toHaveLength(31);
  });
});
describe("streaks and progress", () => {
  it("starts at zero", () =>
    expect(streaks([], "2026-10-01")).toEqual({ current: 0, best: 0 }));
  it("counts consecutive days once regardless of game or order", () => {
    const c = [
      completion("2026-09-30"),
      completion("2026-09-29"),
      completion("2026-09-30", "2026-09-30T18:00:00Z", "math"),
      completion("2026-10-01"),
    ];
    expect(streaks(c, "2026-10-01")).toEqual({ current: 3, best: 3 });
  });
  it("keeps yesterday’s streak until today expires", () => {
    const c = [completion("2026-09-29"), completion("2026-09-30")];
    expect(streaks(c, "2026-10-01").current).toBe(2);
    expect(streaks(c, "2026-10-02")).toEqual({ current: 0, best: 2 });
  });
  it("does not count archived or midnight-crossing completions", () => {
    expect(
      streaks([completion("2026-09-30", "2026-10-01T00:01:00Z")], "2026-10-01"),
    ).toEqual({ current: 0, best: 0 });
  });
  it("counts each daily game once across Sudoku levels", () => {
    expect(
      finishedToday(
        [
          completion("2026-10-01"),
          completion("2026-10-01", undefined, "sudoku"),
          {
            ...completion("2026-10-01", undefined, "sudoku"),
            challengeId: "hard",
          },
        ],
        "2026-10-01",
      ),
    ).toEqual(["word", "sudoku"]);
  });
  it("deduplicates completed challenge records", () => {
    const c = completion("2026-10-01");
    expect(addCompletion([c], c)).toEqual([c]);
  });
});
describe("locale negotiation", () => {
  it("honors priority, regional tags and quality zero", () => {
    expect(detectLocale("en;q=0.3,fr-CA;q=0.9,de;q=0")).toBe("fr");
    expect(detectLocale("pl-PL,en;q=0.8")).toBe("en");
    expect(detectLocale("es;q=0,de;q=0.6")).toBe("de");
    expect(detectLocale(null)).toBe("en");
  });
});
describe("spoiler-free sharing", () => {
  it("shares only feedback and a locale-neutral dated entry point", () => {
    const summary = shareSummary(
      completion("2026-10-01"),
      "fr",
      "https://daily.example",
      [["correct", "present", "absent", "correct", "absent"]],
    );
    expect(summary).toContain("🟩🟨⬜🟩⬜");
    expect(summary).toContain("/play/word?date=2026-10-01");
    expect(summary).not.toContain("CRANE");
    expect(summary).not.toContain("/fr/");
  });
  it("shares math score without expression or reference", () => {
    expect(
      shareSummary(
        completion("2026-10-01", undefined, "math"),
        "es",
        "https://daily.example",
      ),
    ).toContain("Puntos: 1000/1000");
  });
  it("preserves Sudoku difficulty in the share link", () => {
    const c = {
      ...completion("2026-10-01", undefined, "sudoku"),
      challengeId: "sudoku:2026-10-01:universal:hard",
    };
    expect(shareSummary(c, "de", "https://daily.example")).toContain(
      "&difficulty=hard",
    );
  });
});
