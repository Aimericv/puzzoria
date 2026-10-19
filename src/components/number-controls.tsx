"use client";
import { useState } from "react";
import type { Locale } from "@/lib/types";
import type { NumberAction, NumberEvent } from "@/lib/social-types";
import { validNumber } from "@/lib/number-duel";
import { st, sf } from "@/lib/social-i18n";
// Old questions remain readable in saved histories; new play uses proposals only.
export function questionText(action: NumberAction, locale: Locale) {
  const m = st(locale);
  return action.kind !== "question"
    ? sf(m.proposedNumber, { n: action.value })
    : action.predicate.kind === "even"
      ? m.even
      : sf(m[action.predicate.kind], { n: action.predicate.value });
}
export function numberFeedback(
  event: Pick<NumberEvent, "direction" | "answer">,
  locale: Locale,
) {
  const m = st(locale);
  return event.direction === "higher"
    ? m.higherNumber
    : event.direction === "lower"
      ? m.lowerNumber
      : event.direction === "found"
        ? m.foundNumber
        : event.answer
          ? m.yes
          : m.no;
}
export function NumberControls({
  locale,
  disabled,
  onAction,
}: {
  locale: Locale;
  disabled: boolean;
  onAction: (a: NumberAction) => void;
}) {
  const m = st(locale),
    [guess, setGuess] = useState("");
  return (
    <div className="number-controls number-simple-controls">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (disabled || !validNumber(Number(guess))) return;
          onAction({ kind: "try", value: Number(guess) });
          setGuess("");
        }}
      >
        <label>
          {m.guess}
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            value={guess}
            onChange={(event) => setGuess(event.target.value)}
            aria-label={m.guess}
            placeholder="1–100"
            autoComplete="off"
            disabled={disabled}
          />
        </label>
        <button
          className="primary-button"
          disabled={disabled || !validNumber(Number(guess))}
        >
          {m.guess}
        </button>
      </form>
    </div>
  );
}
