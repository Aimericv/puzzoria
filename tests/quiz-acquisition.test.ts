import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createHash,randomUUID} from "node:crypto";
import {renderToStaticMarkup} from "react-dom/server";
import {NextRequest} from "next/server";
import {expandedQuizTopics} from "../src/lib/quiz-expansion";
import {quizTopicPath,quizTopics} from "../src/lib/knowledge-catalog";
import {generateKnowledge,validateKnowledgeContent} from "../src/lib/server/knowledge-content";
import {publicChallenge,validateChallenge} from "../src/lib/challenges";
import type {QuizChallenge} from "../src/lib/knowledge-types";
import {replayKnowledge} from "../src/lib/knowledge-play";
import {locales} from "../src/lib/types";
import {localizedPath} from "../src/lib/locale-path";
import {measurementPage} from "../src/lib/measurement";
import {QuizTopics} from "../src/components/quiz-topics";
import {database,closeDatabase} from "../src/lib/server/database";
import {createRun,beginRun,ownedRun,submitRun,getRun} from "../src/lib/server/play";
import {quizAnalytics} from "../src/lib/server/quiz-analytics";
import {collectMeasurement,recordMeasuredRun,MEASUREMENT_COOKIE} from "../src/lib/server/measurement";
import {digest,json} from "../src/lib/server/http";
import data from "../src/lib/server/data/quiz-expansion.v1.json" with { type: "json" };
import {quizAcquisitionReport} from "../src/lib/quiz-acquisition";
const date="2026-11-03",now=new Date(date+"T12:00:00Z");
const who=(id="one")=>({user:null,guestId:id,owner:`g:${id}`});
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.stubEnv("ANALYTICS_ADMIN_USERNAMES","admin");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});
it("adds sixteen complete four-language playable topics without exposing answers, with matching translated routes",()=>{
 expect(expandedQuizTopics).toHaveLength(16);expect(quizTopics).toHaveLength(25);validateKnowledgeContent();
 for(const locale of locales){const paths=new Set<string>();
  for(const t of expandedQuizTopics){
   const path=quizTopicPath(locale,t);expect(paths.has(path)).toBe(false);paths.add(path);
   expect(t.title[locale].length).toBeGreaterThan(10);expect(t.description[locale].length).toBeGreaterThan(60);expect(t.scope?.[locale].length).toBeGreaterThan(50);
   const c=generateKnowledge("quiz",locale,date,"seed",t.id) as QuizChallenge;validateChallenge(c);
   expect(replayKnowledge(c,c.items.map(i=>({kind:"answer",value:i.answer})))).toMatchObject({completed:true,success:true,score:1000});
   expect(publicChallenge(c)).not.toHaveProperty("answer");expect(JSON.stringify(publicChallenge(c))).not.toContain('"aliases"');
   for(const next of locales)expect(localizedPath(path,locale,next)).toBe(quizTopicPath(next,t));
   expect(measurementPage(path+"?answer=DO-NOT-STORE")).toEqual({page:path,locale,game:"quiz",mode:"practice"});
  }
  const html=renderToStaticMarkup(QuizTopics({locale}));for(const path of paths)expect(html).toContain(`href="${path}"`);
 }
});
it("covers 195 unique countries, explicit regional conventions, all states/capitals and common spelling aliases",()=>{
 const countrySets=expandedQuizTopics.filter(t=>t.id.startsWith("countries-")&&t.id!=="countries-world").flatMap(t=>(data as Record<string,{answer:{en:string}}[]>)[t.id].map(i=>i.answer.en));
 expect(countrySets).toHaveLength(195);expect(new Set(countrySets).size).toBe(195);
 const c=(topic:string)=>generateKnowledge("quiz","fr",date,"seed",topic) as QuizChallenge;
 const world=c("countries-world");expect(world.items).toHaveLength(195);expect(world.items.some(i=>i.answer==="Palestine")).toBe(true);
 expect(replayKnowledge(world,[{kind:"answer",value:"Ivory Coast"},{kind:"answer",value:"Cote d'Ivoire"},{kind:"answer",value:"State of Palestine"}]).found).toHaveLength(2);
 expect(replayKnowledge(c("german-states"),[{kind:"answer",value:"Thueringen"},{kind:"answer",value:"Baden-Wuerttemberg"}]).found).toHaveLength(2);
 expect(replayKnowledge(c("us-state-capitals"),[{kind:"answer",value:"St. Paul"},{kind:"answer",value:"Albany"}]).found).toHaveLength(2);
 expect(c("eu-members").items.some(i=>i.aliases.includes("UK"))).toBe(false);
 expect(()=>validateChallenge({...world,items:[...world.items,...world.items.slice(0,6).map((i,n)=>({...i,id:`extra-${n}`}))]})).toThrow();
});
it("finishes a 195-answer owned server run, keeps its progress and rejects late answers in the longer quiz",async()=>{
 const r=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"countries-world"},who());
 const c=JSON.parse(ownedRun(r.runId,who()).challenge_json) as QuizChallenge;beginRun(r.runId,who());
 for(let i=0;i<c.items.length;i++){vi.setSystemTime(now.getTime()+(i+1)*1000);const d=submitRun(r.runId,who(),{sequence:i,step:{kind:"answer",value:c.items[i].answer}});if(i===10)expect(getRun(r.runId,who()).progress).toMatchObject({found:expect.any(Array),sequence:11});if(i===194)expect(d.completion).toMatchObject({score:1000,success:true,mode:"practice"});}
 expect(database().prepare("SELECT COUNT(*) n FROM results").get()).toMatchObject({n:1});
 const late=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"countries-world"},who("late"));beginRun(late.runId,who("late"));vi.setSystemTime(Date.now()+600001);
 expect(submitRun(late.runId,who("late"),{sequence:0,step:{kind:"answer",value:"France"}}).completion).toMatchObject({score:0,success:false});
});
it("reports per-topic verified newcomers separately from consented Google landings and excludes admins and secrets",async()=>{
 const guest="a".repeat(43),identity=who(guest),topic=expandedQuizTopics.find(t=>t.id==="countries-south-america")!,path=quizTopicPath("fr",topic);
 const request=new NextRequest("http://localhost:3000/api/measurement",{headers:{cookie:`dailygrid-guest=${guest}`,"user-agent":"Mozilla/5.0 Chrome/144",origin:"http://localhost:3000"}});
 const event={id:randomUUID(),name:"page_view",path:path+"?answer=private",locale:"fr"};
 expect(collectMeasurement(request,json({}),{choice:"no",events:[event]}).accepted).toBe(0);
 const response=json({});expect(collectMeasurement(request,response,{choice:"yes",referrer:"https://www.google.com/search?q=private",events:[event]}).accepted).toBe(1);
 const measuredRequest=new NextRequest(request.url,{headers:{cookie:`dailygrid-guest=${guest}; puzzoria-measurement-choice=yes; ${MEASUREMENT_COOKIE}=${response.cookies.get(MEASUREMENT_COOKIE)!.value}`,"user-agent":"Mozilla/5.0 Chrome/144",referer:"http://localhost:3000"+path}});
 const run=await createRun({game:"quiz",locale:"fr",mode:"practice",category:topic.id},identity);beginRun(run.runId,identity);recordMeasuredRun(measuredRequest,run.runId,"run_started");vi.setSystemTime(Date.now()+5000);submitRun(run.runId,identity,{sequence:0,step:{kind:"finish"}});
 const second=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"german-states"},identity);beginRun(second.runId,identity);
 let r=quizAnalytics({days:7},new Date());expect(r.find(t=>t.topic===topic.id&&t.locale==="fr")).toMatchObject({starts:1,finishes:1,players:1,newPlayers:1,googleLandingSessions:1,measuredGoogleNewPlayers:1});
 expect(r.find(t=>t.topic==="german-states"&&t.locale==="fr")).toMatchObject({starts:1,newPlayers:0,finishes:0,meanScore:null});
 expect(quizAnalytics({days:7,interfaceLocale:"de"},new Date()).every(t=>t.googleLandingSessions===0&&t.measuredGoogleNewPlayers===0)).toBe(true);
 database().prepare("INSERT INTO users VALUES(?,?,?,?,?)").run("new-admin","admin","Admin","fixture",now.toISOString());
 database().prepare("UPDATE measurement_sessions SET owner_hash=?").run(digest("u:new-admin"));
 r=quizAnalytics({days:7},new Date());expect(r.every(t=>t.googleLandingSessions===0&&t.measuredGoogleNewPlayers===0)).toBe(true);
 for(const secret of [guest,identity.owner,digest(identity.owner),"private","password","aliases"])expect(JSON.stringify(r)).not.toContain(secret);
 expect(quizAnalytics({days:7,game:"word"},new Date())).toEqual([]);
 expect(measurementPage("/fr/quiz/secret-player-name")).toEqual({page:"/fr/quiz",locale:"fr",game:"quiz",mode:"practice"});
});
it("keeps the v1 answer snapshot reproducibly frozen",()=>{
 expect(createHash("sha256").update(JSON.stringify(data)).digest("hex")).toBe("0f155114bbe31233b9b3988d91f0115a907fcc594b5f6cf8ea2485e843fcab3f");
});
it("preserves first-match and duplicate semantics for saved legacy answer aliases",()=>{
 const c=generateKnowledge("quiz","en",date,"seed","planets") as QuizChallenge;
 c.items[0].aliases.push("legacy shared alias");c.items[1].aliases.push("legacy shared alias");
 expect(replayKnowledge(c,[{kind:"answer",value:"legacy shared alias"},{kind:"answer",value:"LEGACY SHARED ALIAS"}])).toMatchObject({found:[{id:c.items[0].id,answer:c.items[0].answer}],feedback:"duplicate",sequence:2});
});
it("joins trusted page-level Google and playing exports without treating missing top-100 rows as zero or exposing queries",()=>{
 const google={status:"available",timezone:"America/Los_Angeles",breakdowns:{period:{startDate:"2026-10-01",endDate:"2026-10-30"},exhaustive:false,page:{rows:[{key:"https://puzzoria.com/fr/quiz/pays-du-monde",clicks:4,impressions:120,position:14}]},query:{rows:[{key:"PRIVATE QUERY"}]}}};
 const analytics={schema:"puzzoria.analytics",timezone:"UTC",period:{from:date,to:date,privateField:"PRIVATE QUERY"},report:{product:{quizTopics:quizAnalytics({days:30},now)}}};
 const r=quizAcquisitionReport(google,analytics);
 expect(r.rows.find(p=>p.topic==="countries-world"&&p.locale==="fr")?.google).toEqual({clicks:4,impressions:120,position:14,rowReturned:true});
 expect(r.rows.find(p=>p.topic==="countries-africa"&&p.locale==="fr")?.google).toEqual({clicks:null,impressions:null,position:null,rowReturned:false});
 expect(r.rows).toHaveLength(100);expect(JSON.stringify(r)).not.toContain("PRIVATE QUERY");
 expect(()=>quizAcquisitionReport(google,{})).toThrow();
});
