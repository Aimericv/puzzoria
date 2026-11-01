import type { GameId, ResultDetails } from "./types";

// Whitelisted presentation data. Missing historical values stay unknown.
export function readResultDetails(game: GameId, value: unknown): ResultDetails {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>, details: ResultDetails = {};
  const keys: (keyof ResultDetails)[] = game === "math"
    ? ["mathTarget", "mathValue", "mathDistance", "operations"]
    : game === "2048" ? ["largestTile", "moves"]
    : game === "wordsearch" ? ["wordsFound", "wordsTotal"]
    : game === "quiz" ? ["answersFound", "answersTotal"]
    : game === "guess" ? ["botAttempts"]
    : game === "rather" || game === "ranking" ? ["choicesCount"] : [];
  for (const key of keys) {
    const n = row[key];
    if (typeof n === "number" && Number.isFinite(n) && (key === "mathValue" || n >= 0)) details[key] = n;
  }
  return details;
}
