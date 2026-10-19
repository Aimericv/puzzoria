import type { Completion, LetterState, Locale } from "./types";
import { t } from "./i18n";
import { gameName } from "./registry";
import { rt } from "./retention-i18n";
export function shareSummary(
  completion: Completion,
  locale: Locale,
  origin: string,
  rows: LetterState[][] = [],
): string {
  const m = t(locale);
  const heading = `Puzzoria · ${gameName(completion.game, locale)} · ${completion.mode === "practice" ? rt(locale).practice : completion.date}`;
  const info =
    (completion.game === "word" || completion.game === "rareword")
      ? `${completion.success ? completion.attempts : "X"}/${completion.maxAttempts ?? 6}`
      : completion.game === "2048"
        ? `${m.score}: ${completion.score}`
        : completion.game === "math"
          ? `${m.score}: ${completion.score}/1000`
          : `${m.timer}: ${Math.floor(completion.duration / 60)}:${String(completion.duration % 60).padStart(2, "0")}`;
  const visual =
    (completion.game === "word" || completion.game === "rareword")
      ? rows
          .map((row) =>
            row
              .map(
                (state) =>
                  ({ correct: "🟩", present: "🟨", absent: "⬜" })[state],
              )
              .join(""),
          )
          .join("\n")
      : completion.success
        ? "🟦🟦🟦 🏁"
        : "🟦⬜⬜";
  const difficulty =
    completion.game === "sudoku" || completion.game === "mines"
      ? `&difficulty=${completion.difficulty ?? completion.challengeId.split(":").at(-1)}`
      : "";
  // Unlocalized entry point resolves the recipient's locale before redirecting to the dated challenge.
  return `${heading}\n${info}\n${visual}\n${origin}/play/${completion.game}?${completion.mode === "practice" ? "mode=practice" : `date=${completion.date}`}${difficulty}`;
}
