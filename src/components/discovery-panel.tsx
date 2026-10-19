"use client";
import { useEffect, useState } from "react";
import type { Completion, Locale } from "@/lib/types";
import type { Discovery } from "@/lib/discovery-types";
import { et } from "@/lib/engagement-i18n";
export function DiscoveryPanel({
  completion,
  locale,
}: {
  completion: Completion;
  locale: Locale;
}) {
  const [value, setValue] = useState<Discovery | null>(null),
    m = et(locale);
  useEffect(() => {
    if (!completion.runId) return;
    const controller = new AbortController();
    fetch(`/api/discovery?runId=${encodeURIComponent(completion.runId)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) setValue(data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [completion.runId]);
  if (!value) return null;
  const step = value.kind === "sudoku" ? value.first : null;
  return (
    <section className="discovery-panel" data-discovery>
      <h3>{m.discovery}</h3>
      {value.kind === "classic" && <><h4>{value.title}</h4><p>{value.text}</p></>}
      {value.kind === "word" && (
        <>
          <h4>{value.definition?.title ?? value.word}</h4>
          <p>{value.definition?.text ?? m.noDefinition}</p>
          <a
            href={value.definition?.source ?? value.dictionaryUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {m.dictionary}
          </a>
          {value.definition && (
            <small>
              <a
                href="https://creativecommons.org/licenses/by-sa/4.0/"
                target="_blank"
                rel="noopener noreferrer"
              >
                {m.dictionaryCredit}
              </a>
            </small>
          )}
          <p>
            {m.distinct}: {value.distinct} · {m.repeated}:{" "}
            {value.repeated.join(", ") || "—"}
          </p>
        </>
      )}
      {value.kind === "sudoku" && (
        <>
          <h4>{m.deduction}</h4>
          {step ? (
            <>
              <strong>{m[step.kind]}</strong>
              <p>
                {(step.kind === "naked" ? m.reasoning : m.hiddenReason)
                  .replace("{digit}", String(step.digit))
                  .replace("{row}", String(Math.floor(step.index / 9) + 1))
                  .replace("{col}", String((step.index % 9) + 1))
                  .replace("{unit}", step.unit ? m[step.unit] : "")}
              </p>
            </>
          ) : (
            <p>{m.fallbackReason}</p>
          )}
          <dl>
            <div>
              <dt>{m.singleSteps}</dt>
              <dd>{value.naked + value.hidden}</dd>
            </div>
            <div>
              <dt>{m.remaining}</dt>
              <dd>{value.remaining}</dd>
            </div>
          </dl>
          {!step && value.fallback && (
            <p>
              {m.cell}: {Math.floor(value.fallback.index / 9) + 1},{" "}
              {(value.fallback.index % 9) + 1} · {m.candidates}:{" "}
              {value.fallback.candidates.join(", ")}
            </p>
          )}
          <p>
            {m.difficultyAnalysis}: {value.remaining ? m.advanced : m.logical}
          </p>
        </>
      )}
      {value.kind === "math" && (
        <>
          <h4>{m.calculations}</h4>
          <strong>
            {value.expression} = {value.target}
          </strong>
          <ol>
            {value.steps.map((s, i) => (
              <li key={i}>
                {s.a} {s.op === "*" ? "×" : s.op === "/" ? "÷" : s.op} {s.b} ={" "}
                {s.value}
              </li>
            ))}
          </ol>
          <p>{value.alternative ? m.referenceOnly : m.noAlternative}</p>
        </>
      )}
    </section>
  );
}
