"use client";
import Link from "next/link";
import { useState } from "react";
import { Share2, Trophy, Check, ShieldCheck } from "lucide-react";
import {
  catalogGameIds,
  gameFamily,
  type Completion,
  type LetterState,
  type Locale,
  type PublicChallenge,
} from "@/lib/types";
import { gamePath, t } from "@/lib/i18n";
import { gameName } from "@/lib/registry";
import { shareSummary } from "@/lib/share";
import { track } from "@/lib/analytics";
import { useStats } from "./storage";
import { finishedToday } from "@/lib/stats";
import { submitPlay } from "@/lib/play-client";
import { rt } from "@/lib/retention-i18n";
import { practicePath } from "@/lib/play-path";
import { ResultExtras } from "./result-extras";
import { PersonalProgress } from "./personal-progress";
import { InvitationActions } from "./invitation-actions";
import { DiscoveryPanel } from "./discovery-panel";
import { nt } from "@/lib/new-games-i18n";
import { st } from "@/lib/social-i18n";
import { pg, resultModeLabel } from "@/lib/post-game-i18n";
import { dateLabel, utcDay } from "@/lib/date";
import { useResultScroll } from "./result-scroll";
import { requestReplay } from "@/lib/replay-scroll";
import { useLocalPreview } from "./local-preview-context";
import { shareText } from "@/lib/share-client";
import { ShareTextFallback } from "./share-text-fallback";
import { ResultMetrics } from "./result-metrics";
import type { ResultDetails } from "@/lib/types";
import { devPreviewCopy } from "@/lib/dev-preview-i18n";
import { resultCopy } from "@/lib/result-metrics";
import { useLiveRoom } from "./live-context";
export async function validatePlay(
  challenge: PublicChallenge,
  body: unknown,
): Promise<Record<string, unknown>> {
  return submitPlay(challenge, body as Record<string, unknown>);
}
export function ErrorMessage({
  error,
  locale,
}: {
  error: string;
  locale: Locale;
}) {
  if (!error) return null;
  const m = t(locale);
  return (
    <p className="game-error" role="alert">
      {error in m
        ? m[error as keyof typeof m]
        : (st(locale)[error as keyof ReturnType<typeof st>] ??
          pg(locale)[error as keyof ReturnType<typeof pg>] ??
          rt(locale)[error as keyof ReturnType<typeof rt>] ??
          m.networkError)}
    </p>
  );
}
export function SaveNotice({
  locale,
  saved,
}: {
  locale: Locale;
  saved: boolean;
}) {
  return (
    <span className="save-notice">
      <ShieldCheck size={14} />
      {saved
        ? t(locale).saved
        : {
            en: "Storage unavailable — keep this page open.",
            fr: "Sauvegarde indisponible — gardez cette page ouverte.",
            es: "No se puede guardar — mantén esta página abierta.",
            de: "Speichern nicht möglich — Seite offen halten.",
          }[locale]}
    </span>
  );
}
export function CompletionPanel({
  completion,
  locale,
  rows = [],
  answer,
  children,
  title,
  primaryAction,
  shareLines,
  sharePath,
  comparisonContent,
  resultDetails,
  roomResult = false,
  resultSuccess,
  revealContent,
}: {
  completion: Completion;
  locale: Locale;
  rows?: LetterState[][];
  answer?: string;
  children?: React.ReactNode;
  title?: string;
  primaryAction?: React.ReactNode;
  shareLines?: string[];
  sharePath?: string;
  comparisonContent?: React.ReactNode;
  resultDetails?: ResultDetails;
  roomResult?: boolean;
  resultSuccess?: boolean;
  revealContent?: React.ReactNode;
}) {
  const live = useLiveRoom();
  const hidden = live && !roomResult;
  const resultRef = useResultScroll(!hidden);
  const preview = useLocalPreview();
  const m = t(locale),
    [shareStatus, setShareStatus] = useState(""),
    [summary, setSummary] = useState(""),
    [shareBusy, setShareBusy] = useState(false),
    [manualShare, setManualShare] = useState(false);
  async function share() {
    if (shareBusy) return;
    setShareBusy(true);
    setShareStatus("");
    setManualShare(false);
    const text = (preview ? devPreviewCopy(locale).local + "\n" : "") + (shareLines ? [...shareLines, window.location.origin + (sharePath ?? gamePath(locale, completion.game))].join("\n") : shareSummary(completion, locale, window.location.origin, rows));
    setSummary(text);
    try {
      const method = await shareText(text);
      if (method === "clipboard") setShareStatus(m.copied);
      if (method === "manual") {setManualShare(true); setShareStatus(m.shareFailed);}
      if (!preview && (method === "native" || method === "clipboard"))
        track("share", {
          locale,
          game_id: completion.game,
          challenge_id: completion.challengeId,
          method,
        });
    } finally {setShareBusy(false);}
  }
  const shareButton = (
    <button
      type="button"
      className="secondary-button share-button"
      disabled={shareBusy}
      onClick={share}
    >
      <Share2 size={17} />
      {m.share}
    </button>
  );
  if (hidden) return null;
  return (
    <section className="completion-panel" aria-live="polite" ref={resultRef} tabIndex={-1}>
      <div className="result-medallion">
        {(resultSuccess ?? completion.success) ? <Trophy size={25} /> : <Check size={25} />}
      </div>
      <h2>
        {title ?? (completion.game === "2048"
          ? nt(locale).ended
          : completion.success
            ? m.won
            : completion.game === "math"
              ? m.mathEnd
              : completion.mode === "daily"
                ? m.lost
                : nt(locale).ended)}
      </h2>
      <p className="result-mode" data-result-mode>
        <strong>{resultModeLabel(completion, locale)}</strong>
        {completion.mode !== "practice" && (
          <span>{dateLabel(completion.date, locale)}</span>
        )}
      </p>
      {completion.mode === "daily" && completion.date === utcDay() && (
        <p className="result-mode-help">{completion.game === "rareword" ? resultCopy(locale).rareDone : pg(locale).dailyDone}</p>
      )}
      <InvitationActions
        completion={completion}
        locale={locale}
        disabledInvitation={roomResult}
        actions={(inviteButton) => (
          <div className="replay-actions result-top-actions">
            <div className="result-play-actions">
              {primaryAction ?? (completion.game === "rareword" ? <Link className="primary-button" scroll={false} href={practicePath(locale,"word")} onClick={() => requestReplay("word",locale)}>{resultCopy(locale).wordPractice}</Link> : completion.mode === "practice" && !completion.friendId ? (
                <button
                  className="primary-button"
                  onClick={() => {
                    preview?.reset();
                    if (!preview) track("play_again", {
                      locale,
                      game_id: completion.game,
                      challenge_id: completion.challengeId,
                      mode: "practice",
                    });
                    window.dispatchEvent(
                      new CustomEvent("dailygrid:play-again"),
                    );
                  }}
                >
                  {rt(locale).playAgain}
                </button>
              ) : (
                <Link
                  className="primary-button"
                  scroll={false}
                  href={practicePath(
                    locale,
                    completion.game,
                    completion.difficulty,
                  )}
                  onClick={() => {
                    requestReplay(completion.game, locale);
                    if (!preview) track("play_again", {
                      locale,
                      game_id: completion.game,
                      challenge_id: completion.challengeId,
                      mode: "practice",
                    });
                  }}
                >
                  {rt(locale).playAgain}
                </Link>
              ))}
              {roomResult ? <Link className="secondary-button" href={`/${locale}/live`}>{({en:"Choose another game",fr:"Choisir un autre jeu",es:"Elegir otro juego",de:"Anderes Spiel wählen"})[locale]}</Link> : <OtherGameLink completion={completion} locale={locale} />}
              {inviteButton}
            </div>
              <div className="result-utility-actions">
                <Link className="secondary-button" href={`/${locale}/stats`}>
                  {rt(locale).viewStats}
                </Link>
                {shareButton}
              </div>
          </div>
        )}
      />
      {shareStatus && (
        <p className="share-status" role="status">
          {shareStatus}
        </p>
      )}
      {summary && (
        <ShareTextFallback text={summary} manual={manualShare} locale={locale} />
      )}
      <ResultMetrics completion={completion} locale={locale} answer={answer} details={resultDetails}/>
      {revealContent}
      {comparisonContent ? <div className="result-insights"><section className="comparison-panel">{comparisonContent}</section><PersonalProgress completion={completion} locale={locale}/></div> : <ResultExtras completion={completion} locale={locale}>
        <PersonalProgress completion={completion} locale={locale} />
      </ResultExtras>}
      {children}
      {!preview && !roomResult && ["sudoku", "math", "2048", "mines", "wordsearch"].includes(completion.game) && (
        <DiscoveryPanel completion={completion} locale={locale} />
      )}
    </section>
  );
}

export function OtherGameLink({
  completion,
  locale,
}: {
  completion: Completion;
  locale: Locale;
}) {
  const { completions } = useStats();
  const finished = finishedToday(completions);
  const next =
    catalogGameIds.find((g) => g !== gameFamily(completion.game) && !finished.includes(g)) ??
    catalogGameIds.find((g) => g !== gameFamily(completion.game))!;
  return (
    <span className="next-game">
      <Link
        className="secondary-button"
        href={
          completion.mode === "practice"
            ? practicePath(locale, next)
            : gamePath(locale, next)
        }
        onClick={() =>
          track("next_game_click", {
            locale,
            game_id: next,
            challenge_id: completion.challengeId,
            mode: completion.mode ?? "daily",
          })
        }
      >
        {rt(locale).otherGame} · {gameName(next, locale)}
      </Link>
    </span>
  );
}
