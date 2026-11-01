import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { publicChallenge, validateChallenge } from "../src/lib/challenges";
import { footballPlayers, generateKnowledge, validateKnowledgeContent } from "../src/lib/server/knowledge-content";
import { quizTopics, quizTopicPath } from "../src/lib/knowledge-catalog";
import { normalizeAnswer, type QuizChallenge, type FootballChallenge } from "../src/lib/knowledge-types";
import { replayKnowledge } from "../src/lib/knowledge-play";
import { beginRun, compareRun, createRun, getRun, ownedRun, submitRun } from "../src/lib/server/play";
import { closeDatabase, database } from "../src/lib/server/database";
import { personalResultStatistics } from "../src/lib/engagement";
import { completionFromRow, type ResultRow } from "../src/lib/server/results";
import { locales } from "../src/lib/types";
import { localizedPath } from "../src/lib/locale-path";
import sitemap from "../src/app/sitemap";
import { siteOrigin } from "../src/lib/seo";
import { createLive, liveAction, readLive, submitLive } from "../src/lib/server/live-rooms";
const who=(n=0)=>({user:null,guestId:`knowledge-${n}`,owner:`g:knowledge-${n}`});
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-01T12:00:00Z"));});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});
const tick=(ms:number)=>vi.setSystemTime(Date.now()+ms);
describe("editorial content and tolerant answers",()=>{
  it("has complete, uniquely answerable quizzes in every language and sourced retired careers",()=>{
    expect(()=>validateKnowledgeContent()).not.toThrow();
    expect(footballPlayers.length).toBeGreaterThanOrEqual(20);
    for(const locale of locales) for(const topic of quizTopics){
      const c=generateKnowledge("quiz",locale,"2026-11-01","seed",topic.id) as QuizChallenge;
      validateChallenge(c);expect(c.items).toHaveLength(topic.count);
      expect(publicChallenge(c)).toHaveProperty("items");
      expect(JSON.stringify(publicChallenge(c))).not.toContain('"aliases"');
      expect(JSON.stringify(publicChallenge(c))).not.toContain('"answer"');
      const answers=c.items.map(item=>({kind:"answer",value:item.answer}));
      expect(replayKnowledge(c,answers)).toMatchObject({completed:true,success:true,score:1000});
    }
    for(const p of footballPlayers){
      const c:FootballChallenge={id:"practice:football:test",kind:"football",date:"2026-11-01",locale:"fr",cohortKey:"football:retired-v1",clubs:p.clubs,answer:p.name,aliases:p.aliases,attempts:6,sources:p.sources};
      validateChallenge(c);
      expect(publicChallenge(c)).not.toHaveProperty("answer");expect(publicChallenge(c)).not.toHaveProperty("sources");
      expect(replayKnowledge(c,[{kind:"answer",value:p.aliases[0]}])).toMatchObject({success:true,completed:true,answer:p.name});
    }
  });
  it("normalises accents, ligatures, German spelling and punctuation without accepting substrings",()=>{
    expect(normalizeAnswer("  J. R. R. Tölkien ")).toBe("jrrtolkien");
    expect(normalizeAnswer("Œ ß æ")).toBe("oessae");
    const c=generateKnowledge("quiz","fr","2026-11-01","seed","europe-capitals") as QuizChallenge;
    const state=replayKnowledge(c,[{kind:"answer",value:"Paris"},{kind:"answer",value:"paris!"},{kind:"answer",value:"Par"}]);
    expect(state.found).toHaveLength(1);expect(state).not.toHaveProperty("reveal");
    expect(replayKnowledge(c,[...state.actions,{kind:"finish"}]).reveal).toHaveLength(20);
    expect(()=>replayKnowledge(c,[{kind:"answer",value:" "}])).toThrow();
  });
});
describe("authoritative runs",()=>{
  async function quiz(topic="planets"){
    const run=await createRun({game:"quiz",locale:"fr",mode:"practice",category:topic},who());
    return {...run,private:JSON.parse(ownedRun(run.runId,who()).challenge_json) as QuizChallenge};
  }
  it("starts explicitly, prevents cross-owner access, bounds categories and refuses Daily/archive",async()=>{
    const r=await quiz();expect(r.startedAt).toBeNull();
    expect(()=>submitRun(r.runId,who(),{step:{kind:"finish"},sequence:0})).toThrow();
    expect(()=>getRun(r.runId,who(1))).toThrow();
    expect(()=>beginRun(r.runId,who(1))).toThrow();
    await expect(createRun({game:"quiz",locale:"fr",mode:"daily"},who())).rejects.toThrow();
    await expect(createRun({game:"football",locale:"fr",mode:"archive",date:"2026-10-04"},who())).rejects.toThrow();
    await expect(createRun({game:"quiz",locale:"fr",mode:"practice",category:"invented"},who())).rejects.toThrow();
  });
  it("accepts one answer at a time, deduplicates retries and refuses rewritten proofs",async()=>{
    const r=await quiz();beginRun(r.runId,who());tick(5000);
    const step={kind:"answer",value:` ${r.private.items[0].answer} `};
    const first=submitRun(r.runId,who(),{step,sequence:0});
    expect(first.state?.found).toHaveLength(1);
    expect(submitRun(r.runId,who(),{step,sequence:0}).state?.found).toHaveLength(1);
    expect(()=>submitRun(r.runId,who(),{step:{kind:"answer",value:r.private.items[1].answer},sequence:0})).toThrow();
    expect(()=>submitRun(r.runId,who(),{actions:r.private.items.map(i=>({kind:"answer",value:i.answer}))})).toThrow();
    const done=submitRun(r.runId,who(),{step:{kind:"finish"},sequence:1,score:1000,success:true,duration:0});
    expect(done.completion).toMatchObject({answersFound:1,answersTotal:8,score:125,success:false,duration:5,eligible:false,knowledgeSet:r.private.cohortKey});
    expect(submitRun(r.runId,who(),{step:{kind:"finish"},sequence:1})).toEqual(done);
    expect(database().prepare("SELECT COUNT(*) AS n FROM results").get()).toMatchObject({n:1});
    expect(getRun(r.runId,who()).result?.state.reveal).toHaveLength(8);
    const restored=completionFromRow(database().prepare("SELECT * FROM results WHERE id=?").get(r.runId) as ResultRow);
    expect(restored).toMatchObject({answersFound:1,answersTotal:8,knowledgeSet:r.private.cohortKey});
  });
  it("cannot backdate answers after the deadline, including on a resumed game",async()=>{
    const r=await quiz();beginRun(r.runId,who());tick(59999);
    submitRun(r.runId,who(),{step:{kind:"answer",value:r.private.items[0].answer},sequence:0});
    tick(1001);
    expect(getRun(r.runId,who()).progress?.sequence).toBe(1);
    const done=submitRun(r.runId,who(),{step:{kind:"answer",value:r.private.items[1].answer},sequence:1,elapsed:1});
    expect(done.completion).toMatchObject({answersFound:1,duration:60});
    expect(done.state?.found).toHaveLength(1);
  });
  it("persists accepted progress, permits zero-guess concessions and creates fresh runs",async()=>{
    const r=await createRun({game:"football",locale:"fr",mode:"practice"},who());beginRun(r.runId,who());
    const c=JSON.parse(ownedRun(r.runId,who()).challenge_json) as FootballChallenge;
    submitRun(r.runId,who(),{step:{kind:"answer",value:"Not a player"},sequence:0});
    expect(getRun(r.runId,who()).progress?.guesses).toEqual(["Not a player"]);
    expect(()=>submitRun(r.runId,who(),{step:{kind:"answer",value:"Not a player"},sequence:1})).toThrow();
    tick(4000);const win=submitRun(r.runId,who(),{step:{kind:"answer",value:c.aliases[0]},sequence:1});
    expect(win.completion).toMatchObject({game:"football",success:true,attempts:2,score:500});
    expect(win.state?.answer).toBe(c.answer);
    const fresh=await createRun({game:"football",locale:"fr",mode:"practice",previousRunId:r.runId},who());expect(fresh.runId).not.toBe(r.runId);
    expect((JSON.parse(ownedRun(fresh.runId,who()).challenge_json) as FootballChallenge).answer).not.toBe(c.answer);
    beginRun(fresh.runId,who());
    expect(submitRun(fresh.runId,who(),{step:{kind:"finish"},sequence:0}).completion).toMatchObject({attempts:0,success:false});
  });
  it("separates topic records and keeps optional starter comparisons out of stored results",async()=>{
    const r=await quiz();beginRun(r.runId,who());tick(4000);
    const done=submitRun(r.runId,who(),{step:{kind:"finish"},sequence:0}).completion!;
    expect(compareRun(r.runId,who())).toBeNull();
    vi.stubEnv("COMMUNITY_STARTER_STATS","true");
    expect(compareRun(r.runId,who())).toMatchObject({source:"starter",betterScoreThanPercent:0});
    expect(compareRun(r.runId,who())).toEqual(compareRun(r.runId,who()));
    expect(database().prepare("SELECT COUNT(*) AS n FROM results").get()).toMatchObject({n:1});
    expect(personalResultStatistics([{...done,challengeId:"another",knowledgeSet:"quiz:flags:v1:fr",score:1000}],done).played).toBe(1);
  });
  it("requires twenty distinct compatible players before replacing starter comparisons",async()=>{
    vi.stubEnv("COMMUNITY_STARTER_STATS","true");
    const r=await quiz();beginRun(r.runId,who());tick(4000);
    submitRun(r.runId,who(),{step:{kind:"answer",value:r.private.items[0].answer},sequence:0});
    submitRun(r.runId,who(),{step:{kind:"finish"},sequence:1});
    for(let i=1;i<=20;i++) {
      const other=await createRun({game:"quiz",locale:i===20?"en":"fr",mode:"practice",category:i===20?"planets":"flags"},who(i));
      beginRun(other.runId,who(i));tick(4000);submitRun(other.runId,who(i),{step:{kind:"finish"},sequence:0});
    }
    expect(compareRun(r.runId,who())?.source).toBe("starter");
    for(let i=1;i<=20;i++) {
      const other=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"planets"},who(i));
      beginRun(other.runId,who(i));tick(4000);submitRun(other.runId,who(i),{step:{kind:"finish"},sequence:0});
      if(i===19) expect(compareRun(r.runId,who())?.source).toBe("starter");
    }
    const observed=compareRun(r.runId,who());
    expect(observed?.source).toBeUndefined();expect(observed).toMatchObject({samples:20,betterScoreThanPercent:100});
    expect(database().prepare("SELECT COUNT(*) AS n FROM results").get()).toMatchObject({n:41});
  });
});
it("publishes stable quiz topic URLs, reciprocal translations and no random/archive URLs",()=>{
  const entries=sitemap();
  for(const topic of quizTopics)for(const locale of locales){
    const path=quizTopicPath(locale,topic), entry=entries.find(e=>e.url===siteOrigin+path);
    expect(entry).toBeDefined();expect(entry?.alternates?.languages?.["x-default"]).toBe(siteOrigin+quizTopicPath("en",topic));
    for(const next of locales)expect(localizedPath(path,locale,next)).toBe(quizTopicPath(next,topic));
  }
  expect(entries.filter(e=>/\/(quiz|devine-le-footballeur)\/archive/.test(e.url))).toHaveLength(0);
  expect(entries.filter(e=>e.url.includes("practice:"))).toHaveLength(0);
});
it("runs a simultaneous quiz duel with shared timing, private answers and score-based winner",()=>{
  const r=createLive({game:"quiz",locale:"fr",category:"planets"},who());
  liveAction(r.code,who(1),{action:"join"});liveAction(r.code,who(),{action:"ready",ready:true});
  const countdown=liveAction(r.code,who(1),{action:"ready",ready:true});expect(countdown.challenge).toBeUndefined();
  tick(3000);const host=readLive(r.code,who(),true),peer=readLive(r.code,who(1),true);
  expect(host.challenge).toEqual(peer.challenge);expect(host.endAt!-host.startAt!).toBe(60000);
  const c=JSON.parse(ownedRun(host.runId!,who()).challenge_json) as QuizChallenge;
  expect(JSON.stringify(peer.challenge)).not.toContain('"answer"');
  submitLive(r.code,who(),{runId:host.runId,step:{kind:"answer",value:c.items[0].answer},sequence:0});
  expect(JSON.stringify(readLive(r.code,who(1),true))).not.toContain(c.items[0].answer);
  tick(5000);
  submitLive(r.code,who(),{runId:host.runId,step:{kind:"finish"},sequence:1});
  submitLive(r.code,who(1),{runId:peer.runId,step:{kind:"finish"},sequence:0});
  const done=readLive(r.code,who(),true);expect(done.phase).toBe("finished");expect(done.winner).toBe(0);
  expect(done.quizAnswers).toHaveLength(8);
  expect(readLive(r.code,who(9),true).quizAnswers).toBeUndefined();
});
it("reveals a conceded football duel only to its players and changes career on rematch",()=>{
  const r=createLive({game:"football",locale:"fr"},who());
  liveAction(r.code,who(1),{action:"join"});liveAction(r.code,who(),{action:"ready",ready:true});liveAction(r.code,who(1),{action:"ready",ready:true});tick(3000);
  const playing=readLive(r.code,who(),true),c=JSON.parse(ownedRun(playing.runId!,who()).challenge_json) as FootballChallenge;
  expect(playing.footballAnswer).toBeUndefined();
  liveAction(r.code,who(),{action:"resign"});
  expect(readLive(r.code,who(1),true)).toMatchObject({phase:"finished",footballAnswer:c.answer,footballSources:c.sources});
  expect(readLive(r.code,who(9),true).footballAnswer).toBeUndefined();
  liveAction(r.code,who(),{action:"rematch"});liveAction(r.code,who(1),{action:"rematch"});
  liveAction(r.code,who(),{action:"ready",ready:true});liveAction(r.code,who(1),{action:"ready",ready:true});tick(3000);
  const next=readLive(r.code,who(),true);
  expect((JSON.parse(ownedRun(next.runId!,who()).challenge_json) as FootballChallenge).answer).not.toBe(c.answer);
});
