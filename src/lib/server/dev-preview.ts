import { replayKnowledge } from "../knowledge-play";
import { randomInt, randomUUID } from "node:crypto";
import { generateChallenge, publicChallenge } from "../challenges";
import { utcDay } from "../date";
import type { Challenge, Difficulty, GameId, Locale, PlayMode } from "../types";
import type { LocalPreviewFixture } from "../local-preview";
import { rareEntry } from "../rare-word";
import { initialSocial, replaySocial } from "../social-play";
import type { Community, VoteCommunity } from "../social-types";
import { initialPuzzle, replayPuzzle } from "../new-play";
import { neighbors } from "../mines";
import { evaluateExpression } from "../math";
import { verifiedResultDetails } from "./result-details";
import { starterComparison } from "./starter-statistics";

// Local presentation only: never creates runs, results, votes or account data.
export function localPreviewFixture(game: GameId, locale: Locale, difficulty: Difficulty, mode: PlayMode = "practice", source?: Challenge, progress?: {guesses?: string[]; state?: import("../social-types").SocialState}): LocalPreviewFixture {
  const c = source ?? generateChallenge(game, locale, utcDay(), difficulty, randomUUID());
  const now = new Date().toISOString(), samples = randomInt(200, 2001), successes = randomInt(Math.ceil(samples * .6), samples);
  const completion: LocalPreviewFixture["completion"] = {
    challengeId: `dev-preview:${randomUUID()}`, game, locale, date: c.date, mode, success: true,
    duration: c.kind === "quiz" ? randomInt(10,c.seconds+1) : randomInt(60, 240), score: game === "2048" ? 4096 : 1000, completedAt: now, provenance: "server", eligible: false,
    ...("difficulty" in c ? {difficulty: c.difficulty} : {}),
    ...(c.kind === "word" || c.kind === "rareword" ? {attempts: randomInt(2, 5), wordLength: c.length, maxAttempts: c.attempts} : {}),
    ...(c.kind === "guess" ? {numberRules: "higher-lower" as const, outcome: "win" as const, attempts: 5} : {}),
  };
  const history = Array.from({length: 3}, (_, i) => ({...completion,
    challengeId: `dev-preview:${randomUUID()}`, completedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    duration: 180 + i * 70, attempts: completion.attempts === undefined ? undefined : Math.min((completion.maxAttempts ?? 6), completion.attempts + 1 + i), success: ["wordsearch","sudoku","ranking","rather"].includes(game) || i !== 2,
  }));
  let state: LocalPreviewFixture["state"], community: Community = null;
  let puzzleState: LocalPreviewFixture["puzzleState"];
  if (c.kind === "wordsearch") puzzleState = replayPuzzle(c, c.placements.map(p => ({kind:"select", ...p})));
  if (c.kind === "mines") puzzleState = {...initialPuzzle(c), completed:true, success:true, score:1000, mines:c.mines,
    grid:Array.from({length:c.size*c.size}, (_, i) => c.mines.includes(i) ? -2 : neighbors(i,c.size).filter(n => c.mines.includes(n)).length), flags: [...c.mines]};
  if (c.kind === "2048") puzzleState = {...initialPuzzle(c), grid:[2048,128,64,16,32,8,4,2,0,0,0,0,0,0,0,0], moves:150, completed:true, success:true, score:4096};
  if (c.kind === "ranking") {
    const actions = [...(progress?.state?.actions ?? [])];
    const used = actions.flatMap(a => a.kind === "rank" ? [a.position] : []);
    for (const position of [3,1,5,2,4]) if (!used.includes(position)) actions.push({kind:"rank",position});
    state = replaySocial(c, actions);
    const common = state.ranking.map(id => id!);
    [common[0], common[3]] = [common[3], common[0]];
    const percentages = state.ranking.map(item => common.map(id => item === id ? 68 : 8));
    community = {kind: "ranking", samples, percentages, common,
      average: common.map((item, i) => ({item, position: (i + 1) * .6 + 1.2})),
      matched: 3, unusual: randomInt(60, 96), swap: randomInt(60, 91), controversial: 4, hasControversy: true};
  } else if (c.kind === "rather") {
    state = replaySocial(c, c.questions.map((_, i) => ({kind: "vote", choice: progress?.state?.votes[i] ?? (i % 2 ? "b" : "a")})));
    const questions: VoteCommunity[] = c.questions.map((q, i) => {
      const a = i === 1 ? 51 : randomInt(20, 81), count = Math.round(samples * a / 100);
      return {id: q.id, samples, a, b: 100 - a, counts: [count, samples - count], majority: a === 50 ? null : a > 50 ? "a" : "b"};
    });
    const votes = state.votes, decided = questions.filter(q => q.majority !== null).length;
    community = {kind: "rather", samples,
      matched: Math.round(questions.filter((q, i) => q.majority === votes[i]).length * 100 / decided),
      rarest: questions.reduce((best, q, i) => q[votes[i]] < questions[best][votes[best]] ? i : best, 0),
      divisive: questions.reduce((best, q, i) => Math.abs(q.a - 50) < Math.abs(questions[best].a - 50) ? i : best, 0),
      unusual: randomInt(60, 96), questions};
  } else if (c.kind === "guess") {
    state = {...initialSocial(c), ...progress?.state, completed: true, success: true, yourNumber: progress?.state?.yourNumber ?? 73, opponentNumber: c.secret, turns: 5};
    state.events=Array.from({length:4},(_,i)=>({actor:"bot" as const,action:{kind:"try" as const,value:20+i*10},answer:false,direction:"higher" as const,eliminated:10,remaining:90-i*10}));
    community = {kind: "guess", samples, faster: randomInt(60, 96), fooled: randomInt(60, 96)};
  }
  const knowledgeState=c.kind === "quiz" ? replayKnowledge(c,c.items.map(i=>({kind:"answer",value:i.answer}))) : c.kind === "football" ? replayKnowledge(c,[{kind:"answer",value:c.answer}]) : undefined;
  if (c.kind === "quiz" || c.kind === "football") {
    completion.knowledgeSet=c.cohortKey;completion.score=knowledgeState!.score;if(c.kind === "football")completion.attempts=1;
    for (const prior of history) {
      prior.knowledgeSet=c.cohortKey;
      if(c.kind === "quiz") {prior.duration=c.seconds;prior.answersFound=c.items.length-2;prior.answersTotal=c.items.length;prior.score=Math.round(prior.answersFound*1000/c.items.length);prior.success=false;}
      else {prior.attempts=prior.success?3:6;prior.score=prior.success?400:0;}
    }
  }
  const details=verifiedResultDetails(c,c.kind==="math" ? evaluateExpression(c.reference,c.numbers,c.target) : {state:knowledgeState??state??puzzleState});
  Object.assign(completion,details);
  if (c.kind !== "quiz") for(const prior of history) Object.assign(prior,details);
  return {completion, history, challenge: c.kind === "ranking" ? c : publicChallenge(c), state, community,
    puzzleState, knowledgeState,
    ...(c.kind === "sudoku" ? {grid:c.solution} : {}),
    ...(c.kind === "math" ? {expression:c.reference, mathResult:{...evaluateExpression(c.reference,c.numbers,c.target),reference:c.reference}} : {}),
    comparison: c.kind === "quiz" || c.kind === "football" ? starterComparison(completion) : {samples, successes, successRate: successes * 100 / samples, averageTime: 280, medianTime:250, precisionSamples:samples,closerThanPercent:game==="math"?randomInt(60,90):null,fewerAttemptsThanPercent:completion.attempts===undefined?null:randomInt(60,90),attemptDistribution:game==="word"||game==="rareword"?[{attempts:2,count:successes*.2,percent:20},{attempts:3,count:successes*.4,percent:40},{attempts:4,count:successes*.4,percent:40}]:[],fasterThanPercent: randomInt(60, 98),
      betterScoreThanPercent: game === "2048" || game === "quiz" ? randomInt(60, 98) : null, averageAttempts: completion.attempts === undefined ? null : completion.attempts + 1.4,
      fewerAttemptsThanAverage: completion.attempts === undefined ? null : 1.4, commonAttempts: completion.attempts === undefined ? [] : [completion.attempts + 1]},
    ...(c.kind === "word" || c.kind === "rareword" ? {answer: c.answer,
      wordGuesses:[...(progress?.guesses ?? []).slice(0,c.attempts-1),c.answer],
      completion:{...completion, attempts:Math.min(c.attempts,(progress?.guesses?.length ?? 0)+1)}} : {}),
    ...(c.kind === "rareword" ? {discovery: rareEntry(locale, c.answer)} : {}),
  };
}
