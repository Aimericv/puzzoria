"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Delete } from "lucide-react";
import type { LetterState, Locale, PublicChallenge, RareWordDiscovery } from "@/lib/types";
import { normalizeWord } from "@/lib/word-normalization";
import { t } from "@/lib/i18n";
import type { Hint } from "./hint-control";
import { RareWordReveal } from "./rare-word-reveal";
import type { CSSProperties } from "react";
import { useLocalPreview } from "./local-preview-context";
import { wordFeedback } from "@/lib/word";
import { WordModeLabel } from "./word-mode-label";
import { useGameSession, useStoredState } from "./storage";
import {
  CompletionPanel,
  ErrorMessage,
  SaveNotice,
  validatePlay,
} from "./game-common";
type WordPublic = Extract<PublicChallenge, { kind: "word" | "rareword" }>;
type WordState = {
  input: string;
  guesses: string[];
  rows: LetterState[][];
  complete: boolean;
  success: boolean;
  answer: string;
  discovery?: RareWordDiscovery;
};
function validState(v: unknown, challenge: WordPublic): v is WordState {
  if (!v || typeof v !== "object") return false;
  const x = v as WordState;
  return (
    typeof x.input === "string" &&
    x.input.length <= challenge.length &&
    Array.isArray(x.guesses) &&
    x.guesses.length <= challenge.attempts &&
    x.guesses.every((g) => typeof g === "string" && g.length === challenge.length) &&
    Array.isArray(x.rows) &&
    x.rows.length === x.guesses.length &&
    x.rows.every(
      (row) =>
        Array.isArray(row) &&
        row.length === challenge.length &&
        row.every((s) => ["correct", "present", "absent"].includes(s)),
    ) &&
    typeof x.complete === "boolean" &&
    typeof x.success === "boolean" &&
    typeof x.answer === "string"
  );
}
export function WordGame({
  challenge,
  locale,
}: {
  challenge: WordPublic;
  locale: Locale;
}) {
  const m = t(locale);
  const store = useStoredState<WordState>(
    `dailygrid:game:${challenge.id}`,
    {
      input: "",
      guesses: [],
      rows: [],
      complete: false,
      success: false,
      answer: "",
    },
    (value): value is WordState => validState(value, challenge),
  );
  const { value: storedState, setValue, ready } = store;
  const preview = useLocalPreview();
  const state = preview ? {...storedState, input:"", guesses:preview.wordGuesses ?? [], rows:(preview.wordGuesses ?? []).map(g => wordFeedback(g,preview.answer!)), complete:true, success:true, answer:preview.answer!, discovery:preview.discovery} : storedState;
  const session = useGameSession(challenge, locale);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  // Native key events can arrive before React renders the preceding letter.
  const editing = useRef({ input: state.input, selected });
  useLayoutEffect(() => {
    editing.current = { input: state.input, selected };
  }, [state.input, selected]);
  const board = useRef<HTMLDivElement>(null);
  const completion = preview?.completion ?? session.session.completion;
  const finished = state.complete || !!completion;
  useEffect(() => {
    const hint = (e: Event) => {
      const data = (e as CustomEvent<{ challengeId: string; hint: Hint }>)
        .detail;
      if (
        data.challengeId !== challenge.id ||
        data.hint.kind !== "word" ||
        finished
      )
        return;
      session.start();
      const letter = data.hint.letter;
      setValue((s) => ({ ...s, input: letter + s.input.slice(1) }));
      setSelected(1);
    };
    window.addEventListener("dailygrid:hint", hint);
    return () => window.removeEventListener("dailygrid:hint", hint);
  }, [challenge.id, finished, session, setValue]);
  useEffect(() => {
    if (!preview && ready && session.ready && state.complete && !session.session.completion)
      session.finish(
        state.success,
        state.success ? (challenge.attempts + 1 - state.guesses.length) * 100 : 0,
        state.guesses.length,
      );
  }, [preview, ready, session, state.complete, state.success, state.guesses.length, challenge.attempts]);
  const submit = useCallback(async () => {
    if (!ready || !session.ready || busy || finished) return;
    const input = editing.current.input;
    if (input.length !== challenge.length) {
      setError("wordLengthError");
      return;
    }
    session.start();
    setBusy(true);
    setError("");
    const guesses = [...state.guesses, input];
    try {
      const result = await validatePlay(challenge, { guesses });
      setValue({
        input: "",
        guesses: (result.guesses as string[] | undefined) ?? guesses,
        rows: result.rows as LetterState[][],
        complete: result.completed as boolean,
        success: result.success as boolean,
        answer: (result.answer as string) ?? "",
        discovery: result.discovery as RareWordDiscovery | undefined,
      });
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [ready, session, busy, finished, state.guesses, challenge, setValue]);
  const key = useCallback(
    (letter: string) => {
      if (!ready || busy || finished || session.session.paused) return;
      if (letter === "Enter") {
        void submit();
        return;
      }
      const input = editing.current.input;
      const at = editing.current.selected ?? input.length;
      if (
        letter === "ArrowLeft" ||
        letter === "ArrowRight" ||
        letter === "Home" ||
        letter === "End"
      ) {
        const next =
          letter === "Home"
            ? 0
            : letter === "End"
              ? input.length
              : at + (letter === "ArrowLeft" ? -1 : 1);
        const cursor = Math.max(
          0,
          Math.min(next, input.length, challenge.length - 1),
        );
        editing.current.selected = cursor;
        setSelected(cursor);
        return;
      }
      if (letter === "Backspace" || letter === "Delete") {
        const remove = letter === "Backspace" ? at - 1 : at;
        if (remove < 0 || remove >= input.length) return;
        session.start();
        setError("");
        const nextInput = input.slice(0, remove) + input.slice(remove + 1);
        const cursor = remove < input.length - 1 ? remove : null;
        editing.current = { input: nextInput, selected: cursor };
        setValue((s) => ({ ...s, input: nextInput }));
        setSelected(cursor);
      } else if (/^[\p{L}]$/u.test(letter)) {
        const normalized = normalizeWord(letter);
        if (normalized.length === 1 && at < challenge.length) {
          session.start();
          setError("");
          const nextInput =
            input.slice(0, at) + normalized + input.slice(at + 1);
          const cursor = at + 1 < challenge.length ? at + 1 : null;
          editing.current = { input: nextInput, selected: cursor };
          setValue((s) => ({ ...s, input: nextInput }));
          setSelected(cursor);
        }
      }
    },
    [ready, busy, finished, session, submit, setValue, challenge.length],
  );
  useLayoutEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('dialog, [role="dialog"], [role="alertdialog"]') ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        target.isContentEditable ||
        target.closest("a") ||
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
      )
        return;
      if (
        [
          "Enter",
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Home",
          "End",
        ].includes(e.key) ||
        /^[\p{L}]$/u.test(e.key)
      ) {
        if (target.tagName === "BUTTON" && e.key === "Enter") return;
        e.preventDefault();
        key(e.key);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key]);
  const rows =
    locale === "fr"
      ? ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN"]
      : locale === "de"
        ? ["QWERTZUIOP", "ASDFGHJKL", "YXCVBNMẞ"]
        : locale === "es"
          ? ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
          : ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
  const keyStates: Record<string, LetterState> = {};
  const rank = { absent: 1, present: 2, correct: 3 };
  state.guesses.forEach((guess, i) =>
    [...normalizeWord(guess)].forEach((letter, j) => {
      const status = state.rows[i]?.[j];
      if (
        status &&
        rank[status] > (keyStates[letter] ? rank[keyStates[letter]] : 0)
      )
        keyStates[letter] = status;
    }),
  );
  return (
    <>
      <WordModeLabel challenge={challenge} locale={locale} />
      <div
        className={`word-board ${challenge.kind === "rareword" ? "rare-word-board" : ""}`}
        style={{"--word-length": challenge.length} as CSSProperties}
        ref={board}
        role="group"
        aria-label={challenge.kind === "rareword" ? m.inputLabel.replace("{n}", String(challenge.length)) : m.wordInput}
        aria-busy={!ready || !session.ready}
        tabIndex={finished ? -1 : 0}
        aria-keyshortcuts="Enter Backspace Delete ArrowLeft ArrowRight Home End"
        onPaste={(e) => {
          if (!ready || busy || finished) return;
          e.preventDefault();
          session.start();
          setError("");
          const input = normalizeWord(e.clipboardData.getData("text"))
            .replace(/[^\p{L}]/gu, "")
            .slice(0, challenge.length);
          editing.current = { input, selected: null };
          setValue((s) => ({ ...s, input }));
          setSelected(null);
        }}
      >
        {Array.from({ length: challenge.attempts }, (_, i) => (
          <div className="word-row" key={i}>
            {Array.from({ length: challenge.length }, (_, j) => {
              const letter =
                (state.guesses[i]
                  ? normalizeWord(state.guesses[i])[j]
                  : undefined) ??
                (i === state.guesses.length ? state.input[j] : "");
              const status = state.rows[i]?.[j];
              const editable = !finished && i === state.guesses.length;
              const active = editable && j === (selected ?? state.input.length);
              return (
                <div
                  className={`letter-tile ${status ?? ""} ${letter ? "filled" : ""} ${editable ? "editable" : ""} ${active ? "active-cell" : ""}`}
                  key={j}
                  role="group"
                  onClick={
                    editable
                      ? () => {
                          setSelected(Math.min(j, state.input.length));
                          board.current?.focus({ preventScroll: true });
                        }
                      : undefined
                  }
                  aria-label={`${i + 1}, ${j + 1}: ${letter ?? ""}${status ? ` (${{ correct: locale === "fr" ? "bien placé" : locale === "es" ? "correcto" : locale === "de" ? "richtig" : "correct", present: locale === "fr" ? "présent" : locale === "es" ? "presente" : locale === "de" ? "vorhanden" : "present", absent: locale === "fr" ? "absent" : locale === "es" ? "ausente" : locale === "de" ? "fehlt" : "absent" }[status]})` : ""}`}
                >
                  {letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <ErrorMessage error={error === "wordLengthError" ? "" : error} locale={locale} />
      {error === "wordLengthError" && <p className="game-error" role="alert">{m.wordLengthError.replace("{n}", String(challenge.length))}</p>}
      {!finished && (
        <>
          <div className="touch-keyboard" role="group" aria-label={m.keyboard}>
            {rows.map((row, i) => (
              <div className="keyboard-row" key={row}>
                {i === 2 && (
                  <button
                    className="key wide-key"
                    disabled={busy || !ready}
                    onClick={() => {
                      key("Enter");
                      board.current?.focus({ preventScroll: true });
                    }}
                  >
                    {m.enter}
                  </button>
                )}
                {[...row].map((letter) => (
                  <button
                    key={letter}
                    className={`key ${keyStates[normalizeWord(letter)] ?? ""}`}
                    disabled={busy || !ready}
                    onClick={() => {
                      key(letter);
                      board.current?.focus({ preventScroll: true });
                    }}
                  >
                    {letter}
                  </button>
                ))}
                {i === 2 && (
                  <button
                    className="key wide-key"
                    aria-label={m.backspace}
                    disabled={busy || !ready}
                    onClick={() => {
                      key("Backspace");
                      board.current?.focus({ preventScroll: true });
                    }}
                  >
                    <Delete size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      <SaveNotice locale={locale} saved={store.saved && session.saved} />
      {completion && (
        <CompletionPanel
          completion={completion}
          locale={locale}
          rows={state.rows}
          answer={normalizeWord(state.answer)}
        >
          {challenge.kind === "rareword" && <RareWordReveal completion={completion} locale={locale} initial={state.discovery} />}
        </CompletionPanel>
      )}
    </>
  );
}
