import type { NextRequest } from "next/server";
import { collectMeasurement } from "@/lib/server/measurement";
import { apiError, json, readBody, rateLimit, requestAddress } from "@/lib/server/http";
export const runtime="nodejs";
export async function POST(request:NextRequest) {
  try {
    const body=await readBody(request,24000);
    rateLimit(`measurement-address:${requestAddress(request)}`,1200,60000);
    rateLimit(`measurement:${request.cookies.get("dailygrid-guest")?.value ?? requestAddress(request)}`,120,60000);
    const response=json({accepted:0});
    const result=collectMeasurement(request,response,body);
    return new Response(JSON.stringify(result),{status:200,headers:response.headers});
  } catch(error) {return apiError(error);}
}
