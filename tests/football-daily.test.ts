import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {createHash} from "node:crypto";
import {generateChallenge,publicChallenge} from "../src/lib/challenges";
import {footballDailyPlayersV1,generateDailyFootball} from "../src/lib/server/football-daily-content";
import {footballPlayers} from "../src/lib/server/knowledge-content";
import {FOOTBALL_DAILY_FROM} from "../src/lib/football-daily";
import {footballDailyCopy} from "../src/lib/football-daily-i18n";
import {dailyGoal,hasDaily,historicalDailyAvailable} from "../src/lib/game-modes";
import {locales} from "../src/lib/types";
import {DAY_MS,utcDay} from "../src/lib/date";
import {beginRun,compareRun,createRun,getRun,ownedRun,submitRun} from "../src/lib/server/play";
import {closeDatabase,database} from "../src/lib/server/database";
import type {FootballChallenge} from "../src/lib/knowledge-types";
import {personalStatistics} from "../src/lib/statistics";
import {leaderboard} from "../src/lib/server/leaderboards";
import sitemap from "../src/app/sitemap";
import {gamePath} from "../src/lib/i18n";
const who=(n=0)=>({user:null,guestId:`football-daily-${n}`,owner:`g:football-daily-${n}`});
const tick=(n=4000)=>vi.setSystemTime(Date.now()+n);
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date(FOOTBALL_DAILY_FROM+"T12:00:00Z"));});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});

it("has one universal harder career per UTC day, no repeated player within a cycle, and no legacy Daily",()=>{
  expect(hasDaily("football")).toBe(true);
  expect(historicalDailyAvailable("football","2026-11-02")).toBe(false);
  expect(()=>generateChallenge("football","fr","2026-11-02")).toThrow();
  const dates=Array.from({length:64},(_,i)=>utcDay(new Date(Date.parse(FOOTBALL_DAILY_FROM)+i*DAY_MS)));
  const answers=dates.map(date=>generateDailyFootball("fr",date).answer);
  for(let start=0;start<64;start+=16)expect(new Set(answers.slice(start,start+16)).size).toBe(16);
  expect(answers.every((a,i)=>i===0||a!==answers[i-1])).toBe(true);
  for(const locale of locales){
    const c=generateDailyFootball(locale,FOOTBALL_DAILY_FROM),fr=generateDailyFootball("fr",FOOTBALL_DAILY_FROM);
    expect(c).toMatchObject({...fr,locale});
    expect(c.id).toBe(`football:${FOOTBALL_DAILY_FROM}:universal`);
    expect(c.attempts).toBe(6);
    expect(publicChallenge(c)).not.toHaveProperty("answer");expect(publicChallenge(c)).not.toHaveProperty("aliases");expect(publicChallenge(c)).not.toHaveProperty("sources");
    expect(Object.values(footballDailyCopy(locale)).every(s=>s.trim())).toBe(true);
    expect(dailyGoal("football",locale)).toBe(footballDailyCopy(locale).goal);
  }
  expect(footballDailyPlayersV1.every(p=>!footballPlayers.some(q=>q.id===p.id))).toBe(true);
});

it("keeps the published v1 editorial deck stable",()=>{
  const hash=createHash("sha256").update(JSON.stringify(footballDailyPlayersV1)).digest("hex");
  expect(hash).toBe("ea556d5b9f038216215b3b01f0db48d23d3193010ad1964a92022362f57e6693");
  expect(createHash("sha256").update(JSON.stringify(generateDailyFootball("en",FOOTBALL_DAILY_FROM))).digest("hex")).toBe("e700d0b88cc578d134aea000ade600ec07af2e8423df8e3fb78b0354ed7bc99f");
});

it("resumes the same official run across languages, rejects foreign owners, and cannot restart after six misses",async()=>{
  const r=await createRun({game:"football",locale:"fr",mode:"daily"},who());
  expect(r.startedAt).toBeNull();
  const c=JSON.parse(ownedRun(r.runId,who()).challenge_json) as FootballChallenge;
  expect(()=>submitRun(r.runId,who(),{step:{kind:"answer",value:c.answer},sequence:0})).toThrow();
  expect(()=>getRun(r.runId,who(1))).toThrow();
  beginRun(r.runId,who());tick();
  for(let i=0;i<6;i++){
    const result=submitRun(r.runId,who(),{step:{kind:"answer",value:`Wrong player ${i}`},sequence:i});
    expect(result.state?.completed).toBe(i===5);
    if(i<5)expect(result.state).not.toHaveProperty("answer");
    else expect(result).toMatchObject({completion:{mode:"daily",success:false,attempts:6,eligible:true},state:{answer:c.answer}});
    const resumed=await createRun({game:"football",locale:locales[i%4],mode:"daily"},who());
    expect(resumed.runId).toBe(r.runId);
  }
  const practice=await createRun({game:"football",locale:"fr",mode:"practice",previousRunId:r.runId},who());
  expect(practice.runId).not.toBe(r.runId);expect(practice.challenge.mode).toBe("practice");
  expect(JSON.parse(ownedRun(practice.runId,who()).challenge_json).cohortKey).toBe("football:retired-v1");
  expect(database().prepare("SELECT COUNT(*) AS n FROM results WHERE mode='daily'").get()).toMatchObject({n:1});
});

