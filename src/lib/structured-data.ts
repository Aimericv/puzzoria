import { siteOrigin } from "./site-origin";
import { canonicalGamePath, canonicalChallengeDate, gameDescription } from "./seo";
import { gameName } from "./registry";
import { catalogGameIds, type GameId, type Locale } from "./types";
import { seoCopy } from "./seo-content";
import { dateLabel } from "./date";
export const jsonLd = (value: unknown) =>
  JSON.stringify(value).replace(/</g, "\\u003c");
const absolute = (path: string) => `${siteOrigin}${path}`;
export function homeStructuredData(locale: Locale, availableGames: readonly GameId[] = catalogGameIds) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteOrigin}/#website`,
        url: `${siteOrigin}/`,
        name: "Puzzoria",
        alternateName: "puzzoria",
        inLanguage: ["en", "fr", "es", "de"],
        publisher: { "@type": "Organization", name: "Puzzoria", logo: absolute("/puzzoria-logo.svg") },
      },
      {
        "@type": "CollectionPage",
        "@id": absolute(`/${locale}#page`),
        url: absolute(`/${locale}`),
        name: seoCopy(locale).homeTitle,
        description: seoCopy(locale).homeDescription,
        inLanguage: locale,
        isPartOf: { "@id": `${siteOrigin}/#website` },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: availableGames.map((game, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: gameName(game, locale),
            url: absolute(canonicalGamePath(locale, game)),
          })),
        },
      },
    ],
  };
}
export function gameStructuredData(
  locale: Locale,
  game: GameId,
  date?: string,
  difficulty?: string,
) {
  const canonicalDate = canonicalChallengeDate(game, date, difficulty);
  const path = canonicalGamePath(locale, game, canonicalDate, difficulty);
  const crumbs = [
    { name: "Puzzoria", item: absolute(`/${locale}`) },
    {
      name: gameName(game, locale),
      item: absolute(canonicalGamePath(locale, game, undefined, difficulty)),
    },
  ];
  if (canonicalDate)
    crumbs.push({
      name: dateLabel(canonicalDate, locale),
      item: absolute(path),
    });
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": absolute(`${path}#page`),
        url: absolute(path),
        name: gameName(game, locale),
        description: gameDescription(locale, game, date, difficulty),
        inLanguage: locale,
        isPartOf: { "@id": `${siteOrigin}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: crumbs.map((crumb, i) => ({
          "@type": "ListItem",
          position: i + 1,
          ...crumb,
        })),
      },
    ],
  };
}
