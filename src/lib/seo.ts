import type { Metadata } from "next";
import { locales, isDifficulty, type Locale, type GameId } from "./types";
import { gamePath, t } from "./i18n";
import { seoCopy } from "./seo-content";
import { gameName } from "./registry";
import { dateLabel, utcDay } from "./date";
import { hasDaily, SINGLE_SUDOKU_FROM } from "./game-modes";
export { siteOrigin } from "./site-origin";
export function canonicalChallengeDate(game: GameId, date?: string, difficulty?: string) {
  const historicalSudokuLevel = game === "sudoku" && date && date < SINGLE_SUDOKU_FROM && difficulty && difficulty !== "easy";
  return date && (date !== utcDay() || !hasDaily(game) || historicalSudokuLevel) ? date : undefined;
}
export function canonicalGamePath(
  locale: Locale,
  game: GameId,
  date?: string,
  difficulty?: string,
) {
  return gamePath(
    locale,
    game,
    date,
    ((game === "sudoku" && !!date) || game === "mines" || game === "guess") &&
      difficulty !== "easy"
      ? difficulty
      : undefined,
  );
}
export function pageMetadata(
  locale: Locale,
  title: string,
  description: string,
  suffix = "",
  game?: GameId,
  date?: string,
  difficulty?: string,
): Metadata {
  const url = game
    ? canonicalGamePath(locale, game, date, difficulty)
    : `/${locale}${suffix}`;
  const localized = Object.fromEntries(
    locales.map((l) => [
      l,
      game ? canonicalGamePath(l, game, date, difficulty) : `/${l}${suffix}`,
    ]),
  );
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        ...localized,
        "x-default": localized.en,
      },
    },
    openGraph: {
      title,
      description,
      type: "website",
      url,
      siteName: "Puzzoria",
      locale: { en: "en_US", fr: "fr_FR", es: "es_ES", de: "de_DE" }[locale],
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map(
          (l) => ({ en: "en_US", fr: "fr_FR", es: "es_ES", de: "de_DE" })[l],
        ),
      images: [
        {
          url: `/${locale}/social-image`,
          width: 1200,
          height: 630,
          alt: seoCopy(locale).homeTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`/${locale}/social-image`],
    },
  };
}
export const homeMetadata = (locale: Locale) =>
  pageMetadata(
    locale,
    seoCopy(locale).homeTitle,
    seoCopy(locale).homeDescription,
  );
export function gameDescription(
  locale: Locale,
  game: GameId,
  date?: string,
  difficulty?: string,
) {
  const hasLevel = game === "mines" || game === "guess" || (game === "sudoku" && !!date);
  const level = difficulty && isDifficulty(difficulty) ? difficulty : "easy";
  const lead = hasLevel ? `${gameName(game, locale)} · ${t(locale)[level]}. ` : "";
  const archivedDate = canonicalChallengeDate(game, date, difficulty);
  return `${lead}${seoCopy(locale).games[game].description}${archivedDate ? ` ${dateLabel(archivedDate, locale)}.` : ""}`;
}
export function gameMetadata(
  locale: Locale,
  game: GameId,
  date?: string,
  difficulty?: string,
) {
  const copy = seoCopy(locale).games[game];
  const level =
    ((game === "sudoku" && !!date) || game === "mines" || game === "guess") && difficulty
      ? ` · ${t(locale)[difficulty as "easy" | "medium" | "hard"]}`
      : "";
  const archivedDate = canonicalChallengeDate(game, date, difficulty);
  return pageMetadata(
    locale,
    `${archivedDate ? `${gameName(game, locale)} · ${dateLabel(archivedDate, locale)}` : copy.title}${level} | Puzzoria`,
    gameDescription(locale, game, date, difficulty),
    "",
    game,
    archivedDate,
    difficulty,
  );
}
