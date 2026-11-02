"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Difficulty, GameId, Locale, PublicChallenge } from "@/lib/types";
import { quizTopics, validQuizTopic } from "@/lib/knowledge-catalog";
import { kt } from "@/lib/knowledge-i18n";
import { rt } from "@/lib/retention-i18n";
import { postJson, rememberRun } from "@/lib/play-client";
import { readLocal, writeLocal } from "@/lib/browser-storage";
import { GamePlayer } from "./game-player";
import { useAccount } from "./account-provider";
import { st } from "@/lib/social-i18n";
import { useStoredState } from "./storage";
import { GamePreview } from "./game-preview";
import { consumeReplay, preserveReplaySpace, releaseReplaySpace } from "@/lib/replay-scroll";
import {
  categoriesFor,
  categoryLabel,
  validSocialCategory,
} from "@/lib/social-categories";
type Practice = {
  runId: string;
  challenge: PublicChallenge;
  result?: unknown;
  offset?: number;
};
const pending = new Map<string, Promise<Practice>>();
export function PracticePlayer({
  game,
  locale,
  difficulty,
  preview,
  quizCategory,
}: {
  game: GameId;
  locale: Locale;
  difficulty: Difficulty;
  preview?: PublicChallenge;
  quizCategory?: string;
}) {
  const account = useAccount(),
    [challenge, setChallenge] = useState<PublicChallenge | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const [scrollTarget, setScrollTarget] = useState("");
  const initialReplay = useRef<boolean | null>(null);
  const revision = useRef(0),
    progress = useRef({ offset: 0, count: 0 }),
    [ratherOffset, setRatherOffset] = useState(0);
  const {
    value: selectedCategory,
    setValue: setCategory,
    ready: categoryReady,
  } = useStoredState<string>(
    `dailygrid:preferences:category:${game}`,
    "all",
    (v): v is string =>
      game === "quiz" ? validQuizTopic(v) : game === "ranking" || game === "rather"
        ? validSocialCategory(v, game)
        : v === "all",
  );
  const category = quizCategory ?? selectedCategory;
  const key = `dailygrid:practice:${game}:${locale}:${difficulty}${game === "ranking" || game === "rather" || game === "quiz" ? ":" + category : ""}`;
  const load = useCallback(
    async (fresh = false, continuation = false, answered?: number) => {
      if (fresh) preserveReplaySpace();
      const expectedRevision = ++revision.current;
      setBusy(true);
      setError(false);
      const requestKey = `${account.user?.id ?? "guest"}:${key}:${fresh ? "fresh" : "resume"}`;
      let promise = pending.get(requestKey);
      if (!promise) {
        promise = (async () => {
          if (!fresh) {
            try {
              const saved: Practice | null = JSON.parse(
                readLocal(key) ?? "null",
              );
              if (saved?.runId) {
                const response = await fetch(
                  `/api/play?runId=${encodeURIComponent(saved.runId)}`,
                  { cache: "no-store" },
                );
                if (response.ok)
                  return {
                    ...((await response.json()) as Practice),
                    offset:
                      Number.isSafeInteger(saved.offset) &&
                      Number(saved.offset) >= 0
                        ? saved.offset
                        : 0,
                  };
              }
            } catch {
              /* An expired or corrupted draft is replaced with a valid puzzle. */
            }
          }
          const offset =
            fresh && continuation
              ? progress.current.offset +
                (Number.isInteger(answered) &&
                Number(answered) > 0 &&
                Number(answered) <= progress.current.count
                  ? Number(answered)
                  : progress.current.count)
              : 0;
          let previousRunId: string | undefined;
          if (fresh && (game === "quiz" || game === "football")) {try {previousRunId=JSON.parse(readLocal(key) ?? "null")?.runId;}catch { /* An unreadable cache cannot prevent a fresh game. */ }}
          return {
            ...((await postJson("/api/play", {
              action: "new",
              mode: "practice",
              game,
              locale,
              difficulty,
              category,
              previousRunId,
            })) as unknown as Practice),
            offset,
          };
        })();
        pending.set(requestKey, promise);
        promise.finally(() => pending.delete(requestKey)).catch(() => {});
      }
      try {
        const data = await promise;
        if (revision.current !== expectedRevision) return;
        writeLocal(key, {
          runId: data.runId,
          challenge: data.challenge,
          offset: data.offset ?? 0,
        });
        progress.current = {
          offset: data.offset ?? 0,
          count:
            data.challenge.kind === "rather"
              ? data.challenge.questions.length
              : 0,
        };
        setRatherOffset(progress.current.offset);
        rememberRun(data.challenge, data.runId);
        setChallenge(data.challenge);
        initialReplay.current = false;
        if (fresh) setScrollTarget(data.challenge.id);
      } catch {
        if (revision.current === expectedRevision) {setError(true); releaseReplaySpace();}
      } finally {
        if (revision.current === expectedRevision) setBusy(false);
      }
    },
    [account.user?.id, key, game, locale, difficulty, category],
  );
  useEffect(() => {
    if (account.ready && categoryReady) {
      initialReplay.current ??= consumeReplay(game, locale);
      void load(initialReplay.current);
    }
  }, [account.ready, categoryReady, load, game, locale]);
  useEffect(() => {
    const replay = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      void load(
        true,
        game === "rather" && detail?.continueRather === true,
        detail?.answered,
      );
    };
    window.addEventListener("dailygrid:play-again", replay);
    return () => window.removeEventListener("dailygrid:play-again", replay);
  }, [load, game]);
  if (error)
    return (
      <div role="alert">
        <p>{rt(locale).syncIssue}</p>
        <button className="primary-button" onClick={() => void load()}>
          {rt(locale).retry}
        </button>
      </div>
    );
  return (
    <div aria-busy={busy}>
      {game === "quiz" && !quizCategory && <label className="practice-category">{kt(locale).choose}<select value={category} onChange={e=>setCategory(e.target.value)} disabled={busy || !categoryReady || !account.ready}><option value="all">{kt(locale).all}</option>{quizTopics.map(topic=><option key={topic.id} value={topic.id}>{topic.title[locale]}</option>)}</select></label>}
      {(game === "ranking" || game === "rather") && (
        <label className="practice-category">
          {st(locale).category}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={busy || !categoryReady || !account.ready}
          >
            {categoriesFor(game).map((key) => (
              <option key={key} value={key}>
                {categoryLabel(key, locale)}
              </option>
            ))}
          </select>
        </label>
      )}
      {challenge ? (
        <GamePlayer
          key={challenge.id}
          challenge={challenge}
          locale={locale}
          ratherOffset={ratherOffset}
          scrollOnReady={scrollTarget === challenge.id}
        />
      ) : preview ? (
        <GamePreview challenge={preview} locale={locale} />
      ) : (
        <p role="status">{rt(locale).loading}</p>
      )}
    </div>
  );
}
