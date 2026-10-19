import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {comparisonStatistics,personalStatistics} from "../src/lib/statistics";
import type {Completion,MathChallenge} from "../src/lib/types";
import {closeDatabase,database} from "../src/lib/server/database";
import {beginRun,createRun,ownedRun,submitRun} from "../src/lib/server/play";
import {completionFromRow,type ResultRow} from "../src/lib/server/results";
import {evaluateExpression} from "../src/lib/math";
import {readResultDetails} from "../src/lib/result-details";
const base:Completion={game:"math",challengeId:"test",mode:"practice",locale:"fr",date:"2026-10-06",success:true,duration:20,score:1000,completedAt:"2026-10-06T12:00:00Z",provenance:"server"};
beforeEach(()=>{closeDatabase();vi.stubEnv("DAILYGRID_DB_PATH",":memory:");});
afterEach(()=>{closeDatabase();vi.unstubAllEnvs();});
it("compares precision independently of the score and ignores tied distances",()=>{
 const peers=Array.from({length:20},(_,i)=>({...base,success:false,mathDistance:i<5?2:i<10?5:8,score:i%2?100:1000}));
 expect(comparisonStatistics(peers,{...base,success:false,mathDistance:5})).toMatchObject({closerThanPercent:50,precisionSamples:20,fasterThanPercent:null});
});
it("does not infer missing historical distances or publish a precision metric below twenty",()=>{
 const peers=Array.from({length:20},(_,i)=>({...base,...(i<19?{mathDistance:3}:{})}));
 expect(comparisonStatistics(peers,{...base,mathDistance:1})?.closerThanPercent).toBeNull();
 expect(personalStatistics([base],"math","practice")).toMatchObject({bestDistance:null,averageDistance:null});
});
it("uses the median of wins, strict fewer-attempt counts and a distribution with a winning denominator",()=>{
 const peers=Array.from({length:25},(_,i)=>({...base,game:"word" as const,success:i<20,duration:i===19?1000:10,attempts:i<10?2:4}));
 expect(comparisonStatistics(peers,{...base,game:"word",attempts:2})).toMatchObject({medianTime:10,fewerAttemptsThanPercent:50,attemptDistribution:[{attempts:2,count:10,percent:50},{attempts:4,count:10,percent:50}]});
});
it("hides winning medians, attempt percentiles and distributions below twenty wins",()=>{
 const peers=Array.from({length:20},(_,i)=>({...base,game:"word" as const,success:i<19,attempts:2}));
 expect(comparisonStatistics(peers,{...base,game:"word",attempts:1})).toMatchObject({medianTime:null,fewerAttemptsThanPercent:null,attemptDistribution:[]});
});
it("keeps game details separated and rejects unknown/non-finite presentation values",()=>{
 expect(readResultDetails("math",{mathDistance:Infinity,mathValue:-2,largestTile:2048,secret:73})).toEqual({mathValue:-2});
 expect(readResultDetails("2048",{largestTile:2048,moves:120,mathDistance:0})).toEqual({largestTile:2048,moves:120});
});
it("saves and restores server-derived calculation details while ignoring forged summaries",async()=>{
 const who={user:null,guestId:"a".repeat(43),owner:"g:"+"a".repeat(43)};
 const run=await createRun({game:"math",locale:"fr",mode:"practice"},who);
 const c=JSON.parse(ownedRun(run.runId,who).challenge_json) as MathChallenge;
 beginRun(run.runId,who);
 const expected=evaluateExpression(c.reference,c.numbers,c.target);
 const result=submitRun(run.runId,who,{expression:c.reference,mathDistance:999,mathValue:999,operations:999,score:999999});
 expect(result?.completion).toMatchObject({mathTarget:c.target,mathValue:expected.value,mathDistance:0,operations:expected.operations});
 const row=database().prepare("SELECT * FROM results WHERE id=?").get(run.runId) as ResultRow;
 expect(completionFromRow(row)).toMatchObject({mathTarget:c.target,mathValue:expected.value,mathDistance:0,operations:expected.operations});
});