it("publishes a fresh player at midnight, preserves the prior run, and excludes a late finish from Daily competition",async()=>{
  vi.setSystemTime(new Date("2026-11-03T23:59:58Z"));
  const r=await createRun({game:"football",locale:"en",mode:"daily"},who());beginRun(r.runId,who());
  const old=JSON.parse(ownedRun(r.runId,who()).challenge_json) as FootballChallenge;tick(6000);
  const late=submitRun(r.runId,who(),{step:{kind:"answer",value:old.answer},sequence:0});
  expect(late.completion).toMatchObject({eligible:false,date:"2026-11-03"});
  const fresh=await createRun({game:"football",locale:"en",mode:"daily"},who());
  expect(fresh.challenge.id).not.toBe(old.id);expect(fresh.runId).not.toBe(r.runId);
  expect(JSON.parse(ownedRun(fresh.runId,who()).challenge_json).answer).not.toBe(old.answer);
  expect(getRun(r.runId,who()).result.completion).toMatchObject({date:"2026-11-03",success:true});
  await expect(createRun({game:"football",locale:"en",mode:"daily",date:"2026-11-03"},who())).rejects.toThrow();
});

it("compares only other players on the same official career and keeps unlimited results out of Daily records",async()=>{
  let currentId="";
  for(let n=0;n<22;n++){
    const r=await createRun({game:"football",locale:locales[n%4],mode:n===21?"practice":"daily"},who(n));
    beginRun(r.runId,who(n));tick();
    const c=JSON.parse(ownedRun(r.runId,who(n)).challenge_json) as FootballChallenge;
    if(n===0)currentId=r.runId;
    if(n>0)submitRun(r.runId,who(n),{step:{kind:"answer",value:"Wrong name"},sequence:0});
    const result=submitRun(r.runId,who(n),{step:{kind:"answer",value:c.answer},sequence:n>0?1:0});
    if(n===21)expect(personalStatistics([result.completion!],"football","daily").played).toBe(0);
  }
  expect(compareRun(currentId,who())).toMatchObject({samples:20,fewerAttemptsThanPercent:100});
});

it("ranks official football performances by guesses and hides archive dates before launch",async()=>{
  for(const [n,guesses] of [[0,1],[1,3]]){
    const user={id:`daily-foot-${n}`,username:`daily_foot_${n}`,displayName:`Player ${n}`};
    database().prepare("INSERT INTO users(id,username,display_name,password_hash,created_at) VALUES(?,?,?,?,?)").run(user.id,user.username,user.displayName,"fixture",new Date().toISOString());
    const identity={...who(n),user,owner:`u:${user.id}`};
    const r=await createRun({game:"football",locale:"fr",mode:"daily"},identity);beginRun(r.runId,identity);tick();
    const c=JSON.parse(ownedRun(r.runId,identity).challenge_json) as FootballChallenge;
    for(let i=0;i<guesses;i++)submitRun(r.runId,identity,{step:{kind:"answer",value:i===guesses-1?c.answer:`Wrong name ${i}`},sequence:i});
  }
  const board=leaderboard("football","en","easy","today","performance");
  expect(board.map(r=>r.displayName)).toEqual(["Player 0","Player 1"]);expect(board[0].value).toBeGreaterThan(board[1].value);
  vi.setSystemTime(new Date("2026-11-06T12:00:00Z"));
  for(const locale of locales){
    const urls=sitemap().map(e=>e.url);
    expect(urls.some(url=>url.endsWith(gamePath(locale,"football","2026-11-03")))) .toBe(true);
    expect(urls.some(url=>url.endsWith(gamePath(locale,"football","2026-11-02")))) .toBe(false);
  }
  expect(historicalDailyAvailable("football",FOOTBALL_DAILY_FROM)).toBe(true);
  expect(()=>generateDailyFootball("fr","not-a-date")).toThrow();
});
