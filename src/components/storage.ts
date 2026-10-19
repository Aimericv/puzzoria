"use client";
import { useLocalPreview } from "./local-preview-context";
import { useEffect, useState, useCallback, useRef } from "react";
import { track } from "@/lib/analytics";
import { utcDay, validDate } from "@/lib/date";
import { addCompletion, streaks } from "@/lib/stats";
import {
  gameIds,
  type Completion,
  type Locale,
  type PublicChallenge,
} from "@/lib/types";
import { readLocal, writeLocal } from "@/lib/browser-storage";
import { authoritativeCompletion, beginPlay } from "@/lib/play-client";
export const STATS_KEY = "dailygrid:stats:v1";
const CHANGE = "dailygrid:storage";
export function safeRead<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
): T {
  try {
    const raw = readLocal(key);
    if (!raw) return initial;
    const value: unknown = JSON.parse(raw);
    return validate(value) ? value : initial;
  } catch {
    return initial;
  }
}
export function writeStorage(key: string, value: unknown): boolean {
  return writeLocal(key, value);
}
export function useStoredState<T>(
  key: string,
  initial: T,
  validate: (value: unknown) => value is T,
) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    setValue(safeRead(key, initial, validate));
    setReady(true);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ready) setSaved(writeStorage(key, value));
  }, [key, value, ready]);
  return { value, setValue, ready, saved };
}
export function validCompletions(value: unknown): value is Completion[] {
  return (
    Array.isArray(value) &&
    value.every(
      (c) =>
        c &&
        typeof c.challengeId === "string" &&
        c.challengeId.length < 256 &&
        gameIds.includes(c.game) &&
        ["en", "fr", "es", "de"].includes(c.locale) &&
        typeof c.date === "string" &&
        validDate(c.date) &&
        typeof c.success === "boolean" &&
        (c.mode === undefined ||
          ["daily", "practice", "archive"].includes(c.mode)) &&
        Number.isInteger(c.duration) &&
        c.duration >= 0 &&
        Number.isFinite(c.score) &&
        c.score >= 0 &&
        (c.attempts === undefined ||
          (Number.isInteger(c.attempts) &&
            c.attempts >= (c.game === "guess" ? 0 : 1) &&
            c.attempts <= (c.game === "guess" ? 30 : c.game === "rareword" ? (c.maxAttempts ?? 10) : 6))) &&
        typeof c.completedAt === "string" &&
        !Number.isNaN(Date.parse(c.completedAt)),
    )
  );
}
export function useStats() {
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const load = () => {
      setCompletions(safeRead(STATS_KEY, [], validCompletions));
      setReady(true);
    };
    load();
    window.addEventListener(CHANGE, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(CHANGE, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  return { completions, ready };
}
type Session = {
  elapsed: number;
  started: boolean;
  paused: boolean;
  completion: Completion | null;
};
const validSession = (v: unknown): v is Session =>
  !!v &&
  typeof v === "object" &&
  "elapsed" in v &&
  Number.isInteger(v.elapsed) &&
  Number(v.elapsed) >= 0 &&
  "started" in v &&
  typeof v.started === "boolean" &&
  "paused" in v &&
  typeof v.paused === "boolean" &&
  "completion" in v &&
  (v.completion === null || validCompletions([v.completion]));
export function useGameSession(challenge: PublicChallenge, locale: Locale) {
  const localPreview = useLocalPreview();
  const store = useStoredState<Session>(
    `dailygrid:session:${challenge.id}`,
    { elapsed: 0, started: false, paused: false, completion: null },
    validSession,
  );
  const { value: session, setValue, ready } = store;
  const latestSession = useRef(session);
  useEffect(() => {
    if (!ready || !challenge.roomStartedAt || session.completion) return;
    const elapsed = Math.max(0, Math.floor((Date.now()-Date.parse(challenge.roomStartedAt))/1000));
    setValue(s => s.started && !s.paused && s.elapsed >= elapsed ? s : {...s, started: true, paused: false, elapsed});
  }, [ready, challenge.roomStartedAt, session.completion, setValue]);
  useEffect(() => {
    const root=document.querySelector<HTMLElement>("[data-game-root]");
    if(root)root.dataset.measurementPlaying=String(!localPreview && ready && session.started && !session.paused && !session.completion);
  },[localPreview,ready,session.started,session.paused,session.completion]);
  useEffect(() => {
    latestSession.current = session;
  }, [session]);
  useEffect(() => {
    if (ready && !localPreview)
      track("game_view", {
        game_id: challenge.kind,
        challenge_id: challenge.id,
        locale,
        date: challenge.date,
        mode: challenge.mode ?? "daily",
      });
  }, [
    ready,
    localPreview,
    challenge.id,
    challenge.kind,
    challenge.date,
    challenge.mode,
    locale,
  ]);
  useEffect(() => {
    if (localPreview || !ready || !session.started || session.paused || session.completion)
      return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        setValue((s) => ({ ...s, elapsed: s.elapsed + 1 }));
    }, 1000);
    return () => clearInterval(timer);
  }, [localPreview, ready, session.started, session.paused, session.completion, setValue]);
  useEffect(() => {
    let emitted = false;
    const abandon = () => {
      const current = latestSession.current;
      if (!emitted && current.started && !current.completion) {
        emitted = true;
        track("game_abandon", {
          game_id: challenge.kind,
          challenge_id: challenge.id,
          locale,
          duration: current.elapsed,
          mode: challenge.mode ?? "daily",
        });
      }
    };
    window.addEventListener("pagehide", abandon);
    return () => {
      window.removeEventListener("pagehide", abandon);
      abandon();
    };
  }, [challenge.id, challenge.kind, challenge.mode, locale]);
  const start = useCallback(() => {
    if (!ready || session.completion || session.paused) return;
    if (!session.started) {
      void beginPlay(challenge).catch(() => {
        /* Submission retries a failed server start. */
      });
      setValue((s) => ({ ...s, started: true }));
      track("game_start", {
        game_id: challenge.kind,
        challenge_id: challenge.id,
        locale,
        mode: challenge.mode ?? "daily",
      });
      if (challenge.mode === "practice")
        track("practice_start", {
          locale,
          game_id: challenge.kind,
          challenge_id: challenge.id,
          mode: "practice",
        });
    }
  }, [
    ready,
    session.completion,
    session.paused,
    session.started,
    setValue,
    challenge,
    locale,
  ]);
  const finish = (success: boolean, score: number, attempts?: number) => {
    if (session.completion) return;
    const completion: Completion = authoritativeCompletion(challenge.id) ?? {
      challengeId: challenge.id,
      game: challenge.kind,
      date: challenge.date,
      locale,
      duration: session.elapsed,
      success,
      score,
      attempts,
      completedAt: new Date().toISOString(),
      mode: challenge.mode ?? "daily",
      ...(challenge.kind === "sudoku" ||
      challenge.kind === "mines" ||
      challenge.kind === "guess"
        ? { difficulty: challenge.difficulty }
        : {}),
      provenance: "imported",
      eligible: false,
    };
    const previous = safeRead(STATS_KEY, [], validCompletions),
      updated = addCompletion(previous, completion);
    writeStorage(STATS_KEY, updated);
    setValue((s) => ({ ...s, completion }));
    track("game_complete", {
      game_id: challenge.kind,
      challenge_id: challenge.id,
      locale,
      duration: session.elapsed,
      success,
      score,
      mode: completion.mode ?? "daily",
    });
    if (challenge.mode === "practice")
      track("practice_complete", {
        locale,
        game_id: challenge.kind,
        challenge_id: challenge.id,
        duration: completion.duration,
        success,
        score,
        mode: "practice",
      });
    window.dispatchEvent(new CustomEvent("dailygrid:completed"));
    const streak = streaks(updated, utcDay()).current;
    if (streak !== streaks(previous, utcDay()).current)
      track("streak", { locale, streak });
  };
  return {
    ...store,
    session,
    start,
    finish,
    togglePause: () => { if (!challenge.roomId) setValue((s) => ({ ...s, paused: !s.paused })); },
  };
}
export const clockText = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
