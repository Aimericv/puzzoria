"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  difficulties,
  gameIds,
  type Difficulty,
  type GameId,
  type Locale,
} from "@/lib/types";
import { rt } from "@/lib/retention-i18n";
import { t } from "@/lib/i18n";
import { gameName } from "@/lib/registry";
import { track } from "@/lib/analytics";
import type {
  Dimension,
  LeaderboardEntry,
  Period,
} from "@/lib/server/leaderboards";
import { clockText } from "./storage";
import { hasDaily } from "@/lib/game-modes";
export function LeaderboardView({ locale }: { locale: Locale }) {
  const m = rt(locale),
    [game, setGame] = useState<GameId>("word"),
    [difficulty, setDifficulty] = useState<Difficulty>("easy"),
    [period, setPeriod] = useState<Period>("today"),
    [dimension, setDimension] = useState<Dimension>("performance"),
    [entries, setEntries] = useState<LeaderboardEntry[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const query = new URLSearchParams({
      game,
      locale,
      difficulty: game === "sudoku" ? "easy" : difficulty,
      period,
      dimension,
    });
    fetch(`/api/leaderboards?${query}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setEntries(data.entries);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setError(true);
          setLoading(false);
        }
      });
    track("leaderboard_view", { locale, game_id: game, period, dimension });
    return () => controller.abort();
  }, [locale, game, difficulty, period, dimension]);
  return (
    <>
      <div className="leaderboard-filters">
        <label>
          {t(locale).challenge}
          <select
            value={game}
            onChange={(e) => setGame(e.target.value as GameId)}
          >
            {gameIds.filter(hasDaily).map((g) => (
              <option key={g} value={g}>
                {gameName(g, locale)}
              </option>
            ))}
          </select>
        </label>
        {(game === "mines" || game === "guess") && (
          <label>
            {t(locale).difficulty}
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
            >
              {difficulties.map((d) => (
                <option key={d} value={d}>
                  {t(locale)[d]}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          {m.period}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
          >
            {(["today", "week", "month", "all"] as const).map((p) => (
              <option key={p} value={p}>
                {m[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {m.dimension}
          <select
            value={dimension}
            onChange={(e) => setDimension(e.target.value as Dimension)}
          >
            {(
              ["performance", "winRate", "streak", "speed", "score"] as const
            ).map((d) => (
              <option key={d} value={d}>
                {m[d]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="result-footnote">
        {dimension === "winRate" ? m.minimumGames : m.verifiedTime}
      </p>
      {loading ? (
        <p role="status">{m.loading}</p>
      ) : error ? (
        <p role="alert">{m.syncIssue}</p>
      ) : !entries.length ? (
        <div className="empty-leaderboard">
          <p>{m.emptyBoard}</p>
          <Link className="primary-button" href={`/${locale}/account`}>
            {m.account}
          </Link>
        </div>
      ) : (
        <div className="history-table">
          <table>
            <thead>
              <tr>
                <th>{m.rank}</th>
                <th>{m.player}</th>
                <th>{m.games}</th>
                <th>{m.value}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row, i) => (
                <tr key={`${row.displayName}:${i}`}>
                  <td>{row.rank}</td>
                  <td>{row.displayName}</td>
                  <td>{row.played}</td>
                  <td>
                    {dimension === "speed"
                      ? clockText(Math.round(row.value))
                      : dimension === "winRate"
                        ? `${row.value.toFixed(1)}%`
                        : Number(row.value.toFixed(1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
