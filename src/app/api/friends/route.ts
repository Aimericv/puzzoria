import type { NextRequest } from "next/server";
import { identity, setGuest } from "@/lib/server/auth";
import {
  json,
  apiError,
  readBody,
  ApiError,
  rateLimit,
  requestAddress,
} from "@/lib/server/http";
import { createFriend, joinFriend, viewFriend } from "@/lib/server/friends";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("friend-read-address:"+requestAddress(request),600,60000);
    return json(
      viewFriend(request.nextUrl.searchParams.get("id"), identity(request)),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request),
      who = identity(request);
    rateLimit(`friend-address:${requestAddress(request)}`, 200, 60000);
    const data =
      body.action === "create"
        ? createFriend(body.runId, who)
        : body.action === "join"
          ? joinFriend(body.id, who)
          : null;
    if (!data) throw new ApiError("invalid");
    const response = json(data);
    setGuest(response, request, who.guestId);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
