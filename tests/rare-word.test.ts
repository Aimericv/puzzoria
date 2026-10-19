import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gameAvailable, generateChallenge, getChallenge, publicChallenge, validateChallenge } from "../src/lib/challenges";
import { locales, type Completion } from "../src/lib/types";
import { acceptedRareWord, rareEntry } from "../src/lib/rare-word";
import { normalizeWord } from "../src/lib/word-normalization";
import { validateProof, createRun, beginRun, submitRun, getRun, compareRun, ownedRun } from "../src/lib/server/play";
import { closeDatabase } from "../src/lib/server/database";
import { completionFromRow, saveResult, type ResultRow } from "../src/lib/server/results";
import { personalResultStatistics } from "../src/lib/engagement";
import { shareSummary } from "../src/lib/share";
import { hasDaily } from "../src/lib/game-modes";
import { gameMetadata } from "../src/lib/seo";
import type { Identity } from "../src/lib/server/auth";
import { createFriend, joinFriend, viewFriend } from "../src/lib/server/friends";
import sitemap from "../src/app/sitemap";

const who: Identity = {user:null, guestId:"rare-test-owner", owner:"g:rare-test-owner"};
beforeEach(() => {
  closeDatabase(); vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({toFake:["Date"]}); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
});
afterEach(() => {closeDatabase();vi.useRealTimers();vi.unstubAllEnvs();});

