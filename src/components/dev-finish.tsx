"use client";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { Locale, PublicChallenge } from "@/lib/types";
import { isLoopback, type LocalPreviewFixture } from "@/lib/local-preview";
import { devPreviewCopy } from "@/lib/dev-preview-i18n";
import { scrollToGame, preserveReplaySpace } from "@/lib/replay-scroll";
import { LocalPreviewContext } from "./local-preview-context";
import { reservePlay } from "@/lib/play-client";

export function DevFinish({challenge, locale, children}: {challenge: PublicChallenge; locale: Locale; children: ReactNode}) {
  const [enabled, setEnabled] = useState(false), [fixture, setFixture] = useState<LocalPreviewFixture>(), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const root = useRef<HTMLDivElement>(null), closing = useRef(false), m = devPreviewCopy(locale);
  useLayoutEffect(() => {if (process.env.NODE_ENV === "development") setEnabled(isLoopback(location.hostname));}, []);
  useEffect(() => {
    if (fixture || !closing.current) return;
    let cancelScroll: (() => void) | undefined;
    const frame = requestAnimationFrame(() => {if (root.current) cancelScroll = scrollToGame(root.current); closing.current = false;});
    return () => {cancelAnimationFrame(frame); cancelScroll?.();};
  }, [fixture]);
  if (process.env.NODE_ENV === "production") return children;
  const close = () => {preserveReplaySpace(); closing.current = true; setFixture(undefined);};
  async function finish() {
    setBusy(true); setError(false);
    try {
      const run = await reservePlay(challenge);
      const params = new URLSearchParams({runId: run.runId, game: challenge.kind, locale, mode: challenge.mode ?? "daily", difficulty: "difficulty" in challenge ? challenge.difficulty : "easy"});
      const response = await fetch(`/api/dev-preview?${params}`, {cache: "no-store"});
      if (!response.ok) throw new Error();
      setFixture(await response.json());
    } catch {setError(true);} finally {setBusy(false);}
  }
  return <div ref={root} data-local-test data-local-preview={!!fixture}>
    {enabled && <div className="local-test-controls">
      <button className="secondary-button" onClick={fixture ? close : () => void finish()} disabled={busy}>{fixture ? m.close : m.finish}</button>
      {fixture && <small>{m.local}</small>}
      {error && <p role="alert">{m.error}</p>}
    </div>}
    <LocalPreviewContext.Provider value={fixture ? {...fixture, close, reset: () => setFixture(undefined)} : undefined}>
      {children}
    </LocalPreviewContext.Provider>
  </div>;
}
