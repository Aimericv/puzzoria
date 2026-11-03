import { slugs } from "./i18n";
import { isLocale, type GameId, type Locale, type PlayMode } from "./types";
import { hasDaily } from "./game-modes";
import { quizTopics, quizTopicPath } from "./knowledge-catalog";
import { resolveQuizTheme, quizThemePath } from "./quiz-themes";

export const measurementEvents = ["page_view", "active_time", "game_view", "game_abandon", "next_game_click", "share", "friend_invite", "play_again", "account_prompt_view", "account_prompt_dismiss", "account_prompt_never_show", "signup_start", "signup_complete", "login", "local_data_migrated", "stats_view", "leaderboard_view", "locale", "client_error", "ad_opportunity", "ad_request", "ad_render", "ad_viewable", "video_offer", "video_accept", "video_start", "video_complete"] as const;
export type MeasurementName = typeof measurementEvents[number];
export type MeasurementEvent = { id: string; name: MeasurementName; path: string; locale: Locale; challenge_id?: string; seconds?: number; method?: string; impression_id?: string; status?: number; latency?: number };
export type PageContext = { page: string; locale: Locale; game?: GameId; mode?: PlayMode };
// Store route categories, never private invitation codes, query strings or words.
export function measurementPage(path: string): PageContext | null {
  const parts = path.split("?")[0].split("/").filter(Boolean), locale = parts[0];
  if (!isLocale(locale) || parts[1] === "admin") return null;
  const theme=resolveQuizTheme(locale,parts.slice(1));
  if(theme)return {page:quizThemePath(locale,theme),locale};
  const game = (Object.keys(slugs[locale]) as GameId[]).find(g => slugs[locale][g] === parts[1]);
  if(game==="quiz"&&parts.length===3){const topic=quizTopics.find(t=>t.slug[locale]===parts[2]);if(topic)return {page:quizTopicPath(locale,topic),locale,game,mode:"practice"};}
  if (game) return { page: `/${locale}/${slugs[locale][game]}${parts.includes("practice") ? "/practice" : parts.some(p => /^\d{4}-\d{2}-\d{2}$/.test(p)) ? "/archive" : ""}`, locale, game, mode: parts.includes("practice") ? "practice" : parts.some(p => /^\d{4}-\d{2}-\d{2}$/.test(p)) ? "archive" : hasDaily(game) ? "daily" : "practice" };
  const section = parts[1] ?? "home";
  if (["account", "stats", "leaderboards", "archive", "privacy", "friend", "number-room", "live"].includes(section)) return { page: `/${locale}/${section}`, locale, ...(section === "number-room" ? { game: "guess" as const, mode: "practice" as const } : {}) };
  return { page: `/${locale}/${section === "home" ? "" : "article"}`, locale };
}
export function acquisition(referrer: unknown, source: unknown, medium: unknown, campaign: unknown, origin: string) {
  const tag = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9 _.-]{1,64}$/.test(v) ? v.trim().toLowerCase() : null;
  let host: string | null = null;
  if (typeof referrer === "string") try { const url = new URL(referrer); if (["http:", "https:"].includes(url.protocol) && url.origin !== origin) host = url.hostname.toLowerCase().slice(0, 128); } catch { /* Missing or stripped referrer is unknown. */ }
  const utmSource = tag(source), utmMedium = tag(medium), utmCampaign = tag(campaign);
  const channel = utmSource === "friend" ? "friend" : utmSource ? "campaign" : host && /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com)$/.test(host) ? "search" : host && /(^|\.)(facebook\.com|instagram\.com|tiktok\.com|reddit\.com|x\.com|twitter\.com|youtube\.com|t\.co)$/.test(host) ? "social" : host ? "referral" : "direct-unknown";
  return { channel, referrer: host, source: utmSource, medium: utmMedium, campaign: utmCampaign };
}
