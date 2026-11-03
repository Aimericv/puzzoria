import type { GameId, Locale, Difficulty } from "../types";
import { utcDay, DAY_MS } from "../date";
import { streaks } from "../stats";
import { WIN_RATE_MIN_GAMES } from "../statistics";
import { database } from "./database";
import { completionFromRow, type ResultRow } from "./results";
export const periods = ["today", "week", "month", "all"] as const;
export const dimensions = [
  "performance",
  "winRate",
  "streak",
  "speed",
  "score",
] as const;
export type Period = (typeof periods)[number];
export type Dimension = (typeof dimensions)[number];
export type LeaderboardEntry = {
  displayName: string;
  played: number;
  value: number;
  rank: number;
};
export function leaderboard(
  game: GameId,
  locale: Locale,
  difficulty: Difficulty,
  period: Period,
  dimension: Dimension,
  now = new Date(),
): LeaderboardEntry[] {
  const today = utcDay(now),
    days =
      period === "today"
        ? 1
        : period === "week"
          ? 7
          : period === "month"
            ? 30
            : 0;
  const cutoff = days
    ? new Date(
        Date.parse(`${today}T00:00:00Z`) - (days - 1) * DAY_MS,
      ).toISOString()
    : "";
  const rows = database()
    .prepare(
      `SELECT r.*,u.display_name FROM results r JOIN users u ON u.id=r.user_id
    WHERE r.game=? AND r.mode='daily' AND r.provenance='server' AND r.eligible=1 AND r.completed_at>=? AND r.date<=?
    AND (r.game NOT IN ('word','rareword','wordsearch') OR r.locale=?) AND (r.game NOT IN ('sudoku','mines','guess') OR r.difficulty=?) ORDER BY r.completed_at`,
    )
    .all(game, cutoff, today, locale, difficulty) as (ResultRow & {
    display_name: string;
  })[];
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const group = groups.get(row.user_id!) ?? [];
    group.push(row);
    groups.set(row.user_id!, group);
  }
  const entries: Omit<LeaderboardEntry, "rank">[] = [];
  for (const group of groups.values()) {
    const won = group.filter((r) => r.success),
      played = group.length;
    if (
      (dimension === "winRate" && played < WIN_RATE_MIN_GAMES) ||
      (dimension === "speed" && !won.length)
    )
      continue;
    const value =
      dimension === "winRate"
        ? (won.length / played) * 100
        : dimension === "speed"
          ? won.reduce((sum, r) => sum + r.duration, 0) / won.length
          : dimension === "streak"
            ? streaks(group.map(completionFromRow), today).current
            : dimension === "score"
              ? group.reduce((sum, r) => sum + r.score, 0) / played
              : group.reduce(
                  (sum, r) =>
                    sum +
                    (game === "2048"
                      ? r.score
                      : r.success
                        ? game === "word"
                          ? (7 - (r.attempts ?? 6)) * 100
                          : game === "math" || game === "rareword" || game === "football"
                            ? r.score
                            : 1000
                        : 0),
                  0,
                ) / played;
    entries.push({ displayName: group[0].display_name, played, value });
  }
  const sorted = entries.sort(
    (a, b) =>
      (dimension === "speed" ? a.value - b.value : b.value - a.value) ||
      b.played - a.played ||
      a.displayName.localeCompare(b.displayName),
  );
  let rank = 0,
    previous: number | undefined;
  return sorted.slice(0, 100).map((entry, index) => {
    if (entry.value !== previous) rank = index + 1;
    previous = entry.value;
    return { ...entry, rank };
  });
}
