import type { Completion, Locale } from "@/lib/types";
import type { Comparison } from "@/lib/statistics";
import { kt } from "@/lib/knowledge-i18n";
import { rt } from "@/lib/retention-i18n";
import { comparisonCopy } from "@/lib/comparison-i18n";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
import { hasWinRate, hasTimeComparison, resultCopy } from "@/lib/result-metrics";
import { OutcomeBar } from "./outcome-bar";
import { clockText } from "./storage";

export function GameComparison({completion:c,comparison:p,locale}:{completion:Completion;comparison:Comparison;locale:Locale}) {
  const m=rt(locale), labels=gameStatisticsCopy(locale), copy=comparisonCopy(locale);
  const format=(n:number)=>new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(n);
  let highlight:string|null=null;
  if(c.game==="math") {
    if(c.success&&p.fasterThanPercent!==null) highlight=labels.exactSpeed.replace("{n}",String(Math.round(p.fasterThanPercent)));
    else if(!c.success&&p.closerThanPercent!==null&&p.closerThanPercent!==undefined) highlight=labels.precision.replace("{n}",String(Math.round(p.closerThanPercent)));
  } else if(c.game==="2048"&&p.betterScoreThanPercent!==null) highlight=copy.score.replace("{n}",String(Math.round(p.betterScoreThanPercent)));
  else if(c.game==="quiz"&&p.betterScoreThanPercent!==null) highlight=kt(locale).better.replace("{n}",String(Math.round(p.betterScoreThanPercent)));
  else if((c.game==="word"||c.game==="rareword"||c.game==="football")&&p.fewerAttemptsThanPercent!==null&&p.fewerAttemptsThanPercent!==undefined) highlight=labels.fewerGuesses.replace("{n}",String(Math.round(p.fewerAttemptsThanPercent)));
  else if(hasTimeComparison(c.game)&&p.fasterThanPercent!==null) highlight=copy.faster.replace("{n}",String(Math.round(p.fasterThanPercent)));
  const word=c.game==="word"||c.game==="rareword"||c.game==="football";
  return <section className="comparison-panel" data-game-comparison={c.game}>
    <h3>{m.comparison}</h3>
    {highlight&&<p className="comparison-highlight">{highlight}</p>}
    {hasWinRate(c.game)&&c.game!=="math"&&<OutcomeBar rate={p.successRate} locale={locale}/>}
    {hasTimeComparison(c.game)&&!word&&(c.game!=="math"||c.success)&&p.medianTime!==null&&p.medianTime!==undefined&&<dl><div><dt>{labels.medianTime}{c.game==="math"?` · ${resultCopy(locale).exact}`:""}</dt><dd>{clockText(Math.round(p.medianTime))}</dd></div></dl>}
    {word&&!!p.attemptDistribution?.length&&<div className="attempt-distribution" data-attempt-distribution>
      <p>{labels.distribution}</p>
      {p.attemptDistribution.map(row=><div key={row.attempts} className="attempt-distribution-row">
        <span>{row.attempts}</span><span className="attempt-distribution-track"><span style={{width:`${row.percent}%`}}/></span><strong>{format(row.percent)}%</strong>
      </div>)}
    </div>}
    <small>{p.samples} {m.sample}</small>
    <details className="comparison-details"><summary>{labels.comparisonDetails}</summary><dl>
      {hasWinRate(c.game)&&<div><dt>{c.game==="math"?resultCopy(locale).exactCommunity:m.successRate}</dt><dd>{Math.round(p.successRate)}%</dd></div>}
      {hasTimeComparison(c.game)&&p.averageTime!==null&&<div><dt>{m.cohortTime}</dt><dd>{clockText(Math.round(p.averageTime))}</dd></div>}
      {hasTimeComparison(c.game)&&word&&p.medianTime!==null&&p.medianTime!==undefined&&<div><dt>{labels.medianTime}</dt><dd>{clockText(Math.round(p.medianTime))}</dd></div>}
      {p.averageAttempts!==null&&<div><dt>{m.averageAttempts}</dt><dd>{format(p.averageAttempts)}</dd></div>}
      {!!p.commonAttempts.length&&<div><dt>{m.commonAttempts}</dt><dd>{p.commonAttempts.join(" / ")}</dd></div>}
      {c.game==="math"&&p.closerThanPercent!==null&&p.closerThanPercent!==undefined&&<div><dt>{labels.gap}</dt><dd>{p.precisionSamples} {m.sample}</dd></div>}
    </dl>{hasTimeComparison(c.game)&&<small>{labels.sameCohort}</small>}</details>
  </section>;
}
