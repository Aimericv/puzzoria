"use client";
import { useState } from "react";
import type { Locale } from "@/lib/types";
import { st } from "@/lib/social-i18n";
import { t, gamePath } from "@/lib/i18n";
import type {
  Community,
  PublicSocialChallenge,
  SocialState,
} from "@/lib/social-types";
import { socialShareLines } from "@/lib/social-share";
import { shareText } from "@/lib/share-client";
import { ShareTextFallback } from "./share-text-fallback";
export function SocialShare({
  challenge,
  state,
  community,
  runId,
  locale,
  roomCode,
  imageOnly = false,
}: {
  challenge: PublicSocialChallenge;
  state: SocialState;
  community: Community;
  runId?: string;
  locale: Locale;
  roomCode?: string;
  imageOnly?: boolean;
}) {
  const [status, setStatus] = useState(""),
    [fallback, setFallback] = useState(""),
    [busy, setBusy] = useState(false),
    [sharing, setSharing] = useState(false),
    [manual, setManual] = useState(false),
    m = st(locale),
    base = t(locale);
  const lines = socialShareLines(challenge, state, community, locale);
  async function share() {
    if (sharing) return;
    setSharing(true); setStatus(""); setManual(false);
    const text = [
      ...lines,
      new URL(gamePath(locale, challenge.kind), window.location.origin).href,
    ].join("\n");
    setFallback(text);
    try {
      const outcome = await shareText(text);
      if (outcome === "clipboard") setStatus(base.copied);
      if (outcome === "manual") {setManual(true); setStatus(base.shareFailed);}
    } finally {setSharing(false);}
  }
  async function image() {
    if (!runId && !roomCode) return;
    setBusy(true);
    try {
      const query = new URLSearchParams({
        locale,
        ...(runId ? { runId } : { code: roomCode! }),
      });
      const response = await fetch("/api/social-image?" + query, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const file = await response.blob(),
        url = URL.createObjectURL(file),
        a = document.createElement("a");
      a.href = url;
      a.download = `puzzoria-${challenge.kind}.png`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setStatus(base.shareFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="social-share">
      <div className="share-card-preview" aria-label={m.ended}>
        <small>puzzoria.</small>
        {lines.slice(0, 8).map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
      <div className="social-actions">
        {!imageOnly && <button className="primary-button" disabled={sharing} onClick={() => void share()}>
          {m.share}
        </button>}
        <button
          className="secondary-button"
          disabled={busy || (!runId && !roomCode)}
          onClick={() => void image()}
        >
          {m.image}
        </button>
      </div>
      {status && <p role="status">{status}</p>}
      {fallback && (
        <ShareTextFallback text={fallback} manual={manual} locale={locale} />
      )}
    </div>
  );
}
