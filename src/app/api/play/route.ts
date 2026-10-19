import type { NextRequest } from "next/server";
import { recordMeasuredRun } from "@/lib/server/measurement";
import { identity, setGuest } from "@/lib/server/auth";
import {
  apiError,
  json,
  readBody,
  ApiError,
  rateLimit,
  requestAddress,
} from "@/lib/server/http";
import {
  beginRun,
  compareRun,
  createRun,
  getRun,
  submitRun,
} from "@/lib/server/play";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("play-read-address:"+requestAddress(request),1200,60000);
    const who = identity(request);
    const value = request.nextUrl.searchParams.get("comparison")
      ? {
          comparison: compareRun(
            request.nextUrl.searchParams.get("runId"),
            who,
          ),
        }
      : getRun(request.nextUrl.searchParams.get("runId"), who);
    return json(value);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  let measuredRun:unknown;
  try {
    const body = await readBody(request),
      who = identity(request);
    measuredRun=body.runId;
    rateLimit(`play-address:${requestAddress(request)}`, 1000, 60000);
    const action = body.action;
    // Hints stay unavailable until an approved unlock mechanism is connected.
    if (action === "hint") throw new ApiError("hintUnavailable", 409);
    const value =
      action === "new"
        ? await createRun(body, who)
        : action === "start"
          ? beginRun(body.runId, who)
          : action === "submit"
            ? submitRun(body.runId, who, body)
            : null;
    if (!value) throw new ApiError("invalid");
    if (action === "start" || action === "submit") {
      recordMeasuredRun(request,body.runId,"run_started");
      if (action === "submit") recordMeasuredRun(request,body.runId,"run_finished");
    }
    const response = json(value);
    setGuest(response, request, who.guestId);
    return response;
  } catch (error) {
    recordMeasuredRun(request,measuredRun,"run_error",error instanceof ApiError?error.status:500);
    return apiError(error);
  }
}
