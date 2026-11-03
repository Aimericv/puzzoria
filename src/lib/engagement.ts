import { achievements, modeOf, personalStatistics } from "./statistics";
import { DAY_MS, utcDay, validDate } from "./date";
import type { Completion, Difficulty, GameId, Locale, PlayMode } from "./types";
import { isDifficulty, isGameId, isLocale } from "./types";
import { canonicalGamePath } from "./seo";
import { practicePath } from "./play-path";
import { hasDaily } from "./game-modes";
import { hasResultTimeComparison } from "./result-metrics";
export type Visit = {
  game: GameId;
  mode: PlayMode;
  date: string;
  locale: Locale;
  difficulty?: Difficulty;
  friendId?: string;
  challengeId?: string;
};
export type Preferences = { favorite: GameId | null; last: Visit | null };
export const PREFERENCES_KEY = "dailygrid:preferences:v1";
export function validPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") return false;
  const v = value as Preferences;
  if (v.favorite !== null && !isGameId(String(v.favorite))) return false;
  if (v.last === null) return true;
  const last = v.last;
  return (
    !!last &&
    isGameId(last.game) &&
    isLocale(last.locale) &&
    ["daily", "practice", "archive"].includes(last.mode) &&
    typeof last.date === "string" &&
    validDate(last.date) &&
    (!last.difficulty || isDifficulty(last.difficulty)) &&
    (!last.friendId || /^[A-Za-z0-9_-]{43}$/.test(last.friendId)) &&
    (!last.challengeId ||
      (typeof last.challengeId === "string" &&
        /^[A-Za-z0-9:_-]{1,220}$/.test(last.challengeId)))
  );
}
export function visitPath(visit: Visit, locale: Locale) {
  if (visit.friendId) return `/${locale}/friend/${visit.friendId}`;
  return visit.mode === "practice"
    ? practicePath(locale, visit.game, visit.difficulty)
    : canonicalGamePath(
        locale,
        visit.game,
        visit.mode === "archive" ||
          visit.date !== utcDay() ||
          !hasDaily(visit.game)
          ? visit.date
          : undefined,
        visit.difficulty,
      );
}
export function personalProgress(all: Completion[], current: Completion) {
  const before = all.filter(
    (c) =>
      c.challengeId !== current.challengeId &&
      c.completedAt <= current.completedAt,
  );
  const comparable = before
    .filter(
      (c) =>
        c.provenance === "server" &&
        c.game === current.game &&
        (c.game !== "quiz" && c.game !== "football" || c.knowledgeSet === current.knowledgeSet) &&
        (c.game !== "rareword" || (c.wordLength === current.wordLength && c.maxAttempts === current.maxAttempts)) &&
        modeOf(c) === modeOf(current) &&
        ((c.game !== "word" && c.game !== "rareword" && c.game !== "wordsearch" && c.game !== "quiz") ||
          c.locale === current.locale) &&
        ((c.game !== "sudoku" && c.game !== "mines" && c.game !== "guess") ||
          (c.difficulty ?? c.challengeId.split(":").at(-1)) ===
            (current.difficulty ?? current.challengeId.split(":").at(-1))) &&
        (c.game !== "guess" ||
          (c.numberRules ?? "legacy") === (current.numberRules ?? "legacy")),
    )
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const wins = comparable.filter((c) => c.success);
  const times = wins
    .filter(
      (c) =>
        c.duration >=
          {
            word: 3,
            rareword: 3,
            sudoku: 30,
            math: 5,
            "2048": 10,
            mines: 5,
            wordsearch: 10,
            ranking: 3,
            rather: 3,
            guess: 5,
        quiz: 3,
        football: 3,
          }[c.game] && c.duration <= 86400,
    )
    .map((c) => c.duration);
  const currentTimeValid =
    current.duration >=
      {
        word: 3,
            rareword: 3,
        sudoku: 30,
        math: 5,
        "2048": 10,
        mines: 5,
        wordsearch: 10,
        ranking: 3,
        rather: 3,
        guess: 5,
        quiz: 3,
        football: 3,
      }[current.game] && current.duration <= 86400;
  const attempts = wins.flatMap((c) =>
    c.attempts === undefined ? [] : [c.attempts],
  );
  const mean = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) / values.length;
  const records: ("timeRecord" | "attemptsRecord" | "scoreRecord")[] = [];
  if (current.provenance === "server") {
    if (
      hasResultTimeComparison(current) &&
      current.success &&
      currentTimeValid &&
      times.length &&
      current.duration < Math.min(...times)
    )
      records.push("timeRecord");
    if (
      current.success &&
      (current.game === "word" || current.game === "rareword" || current.game === "guess" || current.game === "football") &&
      current.attempts !== undefined &&
      attempts.length &&
      current.attempts < Math.min(...attempts)
    )
      records.push("attemptsRecord");
    if (
      (current.game === "math" || current.game === "2048" || current.game === "quiz") &&
      comparable.length &&
      current.score > Math.max(...comparable.map((c) => c.score))
    )
      records.push("scoreRecord");
  }
  const previousBadges = achievements(before),
    afterBadges = achievements([...before, current]);
  return {
    records,
    first: !comparable.length,
    attemptsImprovement:
      current.success && current.attempts !== undefined && attempts.length >= 3
        ? Math.max(0, mean(attempts) - current.attempts)
        : null,
    timeImprovement:
      hasResultTimeComparison(current) &&
      current.success &&
      currentTimeValid &&
      times.length >= 3
        ? Math.max(0, mean(times) - current.duration)
        : null,
    badges: (Object.keys(afterBadges) as (keyof typeof afterBadges)[]).filter(
      (key) => afterBadges[key] && !previousBadges[key],
    ),
    history: [...comparable.slice(-9), current],
  };
}
export function personalResultStatistics(
  all: Completion[],
  current: Completion,
) {
  const records = new Map<string, Completion>();
  for (const c of [...all, current]) {
    if (
      c.provenance !== "server" ||
      c.game !== current.game ||
      ((c.game === "quiz" || c.game === "football") && c.knowledgeSet !== current.knowledgeSet) ||
      (c.game === "rareword" && modeOf(current) === "practice" && (c.wordLength !== current.wordLength || c.maxAttempts !== current.maxAttempts)) ||
      modeOf(c) !== modeOf(current)
    )
      continue;
    if (
      (c.game === "word" || c.game === "rareword" || c.game === "wordsearch" || c.game === "quiz") &&
      c.locale !== current.locale
    )
      continue;
    if (
      ["sudoku", "mines", "guess"].includes(c.game) &&
      c.difficulty !== current.difficulty
    )
      continue;
    if (
      c.game === "guess" &&
      (c.numberRules ?? "legacy") !== (current.numberRules ?? "legacy")
    )
      continue;
    records.set(c.challengeId, c);
  }
  return personalStatistics(
    [...records.values()],
    current.game,
    modeOf(current),
  );
}
export function activityDays(
  results: Completion[],
  today = utcDay(),
  game?: GameId,
) {
  const days = new Set(
    results
      .filter((c) => !game || c.game === game)
      .map((c) => utcDay(new Date(c.completedAt))),
  );
  return Array.from({ length: 28 }, (_, i) => {
    const date = utcDay(new Date(Date.parse(today) - (27 - i) * DAY_MS));
    return { date, played: days.has(date) };
  });
}
