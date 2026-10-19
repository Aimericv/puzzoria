"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Users, Copy, Zap } from "lucide-react";
import { gameName } from "@/lib/registry";
import { gamePath, t } from "@/lib/i18n";
import { lt } from "@/lib/live-i18n";
import {
  liveGames,
  opinionGame,
  type LiveGame,
  type LiveView,
} from "@/lib/live-types";
import {
  difficulties,
  locales,
  type Difficulty,
  type Locale,
  type Completion,
} from "@/lib/types";
import { categoriesFor, categoryLabel } from "@/lib/social-categories";
import { postJson, rememberRun } from "@/lib/play-client";
import { clockText } from "./storage";
import { useAccount } from "./account-provider";
import { CompletionPanel, ErrorMessage } from "./game-common";
import { GamePlayer } from "./game-player";
import { LiveContext } from "./live-context";
import { SecretNumberForm, NumberArena } from "./number-arena";
import { NumberControls } from "./number-controls";
import { st } from "@/lib/social-i18n";
import { gameStatisticsCopy } from "@/lib/game-statistics-i18n";
import { safeRead, validCompletions, writeStorage, STATS_KEY } from "./storage";
import { addCompletion } from "@/lib/stats";

export function LiveCreate({ locale }: { locale: Locale }) {
  const m = lt(locale),
    router = useRouter(),
    [game, setGame] = useState<LiveGame>("word"),
    [language, setLanguage] = useState<Locale>(locale),
    [difficulty, setDifficulty] = useState<Difficulty>("easy"),
    [category, setCategory] = useState("all"),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const account = useAccount();
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const room = await postJson("/api/live-rooms", {
        action: "create",
        game,
        locale: language,
        difficulty,
        category,
        name,
      });
      router.push(`/${locale}/live/${room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="live-create play-surface">
      <p className="live-eyebrow">
        <Users size={18} /> Puzzoria · {m.title}
      </p>
      <h1>{m.title}</h1>
      <form onSubmit={(e) => void create(e)} className="live-config">
        <label>
          {m.game}
          <select
            value={game}
            onChange={(e) => {
              setGame(e.target.value as LiveGame);
              setCategory("all");
            }}
          >
            {liveGames.map((g) => (
              <option key={g} value={g}>
                {gameName(g, locale)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {m.language}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Locale)}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {
                  {
                    en: "English",
                    fr: "Français",
                    es: "Español",
                    de: "Deutsch",
                  }[l]
                }
              </option>
            ))}
          </select>
        </label>
        {["sudoku", "mines"].includes(game) && (
          <label>
            {m.level}
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
        {(game === "ranking" || game === "rather") && (
          <label>
            {m.category}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categoriesFor(game).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c, locale)}
                </option>
              ))}
            </select>
          </label>
        )}
        {!account.user && (
          <label>
            {m.name}
            <input
              value={name}
              maxLength={24}
              onChange={(e) => setName(e.target.value)}
              autoComplete="nickname"
            />
          </label>
        )}
        <p className="live-rule">{m.rules[game]}</p>
        <button className="primary-button" disabled={busy || !account.ready}>
          {m.create}
        </button>
        <ErrorMessage error={error} locale={locale} />
      </form>
    </section>
  );
}
export function LiveRoom({ locale, code }: { locale: Locale; code: string }) {
  const m = lt(locale),
    account = useAccount(),
    [room, setRoom] = useState<LiveView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [secret, setSecret] = useState(""),
    [copied, setCopied] = useState(false),
    [connected, setConnected] = useState(true),
    [now, setNow] = useState(Date.now()),
    offset = useRef(0),
    lastStream = useRef(Date.now()),
    requestLock = useRef(false),
    savedRun = useRef("");
  const apply = useCallback((value: LiveView) => {
    offset.current = value.serverNow - Date.now();
    if (value.challenge && value.runId)
      rememberRun(value.challenge, value.runId);
    setRoom((old) => ({
      ...value,
      challenge:
        old && old.challenge?.id === value.challenge?.id
          ? old.challenge
          : value.challenge,
    }));
    setConnected(true);
  }, []);
  useEffect(() => {
    if (!account.ready) return;
    let live = true;
    void fetch(`/api/live-rooms?code=${encodeURIComponent(code)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (live) apply(data);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [code, account.ready, account.user?.id, apply]);
  const joined = (room?.you ?? -1) >= 0;
  useEffect(() => {
    const c = room?.completion;
    if (c?.provenance === "server" && c.runId !== savedRun.current) {
      writeStorage(
        STATS_KEY,
        addCompletion(safeRead(STATS_KEY, [], validCompletions), c),
      );
      savedRun.current = c.runId ?? "";
    }
  }, [room?.completion]);
  useEffect(() => {
    if (!joined) return;
    lastStream.current = Date.now();
    const stream = new EventSource(
      `/api/live-rooms?code=${encodeURIComponent(code)}&stream=1`,
    );
    let lost: ReturnType<typeof setTimeout> | undefined;
    stream.addEventListener("state", (e) => {
      lastStream.current = Date.now();
      clearTimeout(lost);
      lost = undefined;
      try {
        apply(JSON.parse((e as MessageEvent).data));
      } catch {
        setConnected(false);
      }
    });
    stream.onerror = () => {
      lost ??= setTimeout(() => setConnected(false), 3000);
    };
    return () => {
      clearTimeout(lost);
      stream.close();
    };
  }, [joined, code, account.user?.id, apply]);
  useEffect(() => {
    if (!joined) return;
    let current = true;
    const timer = setInterval(() => {
      if (Date.now() - lastStream.current < 3000) return;
      void fetch(`/api/live-rooms?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) return;
          const value = await response.json();
          if (current) apply(value);
        })
        .catch(() => {
          if (current) setConnected(false);
        });
    }, 2000);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [joined, code, apply]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setSecret("");
  }, [room?.round]);
  async function action(action: string, extra: Record<string, unknown> = {}) {
    if (requestLock.current) return;
    requestLock.current = true;
    setBusy(true);
    setError("");
    try {
      await postJson("/api/live-rooms", { action, code, name, ...extra });
      const response = await fetch(
        `/api/live-rooms?code=${encodeURIComponent(code)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      apply(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      requestLock.current = false;
      setBusy(false);
    }
  }
  async function copy() {
    const input = document.querySelector<HTMLInputElement>("[data-live-link]");
    try {
      await navigator.clipboard.writeText(input?.value ?? location.href);
      setCopied(true);
    } catch {
      input?.focus();
      input?.select();
    }
  }
  if (!room)
    return (
      <section className="play-surface">
        <h1>{m.title}</h1>
        <ErrorMessage error={error} locale={locale} />
        {!error && <p>{t(locale).loading}</p>}
        <Link href={`/${locale}/live`}>{m.create}</Link>
      </section>
    );
  const me = room.players[room.you],
    peer = room.players[1 - room.you],
    started = room.phase === "playing" || room.phase === "finished",
    done = room.phase === "finished",
    serverNow = now + offset.current;
  const status = (p: LiveView["players"][number]) =>
    p.forfeit
      ? m.forfeit
      : p.finished || done
        ? m.finished
        : !p.online
          ? m.offline
          : started
            ? m.playing
            : p.ready
              ? m.ready
              : m.connected;
  const title = opinionGame(room.game)
    ? m.together
    : room.winner === null
      ? m.draw
      : room.winner === room.you
        ? m.won
        : m.lost;
  const ownCompletion = room.completion;
  const displayCompletion: Completion = ownCompletion ?? {
    challengeId: room.challenge?.id ?? `live:${code}:${room.round}`,
    game: room.game,
    locale: room.locale,
    date: new Date(room.startAt ?? room.serverNow).toISOString().slice(0, 10),
    success: room.winner === room.you && !opinionGame(room.game),
    score: me?.score ?? 0,
    ...(["word", "guess"].includes(room.game)
      ? { attempts: me?.progress ?? 0 }
      : {}),
    ...(opinionGame(room.game) ? { choicesCount: me?.progress ?? 0 } : {}),
    ...(room.game === "wordsearch"
      ? { wordsFound: me?.progress ?? 0, wordsTotal: me?.total ?? 0 }
      : {}),
    duration:
      me?.duration ??
      Math.max(
        0,
        Math.floor(
          ((room.resolvedAt ?? serverNow) - (room.startAt ?? serverNow)) / 1000,
        ),
      ),
    completedAt: new Date(room.resolvedAt ?? room.serverNow).toISOString(),
    mode: "practice",
    friendId: `live:${code}`,
    roomId: code,
    eligible: false,
  };
  return (
    <LiveContext.Provider value={true}>
      <div className="live-room" data-live-room data-phase={room.phase}>
        <header className="live-heading">
          <Link className="back-link" href={`/${locale}`}>
            ← Puzzoria
          </Link>
          <p className="live-eyebrow">
            <Users size={18} />
            {m.title} · {m.round} {room.round}
          </p>
          <h1>{gameName(room.game, locale)}</h1>
          <p className="live-rule">{m.rules[room.game]}</p>
          {opinionGame(room.game) && <p>{m.reveal}</p>}
        </header>
        <div className="live-scoreboard" aria-label={m.progress}>
          {[0, 1].map((i) => {
            const p = room.players[i];
            return (
              <article
                key={i}
                className={`live-player ${i === room.you ? "is-you" : ""} ${done && room.winner === i ? "is-winner" : ""}`}
              >
                <div className="live-player-heading">
                  <strong>
                    {p?.name ?? m.opponent}
                    {i === room.you && <small> · {m.you}</small>}
                  </strong>
                  <span className={`live-dot ${p?.online ? "online" : ""}`} />
                </div>
                <p className="live-player-state">{p ? status(p) : m.waiting}</p>
                {started && p && (
                  <>
                    <div className="live-player-metric">
                      <b>
                        {room.game === "2048"
                          ? p.score
                          : room.game === "math"
                            ? p.finished
                              ? "✓"
                              : "…"
                            : p.progress}
                      </b>
                      <span>
                        {room.game === "2048"
                          ? m.score
                          : ["word", "guess"].includes(room.game)
                            ? m.attempts
                            : p.total
                              ? `/ ${p.total}`
                              : m.progress}
                      </span>
                    </div>
                    {!["word", "guess", "math", "2048"].includes(room.game) && (
                      <div className="live-progress">
                        <span
                          style={{
                            width: `${p.total ? Math.min(100, (p.progress / p.total) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    )}
                    {p.duration !== null && (
                      <small>
                        {m.time} · {clockText(p.duration)}
                      </small>
                    )}
                  </>
                )}
              </article>
            );
          })}
        </div>
        {!connected && joined && (
          <p className="live-connection" role="status">
            {m.reconnect}
          </p>
        )}
        {error && (
          <p className="game-error" role="alert">
            {error === "roomFull"
              ? m.full
              : error === "expired"
                ? m.expired
                : error === "matchFinished"
                  ? m.finished
                  : t(locale).networkError}
          </p>
        )}
        {!started && (
          <section className="live-lobby play-surface">
            {!joined ? (
              room.players.length === 2 ? (
                <p>{m.full}</p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void action("join");
                  }}
                >
                  <label>
                    {m.name}
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={24}
                      autoComplete="nickname"
                    />
                  </label>
                  <button className="primary-button" disabled={busy}>
                    {m.join}
                  </button>
                </form>
              )
            ) : (
              <>
                {room.phase === "lobby" && (
                  <>
                    <label className="live-link">
                      {m.link}
                      <input
                        data-live-link
                        readOnly
                        value={`${typeof location !== "undefined" ? location.origin : ""}/${locale}/live/${code}`}
                        onFocus={(e) => e.target.select()}
                      />
                    </label>
                    <button
                      className="secondary-button"
                      onClick={() => void copy()}
                    >
                      <Copy size={16} />
                      {copied ? m.copied : m.copy}
                    </button>
                    <p>
                      {m.sameLanguage}{" "}
                      <strong>{room.locale.toUpperCase()}</strong>
                    </p>
                    {!account.user && (
                      <form
                        className="live-rename"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void action("rename");
                        }}
                      >
                        <label>
                          {m.name}
                          <input
                            value={name}
                            maxLength={24}
                            placeholder={me?.name}
                            onChange={(e) => setName(e.target.value)}
                          />
                        </label>
                        <button
                          className="secondary-button"
                          disabled={busy || !name.trim()}
                        >
                          OK
                        </button>
                      </form>
                    )}
                    {room.you === 0 &&
                      ["sudoku", "mines"].includes(room.game) && (
                        <label className="live-setting">
                          {m.level}
                          <select
                            value={room.difficulty}
                            disabled={busy}
                            onChange={(e) =>
                              void action("configure", {
                                difficulty: e.target.value,
                              })
                            }
                          >
                            {difficulties.map((d) => (
                              <option key={d} value={d}>
                                {t(locale)[d]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    {room.you === 0 &&
                      (room.game === "ranking" || room.game === "rather") && (
                        <label className="live-setting">
                          {m.category}
                          <select
                            value={room.category}
                            disabled={busy}
                            onChange={(e) =>
                              void action("configure", {
                                category: e.target.value,
                              })
                            }
                          >
                            {categoriesFor(room.game).map((c) => (
                              <option key={c} value={c}>
                                {categoryLabel(c, locale)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    {room.game === "guess" && (
                      <>
                        <p>{m.secretHelp}</p>
                        {room.ownSecret == null ? (
                          <SecretNumberForm
                            locale={locale}
                            value={secret}
                            onChange={setSecret}
                            disabled={busy}
                            onSubmit={(value) =>
                              void action("secret", { value })
                            }
                          />
                        ) : (
                          <p>
                            {st(locale).secret}: <b>{room.ownSecret}</b>
                          </p>
                        )}
                      </>
                    )}
                    <button
                      className="primary-button live-ready"
                      disabled={
                        busy || (room.game === "guess" && !me?.secretReady)
                      }
                      onClick={() =>
                        void action("ready", { ready: !me?.ready })
                      }
                    >
                      <Zap size={17} />
                      {me?.ready ? m.cancelReady : m.ready}
                    </button>
                    <p role="status">{peer ? m.waitingReady : m.waiting}</p>
                  </>
                )}
                {room.phase === "countdown" && (
                  <div className="live-countdown" role="status">
                    <p>{m.start}</p>
                    <strong>
                      {Math.max(
                        1,
                        Math.ceil((room.startAt! - serverNow) / 1000),
                      )}
                    </strong>
                  </div>
                )}
              </>
            )}
          </section>
        )}
        {started && joined && (
          <>
            {!done && (
              <div className="live-timebar">
                <span>
                  {m.remaining}{" "}
                  <strong>
                    {clockText(
                      Math.max(0, Math.ceil((room.endAt! - serverNow) / 1000)),
                    )}
                  </strong>
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    if (confirm(m.confirmResign)) void action("resign");
                  }}
                  disabled={busy}
                >
                  {m.resign}
                </button>
              </div>
            )}
            {room.game === "sudoku" && !done && (
              <p className="live-small">{m.previewProgress}</p>
            )}
            {room.challenge && room.game !== "guess" && (
              <div
                className="play-surface live-board"
                inert={done}
                key={`${room.round}:${account.user?.id ?? "guest"}`}
              >
                <GamePlayer challenge={room.challenge} locale={locale} />
              </div>
            )}
            {room.game === "guess" && (
              <section
                className="play-surface live-number"
                data-game-root
                data-challenge-id={room.challenge?.id}
                data-measurement-playing={String(!done && !me?.finished)}
              >
                <NumberArena
                  simultaneous
                  locale={locale}
                  yourNumber={room.ownSecret ?? null}
                  opponent={peer?.name ?? m.opponent}
                  ready
                  yourTurn={!me?.finished && !done}
                  opponentReady
                  completed={done}
                  opponentNumber={room.opponentSecret}
                />
                {!done && !me?.finished && (
                  <NumberControls
                    locale={locale}
                    disabled={busy}
                    onAction={(a) => {
                      if (a.kind !== "question")
                        void action("submit", {
                          runId: room.runId,
                          value: a.value,
                          sequence: room.guesses?.length ?? 0,
                        });
                    }}
                  />
                )}
                <ol className="live-guess-history">
                  {room.guesses?.map((g, i) => (
                    <li key={i}>
                      <b>{g.value}</b>
                      <span>
                        {g.direction === "found"
                          ? st(locale).foundNumber
                          : g.direction === "higher"
                            ? st(locale).higherNumber
                            : st(locale).lowerNumber}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {!done && me?.finished && (
              <p className="live-wait-finish" role="status">
                {m.waitFinish}
              </p>
            )}
            {done && (
              <div className="play-surface live-result-surface">
                <CompletionPanel
                  roomResult
                  resultSuccess={
                    !opinionGame(room.game) && room.winner === room.you
                  }
                  completion={displayCompletion}
                  answer={room.wordAnswer}
                  locale={locale}
                  title={title}
                  primaryAction={
                    <button
                      className="primary-button"
                      disabled={busy || me?.rematch}
                      onClick={() => void action("rematch")}
                    >
                      {me?.rematch ? m.rematchWait : m.rematch}
                    </button>
                  }
                  shareLines={liveShareLines(room, locale, title)}
                  comparisonContent={
                    <>
                      <h3>
                        {opinionGame(room.game) ? m.together : m.progress}
                      </h3>
                      {room.reason === "timeout" && <p>{m.timeout}</p>}
                      {room.reason === "forfeit" && <p>{m.forfeit}</p>}
                      <LiveComparison room={room} locale={locale} />
                    </>
                  }
                />
              </div>
            )}
          </>
        )}
        {!started && (
          <Link className="text-button" href={`/${locale}/live`}>
            {m.other}
          </Link>
        )}
        {done && (
          <Link className="back-link" href={gamePath(locale, room.game)}>
            {gameName(room.game, locale)}
          </Link>
        )}
      </div>
    </LiveContext.Provider>
  );
}
function liveShareLines(room: LiveView, locale: Locale, title: string) {
  const m = lt(locale),
    c = room.challenge;
  const lines = [`Puzzoria · ${gameName(room.game, locale)}`, title];
  if (c?.kind === "rather" && room.choices) {
    const [a, b] = room.choices;
    const both = c.questions.filter((_, i) => a.votes[i] && b.votes[i]);
    const same = c.questions.filter(
      (_, i) => a.votes[i] && a.votes[i] === b.votes[i],
    );
    lines.push(`${same.length}/${both.length} · ${m.agreement}`);
  }
  room.players.forEach((p, i) => {
    if (c?.kind === "ranking") {
      const ranking = room.choices?.[i].ranking ?? [];
      lines.push(
        `${p.name}: ${ranking.map((id, index) => `#${index + 1} ${(room.rankingItems ?? c.items).find((item) => item.id === id)?.label[locale] ?? "—"}`).join(" · ") || "—"}`,
      );
    } else if (c?.kind === "rather") {
      lines.push(
        `${p.name}: ${p.progress}/${p.total} · ${gameStatisticsCopy(locale).choices}`,
      );
    } else {
      const metric =
        room.game === "math"
          ? `${gameStatisticsCopy(locale).gap}: ${p.distance ?? "—"}`
          : room.game === "2048"
            ? `${m.score}: ${p.score}`
            : ["word", "guess"].includes(room.game)
              ? `${m.attempts}: ${p.progress}`
              : `${m.progress}: ${p.progress}/${p.total}`;
      lines.push(
        `${p.name} · ${metric} · ${m.time}: ${p.duration === null ? "—" : clockText(p.duration)}`,
      );
    }
  });
  return lines;
}
function LiveComparison({ room, locale }: { room: LiveView; locale: Locale }) {
  const m = lt(locale),
    c = room.challenge;
  if (c?.kind === "ranking" && room.choices)
    return (
      <div className="live-ranking">
        <div className="live-choice-head">
          {room.players.map((p, i) => (
            <strong key={i}>{p.name}</strong>
          ))}
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div className="live-choice-row" key={i}>
            {room.choices!.map((p, j) => {
              const item = (room.rankingItems ?? c.items).find(
                (item) => item.id === p.ranking[i],
              );
              return (
                <span key={j}>
                  <b>#{i + 1}</b>{" "}
                  {item ? `${item.emoji} ${item.label[locale]}` : "—"}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    );
  if (c?.kind === "rather" && room.choices) {
    const [a, b] = room.choices,
      answered = c.questions.filter((_, i) => a.votes[i] && b.votes[i]),
      agree = c.questions.filter(
        (_, i) => a.votes[i] && a.votes[i] === b.votes[i],
      ).length;
    return (
      <div className="live-dilemmas">
        <p className="live-agreement">
          <strong>
            {agree}/{answered.length}
          </strong>{" "}
          {m.agreement}
        </p>
        {c.questions.map((q, i) => (
          <article key={q.id}>
            <p>
              {q.a[locale]} / {q.b[locale]}
            </p>
            <div className="live-choice-row">
              {room.choices!.map((p, j) => {
                const choice = p.votes[i];
                return (
                  <span key={j}>
                    <small>{room.players[j].name}</small>
                    <b>{choice ? q[choice][locale] : "—"}</b>
                  </span>
                );
              })}
            </div>
            {a.votes[i] && b.votes[i] && (
              <small>{a.votes[i] === b.votes[i] ? m.same : m.different}</small>
            )}
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="live-result-table">
      {room.players.map((p, i) => (
        <article key={i}>
          <strong>{p.name}</strong>
          <span>
            {m.time}: {p.duration === null ? "—" : clockText(p.duration)}
          </span>
          {["word", "guess"].includes(room.game) ? (
            <span>
              {m.attempts}: {p.progress}
            </span>
          ) : room.game === "math" ? (
            <span>
              {gameStatisticsCopy(locale).gap}: {p.distance ?? "—"}
            </span>
          ) : room.game === "2048" ? (
            <span>
              {m.score}: {p.score}
            </span>
          ) : (
            <span>
              {m.progress}: {p.progress}/{p.total}
            </span>
          )}
        </article>
      ))}
    </div>
  );
}
