"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef, type ReactNode } from "react";
import type { Completion, Locale } from "@/lib/types";
import { postJson } from "@/lib/play-client";
import { et } from "@/lib/engagement-i18n";
import { t } from "@/lib/i18n";
import { track } from "@/lib/analytics";
import { LiveInvite } from "./live-invite";
export function InvitationActions({
  completion,
  locale,
  actions,
  disabledInvitation = false,
}: {
  completion: Completion;
  locale: Locale;
  actions?: (inviteButton: ReactNode) => ReactNode;
  disabledInvitation?: boolean;
}) {
  const [id, setId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [image, setImage] = useState(false),
    linkInput = useRef<HTMLInputElement>(null),
    pending = useRef<Promise<string> | null>(null),
    m = et(locale),
    sharedImage = ["sudoku", "math", "2048", "mines", "wordsearch"].includes(completion.game);
  if (disabledInvitation || !completion.runId || completion.provenance !== "server")
    return actions?.(null) ?? null;
  async function ensure() {
    if (!pending.current)
      pending.current = postJson("/api/friends", {
        action: "create",
        runId: completion.runId,
      })
        .then((value) => {
          setId(value.id as string);
          return value.id as string;
        })
        .catch((error) => {
          pending.current = null;
          throw error;
        });
    return pending.current;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/${locale}/friend/${id}`,
      );
      setMessage(t(locale).copied);
    } catch {
      setMessage(m.copyFailed);
      linkInput.current?.focus({ preventScroll: true });
      linkInput.current?.select();
    }
  }
  async function shareImage() {
    setBusy(true);
    setMessage("");
    try {
      const token = await ensure(),
        url = `/api/share-image?id=${token}&locale=${locale}`;
      const response = await fetch(url);
      if (
        !response.ok ||
        !response.headers.get("content-type")?.includes("image/png")
      )
        throw new Error();
      const file = new File(
        [await response.blob()],
        `puzzoria-${completion.game}-${completion.date}.png`,
        { type: "image/png" },
      );
      setImage(true);
      if (navigator.share && navigator.canShare?.({ files: [file] }))
        await navigator.share({
          files: [file],
          text: `${m.beatMe} ${window.location.origin}/${locale}/friend/${token}`,
        });
      else setMessage(m.imageReady);
      track("share", { locale, game_id: completion.game, method: "image" });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== "AbortError")
        setMessage(m.imageUnavailable);
    } finally {
      setBusy(false);
    }
  }
  const inviteButton = (
    <LiveInvite game={completion.game} locale={locale} difficulty={completion.difficulty}/>
  );
  return (
    <>
      {actions?.(inviteButton)}
      {(!actions || sharedImage || message || id) && (
        <section className="invitation-actions" data-invitation-actions>
          <div className="recovery-actions">
            {!actions && inviteButton}
            {sharedImage && (
              <button
                className="secondary-button"
                disabled={busy}
                onClick={shareImage}
              >
                {m.shareImage}
              </button>
            )}
          </div>
          {message && <p role="status">{message}</p>}
          {id && (
            <>
              <label className="invitation-link">
                {m.invitation}
                <input
                  ref={linkInput}
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}/${locale}/friend/${id}`}
                  onFocus={(event) => event.target.select()}
                />
              </label>
              <div className="recovery-actions">
                <button onClick={copy} className="secondary-button">
                  {m.copyLink}
                </button>
                <Link
                  className="secondary-button"
                  href={`/${locale}/friend/${id}`}
                >
                  {m.friendTitle}
                </Link>
                {image && sharedImage && (
                  <a
                    className="secondary-button"
                    href={`/api/share-image?id=${id}&locale=${locale}`}
                    download={`puzzoria-${completion.game}.png`}
                  >
                    {m.downloadImage}
                  </a>
                )}
              </div>
              {image && sharedImage && (
                <Image
                  className="result-image-preview"
                  unoptimized
                  src={`/api/share-image?id=${id}&locale=${locale}`}
                  width={1200}
                  height={630}
                  alt={m.imageReady}
                />
              )}
            </>
          )}
        </section>
      )}
    </>
  );
}
