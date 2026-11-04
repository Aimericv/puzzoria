import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import geometry from "../public/maps/europe-v1.json" with { type: "json" };
import countries from "../src/lib/server/data/europe-map.v1.json" with { type: "json" };
import original from "../src/lib/server/data/quiz-expansion.v1.json" with { type: "json" };
import { validMapGeometry } from "../src/lib/map-geometry";
import { generateKnowledge } from "../src/lib/server/knowledge-content";
import { publicChallenge, validateChallenge } from "../src/lib/challenges";
import { replayKnowledge } from "../src/lib/knowledge-play";
import { mapCopy } from "../src/lib/map-i18n";
import { europeMapTopic } from "../src/lib/map-quiz-catalog";
import { locales } from "../src/lib/types";
import type { QuizChallenge } from "../src/lib/knowledge-types";
import { createRun, beginRun, getRun, ownedRun, submitRun } from "../src/lib/server/play";
import { closeDatabase, database } from "../src/lib/server/database";
import { createLive, liveAction, readLive, submitLive } from "../src/lib/server/live-rooms";
import { personalResultStatistics } from "../src/lib/engagement";
import { comparisonStatistics } from "../src/lib/statistics";
import { completionFromRow, type ResultRow } from "../src/lib/server/results";
import { localPreviewFixture } from "../src/lib/server/dev-preview";

const who=(id="one")=>({user:null,guestId:id,owner:`g:${id}`});
const make=(locale="fr",seed="sample")=>generateKnowledge("quiz",locale as "fr","2026-11-03",seed,"europe-map") as QuizChallenge;
const perfect=(c:QuizChallenge)=>c.items.map(i=>({kind:"place" as const,region:i.answer}));
const hash=(data:unknown)=>createHash("sha256").update(JSON.stringify(data)).digest("hex");
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));});
afterEach(()=>{closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});

