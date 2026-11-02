import { streaks } from "./stats";
import type { Completion, GameId, PlayMode } from "./types";
export const COMPARISON_MIN_SAMPLES = 20;
export const WIN_RATE_MIN_GAMES = 10;
export const modeOf = (result: Completion): PlayMode => result.mode ?? "daily";
export function personalStatistics(
  results: Completion[],
  game: GameId,
  mode: PlayMode,
) {
  const played = results.filter((r) => r.game === game && modeOf(r) === mode);
  const wins = played.filter((r) => r.success);
  const times = wins.map((r) => r.duration);
  const attempts = wins.flatMap((r) =>
    r.attempts === undefined ? [] : [r.attempts],
  );
  const distances = played.flatMap(r => r.mathDistance === undefined ? [] : [r.mathDistance]);
  const tiles = played.flatMap(r => r.largestTile === undefined ? [] : [r.largestTile]);
  const average = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  let current = 0,
    best = 0;
  for (const result of [...played].sort((a, b) =>
    a.completedAt.localeCompare(b.completedAt),
  )) {
    current = result.success ? current + 1 : 0;
    best = Math.max(best, current);
  }
  const streak = mode === "daily" ? streaks(played) : { current, best };
  return {
    played: played.length,
    won: wins.length,
    winRate: played.length ? (wins.length / played.length) * 100 : null,
    currentStreak: streak.current,
    bestStreak: streak.best,
    averageTime: average(times),
    bestTime: times.length ? Math.min(...times) : null,
    averageAttempts: average(attempts),
    averageScore: average(played.map(r=>r.score)),
    bestScore: played.length ? Math.max(...played.map((r) => r.score)) : null,
    bestAttempts: attempts.length ? Math.min(...attempts) : null,
    bestDistance: distances.length ? Math.min(...distances) : null,
    averageDistance: average(distances),
    largestTile: tiles.length ? Math.max(...tiles) : null,
  };
}
export function comparisonStatistics(
  samples: Completion[],
  current: Completion,
) {
  // Never compare a result to itself. Cohort selection is performed by the server.
  const others = samples.filter(
    (r) => r.runId !== current.runId || !current.runId,
  );
  if (others.length < COMPARISON_MIN_SAMPLES) return null;
  const won = others.filter((r) => r.success);
  const median = (values: number[]) => {
    const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
    return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2 : null;
  };
  const distances = others.filter(r=>r.mathDistance!==undefined);
  const mean = (values: number[]) =>
    values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const counts = new Map<number, number>();
  won.forEach((r) => {
    if (r.attempts !== undefined)
      counts.set(r.attempts, (counts.get(r.attempts) ?? 0) + 1);
  });
  const maxCount = Math.max(0, ...counts.values());
  const commonAttempts = [...counts]
    .filter(([, count]) => count === maxCount)
    .map(([n]) => n)
    .sort((a, b) => a - b);
  return {
    samples: others.length,
    medianTime: won.length >= COMPARISON_MIN_SAMPLES ? median(won.map(r=>r.duration)) : null,
    attemptDistribution: won.length >= COMPARISON_MIN_SAMPLES ? [...won.reduce((counts,r)=>{
      if(r.attempts!==undefined) counts.set(r.attempts,(counts.get(r.attempts)??0)+1);
      return counts;
    },new Map<number,number>())].sort((a,b)=>a[0]-b[0]).map(([attempts,count])=>({attempts,count,percent:count*100/won.length})) : [],
    precisionSamples: distances.length,
    fewerAttemptsThanPercent: current.success && current.attempts!==undefined && won.length>=COMPARISON_MIN_SAMPLES && won.every(r=>r.attempts!==undefined)
      ? won.filter(r=>r.attempts!>current.attempts!).length*100/won.length : null,
    closerThanPercent: current.game === "math" && current.mathDistance!==undefined && distances.length>=COMPARISON_MIN_SAMPLES
      ? distances.filter(r=>r.mathDistance!>current.mathDistance!).length*100/distances.length : null,
    betterScoreThanPercent:
      (current.game === "2048" || current.game === "quiz")
        ? (others.filter((r) => r.score < current.score).length /
            others.length) *
          100
        : null,
    successes: won.length,
    successRate: (won.length / others.length) * 100,
    averageTime:
      current.game !== "2048" && won.length >= COMPARISON_MIN_SAMPLES
        ? mean(won.map((r) => r.duration))
        : null,
    fasterThanPercent:
      current.game !== "2048" &&
      current.success &&
      won.length >= COMPARISON_MIN_SAMPLES
        ? (won.filter((r) => r.duration > current.duration).length /
            won.length) *
          100
        : null,
    averageAttempts:
      counts.size && won.length >= COMPARISON_MIN_SAMPLES
        ? mean(won.map((r) => r.attempts!))
        : null,
    fewerAttemptsThanAverage:
      current.success &&
      current.attempts !== undefined &&
      won.length >= COMPARISON_MIN_SAMPLES &&
      won.every((r) => r.attempts !== undefined)
        ? Math.max(0, mean(won.map((r) => r.attempts!))! - current.attempts)
        : null,
    commonAttempts: won.length >= COMPARISON_MIN_SAMPLES ? commonAttempts : [],
  };
}
type ComputedComparison = NonNullable<ReturnType<typeof comparisonStatistics>>;
type AddedMetrics = "medianTime" | "attemptDistribution" | "precisionSamples" | "closerThanPercent" | "fewerAttemptsThanPercent";
export type Comparison = Omit<ComputedComparison, AddedMetrics> & Partial<Pick<ComputedComparison, AddedMetrics>> & {source?: "starter"};
export function achievements(results: Completion[]) {
  const wins = results.filter((r) => r.success).length;
  const games = new Set(results.filter((r) => r.success).map((r) => r.game))
    .size;
  return {
    firstWin: wins >= 1,
    explorer: games >= 3,
    tenWins: wins >= 10,
    weekStreak: streaks(results).best >= 7,
  };
}
