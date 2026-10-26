import {createHash} from "node:crypto";

export const ANALYTICS_URL="https://puzzoria.com/api/agent/analytics";
export const ANALYTICS_FILE="/opt/puzzoria-pilot/readonly/puzzoria-analytics.json";
const maximum=2*1024*1024;

async function readReport(response,days,token,now) {
  if(!response.ok) throw new Error(`http_${response.status}`);
  if(!response.headers.get("content-type")?.includes("application/json")) throw new Error("invalid_content_type");
  if(Number(response.headers.get("content-length"))>maximum) throw new Error("report_too_large");
  const reader=response.body?.getReader();if(!reader) throw new Error("missing_body");
  let bytes=0;const chunks=[];
  try {
    while(true) {
      const {done,value}=await reader.read();if(done) break;
      bytes+=value.byteLength;if(bytes>maximum) throw new Error("report_too_large");chunks.push(value);
    }
  } finally {await reader.cancel().catch(()=>{});}
  const text=Buffer.concat(chunks).toString("utf8");
  if(text.includes(token)) throw new Error("credential_in_response");
  let report;try{report=JSON.parse(text);}catch{throw new Error("invalid_json");}
  const generated=Date.parse(report.generatedAt);
  if(report.schema!=="puzzoria.analytics" || report.schemaVersion!==1 || report.timezone!=="UTC" || report.filters?.days!==days ||
     !report.period?.from || !report.period?.to || !report.definitions || !report.report?.official || !report.report?.product ||
     !Number.isFinite(generated) || generated>now+60000 || now-generated>10*60000) throw new Error("invalid_or_stale_report");
  return report;
}

// Only the trusted supervisor calls this. Neither credentials nor authenticated
// network access are delegated to the model; redirects never receive the token.
export async function collectAnalytics({token,fetchImpl=fetch,now=Date.now()}={}) {
  const base={schemaVersion:1,source:ANALYTICS_URL,fetchedAt:new Date(now).toISOString()};
  if(!token) return {...base,status:"not_configured",reports:null};
  if(!/^[A-Za-z0-9_-]{43}$/.test(token)) return {...base,status:"unavailable",reason:"invalid_credential",reports:null};
  try {
    const reports={};
    for(const days of [7,30,90]) {
      const response=await fetchImpl(`${ANALYTICS_URL}?days=${days}`,{headers:{Authorization:`Bearer ${token}`,Accept:"application/json"},redirect:"error",signal:AbortSignal.timeout(15000)});
      reports[days]=await readReport(response,days,token,now);
    }
    return {...base,status:"available",reports,sha256:createHash("sha256").update(JSON.stringify(reports)).digest("hex")};
  } catch(error) {
    const reason=/^(http_\d{3}|invalid_content_type|report_too_large|missing_body|credential_in_response|invalid_json|invalid_or_stale_report)$/.test(error.message)?error.message:"request_failed";
    return {...base,status:"unavailable",reason,reports:null};
  }
}
