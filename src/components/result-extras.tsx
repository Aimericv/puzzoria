"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Completion, Locale } from "@/lib/types";
import type { Comparison } from "@/lib/statistics";
import { rt } from "@/lib/retention-i18n";
import { pg } from "@/lib/post-game-i18n";
import { track } from "@/lib/analytics";
import { useAccount } from "./account-provider";
import { useStats } from "./storage";
import { ComparisonPreview } from "./comparison-preview";
import { GameComparison } from "./game-comparison";
import { useLocalPreview } from "./local-preview-context";
type PromptPreference = { never: boolean; nextAt: number };
export function ResultExtras({
  completion,
  locale,
  hideCompetition = false,
  showPreview = false,
  children,
}: {
  completion: Completion;
  locale: Locale;
  hideCompetition?: boolean;
  showPreview?: boolean;
  children?: React.ReactNode;
}) {
  const preview = useLocalPreview();
  const m = rt(locale),
    account = useAccount(),
    { completions } = useStats(),
    [comparison, setComparison] = useState<Comparison | null>(preview?.comparison ?? null),
    [comparisonLoaded, setComparisonLoaded] = useState(false),
    [comparisonFailed, setComparisonFailed] = useState(false),
    [prompt, setPrompt] = useState(false);
  useEffect(() => {
    if (preview) return;
    let active = true;
    if (completion.runId && !hideCompetition)
      fetch(
        `/api/play?comparison=1&runId=${encodeURIComponent(completion.runId)}`,
        { cache: "no-store" },
      )
        .then((r) => {
          if (!r.ok) throw new Error();
          return r.json();
        })
        .then((data) => {
          if (active) {
            setComparison(data?.comparison ?? null);
            setComparisonLoaded(true);
          }
        })
        .catch(() => {
          if (active) {
            setComparisonFailed(true);
            setComparisonLoaded(true);
          }
        });
    return () => {
      active = false;
    };
  }, [completion.runId, hideCompetition, preview]);
  useEffect(() => {
    if (preview) return;
    if (!account.ready || account.user || completions.length < 3) return;
    let preference: PromptPreference = { never: false, nextAt: 0 };
    try {
      preference =
        JSON.parse(
          localStorage.getItem("dailygrid:account-prompt:v1") ?? "null",
        ) ?? preference;
    } catch {
      /* Default is non-blocking. */
    }
    if (preference.never || preference.nextAt > Date.now()) return;
    setPrompt(true);
    try {
      localStorage.setItem(
        "dailygrid:account-prompt:v1",
        JSON.stringify({ never: false, nextAt: Date.now() + 7 * 86400000 }),
      );
    } catch {
      /* Prompt still works without persistence. */
    }
    track("account_prompt_view", {
      locale,
      game_id: completion.game,
      mode: completion.mode ?? "daily",
    });
  }, [
    account.ready,
    account.user,
    completions.length,
    completion.game,
    completion.mode,
    locale,
    preview,
  ]);
  function dismiss(never: boolean) {
    setPrompt(false);
    try {
      localStorage.setItem(
        "dailygrid:account-prompt:v1",
        JSON.stringify({ never, nextAt: Date.now() + 7 * 86400000 }),
      );
    } catch {
      /* Dismissal remains effective for this page. */
    }
    track(never ? "account_prompt_never_show" : "account_prompt_dismiss", {
      locale,
      game_id: completion.game,
    });
  }
  return (
    <>
      {!preview && !hideCompetition &&
        completion.mode === "daily" &&
        completion.provenance === "server" &&
        !completion.eligible && (
          <p className="result-footnote">{m.notRanked}</p>
        )}
      <div className={children && (!hideCompetition || showPreview) ? "result-insights" : undefined}>
      <div className="result-comparison-slot">
      {comparison && <GameComparison completion={completion} comparison={comparison} locale={locale}/>}
      {completion.success &&
        completion.provenance === "server" &&
        !completion.friendId &&
        ((hideCompetition && showPreview) ||
          (!hideCompetition &&
            comparisonLoaded &&
            !comparison &&
            !comparisonFailed)) && (
          <ComparisonPreview game={completion.game} locale={locale} />
        )}
      {!hideCompetition &&
        comparisonLoaded &&
        !comparison &&
        (!completion.success || comparisonFailed || completion.friendId) && (
          <section className="comparison-panel" data-community-pending>
            <h3>{m.comparison}</h3>
            <p>
              {comparisonFailed
                ? pg(locale).communityUnavailable
                : pg(locale).communityPending}
            </p>
          </section>
        )}
      </div>
      {children}
      </div>
      {completion.learnMoreUrl &&
        /^https:\/\//.test(completion.learnMoreUrl) && (
          <a
            href={completion.learnMoreUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {m.learnMore}
          </a>
        )}
      {prompt && (
        <aside className="account-prompt">
          <h3>{m.promptTitle}</h3>
          <p>{m.promptBody}</p>
          <Link className="secondary-button" href={`/${locale}/account`}>
            {m.signup}
          </Link>
          <div>
            <button onClick={() => dismiss(false)}>{m.later}</button>
            <button onClick={() => dismiss(true)}>{m.never}</button>
          </div>
        </aside>
      )}
    </>
  );
}
