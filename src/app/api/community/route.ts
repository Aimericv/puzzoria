import type { NextRequest } from "next/server";
import { identity } from "@/lib/server/auth";
import { ownedRun } from "@/lib/server/play";
import { apiError, ApiError, json, rateLimit, requestAddress } from "@/lib/server/http";
import { socialCommunity } from "@/lib/server/community";
import type { SocialChallenge, SocialState } from "@/lib/social-types";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("community-address:"+requestAddress(request),1200,60000);
    const who = identity(request);
    rateLimit("community:" + who.owner, 180, 60000);
    const run = ownedRun(request.nextUrl.searchParams.get("runId"), who);
    if (!["ranking", "rather", "guess"].includes(run.game))
      throw new ApiError("invalid");
    const state = JSON.parse(run.progress_json).state as
      | SocialState
      | undefined;
    return json({
      sequence: state?.moves ?? 0,
      community: state
        ? socialCommunity(
            JSON.parse(run.challenge_json) as SocialChallenge,
            state,
            who.owner,
          )
        : null,
    });
  } catch (error) {
    return apiError(error);
  }
}
