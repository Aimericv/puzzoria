import type { Completion, GameId } from "./types";
import { previousDay, utcDay } from "./date";
export function streaks(
  completions: Completion[],
  today = utcDay(),
): { current: number; best: number } {
  const days = [
    ...new Set(
      completions
        .filter(
          (c) =>
            (c.mode === undefined || c.mode === "daily") &&
            utcDay(new Date(c.completedAt)) === c.date &&
            c.date <= today,
        )
        .map((c) => c.date),
    ),
  ].sort();
  let best = 0,
    run = 0,
    previous = "";
  for (const day of days) {
    run = previous === previousDay(day) ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  let cursor = days.includes(today) ? today : previousDay(today),
    current = 0;
  while (days.includes(cursor)) {
    current++;
    cursor = previousDay(cursor);
  }
  return { current, best };
}
export function finishedToday(
  completions: Completion[],
  today = utcDay(),
): GameId[] {
  return [
    ...new Set(
      completions
        .filter(
          (c) =>
            (c.mode === undefined || c.mode === "daily") &&
            c.date === today &&
            utcDay(new Date(c.completedAt)) === today,
        )
        .map((c) => c.game),
    ),
  ];
}
export function addCompletion(
  completions: Completion[],
  completion: Completion,
): Completion[] {
  return completions.some((c) => c.challengeId === completion.challengeId)
    ? completions
    : [...completions, completion];
}
