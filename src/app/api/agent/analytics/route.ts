import type { NextRequest } from "next/server";
import { requireAnalyticsReader } from "@/lib/server/analytics-reader";
import { analyticsFilters, siteAnalytics } from "@/lib/server/site-analytics";
import { productAnalytics } from "@/lib/server/product-analytics";
import { analyticsExport } from "@/lib/server/analytics-export";
import { ApiError, apiError, json, rateLimit } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  let response: Response;
  try {
    requireAnalyticsReader(request);
    const allowed = new Set(["days", "game", "locale", "interface_locale", "mode"]);
    for (const key of request.nextUrl.searchParams.keys()) {
      if (!allowed.has(key) || request.nextUrl.searchParams.getAll(key).length !== 1) throw new ApiError("invalid");
    }
    const filters = analyticsFilters(request.nextUrl.searchParams);
    // Protect SQLite aggregation on the shared product VPS; this is not an
    // experiment budget. The supervisor collects three reports per session.
    rateLimit("analytics-reader", 6, 60000);
    const now = new Date();
    response = json(analyticsExport(siteAnalytics(filters, now), productAnalytics(filters, now), now));
  } catch (error) {
    response = apiError(error);
  }
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Authorization");
  response.headers.set("X-Robots-Tag", "noindex");
  response.headers.set("X-Content-Type-Options", "nosniff");
  if (response.status === 401) response.headers.set("WWW-Authenticate", "Bearer");
  return response;
}
