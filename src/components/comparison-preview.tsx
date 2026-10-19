import type { GameId, Locale } from "@/lib/types";
import { comparisonPreviewCopy } from "@/lib/comparison-preview-i18n";
import { rt } from "@/lib/retention-i18n";
import { hasWinRate, resultCopy } from "@/lib/result-metrics";

export function ComparisonPreview({game, locale}: {game: GameId; locale: Locale}) {
  const m = comparisonPreviewCopy(locale), labels = rt(locale);
  return (
    <section className="comparison-panel" data-comparison-preview>
      <h3>{m.title}</h3>
      <p>{m.pending}</p>
      <dl>
        <div><dt>{m.players}</dt><dd>—</dd></div>
        {game !== "ranking" && game !== "rather" && (
          <>
            {hasWinRate(game) && <div><dt>{game === "math" ? resultCopy(locale).exactCommunity : labels.successRate}</dt><dd>—</dd></div>}
            {(game === "word" || game === "rareword" || game === "guess") &&
              <div><dt>{labels.averageAttempts}</dt><dd>—</dd></div>}
          </>
        )}
      </dl>
    </section>
  );
}
