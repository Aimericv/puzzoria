"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Completion, Locale } from "@/lib/types";
import type {
  Community,
  PublicSocialChallenge,
  SocialAction,
  SocialState,
} from "@/lib/social-types";
import { categoryLabel } from "@/lib/social-categories";
import { initialSocial } from "@/lib/social-play";
import { st, sf } from "@/lib/social-i18n";
import { reservePlay, submitPlay, rememberCompletion } from "@/lib/play-client";
import { practicePath } from "@/lib/play-path";
import { t } from "@/lib/i18n";
import { useGameSession, useStats } from "./storage";
import { ErrorMessage, CompletionPanel } from "./game-common";
import { NumberArena, SecretNumberForm } from "./number-arena";
import { CommunityResult, VoteReveal } from "./social-community";
import {
  NumberControls,
  questionText,
  numberFeedback,
} from "./number-controls";
import { numberRuleSet } from "@/lib/number-duel";
import { SocialShare } from "./social-share";
import { LiveInvite } from "./live-invite";
import { requestReplay } from "@/lib/replay-scroll";
import { pg } from "@/lib/post-game-i18n";
import { useLocalPreview } from "./local-preview-context";
import { socialShareLines } from "@/lib/social-share";
export function NumberRecords({
  locale,
  difficulty,
  rules = "legacy",
}: {
  locale: Locale;
  difficulty?: string;
  rules?: Completion["numberRules"];
}) {
  const preview = useLocalPreview();
  const { completions } = useStats(),
    m = st(locale),
    games = (preview ? [...preview.history, preview.completion] : completions).filter(
      (c) =>
        c.game === "guess" &&
        c.difficulty === difficulty &&
        (c.numberRules ?? "legacy") === rules,
    ),
    wins = games.filter((c) => c.success),
    best = Math.min(...wins.map((c) => c.attempts ?? Infinity));
  let streak = 0;
  for (const c of [...games].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  )) {
    if (!c.success) break;
    streak++;
  }
  return (
    <div className="number-records">
      <span>
        {m.wins} <b>{wins.length}</b>
      </span>
      <span>
        {m.losses}{" "}
        <b>{games.filter((c) => !c.success && c.outcome !== "draw").length}</b>
      </span>
      <span>
        {m.streak} <b>{streak}</b>
      </span>
      {Number.isFinite(best) && <small>{sf(m.record, { n: best })}</small>}
    </div>
  );
}
export function SocialGame({
  challenge: c,
  locale,
  ratherOffset = 0,
}: {
  challenge: PublicSocialChallenge;
  locale: Locale;
  ratherOffset?: number;
}) {
  const m = st(locale),
    base = t(locale),
    session = useGameSession(c, locale),
    [storedState, setState] = useState(() => initialSocial(c)),
    [storedCommunity, setCommunity] = useState<Community>(null),
    [communityError, setCommunityError] = useState(false),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [runId, setRunId] = useState(""),
    [storedCompletion, setCompletion] = useState<Completion | null>(null),
    [question, setQuestion] = useState(0),
    [secret, setSecret] = useState(""),
    [friends, setFriends] = useState(false);
  const preview = useLocalPreview();
  const state = preview?.state ?? storedState, completion = preview?.completion ?? storedCompletion, community = preview?.community ?? storedCommunity;
  const [showSummary, setShowSummary] = useState(false);
  const locked = useRef(false),
    current = useRef(state),
    latestSession = useRef(session),
    alive = useRef(true);
  useEffect(() => {
    current.current = state;
    latestSession.current = session;
  });
  async function refresh(id: string) {
    try {
      const r = await fetch("/api/community?runId=" + encodeURIComponent(id), {
        cache: "no-store",
      });
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (alive.current && data.sequence >= current.current.moves) {
        setCommunity(data.community);
        setCommunityError(false);
      }
    } catch {
      if (alive.current) setCommunityError(true);
    }
  }
  useEffect(() => {
    let live = true;
    alive.current = true;
    void reservePlay(c)
      .then((data) => {
        if (!live) return;
        setRunId(data.runId);
        const restored = (data.result?.state ??
          data.progress ??
          initialSocial(c)) as SocialState;
        setState(restored);
        current.current = restored;
        setQuestion(Math.max(0, restored.votes.length - 1));
        if (
          c.kind === "rather" &&
          restored.completed &&
          restored.moves > restored.votes.length
        )
          setShowSummary(true);
        if (data.result?.completion) {
          setCompletion(data.result.completion);
          rememberCompletion(data.result.completion);
          latestSession.current.finish(
            data.result.completion.success,
            data.result.completion.score,
            data.result.completion.attempts,
          );
        }
        setLoaded(true);
        void refresh(data.runId);
      })
      .catch(() => {
        if (live) setError("networkError");
      });
    return () => {
      live = false;
      alive.current = false;
    };
  }, [c]);
  async function act(step: SocialAction) {
    if (
      locked.current ||
      !loaded ||
      !session.ready ||
      current.current.completed
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    latestSession.current.start();
    try {
      if (c.kind === "guess") {
        // A saved run can have advanced in another tab or before a hot reload.
        // Obtain the owned server cursor before sending a manually chosen proposal.
        const saved = await reservePlay(c);
        if (!alive.current) return;
        const restored = (saved.result?.state ??
          saved.progress ??
          initialSocial(c)) as SocialState;
        current.current = restored;
        setState(restored);
        setRunId(saved.runId);
        if (saved.result?.completion) {
          setCompletion(saved.result.completion);
          rememberCompletion(saved.result.completion);
          latestSession.current.finish(
            saved.result.completion.success,
            saved.result.completion.score,
            saved.result.completion.attempts,
          );
          return;
        }
        if (step.kind === "secret" && restored.yourNumber !== null) {
          setError("numberLocked");
          return;
        }
      }
      const data = await submitPlay(c, {
          step,
          sequence: current.current.moves,
        }),
        next = data.state as SocialState;
      if (!alive.current) return;
      setState(next);
      current.current = next;
      if (step.kind === "finish") setShowSummary(true);
      if (data.completion) {
        const result = data.completion as Completion;
        setCompletion(result);
        rememberCompletion(result);
        latestSession.current.finish(
          result.success,
          result.score,
          result.attempts,
        );
      }
      await refresh(runId);
    } catch (e) {
      if (!alive.current) return;
      // Restore accepted actions before retrying, including a lost response after commit.
      try {
        const data = await reservePlay(c);
        if (alive.current) {
          const next = (data.result?.state ??
            data.progress ??
            initialSocial(c)) as SocialState;
          setState(next);
          current.current = next;
          if (
            c.kind === "rather" &&
            next.completed &&
            next.moves > next.votes.length
          )
            setShowSummary(true);
          if (data.result?.completion) {
            setCompletion(data.result.completion);
            rememberCompletion(data.result.completion);
            latestSession.current.finish(
              data.result.completion.success,
              data.result.completion.score,
              data.result.completion.attempts,
            );
          }
          await refresh(data.runId);
        }
      } catch {
        /* Keep the error visible; the next action restores server state. */
      }
      if (alive.current)
        setError(
          (e as Error).message === "invalid"
            ? "invalidAction"
            : (e as Error).message || "networkError",
        );
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const q = c.kind === "rather" ? c.questions[question] : null,
    choice = state.votes[question],
    result =
      community?.kind === "rather" ? community.questions[question] : null;
  const disabled = busy || !loaded || !session.ready,
    endlessRather = c.kind === "rather" && c.mode === "practice" && !c.friendId && !c.roomId,
    finished = state.completed && completion && (!endlessRather || showSummary || !!preview);
  function continueRather() {
    if (preview) {preview.reset(); window.dispatchEvent(new CustomEvent("dailygrid:play-again")); return;}
    window.dispatchEvent(
      new CustomEvent("dailygrid:play-again", {
        detail: { continueRather: true, answered: state.votes.length },
      }),
    );
  }
  const replayButton =
    c.mode === "practice" && !c.friendId ? (
      <button
        className="primary-button"
        onClick={() =>
          endlessRather
            ? continueRather()
            : window.dispatchEvent(new CustomEvent("dailygrid:play-again"))
        }
      >
        {endlessRather ? m.next + " →" : m.replay}
      </button>
    ) : (
      <Link
        className="primary-button"
        scroll={false}
        onClick={() => requestReplay(c.kind, locale)}
        href={practicePath(
          locale,
          c.kind,
          "difficulty" in c ? c.difficulty : undefined,
        )}
      >
        {m.replay}
      </Link>
    );
  return (
    <div className="social-game" aria-busy={busy} data-social-game={c.kind}>
      {(c.kind === "ranking" || c.kind === "rather") && (
        <div
          className={`social-category-heading${c.kind === "ranking" ? " ranking-theme" : ""}`}
        >
          <span>{c.kind === "ranking" ? m.rankingTheme : m.category}</span>
          <strong>
            {c.kind === "ranking" && c.category === "random"
              ? m.rankingRandomTheme
              : categoryLabel(
                  c.kind === "ranking"
                    ? c.category
                    : (q?.category ?? c.category),
                  locale,
                )}
          </strong>
          {c.kind === "ranking" && !finished && (
            <p className="ranking-criteria">{m.rankingCriteria}</p>
          )}
        </div>
      )}
      {c.kind === "guess" && (
        <div className="social-tabs">
          <button
            className={!friends ? "selected" : ""}
            onClick={() => setFriends(false)}
          >
            {m.bot}
          </button>
          <button
            className={friends ? "selected" : ""}
            onClick={() => setFriends(true)}
          >
            {m.friends}
          </button>
        </div>
      )}
      {c.kind === "guess" && friends ? (
        <div className="live-entry"><LiveInvite game="guess" locale={locale}/></div>
      ) : (
        <>
          {finished ? (
            <>
            {c.kind === "ranking" && <ol className="ranking-result" data-finished-board>
              {state.ranking.map((id, i) => {
                const item = state.visibleItems.find((v) => v.id === id)!;
                return <li key={id}><span>{item.emoji} {item.label[locale]}</span>{community?.kind === "ranking" && <small>{sf(m.pick, {n:community.percentages[i][i],item:item.label[locale],position:i+1})}</small>}</li>;
              })}
            </ol>}
            {c.kind === "rather" && q && <div className="dilemma-options" data-finished-board>
              {(["a", "b"] as const).map((side) => <button key={side} disabled className={`option-${side} ${choice === side ? "chosen" : ""}`}><small>{side.toUpperCase()}</small><strong>{q[side][locale]}</strong></button>)}
            </div>}
            {c.kind === "guess" && <NumberArena locale={locale} yourNumber={state.yourNumber} opponent={m.bot} bot ready yourTurn={false} opponentReady completed opponentNumber={state.opponentNumber}/>}
            <CompletionPanel completion={completion} locale={locale}
              resultDetails={c.kind==="guess" ? {botAttempts:state.events.filter(e=>e.actor==="bot").length} : {choicesCount:c.kind==="ranking" ? 5 : state.votes.length}}
              title={c.kind === "guess" ? state.success ? m.won : completion.outcome === "draw" ? m.draw : m.lost : m.ended}
              primaryAction={endlessRather ? replayButton : undefined}
              shareLines={socialShareLines(c,state,community,locale)}
              comparisonContent={<><CommunityResult challenge={c} state={state} community={community} locale={locale} showRanking={false}/><button className="text-button" disabled={busy || !!preview} onClick={() => void refresh(runId)}>{m.refresh}</button></>}>
              {endlessRather && <p className="social-round">{sf(m.recentChoices,{n:state.votes.length})}</p>}
              {c.kind === "guess" && <><p>{m.bot}: <strong>{state.opponentNumber}</strong></p><NumberRecords locale={locale} difficulty={c.difficulty} rules={completion.numberRules}/></>}
              <SocialShare imageOnly challenge={c} state={state} community={community} runId={preview ? undefined : runId} locale={locale}/>
            </CompletionPanel>
            </>
          ) : (
            <>
              {c.kind === "ranking" && (
                <>
                  <p className="social-round">
                    {sf(m.count, { n: state.moves + 1, total: 5 })}
                  </p>
                  <div className="blind-item" key={state.moves}>
                    <span>{state.visibleItems[state.moves]?.emoji}</span>
                    <strong>
                      {state.visibleItems[state.moves]?.label[locale]}
                    </strong>
                  </div>
                  <p>{m.place}</p>
                  <div className="ranking-places">
                    {state.ranking.map((id, i) => {
                      const item = state.visibleItems.find((v) => v.id === id);
                      return (
                        <button
                          key={i}
                          disabled={disabled || id !== null}
                          onClick={() =>
                            void act({ kind: "rank", position: i + 1 })
                          }
                          aria-label={`${i + 1}${item ? " · " + item.label[locale] + " · " + m.locked : ""}`}
                          className={item ? "locked" : ""}
                        >
                          <b>#{i + 1}</b>
                          <span>
                            {item
                              ? item.emoji + " " + item.label[locale]
                              : m.choose}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="blind-queue" aria-hidden="true">
                    {Array.from(
                      { length: Math.max(0, 4 - state.moves) },
                      (_, i) => (
                        <span key={i}>?</span>
                      ),
                    )}
                  </div>
                </>
              )}
              {c.kind === "rather" && q && (
                <>
                  <p className="social-round">
                    {endlessRather
                      ? sf(m.endlessCount, { n: ratherOffset + question + 1 })
                      : sf(m.count, {
                          n: question + 1,
                          total: c.questions.length,
                        })}
                  </p>
                  <h2 className="dilemma-heading">{m.ratherName}…</h2>
                  <div className="dilemma-options">
                    {(["a", "b"] as const).map((side) => (
                      <button
                        key={side}
                        data-choice={side}
                        className={`option-${side} ${choice === side ? "chosen" : ""}`}
                        disabled={disabled || !!choice}
                        onClick={() => void act({ kind: "vote", choice: side })}
                      >
                        <small>{side.toUpperCase()}</small>
                        <strong>{q[side][locale]}</strong>
                      </button>
                    ))}
                  </div>
                  {choice ? (
                    <>
                      <VoteReveal
                        result={result ?? null}
                        choice={choice}
                        locale={locale}
                      />
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() =>
                          question + 1 < c.questions.length
                            ? setQuestion(question + 1)
                            : continueRather()
                        }
                      >
                        {m.next} →
                      </button>
                      {endlessRather && (
                        <button
                          className="secondary-button"
                          disabled={busy}
                          onClick={() =>
                            state.completed
                              ? setShowSummary(true)
                              : void act({ kind: "finish" })
                          }
                        >
                          {m.review}
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="community-wait">{m.voteFirst}</p>
                  )}
                </>
              )}
              {c.kind === "guess" && (
                <>
                  <div className="number-explanation">
                    <p>{m.numberGoal}</p>
                    <small>
                      <b>{m[c.difficulty]} : </b>
                      {m[`${c.difficulty}Explain`]}
                    </small>
                  </div>
                  {c.mode === "practice" && state.yourNumber !== null && (
                    <button
                      className="secondary-button number-new-game"
                      disabled={disabled}
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("dailygrid:play-again"),
                        )
                      }
                    >
                      {m.newNumberGame}
                    </button>
                  )}
                  {state.yourNumber !== null && (
                    <div className="turn-banner active" aria-live="polite">
                      {busy ? base.loading : m.yourTurn} ·{" "}
                      {sf(m.turnNumber, { n: state.turns + 1 })}
                    </div>
                  )}
                  <NumberArena
                    locale={locale}
                    yourNumber={state.yourNumber}
                    opponent={m.bot}
                    bot
                    yourClue={state.events
                      .filter((event) => event.actor === "you")
                      .at(-1)}
                    opponentClue={state.events
                      .filter((event) => event.actor === "bot")
                      .at(-1)}
                    ready={state.yourNumber !== null}
                    yourTurn={!busy}
                    opponentReady
                    setup={
                      <SecretNumberForm
                        locale={locale}
                        value={secret}
                        onChange={setSecret}
                        disabled={disabled}
                        onSubmit={(value) =>
                          void act({ kind: "secret", value })
                        }
                      />
                    }
                  />
                  {state.yourNumber !== null && (
                    <section className="number-deduction">
                      <h3>{m.deduction}</h3>
                      <p className="number-action-help">{m.actionHelp}</p>
                      <NumberControls
                        locale={locale}
                        disabled={disabled}
                        onAction={(a) => void act(a)}
                      />
                    </section>
                  )}
                  <details className="number-history">
                    <summary>
                      {m.history} ({state.events.length})
                    </summary>
                    <ol className="number-events" aria-live="polite">
                      {state.events.map((event, i) => (
                        <li key={i}>
                          <b>{event.actor === "you" ? m.you : "🤖 " + m.bot}</b>{" "}
                          {questionText(event.action, locale)}{" "}
                          <strong>{numberFeedback(event, locale)}</strong>
                        </li>
                      ))}
                    </ol>
                  </details>
                  <details className="number-history">
                    <summary>{m.records}</summary>
                    <NumberRecords
                      locale={locale}
                      difficulty={c.difficulty}
                      rules={c.rules ?? numberRuleSet(state)}
                    />
                  </details>
                </>
              )}
            </>
          )}
        </>
      )}
      <ErrorMessage error={error} locale={locale} />
      {communityError && !friends && (
        <p className="community-status" role="status">
          {pg(locale).communityUnavailable}
        </p>
      )}
      {!loaded && !error && <p role="status">{base.loading}</p>}
    </div>
  );
}
