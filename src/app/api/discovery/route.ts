import type { NextRequest } from "next/server";
import { identity } from "@/lib/server/auth";
import { apiError, json, rateLimit, requestAddress } from "@/lib/server/http";
import { discoverRun } from "@/lib/server/discovery";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("discovery-address:"+requestAddress(request),300,60000);
    return json(
      await discoverRun(
        request.nextUrl.searchParams.get("runId"),
        identity(request),
      ),
    );
  } catch (error) {
    return apiError(error);
  }
}
