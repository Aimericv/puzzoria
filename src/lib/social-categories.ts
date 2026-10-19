import definitions from "../../content/social/categories.json" with { type: "json" };
import type { Locale } from "./types";
export function categoriesFor(game: "ranking" | "rather") {
  return Object.entries(definitions)
    .filter(([, d]) => d.games.includes(game))
    .map(([id]) => id);
}
export function categoryLabel(id: string, locale: Locale) {
  return (
    (definitions as Record<string, { labels: Record<Locale, string> }>)[id]
      ?.labels[locale] ?? id
  );
}
export function validSocialCategory(
  id: unknown,
  game: "ranking" | "rather",
): id is string {
  return typeof id === "string" && categoriesFor(game).includes(id);
}