it("freezes the 44-country scope, geometry and translations independently from the original quizzes",()=>{
  expect(countries).toHaveLength(44);expect(validMapGeometry(geometry)).toBe(true);
  expect(hash(geometry)).toBe("9b49e5619ef92651e955a180163d6051861901ea2e44a4341a3eb5d34643ba68");
  expect(hash(countries)).toBe("b1a8861f01b9634bdd43f504e0b606d7f19cb6bb549a5537aaf0d74c1ff9e040");
  expect(countries.map(r=>r.name).sort((a,b)=>a.en.localeCompare(b.en))).toEqual(original["countries-europe"].map(r=>r.answer).sort((a,b)=>a.en.localeCompare(b.en)));
  expect(new Set(countries.map(r=>r.region))).toEqual(new Set(geometry.regions.map(r=>r.id)));
  expect(countries.some(r=>["TR","CY","XK"].includes(r.iso))).toBe(false);
  expect(geometry.regions.filter(r=>r.small)).toHaveLength(7);
  expect(validMapGeometry({...geometry,regions:Array(44).fill(null)})).toBe(false);
  expect(validMapGeometry({...geometry,context:'<script>alert(1)</script>'})).toBe(false);
  for(const c of countries)for(const locale of locales)expect(JSON.stringify(geometry)).not.toContain(c.name[locale]);
});
it("keeps every region anchor inside its rendered outline, including the corrected Vatican anchor",()=>{
  function inside(point:number[],ring:number[][]){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
  for(const region of geometry.regions){const rings=region.path.split('Z').filter(Boolean).map(d=>d.slice(1).split('L').map(p=>p.split(',').map(Number)));expect(rings.filter(r=>inside(region.point,r)).length%2,region.id).toBe(1);}
});
it("generates a shuffled, fully playable map in all four locales without sending answer locations",()=>{
  for(const locale of locales){const c=make(locale);validateChallenge(c);const dto=publicChallenge(c);
    expect(dto).toMatchObject({format:"map",mapId:"europe-v1",seconds:600});
    expect(JSON.stringify(dto)).not.toContain('"answer"');expect(JSON.stringify(dto)).not.toContain('"aliases"');
    for(const region of geometry.regions)expect(JSON.stringify(dto)).not.toContain(region.id);
    expect(replayKnowledge(c,perfect(c))).toMatchObject({completed:true,success:true,score:1000,sequence:44,map:{index:44}});
    expect(mapCopy(locale).ready.length).toBeGreaterThan(140);expect(europeMapTopic.scope?.[locale]).toBeTruthy();
  }
  expect(make("fr","new-seed").items.map(i=>i.prompt)).not.toEqual(make().items.map(i=>i.prompt));
});
it("resolves one target per confirmed click, keeps skips/wrong answers at zero points and reveals only resolved targets",()=>{
  const c=make(),empty=replayKnowledge(c,[]);expect(empty.map?.solution).toBeUndefined();
  const wrong={kind:"place",region:c.items[1].answer};
  const state=replayKnowledge(c,[wrong,{kind:"map-skip"},{kind:"place",region:c.items[2].answer}]);
  expect(state).toMatchObject({completed:false,score:23,sequence:3,map:{index:3},found:[{id:c.items[2].id,answer:c.items[2].prompt}]});
  expect(state.map?.placements).toHaveLength(3);expect(state.map?.solution).toBeUndefined();
  const done=replayKnowledge(c,[wrong,{kind:"finish"}]);expect(done).toMatchObject({completed:true,success:false,score:0});expect(done.map?.solution).toHaveLength(44);
  expect(()=>replayKnowledge(c,[{kind:"answer",value:c.items[0].answer}])).toThrow();
  expect(()=>replayKnowledge(c,[{kind:"place",region:"context-area"}])).toThrow();
  expect(()=>replayKnowledge(c,[...perfect(c),{kind:"map-skip"}])).toThrow();
});
it("saves real map proofs and derived metrics with start, ownership, sequencing and idempotency guards",async()=>{
  const identity=who(),run=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"europe-map"},identity);
  const c=JSON.parse(ownedRun(run.runId,identity).challenge_json) as QuizChallenge,step=perfect(c)[0];
  expect(()=>submitRun(run.runId,identity,{sequence:0,step})).toThrow();beginRun(run.runId,identity);
  expect(()=>submitRun(run.runId,who("stranger"),{sequence:0,step})).toThrow();
  const first=submitRun(run.runId,identity,{sequence:0,step});expect(submitRun(run.runId,identity,{sequence:0,step})).toEqual(first);
  expect(()=>submitRun(run.runId,identity,{sequence:3,step})).toThrow();
  expect(()=>submitRun(run.runId,identity,{actions:perfect(c)})).toThrow();
  expect(getRun(run.runId,identity).progress).toMatchObject({map:{index:1}});
  vi.setSystemTime(Date.now()+60000);
  for(let sequence=1;sequence<c.items.length;sequence++)submitRun(run.runId,identity,{sequence,step:perfect(c)[sequence],score:999999,mapErrors:999});
  const saved=completionFromRow(database().prepare("SELECT * FROM results WHERE id=?").get(run.runId) as ResultRow);
  expect(saved).toMatchObject({success:true,score:1000,answersFound:44,answersTotal:44,mapErrors:0,duration:60});
  expect(database().prepare("SELECT COUNT(*) n FROM results").get()).toMatchObject({n:1});
});
it("closes an expired map without accepting late placements or resetting its time",async()=>{
  const run=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"europe-map"},who()),c=JSON.parse(ownedRun(run.runId,who()).challenge_json) as QuizChallenge;
  beginRun(run.runId,who());vi.setSystemTime(Date.now()+600001);
  const done=submitRun(run.runId,who(),{sequence:0,step:perfect(c)[0]});
  expect(done.completion).toMatchObject({success:false,answersFound:0,mapErrors:0,duration:600});expect(done.state.map.solution).toHaveLength(44);
});
it("keeps map records/comparisons separate from text topics and suppresses speed after a mistake",async()=>{
  const run=await createRun({game:"quiz",locale:"fr",mode:"practice",category:"europe-map"},who()),c=JSON.parse(ownedRun(run.runId,who()).challenge_json) as QuizChallenge;
  beginRun(run.runId,who());vi.setSystemTime(Date.now()+20000);
  submitRun(run.runId,who(),{sequence:0,step:{kind:"place",region:c.items[1].answer}});
  const done=submitRun(run.runId,who(),{sequence:1,step:{kind:"finish"}}).completion;
  expect(done).toMatchObject({answersFound:0,mapErrors:1,success:false});
  const perfectResult={...done,success:true,score:1000,answersFound:44,mapErrors:0,duration:60};
  expect(personalResultStatistics([{...perfectResult,challengeId:"text",knowledgeSet:"quiz:countries-europe:v1:fr",duration:1}],perfectResult)).toMatchObject({played:1,bestTime:60});
  const peers=Array.from({length:20},(_,i)=>({...perfectResult,runId:`peer-${i}`,duration:90}));
  expect(comparisonStatistics(peers,perfectResult)?.fasterThanPercent).toBe(100);expect(comparisonStatistics(peers,done)?.fasterThanPercent).toBeNull();
  expect(comparisonStatistics(peers.slice(0,19),perfectResult)).toBeNull();
  const tied=peers.map(p=>({...p,duration:perfectResult.duration}));
  expect(comparisonStatistics(tied,perfectResult)).toMatchObject({fasterThanPercent:0,betterScoreThanPercent:0});
});
it("supports private live map rooms without exposing answer locations or peer placements before completion",()=>{
  const room=createLive({game:"quiz",locale:"fr",category:"europe-map"},who());liveAction(room.code,who("peer"),{action:"join"});liveAction(room.code,who(),{action:"ready",ready:true});liveAction(room.code,who("peer"),{action:"ready",ready:true});
  vi.setSystemTime(Date.now()+3000);const host=readLive(room.code,who(),true),peer=readLive(room.code,who("peer"),true),c=JSON.parse(ownedRun(host.runId!,who()).challenge_json) as QuizChallenge;
  expect(host.endAt!-host.startAt!).toBe(600000);expect(peer.challenge).toEqual(host.challenge);
  submitLive(room.code,who(),{runId:host.runId,sequence:0,step:perfect(c)[0]});
  const other=readLive(room.code,who("peer"),true);expect(JSON.stringify(other)).not.toContain(c.items[0].answer);expect(other.players[0].progress).toBe(1);
  submitLive(room.code,who(),{runId:host.runId,sequence:1,step:{kind:"finish"}});submitLive(room.code,who("peer"),{runId:peer.runId,sequence:0,step:{kind:"finish"}});
  expect(readLive(room.code,who(),true)).toMatchObject({phase:"finished",winner:0});expect(readLive(room.code,who(),true).quizAnswers).toBeUndefined();
});
it("renders local map completion through the same replay without persisting any result",()=>{
  const preview=localPreviewFixture("quiz","fr","easy","practice",make());
  expect(preview.knowledgeState).toMatchObject({completed:true,map:{index:44}});expect(preview.completion).toMatchObject({mapErrors:0,answersFound:44});
  expect(database().prepare("SELECT COUNT(*) n FROM results").get()).toMatchObject({n:0});
});
