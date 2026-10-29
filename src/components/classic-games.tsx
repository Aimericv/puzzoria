"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import {
  initialPuzzle,
  type PublicNewChallenge,
  type PuzzleAction,
  type PuzzleState,
} from "@/lib/new-play";
import { nt } from "@/lib/new-games-i18n";
import { t } from "@/lib/i18n";
import { reservePlay, rememberCompletion, submitPlay, beginPlay } from "@/lib/play-client";
import { useLocalPreview } from "./local-preview-context";
import { resultCopy } from "@/lib/result-metrics";
import { searchPath } from "@/lib/wordsearch";
import { slide, type Direction } from "@/lib/tile2048";
import { useStoredState, useGameSession, clockText } from "./storage";
import { CompletionPanel, ErrorMessage, SaveNotice } from "./game-common";
type Draft = { result: PuzzleState | null };
function validDraft(v: unknown): v is Draft {
  if (!v || typeof v !== "object" || !("result" in v)) return false;
  const r = (v as Draft).result;
  return (
    r === null ||
    (Array.isArray(r.grid) &&
      r.grid.every(Number.isInteger) &&
      Array.isArray(r.actions) &&
      r.actions.length <= 10000 &&
      Array.isArray(r.flags) &&
      Array.isArray(r.found) &&
      Array.isArray(r.paths) &&
      typeof r.completed === "boolean" &&
      Number.isFinite(r.score))
  );
}
export function ClassicGame({
  challenge: c,
  locale,
}: {
  challenge: PublicNewChallenge;
  locale: Locale;
}) {
  const m = nt(locale),
    base = t(locale),
    session = useGameSession(c, locale);
  const draft = useStoredState<Draft>(
    `dailygrid:game:${c.id}`,
    { result: null },
    validDraft,
  );
  const { setValue: setDraft, ready: draftReady } = draft;
  const preview = useLocalPreview();
  const completion = preview?.completion ?? session.session.completion;
  const state = preview?.puzzleState ?? draft.value.result ?? initialPuzzle(c),
    [loaded, setLoaded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [flagMode, setFlagMode] = useState(false),
    [anchor, setAnchor] = useState<number | null>(null),
    [hover, setHover] = useState<number | null>(null),
    [focus, setFocus] = useState(c.kind === "mines" ? c.start : 0);
  const locked = useRef(false),
    pointer = useRef<{ x: number; y: number; index: number | null } | null>(
      null,
    ),
    boardRef = useRef<HTMLDivElement>(null),
    current = useRef(state),
    sessionRef = useRef(session);
  useEffect(() => {
    current.current = state;
    sessionRef.current = session;
  });
  useEffect(() => {
    let live = true;
    void reservePlay(c)
      .then((data) => {
        if (!live) return;
        const result = data.result?.state ?? data.progress;
        setDraft({
          result: result ? (result as PuzzleState) : initialPuzzle(c),
        });
        if (data.result?.completion) {
          rememberCompletion(data.result.completion);
          sessionRef.current.finish(
            data.result.completion.success,
            data.result.completion.score,
          );
        } else if (data.startedAt)
          sessionRef.current.setValue((s) => ({
            ...s,
            started: true,
            elapsed: Math.max(
              s.elapsed,
              Math.floor((Date.now() - Date.parse(data.startedAt!)) / 1000),
            ),
          }));
        setLoaded(true);
      })
      .catch(() => {
        if (live) {
          setError("networkError");
          setLoaded(true);
        }
      });
    return () => {
      live = false;
    };
  }, [c, setDraft]);
  const act = useCallback(
    async (step?: PuzzleAction, bank = false) => {
      if (
        locked.current ||
        preview ||
        (c.kind === "wordsearch" && !sessionRef.current.session.started) ||
        !loaded ||
        !draftReady ||
        !sessionRef.current.ready ||
        current.current.completed ||
        sessionRef.current.session.completion
      )
        return;
      if (
        step?.kind === "move" &&
        !slide(current.current.grid, step.direction).changed
      )
        return;
      locked.current = true;
      setBusy(true);
      setError("");
      sessionRef.current.start();
      try {
        const data = await submitPlay(c, {
          step,
          sequence: current.current.moves,
          bank,
        });
        const result = data.state as PuzzleState;
        setDraft({ result });
        current.current = result;
        if (data.completion)
          sessionRef.current.finish(result.success, result.score);
      } catch (e) {
        setError(e instanceof Error ? e.message : "networkError");
        // A lost response can have saved the move. Restore it before allowing another move.
        try {
          const data = await reservePlay(c),
            result = data.result?.state ?? data.progress;
          if (result) {
            setDraft({ result: result as PuzzleState });
            current.current = result as PuzzleState;
          }
          if (data.result?.completion) {
            rememberCompletion(data.result.completion);
            sessionRef.current.finish(
              data.result.completion.success,
              data.result.completion.score,
            );
          }
        } catch {
          /* Keep the draft; a later action retries against its sequence. */
        }
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [c, draftReady, setDraft, loaded, preview],
  );
  const selectBetween = (from: number, to: number) => {
    if (c.kind !== "wordsearch" || locked.current || current.current.completed)
      return;
    const path = searchPath(from, to, c.size),
      word = path.map((i) => c.grid[i]).join(""),
      target = c.words.find(
        (w) => w === word || w === [...word].reverse().join(""),
      );
    if (target && !current.current.found.includes(target)) {
      void act({ kind: "select", from, to });
      setError("");
    } else if (!current.current.found.includes(target ?? ""))
      setError("notWord");
    setAnchor(null);
    setHover(null);
  };
  const pick = (index: number) => {
    if (c.kind !== "wordsearch" || busy || state.completed) return;
    if (anchor === null) {
      setAnchor(index);
      setHover(index);
      return;
    }
    selectBetween(anchor, index);
  };
  const selected =
    c.kind === "wordsearch" && anchor !== null && hover !== null
      ? searchPath(anchor, hover, c.size)
      : [];
  const cellAt = (x: number, y: number) => {
    const el = document
      .elementFromPoint(x, y)
      ?.closest<HTMLElement>("[data-puzzle-cell]");
    return el && boardRef.current?.contains(el)
      ? Number(el.dataset.puzzleCell)
      : null;
  };
  const move = (direction: Direction) => void act({ kind: "move", direction });
  const size = c.kind === "2048" ? 4 : c.size;
  const disabled =
    !loaded ||
    busy ||
    !draftReady ||
    state.completed ||
    !!completion || (c.kind === "wordsearch" && !session.session.started);
  const waiting = c.kind === "wordsearch" && !completion && !session.session.started;
  async function startSearch() {
    if (!loaded || busy || !session.ready || preview) return;
    setBusy(true); setError("");
    try {await beginPlay(c); session.start();}
    catch {setError("networkError");}
    finally {setBusy(false);}
  }
  return (
    <div
      className={`classic-game ${c.kind === "2048" ? "tiles-game" : c.kind}`}
      aria-busy={busy}
    >
      <div className="classic-status">
        <span>
          {base.timer}{" "}
          <strong>
            {clockText(
              completion?.duration ?? session.session.elapsed,
            )}
          </strong>
        </span>
        {c.kind === "2048" ? (
          <>
            <span>
              {base.score} <strong>{state.score}</strong>
            </span>
            <span>
              {m.moves}{" "}
              <strong>
                {state.moves}
                {c.moveLimit ? ` / ${c.moveLimit}` : ""}
              </strong>
            </span>
          </>
        ) : c.kind === "mines" ? (
          <span>
            {m.flags}{" "}
            <strong>
              {state.flags.length} / {c.mineCount}
            </strong>
          </span>
        ) : (
          <span>
            {m.found}{" "}
            <strong>
              {state.found.length} / {c.words.length}
            </strong>
          </span>
        )}
      </div>
      <p className="classic-caption">
        {c.kind === "2048"
          ? c.moveLimit
            ? m.dailyTile
            : m.classicTile
          : c.kind === "mines"
            ? m.noGuess
            : `${m.theme} · ${c.theme}`}
      </p>
      {waiting && <div className="wordsearch-start"><p>{resultCopy(locale).ready}</p><button className="primary-button" disabled={!loaded || busy || !session.ready} onClick={() => void startSearch()}>{resultCopy(locale).start}</button></div>}
      {c.kind === "mines" && (
        <div className="mine-controls">
          <button
            className={`secondary-button ${!flagMode ? "selected" : ""}`}
            aria-pressed={!flagMode}
            onClick={() => setFlagMode(false)}
          >
            {m.reveal}
          </button>
          <button
            className={`secondary-button ${flagMode ? "selected" : ""}`}
            aria-pressed={flagMode}
            onClick={() => setFlagMode(true)}
          >
            ⚑ {m.flag}
          </button>
        </div>
      )}
      <div className="classic-board-frame">
        <div
          ref={boardRef}
          className={`classic-board board-${c.kind === "2048" ? "tiles" : c.kind}`}
          data-locked={waiting ? "true" : undefined}
          aria-disabled={disabled}
          style={{ "--board-size": size } as React.CSSProperties}
          role="group"
          aria-label={
            c.kind === "2048"
              ? m.tileName
              : c.kind === "mines"
                ? m.minesName
                : m.searchName
          }
          tabIndex={c.kind === "2048" ? 0 : -1}
          onKeyDown={(e) => {
            const directions: Record<string, Direction> = {
              ArrowLeft: "left",
              ArrowRight: "right",
              ArrowUp: "up",
              ArrowDown: "down",
            };
            if (directions[e.key]) {
              e.preventDefault();
              if (disabled) return;
              if (c.kind === "2048") move(directions[e.key]);
              else {
                const delta = { left: -1, right: 1, up: -size, down: size }[
                    directions[e.key]
                  ],
                  next = Math.max(0, Math.min(size * size - 1, focus + delta));
                setFocus(next);
                boardRef.current
                  ?.querySelector<HTMLButtonElement>(
                    `[data-puzzle-cell="${next}"]`,
                  )
                  ?.focus();
                if (anchor !== null) setHover(next);
              }
            } else if (
              !disabled &&
              c.kind !== "2048" &&
              (e.key === "Enter" ||
                e.key === " " ||
                e.key.toLowerCase() === "f")
            ) {
              e.preventDefault();
              if (c.kind === "wordsearch" && e.key.toLowerCase() !== "f")
                pick(focus);
              else if (
                c.kind === "mines" &&
                state.grid[focus] === -1 &&
                (state.moves || focus === c.start)
              )
                void act({
                  kind:
                    state.moves && (e.key.toLowerCase() === "f" || flagMode)
                      ? "flag"
                      : "reveal",
                  index: focus,
                });
            } else if (e.key === "Escape") {
              setAnchor(null);
              setHover(null);
            }
          }}
          onPointerDown={(e) => {
            if (
              disabled ||
              (c.kind !== "2048" && c.kind !== "wordsearch") ||
              e.button !== 0
            )
              return;
            pointer.current = {
              x: e.clientX,
              y: e.clientY,
              index: cellAt(e.clientX, e.clientY),
            };
            e.currentTarget.setPointerCapture(e.pointerId);
            if (
              c.kind === "wordsearch" &&
              pointer.current.index !== null &&
              anchor === null
            )
              setHover(pointer.current.index);
          }}
          onPointerMove={(e) => {
            if (c.kind !== "wordsearch" || !pointer.current) return;
            const index = cellAt(e.clientX, e.clientY);
            if (index !== null) {
              if (
                Math.hypot(
                  e.clientX - pointer.current.x,
                  e.clientY - pointer.current.y,
                ) > 8 &&
                anchor === null
              )
                setAnchor(pointer.current.index);
              setHover(index);
            }
          }}
          onPointerUp={(e) => {
            const start = pointer.current;
            pointer.current = null;
            if (!start || disabled) return;
            const dx = e.clientX - start.x,
              dy = e.clientY - start.y;
            if (c.kind === "2048" && Math.hypot(dx, dy) > 25)
              move(
                Math.abs(dx) > Math.abs(dy)
                  ? dx > 0
                    ? "right"
                    : "left"
                  : dy > 0
                    ? "down"
                    : "up",
              );
            if (c.kind === "wordsearch") {
              const end = cellAt(e.clientX, e.clientY);
              // The gesture's origin lives in a ref: fast pointer events may finish before React renders its highlight.
              if (
                end !== null &&
                start.index !== null &&
                Math.hypot(dx, dy) > 8
              )
                selectBetween(start.index, end);
              else if (end !== null) pick(end);
            }
          }}
          onPointerCancel={() => {
            pointer.current = null;
            setAnchor(null);
            setHover(null);
          }}
        >
          {Array.from({ length: size * size }, (_, i) => {
            if (c.kind === "2048")
              return (
                <div
                  className={`tile-cell tile-${state.grid[i] || 0}`}
                  data-tile-value={state.grid[i]}
                  key={i}
                >
                  {state.grid[i] || ""}
                </div>
              );
            const revealed = c.kind === "mines" && state.grid[i] >= 0,
              flagged = state.flags.includes(i),
              bomb =
                c.kind === "mines" &&
                state.completed &&
                state.mines?.includes(i),
              found =
                c.kind === "wordsearch" &&
                state.paths.some((p) => p.includes(i));
            return (
              <button
                type="button"
                data-puzzle-cell={i}
                key={i}
                tabIndex={i === focus ? 0 : -1}
                disabled={disabled}
                onFocus={() => setFocus(i)}
                className={`puzzle-cell ${revealed ? "revealed" : ""} ${flagged ? "flagged" : ""} ${bomb ? "bomb" : ""} ${found ? "found" : ""} ${selected.includes(i) ? "selecting" : ""} ${c.kind === "mines" && !state.moves && i === c.start ? "safe-start" : ""}`}
                data-number={state.grid[i]}
                aria-label={`${m.cell} ${Math.floor(i / size) + 1}, ${(i % size) + 1}: ${c.kind === "wordsearch" ? waiting ? m.hidden : c.grid[i] : bomb ? m.mine : flagged ? m.flag : revealed ? state.grid[i] : !state.moves && i === c.start ? m.safeStart : m.hidden}`}
                onClick={() => {
                  if (
                    c.kind === "mines" &&
                    state.grid[i] === -1 &&
                    (state.moves || i === c.start) &&
                    (flagMode || !flagged)
                  )
                    void act({
                      kind: state.moves && flagMode ? "flag" : "reveal",
                      index: i,
                    });
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (
                    c.kind === "mines" &&
                    !disabled &&
                    state.moves &&
                    state.grid[i] === -1
                  )
                    void act({ kind: "flag", index: i });
                }}
              >
                {c.kind === "wordsearch"
                  ? waiting ? "" : c.grid[i]
                  : bomb
                    ? "✹"
                    : flagged
                      ? "⚑"
                      : revealed
                        ? state.grid[i] || ""
                        : !state.moves && i === c.start
                          ? "◎"
                          : ""}
              </button>
            );
          })}
        </div>
      </div>
      {c.kind === "2048" && (
        <>
          <div className="direction-controls">
            {(
              [
                ["up", "↑"],
                ["left", "←"],
                ["down", "↓"],
                ["right", "→"],
              ] as const
            ).map(([d, arrow]) => (
              <button
                key={d}
                className="secondary-button"
                disabled={disabled}
                aria-label={arrow}
                onClick={() => move(d)}
              >
                {arrow}
              </button>
            ))}
          </div>
          <p>
            {m.largest}: <strong>{Math.max(...state.grid)}</strong>
          </p>
          {Math.max(...state.grid) >= 2048 && <p role="status">{m.reached}</p>}
          {c.moveLimit === null && !state.completed && (
            <button
              className="secondary-button bank-score"
              disabled={disabled || !state.moves}
              onClick={() => void act(undefined, true)}
            >
              {m.bank}
            </button>
          )}
        </>
      )}
      {c.kind === "wordsearch" && (
        <>
          <ul className="search-word-list">
            {c.words.map((word) => (
              <li
                key={word}
                className={state.found.includes(word) ? "found" : ""}
              >
                {state.found.includes(word) && (
                  <span aria-hidden="true">✓ </span>
                )}
                {word}
              </li>
            ))}
          </ul>
          {anchor !== null && (
            <button
              className="secondary-button"
              onClick={() => {
                setAnchor(null);
                setHover(null);
              }}
            >
              {m.clear}
            </button>
          )}
        </>
      )}
      <p className="classic-help">
        {c.kind === "2048"
          ? m.arrows
          : c.kind === "wordsearch"
            ? m.select
            : m.keyboard}
      </p>
      <SaveNotice locale={locale} saved={draft.saved && session.saved} />
      {error === "notWord" ? (
        <p className="game-error" role="alert">
          {m.notWord}
        </p>
      ) : (
        <ErrorMessage error={error} locale={locale} />
      )}
      {completion && (
        <CompletionPanel
          completion={completion}
          locale={locale}
          resultDetails={c.kind==="2048" ? {largestTile:Math.max(...state.grid),moves:state.moves} : c.kind==="wordsearch" ? {wordsFound:state.found.length,wordsTotal:c.words.length} : undefined}
        />
      )}
    </div>
  );
}
