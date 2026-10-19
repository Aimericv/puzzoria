import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { database,closeDatabase } from "../src/lib/server/database";
import { collectMeasurement,recordMeasuredRun,recordMeasuredRoom,recordMeasuredLive,MEASUREMENT_COOKIE } from "../src/lib/server/measurement";
import { createLive,liveAction,readLive,submitLive } from "../src/lib/server/live-rooms";
import { createRoom,joinRoom,actRoom } from "../src/lib/server/number-rooms";
import { productAnalytics } from "../src/lib/server/product-analytics";
import { acquisition,measurementPage } from "../src/lib/measurement";
import { digest,json } from "../src/lib/server/http";
import { POST } from "../src/app/api/measurement/route";
const now=Date.parse("2026-10-05T12:00:00Z"),guest="a".repeat(43);
let cookie:string;
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.stubEnv("ANALYTICS_ADMIN_USERNAMES","admin");vi.stubEnv("ANALYTICS_ADS_ENABLED","false");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);cookie=`dailygrid-guest=${guest}`;});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});
const request=(extra:Record<string,string>={})=>new NextRequest("http://localhost:3000/api/measurement",{headers:{cookie,"user-agent":"Mozilla/5.0 Chrome/144","content-type":"application/json",origin:"http://localhost:3000",...extra}});
const event=(name:string,path="/fr",props:Record<string,unknown>={})=>({id:randomUUID(),name,path,locale:path.split("/")[1],...props});

