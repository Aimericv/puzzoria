import type { NextRequest } from "next/server";
import { recordMeasuredRoom } from "@/lib/server/measurement";
import { identity, setGuest } from "@/lib/server/auth";
import {
  apiError,
  ApiError,
  json,
  readBody,
  rateLimit,
  requestAddress,
} from "@/lib/server/http";
import {
  createRoom,
  joinRoom,
  getRoom,
  actRoom,
} from "@/lib/server/number-rooms";
import { isLocale } from "@/lib/types";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("room-read-address:"+requestAddress(request),1200,60000);
    const who = identity(request);
    rateLimit("room-read:" + who.owner, 180, 60000);
    const data=getRoom(request.nextUrl.searchParams.get("code"), who);
    recordMeasuredRoom(request,data.code);
    return json(data);
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request),
      who = identity(request);
    rateLimit("room-address:" + requestAddress(request), 600, 60000);
    const locale =
      typeof body.locale === "string" && isLocale(body.locale)
        ? body.locale
        : "en";
    const data =
      body.action === "create"
        ? createRoom(who, locale)
        : body.action === "join"
          ? joinRoom(body.code, who, locale)
          : body.action === "play"
            ? actRoom(body.code, who, body)
            : null;
    if (!data) throw new ApiError("invalid");
    recordMeasuredRoom(request,data.code);
    const response = json(data);
    setGuest(response, request, who.guestId);
    return response;
  } catch (e) {
    return apiError(e);
  }
}
