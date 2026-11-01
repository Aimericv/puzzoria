"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Flame, Trophy, ChartNoAxesColumnIncreasing } from "lucide-react";
import { kt } from "@/lib/knowledge-i18n";
import { gameIds, type Locale, type PlayMode } from "@/lib/types";
import { t, gamePath } from "@/lib/i18n";
import { gameName } from "@/lib/registry";
import { streaks } from "@/lib/stats";
import { dateLabel } from "@/lib/date";
import { useStats, clockText } from "./storage";
import { rt } from "@/lib/retention-i18n";
import { achievements, personalStatistics, modeOf } from "@/lib/statistics";
import { track } from "@/lib/analytics";
import { practicePath } from "@/lib/play-path";
import { hasWinRate, hasTimeComparison, resultCopy } from "@/lib/result-metrics";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
export function StatsView({ locale }: { locale: Locale }) {
  const [mode, setMode] = useState<PlayMode>("daily"),
    n = rt(locale);
  useEffect(() => {
    track("stats_view", { locale, mode });
  }, [locale, mode]);
  const m = t(locale),
    { completions, ready } = useStats(),
    streak = streaks(completions);
  return (
    <>
      <div className="stats-overview">
        {[
          [m.currentStreak, streak.current, Flame],
          [m.bestStreak, streak.best, Trophy],
          [m.total, completions.length, ChartNoAxesColumnIncreasing],
        ].map(([label, value, Icon]) => {
          const Component = Icon as typeof Flame;
          return (
            <article key={String(label)}>
              <Component size={22} />
              <strong>{String(value)}</strong>
              <span>{String(label)}</span>
            </article>
          );
        })}
      </div>
      <div className="mode-nav" aria-label={m.stats}>
        {(["daily", "practice", "archive"] as const).map((value) => (
          <button
            key={value}
            className={mode === value ? "selected" : ""}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === "daily"
              ? n.dailyMode
              : value === "practice"
                ? n.practice
                : n.archiveMode}
          </button>
        ))}
      </div>
      <p className="mode-intro">{n.statsHelp}</p>
      <div className="stats-game-grid">
        {gameIds.map((game) => {
          const stats = personalStatistics(completions, game, mode);
          if (game === "ranking" || game === "rather")
            return (
              <article key={game}>
                <h2>{gameName(game, locale)}</h2>
                <dl>
                  <div>
                    <dt>{m.played}</dt>
                    <dd>{stats.played}</dd>
                  </div>
                  {mode === "daily" && (
                    <div>
                      <dt>{m.currentStreak}</dt>
                      <dd>{stats.currentStreak}</dd>
                    </div>
                  )}
                </dl>
                <Link
                  href={
                    mode === "practice"
                      ? practicePath(locale, game)
                      : gamePath(locale, game)
                  }
                >
                  {m.play}
                </Link>
              </article>
            );
          return (
            <article key={game}>
              <h2>{gameName(game, locale)}</h2>
              <dl>
                <div>
                  <dt>{m.played}</dt>
                  <dd>{stats.played}</dd>
                </div>
                {hasWinRate(game) && <div>
                  <dt>{game === "math" ? resultCopy(locale).exact : m.wins}</dt>
                  <dd>{stats.won}</dd>
                </div>}
                {hasWinRate(game) && <div>
                  <dt>{game === "math" ? resultCopy(locale).exactPersonal : m.winRate}</dt>
                  <dd>
                    {stats.winRate === null
                      ? "—"
                      : `${Math.round(stats.winRate)}%`}
                  </dd>
                </div>}
                {(mode === "daily" || hasWinRate(game)) && <div>
                  <dt>
                    {mode === "practice" ? n.currentRun : m.currentStreak}
                  </dt>
                  <dd>{stats.currentStreak}</dd>
                </div>}
                {(mode === "daily" || hasWinRate(game)) && <div>
                  <dt>{mode === "practice" ? n.bestRun : m.bestStreak}</dt>
                  <dd>{stats.bestStreak}</dd>
                </div>}
                {hasTimeComparison(game) && <div>
                  <dt>{game === "math" ? resultCopy(locale).exactTime : n.averageTime}</dt>
                  <dd>
                    {stats.averageTime === null
                      ? "—"
                      : clockText(Math.round(stats.averageTime))}
                  </dd>
                </div>}
                {hasTimeComparison(game) && <div>
                  <dt>{n.bestTime}</dt>
                  <dd>
                    {stats.bestTime === null ? "—" : clockText(stats.bestTime)}
                  </dd>
                </div>}
                {(game === "word" || game === "rareword" || game === "guess" || game === "football") && (
                  <div>
                    <dt>{n.averageAttempts}</dt>
                    <dd>
                      {stats.averageAttempts === null
                        ? "—"
                        : stats.averageAttempts.toFixed(1)}
                    </dd>
                  </div>
                )}
                {game === "math" && <><div><dt>{gameStatisticsCopy(locale).bestGap}</dt><dd>{stats.bestDistance??"—"}</dd></div><div><dt>{gameStatisticsCopy(locale).averageGap}</dt><dd>{stats.averageDistance===null?"—":new Intl.NumberFormat(locale,{maximumFractionDigits:1}).format(stats.averageDistance)}</dd></div></>}
                {game === "quiz" && <><div><dt>{kt(locale).best}</dt><dd>{stats.bestScore===null?"—":`${Math.round(stats.bestScore/10)}%`}</dd></div><div><dt>{kt(locale).average}</dt><dd>{stats.averageScore===null?"—":`${Math.round(stats.averageScore/10)}%`}</dd></div><div><dt>{kt(locale).perfect}</dt><dd>{stats.won}</dd></div></>}
                {game === "2048" && <div><dt>{gameStatisticsCopy(locale).largestTile}</dt><dd>{stats.largestTile??"—"}</dd></div>}
                {(game === "word" || game === "rareword" || game === "guess" || game === "football") && <div><dt>{gameStatisticsCopy(locale).recordAttempts}</dt><dd>{stats.bestAttempts??"—"}</dd></div>}
                {game === "2048" && <div>
                  <dt>{n.bestScore}</dt>
                  <dd>{stats.bestScore ?? "—"}</dd>
                </div>}
              </dl>
              <Link
                href={
                  mode === "practice" && game !== "rareword"
                    ? practicePath(locale, game)
                    : gamePath(locale, game)
                }
              >
                {m.play}
              </Link>
            </article>
          );
        })}
      </div>
      <section className="achievements">
        <h2>{n.achievements}</h2>
        <ul>
          {Object.entries(achievements(completions)).map(([name, unlocked]) => (
            <li key={name} className={unlocked ? "unlocked" : ""}>
              <span aria-hidden="true">{unlocked ? "✓" : "○"}</span>{" "}
              {n[name as "firstWin" | "explorer" | "tenWins" | "weekStreak"]}
              <small>{unlocked ? n.unlocked : n.locked}</small>
            </li>
          ))}
        </ul>
      </section>
      <section className="history">
        <h2>{m.history}</h2>
        {!ready ? (
          <p>{m.loading}</p>
        ) : !completions.length ? (
          <p>{m.emptyStats}</p>
        ) : (
          <div className="history-table">
            <table>
              <thead>
                <tr>
                  <th>{m.date}</th>
                  <th>{m.challenge}</th>
                  <th>{m.result}</th>
                  <th>{m.timer}</th>
                </tr>
              </thead>
              <tbody>
                {[...completions]
                  .filter((c) => modeOf(c) === mode)
                  .reverse()
                  .slice(0, 30)
                  .map((c) => (
                    <tr key={c.challengeId}>
                      <td>{dateLabel(c.date, locale)}</td>
                      <td>
                        {gameName(c.game, locale)}
                        {c.game === "sudoku" ||
                        c.game === "mines" ||
                        (c.game === "guess" && c.difficulty)
                          ? ` · ${m[(c.difficulty ?? c.challengeId.split(":").at(-1)) as "easy" | "medium" | "hard"]}`
                          : ""}
                      </td>
                      <td>
                        {(c.game === "word" || c.game === "rareword")
                          ? `${c.success ? c.attempts : "X"}/${c.maxAttempts ?? 6}`
                          : c.game === "2048"
                            ? `${c.score}`
                            : c.game === "math"
                              ? `${c.score}/1000`
                              : m.completed}
                      </td>
                      <td>{hasTimeComparison(c.game) ? clockText(c.duration) : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
