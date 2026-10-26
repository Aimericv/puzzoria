import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/agent/analytics/route";
import { GET as adminGET } from "../src/app/api/admin/analytics/route";
import { closeDatabase, database } from "../src/lib/server/database";
import { digest } from "../src/lib/server/http";

const token="a".repeat(43), other="b".repeat(43);
const now=new Date("2026-10-10T12:00:00.000Z");
const request=(credential:string|null=token,query="",cookie="")=>new NextRequest(`http://localhost/api/agent/analytics${query}`,{
  headers:{...(credential===null?{}:{Authorization:`Bearer ${credential}`}),Cookie:cookie},
});
beforeEach(()=>{
  closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");
  vi.stubEnv("ANALYTICS_READER_TOKEN_SHA256",digest(token));vi.stubEnv("ANALYTICS_ADMIN_USERNAMES","admin");
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});

it("is disabled without a valid configured digest, even with a credential",async()=>{
  for(const value of ["",token,"bad", "z".repeat(64)]) {
    vi.stubEnv("ANALYTICS_READER_TOKEN_SHA256",value);
    const response=await GET(request());expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  }
});
it("requires the separate Bearer capability and never promotes it to admin access",async()=>{
  for(const value of [null,"",other,"short"]) expect((await GET(request(value))).status).toBe(401);
  expect((await GET(request(null,`?token=${token}`))).status).toBe(401);
  const unauthenticated=await GET(request(null,"","dailygrid-session=fake-admin-session"));
  expect(unauthenticated.status).toBe(401);expect(unauthenticated.headers.get("www-authenticate")).toBe("Bearer");
  expect((await adminGET(request())).status).toBe(403);
  expect((await GET(request())).status).toBe(200);
});
it("returns the existing versioned aggregates without player identities, secrets or cookies",async()=>{
  database().prepare("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,?,?)").run("private-user","private-login","private-display","private-hash",now.toISOString());
  database().prepare("INSERT INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,started_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)")
    .run("private-run","private-owner","private-user","private-device","private-challenge","word","daily",JSON.stringify({locale:"fr",answer:"SECRET"}),now.toISOString(),now.toISOString());
  const response=await GET(request(token,"?days=7&game=word&locale=fr&mode=daily"));
  expect(response.status).toBe(200);
  expect(response.headers.get("vary")).toBe("Authorization");expect(response.headers.get("set-cookie")).toBeNull();
  expect(response.headers.get("x-robots-tag")).toBe("noindex");expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  const data=await response.json();expect(data).toMatchObject({schema:"puzzoria.analytics",schemaVersion:1,generatedAt:now.toISOString(),timezone:"UTC",
    filters:{days:7,game:"word",puzzleLocale:"fr",mode:"daily"},period:{currentDayIsPartial:true},report:{official:{totals:{starts:1}},product:{ads:{revenue:null}}}});
  for(const secret of [token,"private-user","private-login","private-display","private-hash","private-run","private-owner","private-device","SECRET"])
    expect(JSON.stringify(data)).not.toContain(secret);
});
it("rejects unsupported and duplicate filters rather than accepting arbitrary operations",async()=>{
  for(const query of ["?days=1","?days=7&days=90","?game=unknown","?format=csv","?action=delete","?token=anything"])
    expect((await GET(request(token,query))).status).toBe(400);
});
it("revokes the old credential immediately on rotation and closes when disabled",async()=>{
  expect((await GET(request())).status).toBe(200);
  vi.stubEnv("ANALYTICS_READER_TOKEN_SHA256",digest(other));
  expect((await GET(request())).status).toBe(401);expect((await GET(request(other))).status).toBe(200);
  vi.stubEnv("ANALYTICS_READER_TOKEN_SHA256","");expect((await GET(request(other))).status).toBe(404);
});
it("bounds authenticated aggregation work without letting unauthenticated calls consume its allowance",async()=>{
  for(let i=0;i<8;i++) expect((await GET(request(other))).status).toBe(401);
  for(let i=0;i<6;i++) expect((await GET(request())).status).toBe(200);
  expect((await GET(request())).status).toBe(429);
  vi.setSystemTime(new Date(now.getTime()+60001));expect((await GET(request())).status).toBe(200);
});
