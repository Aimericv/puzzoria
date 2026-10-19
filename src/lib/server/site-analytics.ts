import type { NextRequest } from "next/server";
import { account } from "./auth";
import { database } from "./database";
import { ApiError } from "./http";
import { isGameId, isLocale, type GameId, type Locale } from "../types";

// Operational results remain separate from optional browser measurement.
export function analyticsAdmins() {
  return (process.env.ANALYTICS_ADMIN_USERNAMES ?? "").split(",")
    .map((name) => name.trim().toLowerCase()).filter((name) => /^[a-z0-9_]{3,24}$/.test(name));
}
export function requireAnalyticsAdmin(request: NextRequest) {
  const admins = analyticsAdmins();
  if (!admins.length) throw new ApiError("unavailable", 404);
  const user = account(request);
  if (!user || !admins.includes(user.username.toLowerCase())) throw new ApiError("forbidden", 403);
  return user;
}
export type AnalyticsFilters = { days: number; game?: GameId; locale?: Locale; interfaceLocale?: Locale; mode?: "daily" | "practice" | "archive" };
export function analyticsFilters(params: URLSearchParams): AnalyticsFilters {
  const days = Number(params.get("days") ?? 30), game = params.get("game"), locale = params.get("locale"), interfaceLocale=params.get("interface_locale"), mode = params.get("mode");
  if (![7, 30, 90].includes(days) || (game && !isGameId(game)) || (locale && !isLocale(locale)) || (interfaceLocale && !isLocale(interfaceLocale)) || (mode && !["daily", "practice", "archive"].includes(mode))) throw new ApiError("invalid");
  return { days, ...(game ? { game: game as GameId } : {}), ...(locale ? { locale: locale as Locale } : {}), ...(interfaceLocale ? { interfaceLocale: interfaceLocale as Locale } : {}), ...(mode ? { mode: mode as AnalyticsFilters["mode"] } : {}) };
}
type Counts = { players: number; starts: number; finishes: number; pending: number; dormant: number };
type Retention = { mature: number; returned: number; percent: number | null };
export type SiteAnalytics = {
  from: string; to: string; filters: AnalyticsFilters; totals: Counts; signups: number | null;
  daily: (Counts & { day: string })[];
  games: (Counts & { game: GameId })[];
  retention: { d1: Retention; d7: Retention; d30: Retention };
};
export function siteAnalytics(filters: AnalyticsFilters, now = new Date()): SiteAnalytics {
  const db = database(), to = now.toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (filters.days - 1) * 86400000).toISOString().slice(0, 10);
  const until = new Date(now.getTime() + 1).toISOString(), dormantBefore = new Date(now.getTime() - 48 * 3600000).toISOString();
  const admins = analyticsAdmins();
  const excluded = admins.length ? `SELECT id FROM users WHERE lower(username) IN (${admins.map(() => "?").join(",")})` : "SELECT id FROM users WHERE 0";
  const scope = "(? IS NULL OR game=?) AND (? IS NULL OR locale=?) AND (? IS NULL OR mode=?)";
  const scopeArgs = [filters.game ?? null, filters.game ?? null, filters.locale ?? null, filters.locale ?? null, filters.mode ?? null, filters.mode ?? null];
  const cohort = `WITH cohort AS (
    SELECT r.owner, r.game, r.mode, json_extract(r.challenge_json,'$.locale') AS locale,
      r.started_at, substr(r.started_at,1,10) AS day, s.id AS result_id
    FROM runs r LEFT JOIN results s ON s.owner=r.owner AND s.challenge_id=r.challenge_id
      AND s.provenance='server' AND s.completed_at < ?
    WHERE r.started_at >= ? AND r.started_at < ?
      AND (r.user_id IS NULL OR r.user_id NOT IN (${excluded}))
  ), selected AS (SELECT * FROM cohort WHERE ${scope})`;
  const args = [until, `${from}T00:00:00.000Z`, until, ...admins, ...scopeArgs, dormantBefore, dormantBefore];
  const columns = `COUNT(DISTINCT owner) AS players, COUNT(*) AS starts,
    SUM(result_id IS NOT NULL) AS finishes,
    SUM(result_id IS NULL AND started_at>=?) AS pending,
    SUM(result_id IS NULL AND started_at<?) AS dormant`;
  const totals = db.prepare(`${cohort} SELECT ${columns} FROM selected`).get(...args) as Counts;
  // SQLite SUM of an empty set is NULL; the public contract always uses zero.
  for (const key of ["players", "starts", "finishes", "pending", "dormant"] as const) totals[key] ??= 0;
  const dailyRows = db.prepare(`${cohort} SELECT day, ${columns} FROM selected GROUP BY day ORDER BY day`).all(...args) as (Counts & { day: string })[];
  const daily = Array.from({ length: filters.days }, (_, i) => {
    const day = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86400000).toISOString().slice(0, 10);
    return dailyRows.find((row) => row.day === day) ?? { day, players: 0, starts: 0, finishes: 0, pending: 0, dormant: 0 };
  });
  const games = db.prepare(`${cohort} SELECT game, ${columns} FROM selected GROUP BY game ORDER BY starts DESC`).all(...args) as SiteAnalytics["games"];
  // Return activity means a real start OR a server-verified finish on that UTC day.
  // No resumed-tab/page-view event is claimed as a measured visit.
  const activity = `WITH activity AS (
    SELECT owner,game,mode,json_extract(challenge_json,'$.locale') AS locale, substr(started_at,1,10) AS day FROM runs
      WHERE started_at IS NOT NULL AND started_at < ? AND (user_id IS NULL OR user_id NOT IN (${excluded}))
    UNION SELECT s.owner,s.game,s.mode,s.locale,substr(s.completed_at,1,10) AS day FROM results s
      WHERE s.provenance='server' AND s.completed_at < ? AND (s.user_id IS NULL OR s.user_id NOT IN (${excluded}))
    ), scoped AS (SELECT DISTINCT owner, day FROM activity WHERE ${scope}),
    firsts AS (SELECT owner,MIN(day) AS first_day FROM scoped GROUP BY owner),
    newcomers AS (SELECT * FROM firsts WHERE first_day>=? AND first_day<=?)`;
  const retentionAt = (lag: number): Retention => {
    // The return day must be entirely observed; today's incomplete day is not mature.
    const matureThrough = new Date(Date.parse(`${to}T00:00:00Z`) - (lag + 1) * 86400000).toISOString().slice(0, 10);
    const row = db.prepare(`${activity} SELECT COUNT(*) AS mature,
      COALESCE(SUM(EXISTS(SELECT 1 FROM scoped a WHERE a.owner=n.owner AND a.day=date(n.first_day,'+${lag} days'))),0) AS returned
      FROM newcomers n WHERE first_day<=?`).get(until, ...admins, until, ...admins, ...scopeArgs, from, to, matureThrough) as { mature: number; returned: number };
    return { ...row, percent: row.mature ? Math.round(1000 * row.returned / row.mature) / 10 : null };
  };
  const signups = filters.game || filters.locale || filters.mode ? null : (db.prepare(`SELECT COUNT(*) AS n FROM users WHERE created_at>=? AND created_at<? ${admins.length ? `AND lower(username) NOT IN (${admins.map(() => "?").join(",")})` : ""}`).get(`${from}T00:00:00.000Z`, until, ...admins) as { n: number }).n;
  return { from, to, filters, totals, signups, daily, games, retention: { d1: retentionAt(1), d7: retentionAt(7), d30: retentionAt(30) } };
}