describe("Unusual Word daily discovery", () => {
  it("never advertises an unpublished unusual word or a future archive in the sitemap", () => {
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    expect(sitemap().some(entry => entry.url.includes("/mot-insolite"))).toBe(false);
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    expect(sitemap().filter(entry => entry.url.includes("/mot-insolite")).map(entry => new URL(entry.url).pathname)).toEqual(["/fr/mot-insolite"]);
  });
  it.each(locales)("publishes a distinct deterministic %s deck with complete explanations and no public answer", async locale => {
    const words = new Set();
    for (let day=4;day<12;day++) {
      const date = `2026-10-${String(day).padStart(2,"0")}`;
      const challenge = generateChallenge("rareword", locale, date);
      expect(challenge.kind).toBe("rareword");
      if (challenge.kind !== "rareword") throw new Error();
      validateChallenge(challenge);
      expect(await getChallenge("rareword",locale,date)).toEqual(challenge);
      expect(generateChallenge("rareword",locale,date)).toEqual(challenge);
      expect(challenge.length).toBe(normalizeWord(challenge.answer).length);
      expect(challenge.attempts).toBe(challenge.length <= 8 ? 8 : 10);
      expect(acceptedRareWord(challenge.answer,locale,challenge.length)).toBe(true);
      const entry = rareEntry(locale,challenge.answer);
      expect(entry.definition.length).toBeGreaterThan(20);
      expect(entry.origin.length).toBeGreaterThan(15);
      expect(entry.example.length).toBeGreaterThan(15);
      expect(entry.source).toMatch(/^https:\/\//);
      expect(publicChallenge(challenge)).not.toHaveProperty("answer");
      expect(publicChallenge(challenge)).not.toHaveProperty("discovery");
      words.add(normalizeWord(challenge.answer));
    }
    expect(words.size).toBe(8);
    expect(hasDaily("rareword")).toBe(true);
    expect(gameAvailable("rareword","2026-10-03")).toBe(false);
    expect(() => generateChallenge("rareword",locale,"2026-10-03")).toThrow();
    const seo = gameMetadata(locale,"rareword");
    expect(seo.alternates?.languages?.["x-default"]).toContain("/en/unusual-word");
  });

  it("validates variable-length proofs, reveals the explanation only at the end and enforces the guess budget", () => {
    const challenge = generateChallenge("rareword","fr","2026-10-04");
    if(challenge.kind !== "rareword") throw new Error();
    const wrong = "GALIMATIAS"; // 10 letters, accepted but not today's answer.
    const first = validateProof(challenge,{guesses:[wrong]});
    expect(first.completed).toBe(false);
    expect(first).not.toHaveProperty("answer");expect(first).not.toHaveProperty("discovery");
    expect(() => validateProof(challenge,{guesses:["OUTIL"]})).toThrow();
    expect(() => validateProof(challenge,{guesses:["ZZZZZZZZZZ"]})).toThrow();
    expect(() => validateProof(challenge,{guesses:Array(11).fill(wrong)})).toThrow();
    const won = validateProof(challenge,{guesses:[wrong,challenge.answer]});
    expect(won).toMatchObject({completed:true,success:true,attempts:2,score:900,discovery:rareEntry("fr",challenge.answer)});
    const lost = validateProof(challenge,{guesses:Array(10).fill(wrong)});
    expect(lost).toMatchObject({completed:true,success:false,attempts:10,score:0});
    expect(lost).toHaveProperty("discovery");
    expect(() => validateProof(challenge,{guesses:[challenge.answer,wrong]})).toThrow();
  });

  it("keeps server progress authoritative, first Daily results immutable and Practice independent", async () => {
    const run = await createRun({game:"rareword",locale:"fr"},who);
    expect(run).not.toHaveProperty("result");
    expect(() => submitRun(run.runId,who,{guesses:["ANACOLUTHE"]})).toThrow();
    beginRun(run.runId,who);
    submitRun(run.runId,who,{guesses:["GALIMATIAS"]});
    expect(() => submitRun(run.runId,who,{guesses:["ANACOLUTHE"]})).toThrow();
    vi.setSystemTime(new Date("2026-10-04T12:00:12Z"));
    const result = submitRun(run.runId,who,{guesses:["GALIMATIAS","ANACOLUTHE"]});
    expect(result.completion).toMatchObject({game:"rareword",mode:"daily",wordLength:10,maxAttempts:10,attempts:2,eligible:true});
    expect(getRun(run.runId,who).result.discovery.word).toBe("anacoluthe");
    expect(submitRun(run.runId,who,{guesses:["invalid"]})).toEqual(JSON.parse(JSON.stringify(result)));
    expect((await createRun({game:"rareword",locale:"fr"},who)).runId).toBe(run.runId);
    expect((await createRun({game:"word",locale:"fr"},who)).runId).not.toBe(run.runId);
    const practice = await createRun({game:"rareword",locale:"fr",mode:"practice"},who);
    expect(practice.challenge.mode).toBe("practice");expect(practice.runId).not.toBe(run.runId);
    expect(compareRun(run.runId,who)).toBeNull();
    expect(() => getRun(run.runId,{...who,owner:"g:other"})).toThrow();
  });

  it("compares only compatible word lengths, preserves metadata and shares the correct budget without the answer", () => {
    const current: Completion = {challengeId:"practice:rareword:x:fr",game:"rareword",locale:"fr",date:"2026-10-04",mode:"practice",success:true,attempts:2,wordLength:10,maxAttempts:10,duration:30,score:900,completedAt:new Date().toISOString(),provenance:"server"};
    const other = {...current,challengeId:"other",wordLength:7,maxAttempts:8};
    expect(personalResultStatistics([other],current).played).toBe(1);
    saveResult("metadata",who,current,{wordLength:10,maxAttempts:10});
    // Exercise persistent representation through the same authoritative reader.
    const {wordLength,maxAttempts} = completionFromRow({id:"metadata",game:"rareword",mode:"practice",challenge_id:current.challengeId,locale:"fr",date:current.date,completed_at:current.completedAt,duration:30,score:900,attempts:2,success:1,errors:0,provenance:"server",eligible:0,metadata_json:'{"wordLength":10,"maxAttempts":10}',difficulty:null,started_at:null,user_id:null,owner:who.owner} as ResultRow);
    expect([wordLength,maxAttempts]).toEqual([10,10]);
    const text = shareSummary(current,"fr","https://dailygrid.fr",[Array(10).fill("correct")]);
    expect(text).toContain("2/10");expect(text).toContain("🟩".repeat(10));expect(text).not.toContain("ANACOLUTHE");
  });

  it("requires 20 other owners of the same language, length and attempt budget for real Practice comparisons", async () => {
    const run = await createRun({game:"rareword",locale:"fr",mode:"practice"},who);
    const c = JSON.parse(ownedRun(run.runId,who).challenge_json);
    beginRun(run.runId,who); vi.setSystemTime(new Date("2026-10-04T12:00:12Z"));
    const completion = submitRun(run.runId,who,{guesses:[c.answer]}).completion as Completion;
    const sample = (id:string, overrides:Partial<Completion>, metadata:Record<string,unknown>) => saveResult(id,{...who,owner:`g:${id}`},{...completion,challengeId:`practice:${id}`,duration:20,...overrides},{comparisonEligible:true,wordLength:c.length,maxAttempts:c.attempts,...metadata});
    for(let n=0;n<50;n++) {
      sample(`length-${n}`,{},{wordLength:c.length === 7 ? 10 : 7});
      sample(`budget-${n}`,{},{maxAttempts:c.attempts === 8 ? 10 : 8});
      sample(`locale-${n}`,{locale:"es"},{});
      sample(`classic-${n}`,{game:"word"},{});
    }
    expect(compareRun(run.runId,who)).toBeNull();
    for(let n=0;n<19;n++) sample(`peer-${n}`,{},{});
    expect(compareRun(run.runId,who)).toBeNull();
    sample("peer-49",{},{});
    expect(compareRun(run.runId,who)).toMatchObject({samples:20,successes:20,fasterThanPercent:100});
  });

  it("keeps the Daily streak across word lengths while Practice and classic Word results stay separate", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
    const current: Completion = {game:"rareword",challengeId:"rareword:2026-10-05:fr",locale:"fr",mode:"daily",date:"2026-10-05",completedAt:new Date().toISOString(),success:true,duration:100,score:700,attempts:2,wordLength:8,maxAttempts:8,provenance:"server"};
    const previous = {...current,challengeId:"rareword:2026-10-04:fr",date:"2026-10-04",completedAt:"2026-10-04T12:00:00Z",wordLength:10,maxAttempts:10};
    const practice = {...previous,challengeId:"practice:rareword:seed:fr",mode:"practice" as const};
    const classic = {...previous,challengeId:"word:2026-10-04:fr",game:"word" as const};
    expect(personalResultStatistics([previous,practice,classic],current)).toMatchObject({played:2,currentStreak:2});
  });

  it("shares the exact unusual word with a friend without revealing it before play or changing Daily results", async () => {
    const original = await createRun({game:"rareword",locale:"fr"},who);
    beginRun(original.runId,who);
    const hostResult = submitRun(original.runId,who,{guesses:["ANACOLUTHE"]});
    const {id} = createFriend(original.runId,who);
    const peer = {...who,owner:"g:rare-friend",guestId:"rare-friend"};
    const view = viewFriend(id,peer);
    expect(view.challenge).toMatchObject({kind:"rareword",locale:"fr",length:10,attempts:10,mode:"practice",friendId:id});
    expect(view.challenge).not.toHaveProperty("answer");expect(view.challenge).not.toHaveProperty("discovery");
    const invitation = joinFriend(id,peer);beginRun(invitation.runId,peer);
    const result = submitRun(invitation.runId,peer,{guesses:["ANACOLUTHE"]});
    expect(result.completion).toMatchObject({mode:"practice",friendId:id,eligible:false,maxAttempts:10});
    expect(result.discovery.word).toBe("anacoluthe");
    expect(getRun(original.runId,who).result.completion).toEqual(JSON.parse(JSON.stringify(hostResult.completion)));
  });
});
