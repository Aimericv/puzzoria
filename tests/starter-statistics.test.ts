import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {database,closeDatabase} from "../src/lib/server/database";
import {beginRun,compareRun,createRun,ownedRun,submitRun} from "../src/lib/server/play";
import {socialCommunity,rankingAggregate,voteAggregate} from "../src/lib/server/community";
import {generateChallenge} from "../src/lib/challenges";
import {replaySocial} from "../src/lib/social-play";
import {starterComparison} from "../src/lib/server/starter-statistics";
import type {Completion,WordChallenge} from "../src/lib/types";
import type {SocialChallenge} from "../src/lib/social-types";
const date="2026-10-07";
const who=(i:number)=>({user:null,guestId:String(i).padStart(43,"x"),owner:"g:"+String(i).padStart(43,"x")});
beforeEach(()=>{
  closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.stubEnv("COMMUNITY_STARTER_STATS","true");
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(date+"T12:00:00Z"));
});
afterEach(()=>{closeDatabase();vi.unstubAllEnvs();vi.useRealTimers();});
async function win(i:number){
  const owner=who(i),run=await createRun({game:"word",locale:"fr",mode:"daily"},owner);
  const c=JSON.parse(ownedRun(run.runId,owner).challenge_json) as WordChallenge;
  beginRun(run.runId,owner);vi.setSystemTime(new Date(Date.now()+60000));
  submitRun(run.runId,owner,{guesses:[c.answer],hints:0});return {owner,run};
}
it("replaces a stable starter comparison with observed data at exactly twenty distinct other players",async()=>{
  const current=await win(0);
  const before=database().prepare("SELECT COUNT(*) AS n FROM results").get()!.n;
  const first=compareRun(current.run.runId,current.owner);
  expect(first?.source).toBe("starter");expect(compareRun(current.run.runId,current.owner)).toEqual(first);
  expect(database().prepare("SELECT COUNT(*) AS n FROM results").get()!.n).toBe(before);
  for(let i=1;i<=19;i++)await win(i);
  expect(compareRun(current.run.runId,current.owner)?.source).toBe("starter");
  await win(20);
  expect(compareRun(current.run.runId,current.owner)).toMatchObject({samples:20,successRate:100,averageAttempts:1,fewerAttemptsThanPercent:0});
  expect(compareRun(current.run.runId,current.owner)?.source).toBeUndefined();
  expect(database().prepare("SELECT COUNT(*) AS n FROM results").get()!.n).toBe(21);
});
it("leaves the normal no-data behavior available when the setting is disabled",async()=>{
  vi.stubEnv("COMMUNITY_STARTER_STATS","false");const current=await win(0);
  expect(compareRun(current.run.runId,current.owner)).toBeNull();
});
it("uses coherent attempt distributions and respects the unusual-word budget",()=>{
  const base:Completion={game:"rareword",challengeId:"rare-test",date,locale:"de",mode:"daily",success:true,
    score:1000,duration:180,attempts:7,wordLength:10,maxAttempts:10,completedAt:date+"T12:00:00Z"};
  const p=starterComparison(base),rows=p.attemptDistribution!;
  expect(rows.every(row=>row.attempts>=1&&row.attempts<=10&&Number.isInteger(row.count))).toBe(true);
  expect(rows.reduce((sum,row)=>sum+row.count,0)).toBe(p.successes);
  expect(rows.reduce((sum,row)=>sum+row.percent,0)).toBeCloseTo(100);
  expect(p.fewerAttemptsThanPercent).toBeGreaterThanOrEqual(0);expect(p.fewerAttemptsThanPercent).toBeLessThanOrEqual(100);
  expect(starterComparison({...base,game:"sudoku",attempts:undefined})).toMatchObject({successRate:100,averageAttempts:null});
});
it("reveals dilemma percentages only after voting and takes observed votes over starter values",async()=>{
  const c=generateChallenge("rather","fr","2026-10-03") as Extract<SocialChallenge,{kind:"rather"}>;
  const initial=replaySocial(c,[]);
  const before=socialCommunity(c,initial,who(0).owner);
  expect(before?.kind).toBe("rather");if(before?.kind!=="rather")throw new Error();
  expect(before.questions.every(q=>q===null)).toBe(true);
  const state=replaySocial(c,[{kind:"vote",choice:"a"}]);
  const starter=socialCommunity(c,state,who(0).owner);if(starter?.kind!=="rather")throw new Error();
  expect(starter.questions[0]?.source).toBe("starter");expect(starter.questions[0]!.a+starter.questions[0]!.b).toBe(100);
  for(let i=1;i<=20;i++) {
    const owner=who(i),run=await createRun({game:"rather",locale:"fr",mode:"archive",date:"2026-10-03"},owner);
    beginRun(run.runId,owner);submitRun(run.runId,owner,{sequence:0,step:{kind:"vote",choice:"b"}});
  }
  const observed=socialCommunity(c,state,who(0).owner);if(observed?.kind!=="rather")throw new Error();
  expect(observed.questions[0]).toEqual(voteAggregate(c.questions[0].id,Array(20).fill("b")));
  expect(database().prepare("SELECT COUNT(*) AS n FROM community_votes").get()!.n).toBe(20);
});
it("uses coherent ranking averages, then replaces them without creating votes",async()=>{
  const c=generateChallenge("ranking","fr","2026-10-03") as Extract<SocialChallenge,{kind:"ranking"}>;
  const state=replaySocial(c,[1,2,3,4,5].map(position=>({kind:"rank" as const,position})));
  const first=socialCommunity(c,state,who(0).owner);if(first?.kind!=="ranking")throw new Error();
  expect(first.source).toBe("starter");expect(first.average.reduce((sum,row)=>sum+row.position,0)).toBeCloseTo(15);
  expect(first.common.slice().sort()).toEqual(c.items.map(i=>i.id).sort());
  expect(database().prepare("SELECT COUNT(*) AS n FROM community_votes").get()!.n).toBe(0);
  const ranking=state.ranking as string[];
  for(let i=1;i<=20;i++) {
    const owner=who(i),run=await createRun({game:"ranking",locale:"fr",mode:"archive",date:"2026-10-03"},owner);
    beginRun(run.runId,owner);
    for(let position=1;position<=5;position++)submitRun(run.runId,owner,{sequence:position-1,step:{kind:"rank",position}});
  }
  expect(socialCommunity(c,state,who(0).owner)).toEqual(rankingAggregate(Array.from({length:20},()=>ranking),ranking,c.items.map(i=>i.id)));
});
