"use client";
import type { GameId, Locale } from "./types";
export type EventName =
  | "game_view"
  | "game_start"
  | "game_complete"
  | "game_abandon"
  | "next_game_click"
  | "share"
  | "friend_invite"
  | "streak"
  | "locale"
  | "practice_start"
  | "practice_complete"
  | "play_again"
  | "account_prompt_view"
  | "account_prompt_dismiss"
  | "account_prompt_never_show"
  | "signup_start"
  | "signup_complete"
  | "login"
  | "local_data_migrated"
  | "stats_view"
  | "leaderboard_view"
  | "ranked_queue"
  | "ranked_match_start"
  | "ranked_match_complete";
export type EventProperties = {
  game_id?: GameId;
  challenge_id?: string;
  locale: Locale;
  duration?: number;
  success?: boolean;
  score?: number;
  streak?: number;
  method?: "native" | "clipboard" | "image";
  date?: string;
  mode?: "daily" | "practice" | "archive";
  count?: number;
  session_id?: string;
  period?: string;
  dimension?: string;
};
type Adapter = (name: EventName, properties: EventProperties) => void;
let adapter: Adapter | undefined;
export function setAnalyticsAdapter(next: Adapter | undefined) {
  adapter = next;
}
export function track(name: EventName, properties: EventProperties) {
  if (typeof window === "undefined") return;
  let sessionId: string | undefined;
  try {
    sessionId =
      sessionStorage.getItem("dailygrid:analytics-session") ?? undefined;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      sessionStorage.setItem("dailygrid:analytics-session", sessionId);
    }
  } catch {
    /* Analytics remains optional when browser storage is unavailable. */
  }
  const enriched = {
    ...properties,
    ...(sessionId ? { session_id: sessionId } : {}),
  };
  window.dispatchEvent(
    new CustomEvent("dailygrid:analytics", {
      detail: { name, properties: enriched },
    }),
  );
  adapter?.(name, enriched);
}
