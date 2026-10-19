import { NextResponse, type NextRequest } from "next/server";
import { getChallenge, publicChallenge, gameAvailable } from "@/lib/challenges";
import { publishedDate, utcDay } from "@/lib/date";
import { isDifficulty, isGameId, isLocale } from "@/lib/types";
import { identity } from "@/lib/server/auth";
import { ApiError, apiError, json, readBody } from "@/lib/server/http";
import { ownedRun, submitRun } from "@/lib/server/play";
import { hasDaily, historicalDailyAvailable, dailyDifficulties } from "@/lib/game-modes";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ locale: string; game: string }> };
async function load(request: NextRequest, context: Context) {
  const { locale, game } = await context.params;
  const date = request.nextUrl.searchParams.get("date") ?? utcDay();
  const difficulty = request.nextUrl.searchParams.get("difficulty") ?? "easy";
  if (
    !isLocale(locale) ||
    !isGameId(game) ||
    !isDifficulty(difficulty) ||
    !publishedDate(date) ||
    !gameAvailable(game, date) ||
    (!hasDaily(game) && !request.nextUrl.searchParams.has("date")) ||
    !historicalDailyAvailable(game, date) ||
    (game === "sudoku" && !dailyDifficulties(game, date).includes(difficulty))
  )
    return null;
  return getChallenge(game, locale, date, difficulty);
}
export async function GET(request: NextRequest, context: Context) {
  const challenge = await load(request, context);
  if (!challenge)
    return NextResponse.json({ error: "unavailable" }, { status: 404 });
  return NextResponse.json(publicChallenge(challenge), {
    headers: { "Cache-Control": "public, max-age=0, must-revalidate" },
  });
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const challenge = await load(request, context);
    if (!challenge)
      return NextResponse.json({ error: "unavailable" }, { status: 404 });
    const body = await readBody(request),
      who = identity(request);
    if (!body.runId) throw new ApiError("notStarted");
    const run = ownedRun(body.runId, who);
    if (run.challenge_id !== challenge.id) throw new ApiError("invalid");
    return json(submitRun(run.id, who, body));
  } catch (error) {
    return apiError(error);
  }
}
