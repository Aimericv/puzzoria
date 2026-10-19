import { NextResponse, type NextRequest } from "next/server";
import { isDifficulty, isGameId, isLocale } from "@/lib/types";
import { isLoopback } from "@/lib/local-preview";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || !isLoopback(request.nextUrl.hostname))
    return new NextResponse(null, {status: 404});
  const game = request.nextUrl.searchParams.get("game") ?? "", locale = request.nextUrl.searchParams.get("locale") ?? "", difficulty = request.nextUrl.searchParams.get("difficulty") ?? "easy";
  const mode = request.nextUrl.searchParams.get("mode") ?? "practice";
  if (!isGameId(game) || !isLocale(locale) || !isDifficulty(difficulty)) return new NextResponse(null, {status: 400});
  if (mode !== "daily" && mode !== "practice" && mode !== "archive") return new NextResponse(null, {status: 400});
  const {localPreviewFixture} = await import("@/lib/server/dev-preview");
  let challenge;
  let progress;
  const runId = request.nextUrl.searchParams.get("runId");
  if (runId) {
    const {ownedRun} = await import("@/lib/server/play"), {identity} = await import("@/lib/server/auth");
    try {const run = ownedRun(runId, identity(request)); challenge = JSON.parse(run.challenge_json); progress = JSON.parse(run.progress_json);}
    catch {return new NextResponse(null,{status:404});}
    if (challenge.kind !== game || challenge.locale !== locale) return new NextResponse(null,{status:400});
  }
  return NextResponse.json(localPreviewFixture(game, locale, difficulty, mode, challenge, progress), {headers: {"Cache-Control": "no-store", "X-Robots-Tag": "noindex"}});
}
