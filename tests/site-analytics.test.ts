import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { database, closeDatabase } from "../src/lib/server/database";
import { analyticsFilters, requireAnalyticsAdmin, siteAnalytics } from "../src/lib/server/site-analytics";
import { digest } from "../src/lib/server/http";
import { GET } from "../src/app/api/admin/analytics/route";
const now = new Date("2026-10-10T12:00:00.000Z");
let sequence=0;
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.stubEnv("ANALYTICS_ADMIN_USERNAMES","admin");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);sequence=0;});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});
function addRun(owner:string,day:string,{game="word",locale="fr",mode="daily",finished,provenance="server",started=true,userId=null}:{game?:string;locale?:string;mode?:string;finished?:string;provenance?:string;started?:boolean;userId?:string|null}={}){
  const id=`run-${sequence++}`;
  database().prepare(`INSERT INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,started_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).run(id,owner,userId,"guest",id,game,mode,JSON.stringify({locale}),started?`${day}T10:00:00.000Z`:null,`${day}T09:00:00.000Z`);
  if(finished) database().prepare(`INSERT INTO results(id,user_id,owner,game,mode,challenge_id,date,locale,completed_at,duration,success,score,provenance) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(`result-${id}`,userId,owner,game,mode,id,day,locale,`${finished}T11:00:00.000Z`,60,1,100,provenance);
}
function account(username:string,displayName=username){
  database().prepare("INSERT INTO users VALUES(?,?,?,?,?)").run(username,username,displayName,"test-fixture",now.toISOString());
  const token=`test-private-token-${username}`;
  database().prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(digest(token),username,now.getTime()+60000,now.toISOString());
  return `dailygrid-session=${token}`;
}
const request=(cookie="",query="")=>new NextRequest(`http://localhost:3000/api/admin/analytics${query}`,{headers:{cookie}});
it("counts server starts and their verified finishes without importing results or counting reservations",()=>{
  addRun("g:one","2026-10-02",{finished:"2026-10-03"});
  addRun("g:one","2026-10-04",{mode:"practice",finished:"2026-10-05"});
  addRun("g:two","2026-10-02",{finished:"2026-10-03",provenance:"imported"});
  addRun("g:two","2026-10-10",{game:"sudoku",locale:"en"});
  addRun("g:reserved","2026-10-03",{started:false});
  addRun("g:future","2026-10-11",{finished:"2026-10-11"});
  account("admin");addRun("u:admin","2026-10-02",{userId:"admin",finished:"2026-10-03"});
  const result=siteAnalytics({days:30},now);
  expect(result.totals).toEqual({players:2,starts:4,finishes:2,pending:1,dormant:1});
  expect(result.daily).toHaveLength(30);
  expect(result.games.find(g=>g.game==="word")).toMatchObject({starts:3,finishes:2,players:2});
  expect(JSON.stringify(result)).not.toContain("g:one");
  expect(JSON.stringify(result)).not.toContain("test-private-token");
  expect(siteAnalytics({days:30,game:"word",locale:"fr",mode:"practice"},now).totals.starts).toBe(1);
  expect(siteAnalytics({days:7},now).totals.finishes).toBe(1);
});
it("uses distinct players, exact UTC return days and fully elapsed observation windows for D1/D7",()=>{
  addRun("g:a","2026-10-01",{finished:"2026-10-02"});addRun("g:a","2026-10-08");
  addRun("g:b","2026-10-01",{finished:"2026-10-01"});addRun("g:b","2026-10-03");
  addRun("g:c","2026-10-09");addRun("g:c","2026-10-10");
  addRun("g:d","2026-10-08",{finished:"2026-10-09"});
  const r=siteAnalytics({days:30},now).retention;
  expect(r.d1).toEqual({mature:3,returned:2,percent:66.7});
  expect(r.d7).toEqual({mature:2,returned:1,percent:50});
  expect(siteAnalytics({days:7},now).retention.d1).toEqual({mature:1,returned:1,percent:100});
  expect(siteAnalytics({days:7},now).retention.d7.percent).toBeNull();
});
it("returns empty observation instead of fictitious populations and rejects unsupported filters",()=>{
  const r=siteAnalytics({days:7},now);
  expect(r.totals).toEqual({players:0,starts:0,finishes:0,pending:0,dormant:0});
  expect(r.retention.d1.percent).toBeNull();
  expect(r.daily.every(d=>d.starts===0)).toBe(true);
  for(const q of ["days=99999","game=unknown","locale=xx","mode=ranked","days=NaN"]){expect(()=>analyticsFilters(new URLSearchParams(q))).toThrow();}
});
it("includes verified private-room finishes in return activity without inventing game runs",()=>{
  addRun("g:room","2026-10-01",{game:"guess",mode:"practice",finished:"2026-10-01"});
  addRun("g:room","2026-10-02",{game:"guess",mode:"practice",finished:"2026-10-02"});
  database().prepare("DELETE FROM runs WHERE owner=?").run("g:room");
  expect(siteAnalytics({days:30},now).retention.d1).toEqual({mature:1,returned:1,percent:100});
  expect(siteAnalytics({days:30},now).totals.starts).toBe(0);
});
it("denies access by default and ignores public display names when authorizing an existing account",async()=>{
  expect((await GET(request())).status).toBe(403);
  const ordinaryCookie=account("ordinary","admin");
  expect(()=>requireAnalyticsAdmin(request(ordinaryCookie))).toThrow();
  expect((await GET(request(ordinaryCookie))).status).toBe(403);
  const adminCookie=account("admin","New public name");
  const response=await GET(request(adminCookie));
  expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).not.toHaveProperty("owner");
  vi.stubEnv("ANALYTICS_ADMIN_USERNAMES","");expect((await GET(request(adminCookie))).status).toBe(404);
});
it("exports only daily aggregates and never account details, with signup counts only in the global scope",async()=>{
  const cookie=account("admin");account("ordinary");
  addRun("g:secret-guest","2026-10-10",{finished:"2026-10-10"});
  expect(siteAnalytics({days:7},now).signups).toBe(1);
  expect(siteAnalytics({days:7,game:"word"},now).signups).toBeNull();
  const response=await GET(request(cookie,"?days=7&format=csv"));
  expect(response.status).toBe(200);expect(response.headers.get("x-robots-tag")).toBe("noindex");
  const csv=await response.text();expect(csv).toContain("2026-10-10,1,1,1,0,0");expect(csv).not.toContain("secret-guest");expect(csv).not.toContain("ordinary");
  expect((await GET(request(cookie,"?game=bogus"))).status).toBe(400);
});
it("downloads a versioned report with filters, definitions and both aggregate datasets, behind administrator access",async()=>{
  expect((await GET(request("", "?format=json"))).status).toBe(403);
  const ordinaryCookie=account("ordinary", "admin");
  expect((await GET(request(ordinaryCookie, "?format=json"))).status).toBe(403);
  const cookie=account("admin");
  addRun("g:private-owner", "2026-10-10", {finished:"2026-10-10"});
  addRun("g:other-game", "2026-10-10", {game:"sudoku"});
  const response=await GET(request(cookie, "?format=json&days=7&game=word&locale=fr&interface_locale=en&mode=daily"));
  expect(response.status).toBe(200);
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="puzzoria-analytics-2026-10-04-2026-10-10.json"');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-robots-tag")).toBe("noindex");
  const exported=await response.json();
  expect(exported).toMatchObject({schema:"puzzoria.analytics",schemaVersion:1,generatedAt:now.toISOString(),timezone:"UTC",
    period:{from:"2026-10-04",to:"2026-10-10",currentDayIsPartial:true},
    filters:{days:7,game:"word",puzzleLocale:"fr",interfaceLocale:"en",mode:"daily"},
    report:{official:{totals:{starts:1,finishes:1}},product:{ads:{revenue:null,rewards:null}}}});
  expect(exported.report.product).toHaveProperty("acquisition");
  expect(exported.report.product).toHaveProperty("transitions");
  expect(exported.report.product).toHaveProperty("sameGameRetention");
  expect(exported.definitions.distribution.buckets).toHaveLength(4);
  expect(exported.definitions.visits).toContain("consent");
  expect(exported.report.official.retention.d1.percent).toBeNull();
  for(const privateValue of ["private-owner", "other-game", "test-private-token", "password_hash", "owner_hash"]) expect(JSON.stringify(exported)).not.toContain(privateValue);
  vi.stubEnv("ANALYTICS_ADMIN_USERNAMES", "");
  expect((await GET(request(cookie, "?format=json"))).status).toBe(404);
});
