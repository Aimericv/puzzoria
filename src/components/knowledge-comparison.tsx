import type { Completion, Locale } from "@/lib/types";
import type { Comparison } from "@/lib/statistics";
import { knowledgeStatisticsCopy } from "@/lib/knowledge-statistics-i18n";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
import { rt } from "@/lib/retention-i18n";
import { kt } from "@/lib/knowledge-i18n";
import { clockText } from "./storage";
import { OutcomeBar } from "./outcome-bar";

export function KnowledgeComparison({ completion: c, comparison: p, locale }: { completion: Completion; comparison: Comparison; locale: Locale }) {
  const m = knowledgeStatisticsCopy(locale), common = rt(locale), labels = gameStatisticsCopy(locale);
  const format = (n: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const speed = c.game === "quiz" ? p.fasterThanPercent : p.footballFasterThanPercent;
  const median = c.game === "quiz" ? p.medianTime : p.footballMedianTime;
  const quiz = c.game === "quiz";
  return <section className="comparison-panel knowledge-comparison" data-game-comparison={c.game}>
    <h3>{common.comparison}</h3>
    {quiz ? <>
      {c.success ? <p className="comparison-highlight">{m.perfect}</p> : p.betterScoreThanPercent !== null && <p className="comparison-highlight">{kt(locale).better.replace("{n}", String(Math.floor(p.betterScoreThanPercent)))}</p>}
      {c.answersFound !== undefined && !!c.answersTotal && <div className="quiz-answer-comparison" data-quiz-answer-comparison>
        {[{ label: m.you, value: c.answersFound }, ...(p.quizAverageAnswers != null ? [{ label: m.average, value: p.quizAverageAnswers }] : [])].map(row => <div key={row.label}>
          <div><span>{row.label}</span><strong>{format(row.value)}/{c.answersTotal}</strong></div>
          <div className="knowledge-stat-track" role="img" aria-label={`${row.label} : ${format(row.value)}/${c.answersTotal}`}><span style={{ width: `${row.value * 100 / c.answersTotal!}%` }} /></div>
        </div>)}
      </div>}
      <div className="outcome-summary quiz-perfect-summary" data-quiz-perfect-share>
        <p>{m.split}</p>
        <div className="outcome-bar" role="img" aria-label={`${m.perfectShare} ${format(p.successRate)} %, ${m.incompleteShare} ${format(100 - p.successRate)} %`}><span className="outcome-win" style={{ width: `${p.successRate}%` }} /><span className="quiz-incomplete" style={{ width: `${100 - p.successRate}%` }} /></div>
        <div className="outcome-labels"><span>✓ {format(p.successRate)} % {m.perfectShare}</span><span>{format(100 - p.successRate)} % {m.incompleteShare}</span></div>
      </div>
    </> : <>
      {c.success && c.attempts === 1 && <p className="comparison-highlight">{m.firstGuess}</p>}
      {p.fewerAttemptsThanPercent != null && <p className="comparison-highlight">{labels.fewerGuesses.replace("{n}", String(Math.floor(p.fewerAttemptsThanPercent)))}</p>}
      <OutcomeBar rate={p.successRate} locale={locale} />
      {!!p.attemptDistribution?.length && <div className="attempt-distribution" data-attempt-distribution><p>{labels.distribution}</p>{p.attemptDistribution.map(row => <div className="attempt-distribution-row" key={row.attempts}><span>{row.attempts}</span><span className="attempt-distribution-track"><span style={{ width: `${row.percent}%` }} /></span><strong>{format(row.percent)}%</strong></div>)}</div>}
    </>}
    {c.success && <div className="knowledge-speed" data-knowledge-speed>
      {speed != null ? <p className="comparison-highlight">{(quiz ? m.perfectSpeed : m.footballSpeed).replace("{n}", String(Math.floor(speed))).replace("{attempts}", String(c.attempts))}</p> : <p>{quiz ? m.pendingPerfect : m.pendingFootball}</p>}
      {median != null && <dl><div><dt>{(quiz ? m.perfectMedian : m.footballMedian).replace("{attempts}", String(c.attempts))}</dt><dd>{clockText(Math.round(median))}</dd></div></dl>}
      {speed != null && <small>{(quiz ? m.perfectSamples : m.footballSamples).replace("{n}", String(quiz ? p.successes : p.footballTimeSamples))}</small>}
    </div>}
    <small>{p.samples} {common.sample}</small>
    <details className="comparison-details"><summary>{labels.comparisonDetails}</summary><dl>
      {quiz && <div><dt>{m.perfectCount}</dt><dd>{p.successes}/{p.samples}</dd></div>}
      {quiz && p.averageTime !== null && <div><dt>{m.perfectAverage}</dt><dd>{clockText(Math.round(p.averageTime))}</dd></div>}
      {!quiz && p.averageAttempts !== null && <div><dt>{common.averageAttempts}</dt><dd>{format(p.averageAttempts)}</dd></div>}
    </dl><small>{quiz ? m.quizCohort : m.footballCohort}</small>{quiz && <small>{m.scoreTies}</small>}</details>
  </section>;
}
