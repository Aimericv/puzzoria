import type { NextRequest } from "next/server";
import { identity, setGuest } from "@/lib/server/auth";
import {
  apiError,
  json,
  readBody,
  rateLimit,
  requestAddress,
  ApiError,
} from "@/lib/server/http";
import {
  createLive,
  readLive,
  liveAction,
  liveRun,
  submitLive,
  draftLive,
} from "@/lib/server/live-rooms";
import {
  recordMeasuredRun,
  recordMeasuredLive,
} from "@/lib/server/measurement";
import type { LiveView } from "@/lib/live-types";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("live-read:" + requestAddress(request), 300, 60000);
    const who = identity(request),
      code = request.nextUrl.searchParams.get("code");
    if (request.nextUrl.searchParams.has("runId"))
      return json(
        liveRun(code, who, request.nextUrl.searchParams.get("runId")),
      );
    const initial = readLive(code, who, true);
    recordMeasuredLive(request, initial);
    if (!request.nextUrl.searchParams.has("stream")) return json(initial);
    if (initial.you === -1) throw new ApiError("forbidden", 403);
    const encoder = new TextEncoder();
    let close: () => void;
    const stream = new ReadableStream({
      start(controller) {
        let stopped = false;
        close = () => {
          if (stopped) return;
          stopped = true;
          clearInterval(timer);
          clearTimeout(lifetime);
          request.signal.removeEventListener("abort", close);
          try {
            controller.close();
          } catch {
            /* Already cancelled by the browser. */
          }
        };
        const send = () => {
          if (stopped) return;
          try {
            // Revalidate revoked sessions and seat ownership on every emission.
            const value = readLive(code, identity(request), true);
            if (value.you === -1) return close();
            recordMeasuredLive(request, value);
            controller.enqueue(
              encoder.encode(
                `retry: 500\nevent: state\ndata: ${JSON.stringify(value)}\n\n`,
              ),
            );
          } catch {
            close();
          }
        };
        const timer = setInterval(send, 1000),
          lifetime = setTimeout(close, 25000);
        request.signal.addEventListener("abort", close, { once: true });
        send();
      },
      cancel() {
        close?.();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
        "X-Accel-Buffering": "no",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request),
      who = identity(request);
    rateLimit("live-write:" + requestAddress(request), 1500, 60000);
    const value =
      body.action === "create"
        ? createLive(body, who)
        : body.action === "run"
          ? liveRun(body.code, who, body.runId)
          : body.action === "submit"
            ? submitLive(body.code, who, body)
            : body.action === "draft"
              ? draftLive(body.code, who, body)
              : liveAction(body.code, who, body);
    if (body.action === "submit" || body.action === "run") {
      recordMeasuredRun(request, body.runId, "run_started");
      recordMeasuredRun(request, body.runId, "run_finished");
    }
    if (
      ["create", "join", "ready", "rematch", "resign"].includes(
        String(body.action),
      )
    )
      recordMeasuredLive(
        request,
        value as LiveView,
        body.action === "create"
          ? "duel_created"
          : body.action === "join"
            ? "duel_joined"
            : body.action === "rematch"
              ? "duel_rematch"
              : undefined,
      );
    const response = json(value);
    setGuest(response, request, who.guestId);
    return response;
  } catch (e) {
    return apiError(e);
  }
}
