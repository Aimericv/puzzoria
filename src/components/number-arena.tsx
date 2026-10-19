"use client";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/types";
import type { NumberEvent } from "@/lib/social-types";
import { st, sf } from "@/lib/social-i18n";
import { questionText, numberFeedback } from "./number-controls";
import { validNumber } from "@/lib/number-duel";

type Clue = Pick<NumberEvent, "action" | "answer" | "direction">;
export function SecretNumberForm({
  locale,
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  locale: Locale;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: number) => void;
  disabled: boolean;
}) {
  const m = st(locale);
  return (
    <form
      className="secret-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!disabled && validNumber(Number(value))) onSubmit(Number(value));
      }}
    >
      <label>
        {m.secret}
        <input
          aria-label={m.secret}
          type="number"
          inputMode="numeric"
          autoComplete="off"
          min={1}
          max={100}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder="1–100"
        />
      </label>
      <button
        className="primary-button"
        disabled={disabled || !validNumber(Number(value))}
      >
        {m.seal}
      </button>
    </form>
  );
}

function LastClue({
  clue,
  locale,
  opponent = false,
}: {
  clue?: Clue;
  locale: Locale;
  opponent?: boolean;
}) {
  const m = st(locale);
  return clue ? (
    <div
      className={opponent ? "number-opponent-answer" : "number-answer"}
      role="status"
    >
      <small>{opponent ? m.theirLastQuestion : m.yourLastQuestion}</small>
      <span>{questionText(clue.action, locale)}</span>
      <strong
        className={clue.direction ? `number-direction ${clue.direction}` : ""}
      >
        {numberFeedback(clue, locale)}
      </strong>
    </div>
  ) : (
    <p className="duel-no-clue">{m.noQuestionsYet}</p>
  );
}

export function NumberArena({
  locale,
  yourNumber,
  opponent,
  yourClue,
  opponentClue,
  ready,
  yourTurn,
  opponentReady,
  setup,
  bot = false,
  completed = false,
  opponentNumber,
  simultaneous = false,
}: {
  locale: Locale;
  yourNumber: number | null;
  opponent: string;
  yourClue?: Clue;
  opponentClue?: Clue;
  ready: boolean;
  yourTurn: boolean;
  opponentReady: boolean;
  setup?: ReactNode;
  bot?: boolean;
  completed?: boolean;
  opponentNumber?: number | null;
  simultaneous?: boolean;
}) {
  const m = st(locale);
  return (
    <div className="number-arena">
      <article
        className={`duel-player duel-you ${!completed && ready && yourTurn ? "is-active" : ""}`}
        data-duel-player="you"
      >
        <header>
          <h3>🙂 {m.you}</h3>
          {!ready && <span>{yourNumber === null ? m.choose : m.locked}</span>}
        </header>
        <p className="duel-role">{m.numberToProtect}</p>
        {yourNumber === null ? (
          <>
            <p className="duel-setup-help">{m.secretHelp}</p>
            {setup}
          </>
        ) : (
          <>
            <strong className="duel-secret">{yourNumber}</strong>
            {!completed && <small className="duel-private">{m.onlyYouSee}</small>}
          </>
        )}
        {!simultaneous && !completed && yourNumber !== null && ready && (
          <div className="duel-search">
            <p>{sf(m.opponentSearch, { name: opponent })}</p>
            <LastClue clue={opponentClue} locale={locale} opponent />
          </div>
        )}
      </article>
      <article
        className={`duel-player duel-opponent ${!completed && ready && !yourTurn ? "is-active" : ""}`}
        data-duel-player="opponent"
      >
        <header>
          <h3>
            {bot ? "🤖" : "👤"} {opponent}
          </h3>
          {!ready && <span>{opponentReady ? m.locked : m.preparing}</span>}
        </header>
        <p className="duel-role">{m.numberToFind}</p>
        <strong className="duel-secret" aria-label={completed ? m.numberToFind : m.hiddenNumber}>
          {completed ? opponentNumber : "?"}
        </strong>
        {!completed && <small className="duel-private">{m.hiddenNumber}</small>}
        {!completed && (ready ? (
          <div className="duel-search">
            <p>{m.yourSearch}</p>
            <LastClue clue={yourClue} locale={locale} />
          </div>
        ) : (
          <p className="duel-setup-help">
            {opponentReady ? m.opponentIsReady : m.opponentPreparing}
          </p>
        ))}
      </article>
    </div>
  );
}