it("measures real-time duel lifecycle once without storing invitation codes, names or secret numbers",()=>{
 collect([event("page_view","/fr/live/PRIVATE-ROOM")]);
 const host={user:null,guestId:guest,owner:`g:${guest}`},peer={user:null,guestId:"b".repeat(43),owner:`g:${"b".repeat(43)}`};
 const room=createLive({game:"guess",locale:"fr",name:"PrivateHost"},host);
 recordMeasuredLive(request(),room,"duel_created");recordMeasuredLive(request(),room,"duel_created");
 liveAction(room.code,peer,{action:"join",name:"PrivatePeer"});
 liveAction(room.code,host,{action:"secret",value:73});liveAction(room.code,peer,{action:"secret",value:42});
 liveAction(room.code,host,{action:"ready",ready:true});liveAction(room.code,peer,{action:"ready",ready:true});
 vi.setSystemTime(now+3000);
 const playing=readLive(room.code,host,true);
 recordMeasuredLive(request(),playing);recordMeasuredLive(request(),playing);
 submitLive(room.code,host,{sequence:0,value:42});submitLive(room.code,peer,{sequence:0,value:73});
 const finished=readLive(room.code,host,true);
 recordMeasuredLive(request({dnt:"1"}),finished);
 expect(database().prepare("SELECT COUNT(*) n FROM measurement_events WHERE name='duel_finished'").get()).toMatchObject({n:0});
 recordMeasuredLive(request(),finished);recordMeasuredLive(request(),finished);
 for(const name of ["duel_created","duel_started","duel_finished","run_started","run_finished"])
   expect(database().prepare("SELECT COUNT(*) n FROM measurement_events WHERE name=?").get(name)).toMatchObject({n:1});
 const stored=JSON.stringify(database().prepare("SELECT * FROM measurement_events").all());
 for(const value of [room.code,"PRIVATE-ROOM","PrivateHost","PrivatePeer",guest])expect(stored).not.toContain(value);
 expect(measurementPage(`/de/live/${room.code}?secret=73`)).toMatchObject({page:"/de/live",locale:"de"});
 expect(productAnalytics({days:7}).social.find(row=>row.name==="duel_finished")?.count).toBe(1);
});
function collect(events:unknown[],extra:Record<string,unknown>={},time=Date.now()){
 const response=json({});const result=collectMeasurement(request(),response,{choice:"yes",events,...extra},time);
 const values=new Map(cookie.split("; ").map(s=>{const [k,...v]=s.split("=");return [k,v.join("=")];}));for(const c of response.cookies.getAll())values.set(c.name,c.value);cookie=[...values].map(([k,v])=>`${k}=${v}`).join("; ");return result;
}
function run(owner=`g:${guest}`,userId:string|null=null){database().prepare("INSERT INTO runs(id,owner,user_id,guest_id,challenge_id,game,mode,challenge_json,started_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run("run",owner,userId,guest,"challenge","word","practice",JSON.stringify({locale:"fr",answer:"NEVER-COLLECT-ANSWER"}),new Date(now).toISOString(),new Date(now).toISOString());}
it("uses closed route categories and keeps private codes, query strings and input text out of storage",()=>{
 expect(measurementPage("/fr/number-room/ABCDEFGH?password=secret")).toMatchObject({page:"/fr/number-room",game:"guess"});
 expect(measurementPage("/fr/admin/analytics")).toBeNull();
 expect(measurementPage("/fr/mot/practice")).toMatchObject({mode:"practice"});
 collect([event("page_view","/fr/friend/PRIVATE-CODE?token=secret",{password:"NEVER-COLLECT-PASSWORD"})],{referrer:"https://google.com/search?q=NEVER-COLLECT-QUERY",source:"ok-campaign",campaign:"bad@email"});
 const text=JSON.stringify(database().prepare("SELECT * FROM measurement_sessions").all())+JSON.stringify(database().prepare("SELECT * FROM measurement_events").all());
 for(const value of ["PRIVATE-CODE","NEVER-COLLECT-PASSWORD","NEVER-COLLECT-QUERY",guest,"bad@email"])expect(text).not.toContain(value);
 expect(productAnalytics({days:7}).acquisition[0]).toMatchObject({channel:"friend",source:"ok-campaign"});
 expect(acquisition("https://www.google.fr/search?q=hello",null,null,null,"https://puzzoria.test")).toMatchObject({channel:"search",referrer:"www.google.fr"});
});
it("requires explicit choice and respects refusal, GPC and Do Not Track",()=>{
 const r=json({});expect(()=>collectMeasurement(request(),r,{events:[event("page_view")]})).toThrow();
 for(const h of [{dnt:"1"},{"sec-gpc":"1"}] as Record<string,string>[]){expect(collectMeasurement(request(h),json({}),{choice:"yes",events:[event("page_view")]}).accepted).toBe(0);}
 expect(collectMeasurement(request(),r,{choice:"no",events:[]}).accepted).toBe(0);
 expect(database().prepare("SELECT COUNT(*) n FROM measurement_sessions").get()).toMatchObject({n:0});
});
it("deduplicates retries and overlapping tabs and rejects fabricated outcomes or active time",()=>{
 run();const page=event("page_view","/fr/mot/practice");collect([page]);
 expect(collect([page]).accepted).toBe(0);
 collect([event("active_time","/fr/mot/practice",{challenge_id:"challenge",seconds:15})],{},now+15000);
 collect([event("active_time","/fr/mot/practice",{challenge_id:"challenge",seconds:15})],{},now+15000);
 collect([event("active_time","/fr/mot/practice",{challenge_id:"challenge",seconds:15})],{},now+20000);
 expect(collect([event("game_complete","/fr/mot/practice",{success:true,score:100000}),event("active_time","/fr/mot/practice",{challenge_id:"foreign",seconds:15}),event("active_time","/fr/mot/practice",{challenge_id:"challenge",seconds:9999})]).accepted).toBe(0);
 const value=productAnalytics({days:7},new Date(now+25000));expect(value.totals.activeSeconds).toBe(20);expect(value.totals.finishesPerSession).toBe(0);
 expect(database().prepare("SELECT COUNT(*) n FROM results").get()).toMatchObject({n:0});
 expect(JSON.stringify(value)).not.toContain("NEVER-COLLECT-ANSWER");
});
it("rotates expired sessions, prevents a foreign device from attaching to one and merges guest history only into its authenticated account",()=>{
 collect([event("page_view")]);const first=database().prepare("SELECT id FROM measurement_sessions").get() as {id:string};
 collect([event("page_view")],{},now+31*60000);expect(database().prepare("SELECT COUNT(*) n FROM measurement_sessions").get()).toMatchObject({n:2});
 cookie=cookie.replace(guest,"b".repeat(43));collect([event("page_view")],{},now+32*60000);expect(database().prepare("SELECT COUNT(*) n FROM measurement_sessions").get()).toMatchObject({n:3});
 database().prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("user","ordinary","Ordinary","fixture",new Date(now).toISOString());database().prepare("INSERT INTO sessions VALUES(?,?,?,?)").run(digest("session-token"),"user",now+86400000,new Date(now).toISOString());cookie=`dailygrid-guest=${guest}; dailygrid-session=session-token`;
 collect([event("page_view")],{},now+33*60000);
 expect(database().prepare("SELECT owner_hash FROM measurement_sessions WHERE id=?").get(first.id)).toMatchObject({owner_hash:digest("u:user")});
 expect(database().prepare("SELECT COUNT(DISTINCT owner_hash) n FROM measurement_sessions").get()).toMatchObject({n:2});
});
it("counts starts and finishes only from an owned verified run and handles retransmission once",()=>{
 collect([event("page_view","/fr/mot/practice")]);run();
 recordMeasuredRun(request(),"run","run_started");recordMeasuredRun(request(),"run","run_started");
 recordMeasuredRun(request(),"run","run_finished");expect(productAnalytics({days:7}).funnel.find(f=>f.stage==="finish")?.sessions).toBe(0);
 database().prepare("INSERT INTO results(id,owner,game,mode,challenge_id,date,locale,completed_at,duration,success,score,provenance) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").run("result",`g:${guest}`,"word","practice","challenge","2026-10-05","fr",new Date(now).toISOString(),60,1,100,"server");
 recordMeasuredRun(request(),"run","run_finished");recordMeasuredRun(request(),"run","run_finished");
 const d=productAnalytics({days:7});expect(d.quality.coverage).toBe(100);expect(d.totals.finishesPerSession).toBe(1);expect(d.games[0]).toMatchObject({wins:1,losses:0,officialMedian:60});
});
it("reports transitions, sources, true denominators and only aggregate data",()=>{
 collect([event("page_view","/fr/mot/practice"),event("page_view","/fr/sudoku/practice"),event("play_again","/fr/sudoku/practice")],{referrer:"https://reddit.com/r/puzzles?secret=hidden"});
 const d=productAnalytics({days:7});expect(d.transitions).toEqual([{from:"word",to:"sudoku",count:1}]);expect(d.acquisition[0]).toMatchObject({channel:"social",sessions:1});expect(d.totals.activeMedian).toBeNull();expect(d.frequency.daysPerWeek).toBeNull();
 for(const secret of [guest,digest(`g:${guest}`),"secret=hidden",MEASUREMENT_COOKIE])expect(JSON.stringify(d)).not.toContain(secret);
});
it("excludes admin/bot visits, leaves ads disconnected and prunes only old telemetry",()=>{
 expect(collectMeasurement(request({"user-agent":"Googlebot"}),json({}),{choice:"yes",events:[event("page_view")]}).accepted).toBe(0);
 collect([event("page_view")]);run();
 collect([event("ad_viewable","/fr/mot/practice",{impression_id:randomUUID()})]);expect(productAnalytics({days:7}).ads).toMatchObject({enabled:false,revenue:null});
 collect([event("page_view")],{},now+400*86400000);
 expect(database().prepare("SELECT COUNT(*) n FROM measurement_sessions").get()).toMatchObject({n:1});expect(database().prepare("SELECT COUNT(*) n FROM runs").get()).toMatchObject({n:1});
});
it("bounds JSON batches, refuses cross-site traffic and sets private HttpOnly cookies",async()=>{
 const r=(body:unknown,origin="http://localhost:3000")=>new NextRequest("http://localhost:3000/api/measurement",{method:"POST",headers:{cookie,"user-agent":"Mozilla Chrome","content-type":"application/json",origin},body:JSON.stringify(body)});
 expect((await POST(r({choice:"yes",events:[event("page_view")]},"https://evil.test"))).status).toBe(403);
 expect((await POST(r({choice:"yes",events:Array.from({length:31},()=>event("page_view"))}))).status).toBe(400);
 const response=await POST(r({choice:"yes",events:[event("page_view")]}));expect(response.status).toBe(200);expect(response.headers.get("cache-control")).toBe("private, no-store");expect(response.headers.getSetCookie().some(c=>c.startsWith(MEASUREMENT_COOKIE+"=")&&c.includes("HttpOnly"))).toBe(true);
});
it("measures an owned manual number room without storing its code or secret numbers",()=>{
 collect([event("page_view","/fr/number-room")]);
 const host={user:null,guestId:guest,owner:`g:${guest}`},other={user:null,guestId:"b".repeat(43),owner:`g:${"b".repeat(43)}`};
 const room=createRoom(host,"fr"),joined=joinRoom(room.code,other,"fr");
 const first=actRoom(room.code,host,{sequence:joined.sequence,step:{kind:"secret",value:73}});
 actRoom(room.code,other,{sequence:first.sequence,step:{kind:"secret",value:28}});
 recordMeasuredRoom(request(),room.code);
 collect([event("active_time",`/fr/number-room/${room.code}`,{challenge_id:`duel:guess:${room.code}`,seconds:15})],{},now+15000);
 const raw=JSON.stringify(database().prepare("SELECT * FROM measurement_events").all());expect(raw).not.toContain(room.code);expect(raw).not.toContain('"number"');
 const d=productAnalytics({days:7},new Date(now+16000));expect(d.totals.activeSeconds).toBe(15);expect(d.quality.coverage).toBe(50);
});
it("deduplicates each real ad stage globally and never accepts a client reward or revenue",()=>{
 vi.stubEnv("ANALYTICS_ADS_ENABLED","true");const id=randomUUID();
 collect([event("ad_viewable","/fr/mot",{impression_id:id,revenue:999}),event("ad_viewable","/fr/mot",{impression_id:id}),event("video_complete","/fr/mot",{impression_id:id}),event("video_reward","/fr/mot",{impression_id:id})]);
 const d=productAnalytics({days:7});expect(d.ads.events.find(e=>e.name==="ad_viewable")?.count).toBe(1);expect(d.ads.events.find(e=>e.name==="video_complete")?.count).toBe(1);expect(d.ads.revenue).toBeNull();expect(d.ads.rewards).toBeNull();
});
it("distinguishes puzzle language from interface language in measured activity",()=>{
 run();database().prepare("UPDATE runs SET challenge_json=?").run(JSON.stringify({locale:"en",answer:"secret"}));
 collect([event("active_time","/fr/mot/practice",{challenge_id:"challenge",seconds:15})],{},now+15000);
 expect(productAnalytics({days:7,locale:"en",interfaceLocale:"fr"},new Date(now+16000)).totals.activeSeconds).toBe(15);
 expect(productAnalytics({days:7,locale:"en",interfaceLocale:"es"},new Date(now+16000)).totals.activeSeconds).toBe(0);
});
