"use client";
import { useEffect, useRef } from "react";
import type { Locale } from "@/lib/types";
import { t } from "@/lib/i18n";
export function ShareTextFallback({text, manual, locale}: {text: string; manual: boolean; locale: Locale}) {
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {if (manual) {input.current?.focus({preventScroll:true}); input.current?.select();}}, [manual, text]);
  return <details className="share-text" open={manual || undefined}>
    <summary>{t(locale).result}</summary>
    <textarea ref={input} readOnly aria-label={t(locale).result} value={text} onClick={e => e.currentTarget.select()} rows={Math.min(12, text.split("\n").length + 1)} />
  </details>;
}
