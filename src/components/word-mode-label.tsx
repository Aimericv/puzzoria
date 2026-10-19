import type { Locale, PublicChallenge } from "@/lib/types";
import { dateLabel, utcDay } from "@/lib/date";
import { pg } from "@/lib/post-game-i18n";
import { rt } from "@/lib/retention-i18n";
import { rareWordCopy } from "@/lib/rare-word-i18n";
import { lt } from "@/lib/live-i18n";

export const dailyWordLabel = (locale: Locale) =>
  ({
    en: "Word of the day",
    fr: "Mot du jour",
    es: "Palabra del día",
    de: "Wort des Tages",
  })[locale];

export function WordModeLabel({
  challenge,
  locale,
}: {
  challenge: PublicChallenge;
  locale: Locale;
}) {
  const daily =
    !challenge.friendId &&
    (challenge.mode ?? "daily") === "daily" &&
    challenge.date === utcDay();
  return (
    <p
      className="word-mode-label"
      data-word-mode={daily ? "daily" : (challenge.mode ?? "archive")}
    >
      <strong>
        {challenge.roomId ? lt(locale).title : challenge.friendId
          ? pg(locale).friend
          : daily
            ? challenge.kind === "rareword" ? rareWordCopy(locale).dailyLabel : dailyWordLabel(locale)
            : challenge.mode === "practice"
              ? rt(locale).practice
              : rt(locale).archiveMode}
      </strong>
      {challenge.mode !== "practice" && !challenge.friendId && (
        <span>{dateLabel(challenge.date, locale)}</span>
      )}
      {challenge.kind === "rareword" && <span>{rareWordCopy(locale).format.replace("{n}", String(challenge.length)).replace("{attempts}", String(challenge.attempts))}</span>}
    </p>
  );
}
