import { seededRandom, shuffled } from "../random";
import { numberRuleSet } from "../number-duel";
import { comparisonStatistics, type Comparison } from "../statistics";
import type { Completion } from "../types";
import type { GuessChallenge, GuessCommunity, SocialState, VoteCommunity } from "../social-types";

// Presentation only: these populations are never inserted into SQLite or analytics.
export const starterStatisticsEnabled = () => process.env.COMMUNITY_STARTER_STATS === "true";
const populationSize = (seed: string) => 240 + Math.floor(seededRandom(`population:${seed}`)() * 480);

export function starterComparison(current: Completion): Comparison {
  const cohort = [current.game, current.mode, current.locale, current.difficulty,
    current.wordLength, current.maxAttempts,
    current.mode === "daily" ? current.challengeId : current.date].join(":");
  const random = seededRandom(`performance:${cohort}`), count = populationSize(cohort);
  const baseline = {word:115,rareword:230,sudoku:330,math:55,mines:95,wordsearch:165,
    "2048":360,guess:90,ranking:60,rather:90}[current.game]
    * (current.difficulty === "hard" ? 2 : current.difficulty === "medium" ? 1.45 : 1);
  const winRate = {word:.87,rareword:.67,mines:.64,math:.56,guess:.62,
    sudoku:1,wordsearch:1,"2048":1,ranking:1,rather:1}[current.game];
  const budget = current.maxAttempts ?? (current.game === "rareword" ? 8 : 6);
  const word = current.game === "word" || current.game === "rareword";
  const weights = Array.from({length:budget},(_,i) =>
    Math.exp(-((i + 1 - (current.game === "rareword" ? budget * .66 : 4)) ** 2) / 2.4));
  const totalWeight = weights.reduce((sum,n)=>sum+n,0);
  const attempts = () => {
    let target = random() * totalWeight;
    for(let i=0;i<weights.length;i++) {target-=weights[i]; if(target<=0) return i+1;}
    return budget;
  };
  const peers: Completion[] = Array.from({length:count},(_,i)=>{
    const success = random() < winRate;
    return {...current,runId:`starter:${cohort}:${i}`,success,
      duration:Math.max(1,Math.round(baseline * (.35 - Math.log(Math.max(.001,random())) * .65))),
      score:current.game==="2048" ? Math.round((400+random()*8500)/4)*4 : current.score,
      attempts:word ? attempts() : undefined,
      ...(current.game==="math" ? {mathDistance:success ? 0 : 1+Math.floor(random()*110)} : {})};
  });
  return {...comparisonStatistics(peers,current)!,source:"starter"};
}

export function starterRankings(items: string[], cohort: string): string[][] {
  const random=seededRandom(`ranking:${cohort}`), common=shuffled([...items].sort(),random);
  return Array.from({length:populationSize(cohort)},()=>{
    if(random()<.2) return shuffled(common,random);
    const ranking=[...common];
    const changes=random()<.4 ? 0 : random()<.7 ? 1 : 2;
    for(let i=0;i<changes;i++) {
      const a=Math.floor(random()*5),b=Math.floor(random()*5);
      [ranking[a],ranking[b]]=[ranking[b],ranking[a]];
    }
    return ranking;
  });
}

export function starterChoices(id: string): ("a"|"b")[] {
  const random=seededRandom(`vote:${id}`), probability=.12+random()*.76;
  return Array.from({length:populationSize(id)},()=>random()<probability ? "a" : "b");
}

export function starterUnusualness(questions: VoteCommunity[], choices: ("a"|"b")[]): {samples:number;unusual:number} {
  const seed=questions.map(q=>q.id).join(":"),random=seededRandom(`choices:${seed}`),samples=populationSize(seed);
  const rarity=(votes:("a"|"b")[])=>-votes.reduce((sum,v,i)=>sum+Math.log((questions[i].counts[v==="a"?0:1]+1)/(questions[i].samples+2)),0);
  const current=rarity(choices);
  let lessUnusual=0;
  for(let i=0;i<samples;i++) {
    const votes=questions.map(q=>random()<q.counts[0]/q.samples ? "a" as const : "b" as const);
    if(rarity(votes)<current-1e-10) lessUnusual++;
  }
  return {samples,unusual:Math.round(lessUnusual*100/samples)};
}

export function starterGuess(c: GuessChallenge,state:SocialState): GuessCommunity {
  const seed=[c.difficulty,c.mode,c.date,numberRuleSet(state)].join(":"),random=seededRandom(`guess:${seed}`),samples=populationSize(seed);
  const botTurns=state.events.filter(e=>e.actor==="bot").length;
  let slower=0,lessFooled=0;
  for(let i=0;i<samples;i++) {
    const proposals=2+Math.floor(random()*11);
    const botProposals=c.difficulty==="easy" ? 3+Math.floor(random()*11) : c.difficulty==="medium" ? 3+Math.floor(random()*6) : 3+Math.floor(random()*5);
    if(proposals>state.turns) slower++;
    if(botProposals<botTurns) lessFooled++;
  }
  return {kind:"guess",samples,faster:state.success?Math.round(slower*100/samples):0,
    fooled:Math.round(lessFooled*100/samples),source:"starter"};
}
