import { createHash, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import { database } from "./database";
import { deploymentReady } from "./deployment";
import { recordServerError } from "./operational-errors";

export class ApiError extends Error {
  constructor(
    public code: string,
    public status = 400,
  ) {
    super(code);
  }
}
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const randomToken = () => randomBytes(32).toString("base64url");
export function rateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
) {
  // Expired buckets are transient security state, never game history.
  database().prepare("DELETE FROM rate_limits WHERE resets_at<=?").run(now);
  database().prepare("DELETE FROM sessions WHERE expires_at<=?").run(now);
  const row = database()
    .prepare(
      `INSERT INTO rate_limits(bucket,count,resets_at) VALUES (?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=CASE WHEN resets_at <= ? THEN 1 ELSE count+1 END,
    resets_at=CASE WHEN resets_at <= ? THEN excluded.resets_at ELSE resets_at END RETURNING count`,
    )
    .get(digest(bucket), now + windowMs, now, now) as { count: number };
  if (row.count > limit) throw new ApiError("rateLimited", 429);
}
export function requestAddress(request: NextRequest) {
  if(!deploymentReady()) throw new ApiError("unavailable",503);
  // Only enable behind a proxy that overwrites (never appends untrusted) X-Forwarded-For.
  if(process.env.TRUST_PROXY!=="true") return "direct";
  const address=request.headers.get("x-forwarded-for")?.trim();
  // A configured proxy must overwrite with one actual peer address, not an appended chain.
  return address && isIP(address) ? address.toLowerCase() : "unknown";
}
export function sameOrigin(request: NextRequest) {
  if(!deploymentReady()) throw new ApiError("unavailable",503);
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  const expectedOrigin =
    process.env.AUTH_ORIGIN ??
    `${request.nextUrl.protocol}//${request.headers.get("host") ?? request.nextUrl.host}`;
  if (site === "cross-site" || (origin && origin !== expectedOrigin))
    throw new ApiError("forbidden", 403);
  // Non-browser clients omit Origin; they still need the opaque owner/session cookie.
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ApiError("invalid", 415);
}
export async function readBody(
  request: NextRequest,
  maxBytes = 8000,
): Promise<Record<string, unknown>> {
  sameOrigin(request);
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new ApiError("invalid", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("invalid");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new ApiError("invalid", 413);
    }
    chunks.push(value);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new ApiError("invalid");
  }
}
export function json(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export function apiError(error: unknown) {
  if (!(error instanceof ApiError) || error.status >= 500) recordServerError();
  if (error instanceof ApiError)
    return json({ error: error.code }, error.status);
  console.error(
    "Puzzoria API failure:",
    error instanceof Error ? error.message : "unknown",
  );
  return json({ error: "networkError" }, 500);
}
export function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    secure:
      process.env.NODE_ENV === "production" ||
      request.nextUrl.protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
