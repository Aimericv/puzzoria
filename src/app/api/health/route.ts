import { database } from "@/lib/server/database";
import { deploymentReady } from "@/lib/server/deployment";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() {
  try {
    if(!deploymentReady()) throw new Error("Public origin/proxy configuration incomplete");
    database().prepare("SELECT 1").get();
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
}
