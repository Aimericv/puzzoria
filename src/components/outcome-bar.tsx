import type { Locale } from "@/lib/types";
import { comparisonCopy } from "@/lib/comparison-i18n";
export function OutcomeBar({rate, locale}: {rate: number; locale: Locale}) {
  const m = comparisonCopy(locale), wins = Math.round(rate), losses = 100 - wins;
  return <div className="outcome-summary" data-outcome-bar>
    <p>{m.split}</p>
    <div className="outcome-bar" role="img" aria-label={`${m.won} ${wins} %, ${m.lost} ${losses} %`}>
      <span className="outcome-win" style={{width: `${rate}%`}} />
      <span className="outcome-loss" style={{width: `${100-rate}%`}} />
    </div>
    <div className="outcome-labels"><span>✓ {wins} % {m.won}</span><span>× {losses} % {m.lost}</span></div>
  </div>;
}
