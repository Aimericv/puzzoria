"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import type { RoomView } from "@/lib/number-room-types";
import type { SocialAction } from "@/lib/social-types";
import { st } from "@/lib/social-i18n";
import { t } from "@/lib/i18n";
import { postJson } from "@/lib/play-client";
import {
  NumberControls,
  questionText,
  numberFeedback,
} from "./number-controls";
import { useAccount } from "./account-provider";
import { addCompletion } from "@/lib/stats";
import { STATS_KEY, safeRead, validCompletions, writeStorage } from "./storage";
import { ErrorMessage, CompletionPanel } from "./game-common";
import { NumberArena, SecretNumberForm } from "./number-arena";
import { NumberRecords } from "./social-game";
import { SocialShare } from "./social-share";
import { socialShareLines } from "@/lib/social-share";
import { initialSocial } from "@/lib/social-play";
export function NumberRoom(props: { locale: Locale; initialCode?: string }) {
  const account = useAccount();
  if (!account.ready) return <p role="status">{t(props.locale).loading}</p>;
  return <RoomClient key={account.user?.id ?? "guest"} {...props} />;
}
function RoomClient({
  locale,
  initialCode,
}: {
  locale: Locale;
  initialCode?: string;
}) {
  const m = st(locale),
    base = t(locale),
    account = useAccount(),
    [room, setRoom] = useState<RoomView | null>(null),
    [code, setCode] = useState(""),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const current = useRef<RoomView | null>(null),
    locked = useRef(false),
    alive = useRef(true);
  function accept(value: RoomView) {
    if (
      !alive.current ||
      (current.current &&
        current.current.code === value.code &&
        current.current.sequence > value.sequence)
    )
      return;
    current.current = value;
    setRoom(value);
    if (value.completion)
      writeStorage(
        STATS_KEY,
        addCompletion(
          safeRead(STATS_KEY, [], validCompletions),
          value.completion,
        ),
      );
  }
  useEffect(() => {
    let live = true;
    alive.current = true;
    if (initialCode && account.ready)
      void postJson("/api/number-rooms", {
        action: "join",
        code: initialCode,
        locale,
      })
        .then((data) => {
          if (live) accept(data as unknown as RoomView);
        })
        .catch((e) => {
          if (live) setError((e as Error).message);
        });
    return () => {
      live = false;
      alive.current = false;
    };
  }, [initialCode, locale, account.ready, account.user?.id]);
  const roomCode = room?.code,
    completed = room?.completed;
  useEffect(() => {
    if (!roomCode || completed) return;
    let live = true,
      pending = false;
    const poll = async () => {
      if (pending || document.visibilityState === "hidden") return;
      pending = true;
      try {
        const r = await fetch("/api/number-rooms?code=" + roomCode, {
          cache: "no-store",
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) accept(data);
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        pending = false;
      }
    };
    const timer = setInterval(() => void poll(), 2000);
    void poll();
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [roomCode, completed]);
  async function request(action: string, extra: Record<string, unknown> = {}) {
    if (locked.current || !account.ready) return;
    locked.current = true;
    setBusy(true);
    setError("");
    try {
      const value = await postJson("/api/number-rooms", {
        action,
        locale,
        ...extra,
      });
      if (action === "create") setSecret("");
      accept(value as unknown as RoomView);
    } catch (e) {
      if (current.current)
        try {
          const r = await fetch(
            "/api/number-rooms?code=" + current.current.code,
            { cache: "no-store" },
          );
          if (r.ok) accept(await r.json());
        } catch {
          /* The saved state will be retried on the next poll. */
        }
      if (alive.current) setError((e as Error).message);
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  function play(step: SocialAction) {
    if (room)
      void request("play", { code: room.code, sequence: room.sequence, step });
  }
  async function copy() {
    if (!room) return;
    const link = new URL(
      `/${locale}/number-room/${room.code}`,
      window.location.origin,
    ).href;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(base.copied);
    } catch {
      setNotice(link);
    }
  }
  const disabled = busy || !account.ready,
    canPlay =
      room?.ready.every(Boolean) && room.turn === room.you && !room.completed;
  return (
    <div className="number-room" aria-busy={busy} data-game-root data-challenge-id={room?`duel:guess:${room.code}`:undefined} data-measurement-playing={String(!!room && room.ready.every(Boolean) && !room.completed)}>
      {!room ? (
        <div className="room-lobby">
          <button
            className="primary-button"
            disabled={disabled}
            onClick={() => void request("create")}
          >
            {m.create}
          </button>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void request("join", { code: code.toUpperCase().trim() });
            }}
          >
            <label>
              {m.code}
              <input
                aria-label={m.code}
                autoCapitalize="characters"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
            </label>
            <button
              className="secondary-button"
              disabled={disabled || !/^[A-Z2-9]{8}$/.test(code)}
            >
              {m.join}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="room-code">
            <span>{m.code}</span>
            <strong>{room.code}</strong>
            <button className="secondary-button" onClick={() => void copy()}>
              {m.link}
            </button>
          </div>
          <Link
            href={`/${locale}/number-room/${room.code}`}
            className="text-button"
          >
            {m.connected}
          </Link>
          {room.completed ? (
            <>
            <NumberArena locale={locale} yourNumber={room.numbers![room.you]} opponent={m.opponent} ready yourTurn={false} opponentReady completed opponentNumber={room.numbers![1-room.you]}/>
            <CompletionPanel completion={room.completion!} locale={locale}
              comparisonContent={<><h3>{m.friends}</h3><p>{room.winner === null ? m.draw : room.winner === room.you ? m.won : m.lost}</p><p>{m.you}: <b>{room.numbers![room.you]}</b> · {m.opponent}: <b>{room.numbers![1-room.you]}</b></p></>}
              title={room.winner === null ? m.draw : room.winner === room.you ? m.won : m.lost}
              primaryAction={<button
                  className="primary-button"
                  disabled={disabled}
                  onClick={() => void request("create")}
                >
                  {m.replay}
                </button>}
              shareLines={socialShareLines({
                  kind: "guess",
                  id: "duel:guess:" + room.code,
                  date: room.completion!.date,
                  locale,
                  difficulty: "medium",
                  mode: "practice",
                },{
                  ...initialSocial({
                    kind: "guess",
                    id: "",
                    date: room.completion!.date,
                    locale,
                    difficulty: "medium",
                  }),
                  completed: true,
                  candidates: room.candidates,
                  botCandidates: room.opponentCandidates,
                  success: room.winner === room.you,
                  yourNumber: room.numbers![room.you],
                  opponentNumber: room.numbers![1 - room.you],
                  turns: room.events.filter((e) => e.player === room.you)
                    .length,
                  events: room.events.map((e) => ({
                    ...e,
                    actor: e.player === room.you ? "you" : "bot",
                  })),
                },null,locale)}>
              <p>
                {m.you}: <b>{room.numbers![room.you]}</b> · {m.opponent}:{" "}
                <b>{room.numbers![1 - room.you]}</b>
              </p>
              <NumberRecords
                locale={locale}
                rules={room.completion!.numberRules}
              />

              <SocialShare imageOnly
                challenge={{
                  kind: "guess",
                  id: "duel:guess:" + room.code,
                  date: room.completion!.date,
                  locale,
                  difficulty: "medium",
                  mode: "practice",
                }}
                state={{
                  ...initialSocial({
                    kind: "guess",
                    id: "",
                    date: room.completion!.date,
                    locale,
                    difficulty: "medium",
                  }),
                  completed: true,
                  candidates: room.candidates,
                  botCandidates: room.opponentCandidates,
                  success: room.winner === room.you,
                  yourNumber: room.numbers![room.you],
                  opponentNumber: room.numbers![1 - room.you],
                  turns: room.events.filter((e) => e.player === room.you)
                    .length,
                  events: room.events.map((e) => ({
                    ...e,
                    actor: e.player === room.you ? "you" : "bot",
                  })),
                }}
                community={null}
                locale={locale}
                roomCode={room.code}
              />

            </CompletionPanel>
            </>
          ) : (
            <>
              {!room.ready.every(Boolean) && (
                <p className="community-wait">{m.waitingFriend}</p>
              )}
              {room.ready.every(Boolean) && (
                <div
                  className={
                    canPlay ? "turn-banner active" : "turn-banner waiting"
                  }
                  aria-live="polite"
                >
                  {canPlay ? m.yourTurn : m.opponentTurn}
                </div>
              )}
              <NumberArena
                locale={locale}
                yourNumber={room.number}
                opponent={m.opponent}
                yourClue={room.events
                  .filter((event) => event.player === room.you)
                  .at(-1)}
                opponentClue={room.events
                  .filter((event) => event.player !== room.you)
                  .at(-1)}
                ready={room.ready.every(Boolean)}
                yourTurn={!!canPlay}
                opponentReady={room.ready[1 - room.you]}
                setup={
                  <SecretNumberForm
                    locale={locale}
                    value={secret}
                    onChange={setSecret}
                    disabled={disabled}
                    onSubmit={(value) => play({ kind: "secret", value })}
                  />
                }
              />
              {room.ready.every(Boolean) && (
                <section className="number-deduction">
                  <h3>{m.deduction}</h3>
                  <p className="number-action-help">
                    {canPlay ? m.actionHelp : m.waitingAction}
                  </p>
                  <NumberControls
                    locale={locale}
                    disabled={disabled || !canPlay}
                    onAction={play}
                  />
                </section>
              )}
            </>
          )}
          <details className="number-history">
            <summary>
              {m.history} ({room.events.length})
            </summary>
            <ol className="number-events" aria-live="polite">
              {room.events.map((e, i) => (
                <li key={i}>
                  <b>{e.player === room.you ? m.you : m.opponent}</b>{" "}
                  {questionText(e.action, locale)}{" "}
                  <strong>{numberFeedback(e, locale)}</strong>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
      <ErrorMessage error={error} locale={locale} />
      {notice && (
        <p role="status" className="share-status">
          {notice}
        </p>
      )}
    </div>
  );
}
