import type { NextRequest } from "next/server";
import { isDifficulty, isGameId, isLocale } from "@/lib/types";
import {
  dimensions,
  leaderboard,
  periods,
  type Dimension,
  type Period,
} from "@/lib/server/leaderboards";
import { apiError, ApiError, json } from "@/lib/server/http";
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams,
      game = q.get("game") ?? "word",
      locale = q.get("locale") ?? "en",
      difficulty = q.get("difficulty") ?? "easy",
      period = q.get("period") ?? "today",
      dimension = q.get("dimension") ?? "performance";
    if (
      !isGameId(game) ||
      !isLocale(locale) ||
      !isDifficulty(difficulty) ||
      !periods.includes(period as Period) ||
      !dimensions.includes(dimension as Dimension)
    )
      throw new ApiError("invalid");
    return json({
      entries: leaderboard(
        game,
        locale,
        difficulty,
        period as Period,
        dimension as Dimension,
      ),
      minimumGames: dimension === "winRate" ? 10 : 1,
    });
  } catch (error) {
    return apiError(error);
  }
}
