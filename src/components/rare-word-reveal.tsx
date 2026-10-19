"use client";
import { useEffect, useState } from "react";
import type { Completion, Locale, RareWordDiscovery } from "@/lib/types";
import { rareWordCopy } from "@/lib/rare-word-i18n";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { wordArticlePath } from "@/lib/word-article-path";
import { wordArticleCopy } from "@/lib/word-article-i18n";
import { useLocalPreview } from "./local-preview-context";

export function RareWordReveal({ completion, locale, initial }: {completion: Completion; locale: Locale; initial?: RareWordDiscovery}) {
  const [entry, setEntry] = useState(initial);
  const m = rareWordCopy(locale);
  const preview = useLocalPreview();
  useEffect(() => {
    if (entry || !completion.runId) return;
    let active = true;
    fetch(`/api/play?runId=${encodeURIComponent(completion.runId)}`, {cache: "no-store"})
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (active && data?.result?.discovery) setEntry(data.result.discovery); })
      .catch(() => {});
    return () => { active = false; };
  }, [entry, completion.runId]);
  if (!entry) return null;
  return <section className="rare-word-discovery" data-word-discovery>
    <p className="eyebrow">{m.learn}</p>
    <h3>{entry.word}</h3>
    <dl>
      <div><dt>{m.definition}</dt><dd>{entry.definition}</dd></div>
      <div><dt>{m.origin}</dt><dd>{entry.origin}</dd></div>
      <div><dt>{m.example}</dt><dd>« {entry.example} »</dd></div>
    </dl>
    <div className="rare-word-discovery-links">
      <Link className="secondary-button" prefetch={false} href={wordArticlePath(locale, entry.word) + (preview ? "?preview=1" : completion.runId ? `?runId=${encodeURIComponent(completion.runId)}` : "")}>{wordArticleCopy(locale).read}<ArrowRight size={16}/></Link>
      <a href={entry.source} target="_blank" rel="noopener noreferrer">{m.source} ↗</a>
    </div>
  </section>;
}
