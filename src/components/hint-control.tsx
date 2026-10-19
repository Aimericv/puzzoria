"use client";
import { useEffect, useState } from "react";
import type { Locale, PublicChallenge } from "@/lib/types";
import { requestHint } from "@/lib/play-client";
import { rt } from "@/lib/retention-i18n";
import { useStoredState, useStats } from "./storage";
export type Hint =
  | { kind: "word"; index: number; letter: string }
  | { kind: "sudoku"; index: number; value: number }
  | { kind: "math"; expression: string };
export function applyHint(challengeId: string, hint: Hint) {
  window.dispatchEvent(
    new CustomEvent("dailygrid:hint", { detail: { challengeId, hint } }),
  );
}
export function HintControl({
  challenge,
  locale,
}: {
  challenge: PublicChallenge;
  locale: Locale;
}) {
  const m = rt(locale),
    store = useStoredState<{ hint: Hint | null }>(
      `dailygrid:game:hint:${challenge.id}`,
      { hint: null },
      (v): v is { hint: Hint | null } =>
        !!v && typeof v === "object" && "hint" in v,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    const complete = () => setDone(true);
    window.addEventListener("dailygrid:completed", complete);
    return () => window.removeEventListener("dailygrid:completed", complete);
  }, []);
  const hint = store.value.hint;
  const { completions } = useStats();
  if (done || completions.some((c) => c.challengeId === challenge.id))
    return null;
  return (
    <details className="hint-control">
      <summary>{m.hint}</summary>
      <p>{m.hintHelp}</p>
      {!hint ? (
        <button
          className="secondary-button"
          disabled={busy || !store.ready}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const hint = (await requestHint(challenge)) as Hint;
              store.setValue({ hint });
              applyHint(challenge.id, hint);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {m.hint}
        </button>
      ) : (
        <p className="hint-answer">
          {m.hintUsed}:{" "}
          {hint.kind === "word"
            ? `1 → ${hint.letter}`
            : hint.kind === "sudoku"
              ? `${Math.floor(hint.index / 9) + 1}, ${(hint.index % 9) + 1} → ${hint.value}`
              : hint.expression}
        </p>
      )}
      {error && <p role="alert">{m[error as keyof typeof m] ?? m.syncIssue}</p>}
    </details>
  );
}
