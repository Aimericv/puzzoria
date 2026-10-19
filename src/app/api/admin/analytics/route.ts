import type { NextRequest } from "next/server";
import { analyticsFilters, requireAnalyticsAdmin, siteAnalytics } from "@/lib/server/site-analytics";
import { apiError, json, rateLimit } from "@/lib/server/http";
import { productAnalytics } from "@/lib/server/product-analytics";
import { analyticsExport } from "@/lib/server/analytics-export";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    const user = requireAnalyticsAdmin(request);
    rateLimit(`analytics-admin:${user.id}`, 30, 60000);
    const now = new Date();
    const data = siteAnalytics(analyticsFilters(request.nextUrl.searchParams), now);
    if (request.nextUrl.searchParams.get("format") === "json") {
      const response = json(analyticsExport(data, productAnalytics(data.filters, now), now));
      response.headers.set("Content-Disposition", `attachment; filename="puzzoria-analytics-${data.from}-${data.to}.json"`);
      response.headers.set("X-Robots-Tag", "noindex");
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    }
    if (request.nextUrl.searchParams.get("format") === "csv") {
      const traffic=request.nextUrl.searchParams.get("dataset")==="visits";
      const csv = traffic?["day,sessions,visitors,page_views,active_seconds",...productAnalytics(data.filters, now).daily.map(r=>[r.day,r.sessions,r.visitors,r.views,r.activeSeconds].join(","))].join("\r\n"):["day,players,starts,finishes,pending,dormant", ...data.daily.map((r) => [r.day,r.players,r.starts,r.finishes,r.pending,r.dormant].join(","))].join("\r\n");
      return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="analytics-${data.from}-${data.to}.csv"`, "Cache-Control": "private, no-store", "Vary": "Cookie", "X-Robots-Tag": "noindex" } });
    }
    return json({...data,product:productAnalytics(data.filters, now)});
  } catch (error) { return apiError(error); }
}
