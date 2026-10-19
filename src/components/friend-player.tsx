"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { GamePlayer } from "./game-player";
import { useAccount } from "./account-provider";
import { clockText, useStats } from "./storage";
import { et } from "@/lib/engagement-i18n";
import { t, languageNames } from "@/lib/i18n";
import type { Locale, PublicChallenge } from "@/lib/types";
import type { FriendScore, FriendView } from "@/lib/friend-types";
import { friendWinner } from "@/lib/friend-types";
import { postJson, rememberRun } from "@/lib/play-client";
import { gameName } from "@/lib/registry";
export function FriendPlayer({
  initial,
  locale,
}: {
  initial: FriendView;
  locale: Locale;
}) {
  const [view, setView] = useState(initial),
    [challenge, setChallenge] = useState<PublicChallenge | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [revision, setRevision] = useState(0);
  const account = useAccount(),
    { completions } = useStats(),
    m = et(locale);
  const completed = completions.find((c) => c.friendId === initial.id);
  useEffect(() => {
    if (!account.ready) return;
    const controller = new AbortController();
    fetch(`/api/friends?id=${initial.id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw new Error(
            r.status === 410 ? m.expired : t(locale).networkError,
          );
        return r.json();
      })
      .then((value) => {
        if (controller.signal.aborted) return;
        setView(value);
        setReady(true);
        setError("");
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : t(locale).networkError,
          );
      });
    return () => controller.abort();
  }, [
    account.ready,
    account.user?.id,
    completed?.runId,
    initial.id,
    revision,
    locale,
    m.expired,
  ]);
  useEffect(() => {
    if (!view.isHost) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setRevision((n) => n + 1);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [view.isHost]);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const data = await postJson("/api/friends", {
        action: "join",
        id: initial.id,
      });
      rememberRun(data.challenge as PublicChallenge, data.runId as string);
      setChallenge(data.challenge as PublicChallenge);
    } catch {
      setError(t(locale).networkError);
    } finally {
      setBusy(false);
    }
  }
  function scoreCard(title: string, score: FriendScore | null, key: string) {
    return (
      <article key={key}>
        <h4>{title}</h4>
        {score ? (
          <>
            <p>
              {view.challenge.kind === "2048"
                ? t(locale).mathEnd
                : score.success
                  ? t(locale).won
                  : t(locale).ended}
            </p>
            <strong>
              {(view.challenge.kind === "word" || view.challenge.kind === "rareword")
                ? `${score.success ? score.attempts : "X"}/${"attempts" in view.challenge ? view.challenge.attempts : 6}`
                : view.challenge.kind === "math" ||
                    view.challenge.kind === "2048"
                  ? `${score.score} ${t(locale).score}`
                  : clockText(score.duration)}
            </strong>
            {view.challenge.kind !== "sudoku" && (
              <p>{clockText(score.duration)}</p>
            )}
          </>
        ) : (
          <p>{m.waiting}</p>
        )}
      </article>
    );
  }
  const outcome = view.you
    ? friendWinner(view.challenge.kind, view.host, view.you)
    : null;
  return (
    <div className="friend-player">
      <h2>
        {gameName(view.challenge.kind, locale)}
        {((view.challenge.kind === "word" || view.challenge.kind === "rareword") ||
          view.challenge.kind === "wordsearch") &&
          ` · ${languageNames[view.challenge.locale]}`}
      </h2>
      {view.isHost ? (
        <p>{m.host}</p>
      ) : challenge ? (
        <div className={`play-surface ${challenge.kind}`}>
          <GamePlayer
            challenge={challenge}
            locale={
              challenge.kind === "word" || challenge.kind === "rareword" || challenge.kind === "wordsearch"
                ? challenge.locale
                : locale
            }
          />
        </div>
      ) : (
        <button
          className="primary-button"
          disabled={!account.ready || !ready || busy}
          onClick={join}
        >
          {m.playChallenge}
        </button>
      )}
      {error && <p role="alert">{error}</p>}
      <section className="friend-comparison" data-friend-comparison>
        <h3>{m.comparison}</h3>
        <div className="friend-scores">
          {view.isHost ? (
            <>
              {scoreCard(m.you, view.host, "host")}
              {view.peers.length
                ? view.peers.map((peer, i) =>
                    scoreCard(`${m.friend} ${i + 1}`, peer, `peer-${i}`),
                  )
                : scoreCard(m.friend, null, "waiting")}
            </>
          ) : (
            <>
              {scoreCard(m.friend, view.host, "host")}
              {scoreCard(m.you, view.you, "you")}
            </>
          )}
        </div>
        {outcome && !view.isHost && (
          <p className="friend-outcome">
            {outcome === "draw"
              ? m.draw
              : outcome === "you"
                ? m.youWin
                : m.friendWins}
          </p>
        )}
        <button
          className="secondary-button"
          onClick={() => setRevision((n) => n + 1)}
          disabled={!account.ready}
        >
          {
            {
              fr: "Actualiser les résultats",
              en: "Refresh results",
              es: "Actualizar resultados",
              de: "Ergebnisse aktualisieren",
            }[locale]
          }
        </button>
        <p>
          <small>{m.friendlyOnly}</small>
        </p>
      </section>
      <Link
        className="secondary-button"
        href={`/${locale}/friend/${initial.id}/rematch`}
      >
        {m.rematch}
      </Link>
      <p>{m.rematchHelp}</p>
    </div>
  );
}
