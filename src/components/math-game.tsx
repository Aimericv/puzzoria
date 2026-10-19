"use client";
import { useEffect, useState } from "react";
import { Delete } from "lucide-react";
import type { Locale, PublicChallenge } from "@/lib/types";
import type { MathResult } from "@/lib/math";
import { evaluateExpression } from "@/lib/math";
import { t } from "@/lib/i18n";
import type { Hint } from "./hint-control";
import { useLocalPreview } from "./local-preview-context";
import { resultCopy } from "@/lib/result-metrics";
import { useGameSession, useStoredState } from "./storage";
import {
  CompletionPanel,
  ErrorMessage,
  SaveNotice,
  validatePlay,
} from "./game-common";
type MathPublic = Extract<PublicChallenge, { kind: "math" }>;
type MathState = {
  expression: string;
  result: (MathResult & { reference: string }) | null;
};
const validState = (v: unknown): v is MathState => {
  const x = v as MathState;
  return (
    !!x &&
    typeof x.expression === "string" &&
    x.expression.length <= 160 &&
    (x.result === null ||
      (typeof x.result === "object" &&
        Number.isFinite(x.result.value) &&
        Number.isFinite(x.result.score) &&
        Number.isFinite(x.result.distance) &&
        typeof x.result.reference === "string"))
  );
};
export function MathGame({
  challenge,
  locale,
}: {
  challenge: MathPublic;
  locale: Locale;
}) {
  const m = t(locale),
    store = useStoredState<MathState>(
      `dailygrid:game:${challenge.id}`,
      { expression: "", result: null },
      validState,
    );
  const { value: storedState, setValue, ready } = store;
  const localPreview = useLocalPreview();
  const state = localPreview ? {...storedState, expression:localPreview.expression!, result:localPreview.mathResult!} : storedState;
  const session = useGameSession(challenge, locale),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<MathResult | null>(null);
  const completion = localPreview?.completion ?? session.session.completion;
  const done = !!completion || !!state.result;
  useEffect(() => {
    const hint = (e: Event) => {
      const data = (e as CustomEvent<{ challengeId: string; hint: Hint }>)
        .detail;
      if (
        data.challengeId !== challenge.id ||
        data.hint.kind !== "math" ||
        done
      )
        return;
      session.start();
      const expression = data.hint.expression;
      setValue((s) => ({ ...s, expression }));
    };
    window.addEventListener("dailygrid:hint", hint);
    return () => window.removeEventListener("dailygrid:hint", hint);
  }, [challenge.id, done, session, setValue]);
  useEffect(() => {
    if (!localPreview && ready && session.ready && state.result && !session.session.completion)
      session.finish(state.result.distance === 0, state.result.score);
  }, [localPreview, ready, session, state.result]);
  const used = state.expression.match(/\d+/g)?.map(Number) ?? [];
  const usedTile = (i: number) =>
    used.filter((n) => n === challenge.numbers[i]).length >
    challenge.numbers.slice(0, i).filter((n) => n === challenge.numbers[i])
      .length;
  function append(token: string) {
    if (!ready || done || busy) return;
    session.start();
    setError("");
    setPreview(null);
    setValue((s) => ({
      ...s,
      expression: `${s.expression}${s.expression ? " " : ""}${token}`.slice(
        0,
        160,
      ),
    }));
  }
  function check() {
    setError("");
    session.start();
    try {
      setPreview(
        evaluateExpression(
          state.expression,
          challenge.numbers,
          challenge.target,
        ),
      );
    } catch {
      setError("mathInvalid");
      setPreview(null);
    }
  }
  async function submit() {
    if (!ready || busy || done) return;
    session.start();
    setError("");
    setBusy(true);
    try {
      const result = await validatePlay(challenge, {
        expression: state.expression,
      });
      setValue((s) => ({
        ...s,
        expression:
          typeof result.expression === "string"
            ? result.expression
            : s.expression,
        result: result as unknown as MathResult & { reference: string },
      }));
      session.finish(result.success as boolean, result.score as number);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="math-target">
        <span>{m.target}</span>
        <strong>{challenge.target}</strong>
        <div className="target-rule" />
      </div>
      <div className="numbers-heading">
        {m.available}
        <small>+ − × ÷</small>
      </div>
      <div className="math-numbers">
        {challenge.numbers.map((n, i) => (
          <button
            key={i}
            className={usedTile(i) ? "used" : ""}
            disabled={!ready || done || busy || usedTile(i)}
            onClick={() => append(String(n))}
          >
            {n}
          </button>
        ))}
      </div>
      <label className="expression-label" htmlFor="math-expression">
        {m.expression}
      </label>
      <div className="expression-field">
        <input
          id="math-expression"
          value={state.expression}
          maxLength={160}
          placeholder="( … × … ) + …"
          inputMode="text"
          autoComplete="off"
          disabled={!ready || done || busy}
          onChange={(e) => {
            session.start();
            setPreview(null);
            setError("");
            setValue((s) => ({ ...s, expression: e.target.value }));
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              check();
            }
          }}
        />
        <button
          aria-label={m.backspace}
          disabled={!ready || done || busy}
          onClick={() => {
            setPreview(null);
            setValue((s) => ({
              ...s,
              expression: s.expression
                .trimEnd()
                .replace(/(?:\d+|[^\d\s])\s*$/, "")
                .trimEnd(),
            }));
          }}
        >
          <Delete size={19} />
        </button>
      </div>
      {!done && (
        <>
          <div className="operator-pad">
            {["+", "−", "×", "÷", "(", ")"].map((op) => (
              <button
                key={op}
                disabled={!ready || busy}
                onClick={() => append(op)}
              >
                {op}
              </button>
            ))}
          </div>
          <div className="math-actions">
            <button
              className="text-button"
              disabled={!ready || busy}
              onClick={() => {
                setValue((s) => ({ ...s, expression: "" }));
                setPreview(null);
                setError("");
              }}
            >
              {m.clear}
            </button>
            <button
              className="secondary-button"
              disabled={!ready || busy || !state.expression}
              onClick={check}
            >
              {m.preview}
            </button>
          </div>
          {preview && (
            <div className="math-preview-result" aria-live="polite">
              <div>
                {m.result}
                <strong>{preview.value}</strong>
              </div>
              <div>
                {m.distance}
                <strong>{preview.distance}</strong>
              </div>
              <div>
                {m.score}
                <strong>{preview.score}</strong>
              </div>
            </div>
          )}
          <p className="score-help">{m.mathScoreHelp}</p>
          <button
            className="primary-button finish-math"
            disabled={!ready || busy || !state.expression}
            onClick={submit}
          >
            {m.submit}
          </button>
        </>
      )}
      <ErrorMessage error={error} locale={locale} />
      <SaveNotice locale={locale} saved={store.saved && session.saved} />
      {completion && (
        <CompletionPanel
          completion={completion}
          locale={locale}
          resultDetails={state.result ? {mathTarget:challenge.target,mathValue:state.result.value,mathDistance:state.result.distance,operations:state.result.operations} : undefined}
        >
          {state.result && (
            <div className="math-reference">
              <dl className="math-preview-result" data-math-result>
                <div><dt>{m.result}</dt><dd>{state.result.value}</dd></div>
                <div><dt>{m.distance}</dt><dd>{state.result.distance}</dd></div>
                {Number.isSafeInteger(state.result.operations) && <div><dt>{resultCopy(locale).operations}</dt><dd>{state.result.operations}</dd></div>}
              </dl>
              <span>{m.reference}</span>
              <strong>
                {state.result.reference} = {challenge.target}
              </strong>
            </div>
          )}
        </CompletionPanel>
      )}
    </>
  );
}
