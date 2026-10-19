import type { Completion, Locale, ResultDetails } from "@/lib/types";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
import { t } from "@/lib/i18n";
import { clockText } from "./storage";

export function ResultMetrics({completion:c,locale,answer,details={}}:{completion:Completion;locale:Locale;answer?:string;details?:ResultDetails}) {
  const m=gameStatisticsCopy(locale), base=t(locale), d={...c,...details};
  const items: [string,string|number|undefined][] = c.game === "math"
    ? [[m.target,d.mathTarget],[m.value,d.mathValue],[m.gap,d.mathDistance],[base.timer,clockText(c.duration)]]
    : c.game === "2048" ? [[base.score,c.score],[m.largestTile,d.largestTile],[m.moves,d.moves]]
    : c.game === "guess" ? [[m.yourGuesses,c.attempts],[m.botGuesses,d.botAttempts]]
    : c.game === "ranking" || c.game === "rather" ? [[m.choices,d.choicesCount]]
    : c.game === "word" || c.game === "rareword" ? [[base.timer,clockText(c.duration)],[base.attemptsLabel,`${c.attempts}/${c.maxAttempts??6}`]]
    : c.game === "wordsearch" ? [[base.timer,clockText(c.duration)],[m.wordsFound,d.wordsFound!==undefined&&d.wordsTotal!==undefined?`${d.wordsFound}/${d.wordsTotal}`:undefined]]
    : [[base.timer,clockText(c.duration)]];
  return <div className={`completion-metrics${answer?" word-metrics":""}`} data-result-metrics={c.game}>
    {items.filter(([,v])=>v!==undefined).map(([label,value])=><span key={label} data-result-metric={label}>{label} <strong>{value}</strong></span>)}
    {answer&&<span className="revealed-answer">{base.wordAnswer} <strong>{answer}</strong></span>}
  </div>;
}
