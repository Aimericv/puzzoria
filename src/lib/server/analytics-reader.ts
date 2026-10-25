import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError } from "./http";

// A separate capability, never a player/admin session. Production stores only
// the SHA-256 digest of a random 256-bit base64url token held by the collector.
export function requireAnalyticsReader(request: NextRequest) {
  const expected = process.env.ANALYTICS_READER_TOKEN_SHA256 ?? "";
  if (!/^[a-f0-9]{64}$/.test(expected)) throw new ApiError("unavailable", 404);
  const token = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token || !timingSafeEqual(createHash("sha256").update(token).digest(), Buffer.from(expected, "hex")))
    throw new ApiError("unauthorized", 401);
}
