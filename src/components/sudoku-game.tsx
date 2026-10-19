"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Eraser, Undo2, Pause, Play } from "lucide-react";
import type { Locale, PublicChallenge } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { Hint } from "./hint-control";
import { useLocalPreview } from "./local-preview-context";
import { candidates } from "@/lib/sudoku";
import { postJson } from "@/lib/play-client";
import { clockText, useGameSession, useStoredState } from "./storage";
import {
  CompletionPanel,
  ErrorMessage,
  SaveNotice,
  validatePlay,
} from "./game-common";
type SudokuPublic = Extract<PublicChallenge, { kind: "sudoku" }>;
type Snapshot = { grid: number[]; notes: number[][] };
type SudokuState = Snapshot & {
  selected: number;
  noteMode: boolean;
  errors: boolean;
  history: Snapshot[];
};
const validSnapshot = (v: unknown): v is Snapshot => {
  const x = v as Snapshot;
  return (
    !!x &&
    Array.isArray(x.grid) &&
    x.grid.length === 81 &&
    x.grid.every((n) => Number.isInteger(n) && n >= 0 && n <= 9) &&
    Array.isArray(x.notes) &&
    x.notes.length === 81 &&
    x.notes.every(
      (row) =>
        Array.isArray(row) &&
        row.every((n) => Number.isInteger(n) && n >= 1 && n <= 9),
    )
  );
};
function validState(v: unknown): v is SudokuState {
  const x = v as SudokuState;
  return (
    validSnapshot(x) &&
    Number.isInteger(x.selected) &&
    x.selected >= 0 &&
    x.selected < 81 &&
    typeof x.noteMode === "boolean" &&
    typeof x.errors === "boolean" &&
    Array.isArray(x.history) &&
    x.history.length <= 100 &&
    x.history.every(validSnapshot)
  );
}
export function SudokuGame({
  challenge,
  locale,
}: {
  challenge: SudokuPublic;
  locale: Locale;
}) {
  const m = t(locale);
  const store = useStoredState<SudokuState>(
    `dailygrid:game:${challenge.id}`,
    {
      grid: challenge.grid,
      notes: Array.from({ length: 81 }, () => []),
      selected: Math.max(
        0,
        challenge.grid.findIndex((n) => !n),
      ),
      noteMode: false,
      errors: false,
      history: [],
    },
    (v: unknown): v is SudokuState =>
      validState(v) && challenge.grid.every((n, i) => !n || v.grid[i] === n),
  );
  const { value: storedState, setValue, ready } = store;
  const preview = useLocalPreview();
  const state = preview?.grid ? {...storedState, grid:preview.grid, notes:storedState.notes.map(() => [])} : storedState;
  const session = useGameSession(challenge, locale);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const completion = preview?.completion ?? session.session.completion;
  const done = !!completion;
  const boardRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!challenge.roomId || !ready || done) return;
    const timer = setTimeout(() => { void postJson("/api/live-rooms", {action:"draft",code:challenge.roomId,grid:state.grid}).catch(() => {}); }, 250);
    return () => clearTimeout(timer);
  }, [challenge.roomId, ready, done, state.grid]);
  useEffect(() => {
    if (boardRef.current?.contains(document.activeElement))
      boardRef.current.querySelector<HTMLButtonElement>(".sudoku-cell.selected")?.focus({preventScroll: true});
  }, [state.selected]);
  useEffect(() => {
    const hint = (e: Event) => {
      const data = (e as CustomEvent<{ challengeId: string; hint: Hint }>)
        .detail;
      if (
        data.challengeId !== challenge.id ||
        data.hint.kind !== "sudoku" ||
        done
      )
        return;
      session.start();
      const { index, value } = data.hint;
      setValue((s) => ({
        ...s,
        grid: s.grid.map((n, i) => (i === index ? value : n)),
        notes: s.notes.map((row, i) => (i === index ? [] : row)),
        selected: index,
      }));
    };
    window.addEventListener("dailygrid:hint", hint);
    return () => window.removeEventListener("dailygrid:hint", hint);
  }, [challenge.id, done, session, setValue]);
  const place = useCallback(
    (number: number) => {
      if (
        !ready ||
        done ||
        busy ||
        session.session.paused ||
        challenge.grid[state.selected]
      )
        return;
      session.start();
      setError("");
      setValue((s) => {
        const grid = [...s.grid],
          notes = s.notes.map((row) => [...row]);
        if (s.noteMode && number) {
          if (grid[s.selected]) return s;
          notes[s.selected] = notes[s.selected].includes(number)
            ? notes[s.selected].filter((n) => n !== number)
            : [...notes[s.selected], number].sort();
        } else {
          grid[s.selected] = number;
          notes[s.selected] = [];
        }
        return {
          ...s,
          grid,
          notes,
          history: [...s.history, { grid: s.grid, notes: s.notes }].slice(-100),
        };
      });
    },
    [ready, done, busy, session, challenge.grid, state.selected, setValue],
  );
  const undo = useCallback(() => {
    if (done || session.session.paused) return;
    setValue((s) => {
      const previous = s.history.at(-1);
      return previous
        ? { ...s, ...previous, history: s.history.slice(0, -1) }
        : s;
    });
    setError("");
  }, [done, session.session.paused, setValue]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        ["SELECT", "INPUT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        ) ||
        done ||
        !ready ||
        session.session.paused
      )
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          undo();
        }
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        place(Number(e.key));
      } else if (["Backspace", "Delete", "0"].includes(e.key)) {
        e.preventDefault();
        place(0);
      } else if (e.key.toLowerCase() === "n") {
        setValue((s) => ({ ...s, noteMode: !s.noteMode }));
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        const delta = (
          { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -9, ArrowDown: 9 } as Record<
            string,
            number
          >
        )[e.key];
        if (delta)
          setValue((s) => ({
            ...s,
            selected: Math.max(0, Math.min(80, s.selected + delta)),
          }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [done, ready, session.session.paused, undo, place, setValue]);
  async function check() {
    setBusy(true);
    setError("");
    session.start();
    try {
      await validatePlay(challenge, { grid: state.grid });
      session.finish(true, 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const selectedRow = Math.floor(state.selected / 9),
    selectedCol = state.selected % 9;
  return (
    <>
      <div className="sudoku-toolbar">
        <span className="timer">
          <span className="timer-dot" />
          {m.timer} <strong>{clockText(session.session.elapsed)}</strong>
        </span>
        {!challenge.roomId && <button
          className="icon-button"
          onClick={session.togglePause}
          disabled={!ready || done}
          aria-label={session.session.paused ? m.resume : m.pause}
        >
          {session.session.paused ? <Play size={16} /> : <Pause size={16} />}
        </button>}
        {(challenge.mode === "practice" || challenge.mode === "archive") && <span className={`difficulty-badge ${challenge.difficulty}`}>
          {m[challenge.difficulty]}
        </span>}
      </div>
      <div className="sudoku-wrap">
        <div
          className={`sudoku-board ${session.session.paused ? "is-paused" : ""}`}
          role="group"
          ref={boardRef}
          aria-label={m.sudokuName}
        >
          {state.grid.map((n, i) => {
            const row = Math.floor(i / 9),
              col = i % 9;
            let conflict = false;
            if (n && state.errors) {
              const copy = [...state.grid];
              copy[i] = 0;
              conflict = !candidates(copy, i).includes(n);
            }
            const peer =
              row === selectedRow ||
              col === selectedCol ||
              (Math.floor(row / 3) === Math.floor(selectedRow / 3) &&
                Math.floor(col / 3) === Math.floor(selectedCol / 3));
            return (
              <button
                key={i}
                disabled={!ready || done || session.session.paused}
                className={`sudoku-cell ${challenge.grid[i] ? "given" : "entered"} ${peer ? "peer" : ""} ${state.selected === i ? "selected" : ""} ${n && n === state.grid[state.selected] ? "matching" : ""} ${conflict ? "conflict" : ""} ${col === 2 || col === 5 ? "box-right" : ""} ${row === 2 || row === 5 ? "box-bottom" : ""}`}
                aria-label={`${row + 1}, ${col + 1}: ${n || "—"}`}
                aria-pressed={state.selected === i}
                tabIndex={state.selected === i ? 0 : -1}
                onClick={() => setValue((s) => ({ ...s, selected: i }))}
              >
                {n || (
                  <span className="cell-notes">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((note) => (
                      <span key={note}>
                        {state.notes[i].includes(note) ? note : ""}
                      </span>
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {session.session.paused && (
          <button className="paused-overlay" onClick={session.togglePause}>
            <Play size={24} />
            {m.resume}
          </button>
        )}
      </div>
      <ErrorMessage error={error} locale={locale} />
      {!done && (
        <>
          <div className="sudoku-options">
            <button
              className={`tool-button ${state.noteMode ? "selected" : ""}`}
              aria-pressed={state.noteMode}
              onClick={() => setValue((s) => ({ ...s, noteMode: !s.noteMode }))}
            >
              <Pencil size={17} />
              {m.notes}
            </button>
            <button
              className="tool-button"
              onClick={() => place(0)}
              disabled={!ready || session.session.paused}
            >
              <Eraser size={17} />
              {m.erase}
            </button>
            <button
              className="tool-button"
              onClick={undo}
              disabled={!state.history.length || session.session.paused}
            >
              <Undo2 size={17} />
              {m.undo}
            </button>
          </div>
          <div className="number-pad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => place(n)}
                disabled={!ready || session.session.paused || busy}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="sudoku-check">
            <label>
              <input
                type="checkbox"
                checked={state.errors}
                onChange={(e) =>
                  setValue((s) => ({ ...s, errors: e.target.checked }))
                }
              />
              {m.checkErrors}
            </label>
            <button
              className="primary-button"
              onClick={check}
              disabled={!ready || busy || session.session.paused}
            >
              {m.check}
            </button>
          </div>
        </>
      )}
      <SaveNotice locale={locale} saved={store.saved && session.saved} />
      {completion && (
        <CompletionPanel
          completion={completion}
          locale={locale}
        />
      )}
    </>
  );
}
