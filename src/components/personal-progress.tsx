"use client";
import { kt } from "@/lib/knowledge-i18n";
import { et } from "@/lib/engagement-i18n";
import { personalProgress, personalResultStatistics } from "@/lib/engagement";
import type { Completion, Locale } from "@/lib/types";
import { t } from "@/lib/i18n";
import { rt } from "@/lib/retention-i18n";
import { useStats, clockText } from "./storage";
import { useLocalPreview } from "./local-preview-context";
import { hasWinRate, hasResultTimeComparison, resultCopy } from "@/lib/result-metrics";
import { knowledgeStatisticsCopy } from "@/lib/knowledge-statistics-i18n";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
import { dateLabel } from "@/lib/date";
export function PersonalProgress({
  completion,
  locale,
}: {
  completion: Completion;
  locale: Locale;
}) {
  const { completions, ready } = useStats(),
    m = et(locale);
  const preview = useLocalPreview();
  if (!preview && (!ready || completion.provenance !== "server")) return null;
  const history = preview?.history ?? completions;
  const p = personalProgress(history, completion),
    stats = personalResultStatistics(history, completion),
    format = (n: number) =>
      new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  const metric = (c: Completion) =>
    (c.game === "word" || c.game === "rareword")
      ? (c.attempts ?? 6)
      : c.game === "math" ? (c.mathDistance??0) : c.game === "guess" || c.game === "football" ? (c.attempts??0) : c.game === "2048" || c.game === "quiz"
        ? c.score
        : c.duration;
  const max = Math.max(1, ...p.history.map(metric));
  const labels=gameStatisticsCopy(locale);
  const record: [string,string|number|null] | null = completion.game === "word" || completion.game === "rareword" || completion.game === "guess" || completion.game === "football"
    ? [labels.recordAttempts,stats.bestAttempts]
    : completion.game === "quiz" ? [kt(locale).best, stats.bestScore===null?null:`${format(stats.bestScore/10)}%`]
    : completion.game === "2048" ? [m.scoreRecord,stats.bestScore]
    : completion.game === "math" ? completion.success ? [labels.exactRecord,stats.bestTime===null?null:clockText(stats.bestTime)] : [labels.bestGap,stats.bestDistance]
    : hasResultTimeComparison(completion) ? [resultCopy(locale).best,stats.bestTime===null?null:clockText(stats.bestTime)] : null;
  const timeRecordLabel=completion.game === "quiz" ? knowledgeStatisticsCopy(locale).perfectRecord : completion.game === "math" ? labels.exactRecord : m.timeRecord;
  const recordLabel=(key: typeof p.records[number])=>key === "timeRecord" ? timeRecordLabel : m[key];
  const visibleRecords=p.records.filter(key => (key !== "timeRecord" || hasResultTimeComparison(completion)) && (key!=="scoreRecord" || completion.game!=="math")).sort((a,b)=>(a==="attemptsRecord"?-1:b==="attemptsRecord"?1:0));
  return (
    <section className="personal-progress" data-personal-progress>
      <h3>{m.personalProgress}</h3>
      <dl className="personal-record-summary" data-personal-record>
        {record && <div><dt>{record[0]}</dt><dd>{record[1]??"—"}</dd></div>}
        {completion.game === "quiz" && <div data-quiz-time-record><dt>{knowledgeStatisticsCopy(locale).perfectRecord}</dt><dd>{stats.bestTime === null ? "—" : clockText(stats.bestTime)}</dd></div>}
        {completion.mode==="daily" && <div><dt>{t(locale).currentStreak}</dt><dd>{stats.currentStreak}</dd></div>}
        {!record && <div><dt>{t(locale).played}</dt><dd>{stats.played}</dd></div>}
      </dl>
      {p.first && <p>{m.firstRecord}</p>}
      {visibleRecords.slice(0,1).map(key=><p className="personal-record" key={key}>★ {m.newRecord} · {recordLabel(key)}</p>)}
      <details className="progress-details">
        <summary>{labels.personalDetails}</summary>
      <dl className="personal-summary" data-personal-summary>
        <div>
          <dt>{t(locale).played}</dt>
          <dd>{stats.played}</dd>
        </div>
        {hasWinRate(completion.game) && <div>
          <dt>{completion.game === "math" ? resultCopy(locale).exact : t(locale).wins}</dt>
          <dd>{stats.won}</dd>
        </div>}
        {hasWinRate(completion.game) && <div>
          <dt>{completion.game === "math" ? resultCopy(locale).exactPersonal : t(locale).winRate}</dt>
          <dd>{format(stats.winRate ?? 0)}%</dd>
        </div>}
        {(hasResultTimeComparison(completion) || completion.game === "quiz") && <div>
          <dt>{completion.game === "quiz" ? knowledgeStatisticsCopy(locale).perfectAverage : completion.game === "math" ? resultCopy(locale).exactTime : rt(locale).averageTime}</dt>
          <dd>
            {stats.averageTime === null
              ? "—"
              : clockText(Math.round(stats.averageTime))}
          </dd>
        </div>}
        {(completion.game === "wordsearch" || completion.game === "sudoku") && <div><dt>{resultCopy(locale).best}</dt><dd>{stats.bestTime === null ? "—" : clockText(stats.bestTime)}</dd></div>}
        {completion.game === "quiz" && <><div><dt>{kt(locale).average}</dt><dd>{stats.averageScore===null?"—":`${format(stats.averageScore/10)}%`}</dd></div><div><dt>{kt(locale).perfect}</dt><dd>{stats.won}</dd></div></>}
        {completion.game === "2048" && <div><dt>{m.scoreRecord}</dt><dd>{stats.bestScore ?? "—"}</dd></div>}
        {(completion.game === "word" || completion.game === "rareword" || completion.game === "guess" || completion.game === "football") && (
          <div>
            <dt>{rt(locale).averageAttempts}</dt>
            <dd>
              {stats.averageAttempts === null
                ? "—"
                : format(stats.averageAttempts)}
            </dd>
          </div>
        )}
      </dl>
      {completion.game==="math"&&<dl><div><dt>{labels.bestGap}</dt><dd>{stats.bestDistance??"—"}</dd></div><div><dt>{labels.averageGap}</dt><dd>{stats.averageDistance===null?"—":format(stats.averageDistance)}</dd></div><div><dt>{labels.exactRecord}</dt><dd>{stats.bestTime===null?"—":clockText(stats.bestTime)}</dd></div></dl>}
      {completion.game==="2048"&&stats.largestTile!==null&&<dl><div><dt>{labels.largestTile}</dt><dd>{stats.largestTile}</dd></div></dl>}
      {visibleRecords.slice(1).map(key=><p className="personal-record" key={key}>★ {m.newRecord} · {recordLabel(key)}</p>)}
      {!!p.attemptsImprovement && p.attemptsImprovement >= 0.1 && (
        <p>
          {m.belowAverage.replace("{count}", format(p.attemptsImprovement))}
        </p>
      )}
      {hasResultTimeComparison(completion) && !!p.timeImprovement && p.timeImprovement >= 1 && (
        <p>{m.fasterAverage.replace("{count}", format(p.timeImprovement))}</p>
      )}
      {p.badges.filter(() => completion.game !== "ranking" && completion.game !== "rather").map((key) => (
        <p className="personal-record" key={key}>
          ✓ {m.unlocked} · {m[key]}
        </p>
      ))}
      <p>{m.history}</p>
      <ol className="personal-history">
        {p.history.map((c, i) => (
          <li key={c.challengeId}>
            <span>{i + 1}</span>
            {c.game !== "ranking" && c.game !== "rather" && (c.game!=="math"||c.mathDistance!==undefined) && <span
              className={`history-bar ${c.success ? "won" : "lost"}`}
              style={{ width: `${Math.max(5, (metric(c) / max) * 100)}%` }}
            />}
            <strong>
              {(c.game === "word" || c.game === "rareword")
                ? `${c.success ? c.attempts : "X"}/${c.maxAttempts ?? 6}`
                : c.game === "math" ? `${labels.gap}: ${c.mathDistance??"—"}` : c.game === "2048"
                  ? `${c.score} ${t(locale).score}`
                  : c.game === "quiz" ? `${c.answersFound??"—"}/${c.answersTotal??"—"}` : c.game === "football" ? `${labels.yourGuesses}: ${c.attempts??0}/6` : c.game === "guess" ? `${labels.yourGuesses}: ${c.attempts??"—"}` : c.game === "ranking" || c.game === "rather" ? dateLabel(c.date,locale) : clockText(c.duration)}
            </strong>
          </li>
        ))}
      </ol>
      <small>{m.historyHelp}</small>
      </details>
    </section>
  );
}
