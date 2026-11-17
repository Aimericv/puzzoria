import type { Locale } from "./types";

export const footballProfileSection = {
  en: "football-players",
  fr: "footballeurs",
  es: "futbolistas",
  de: "fussballspieler",
} satisfies Record<Locale, string>;

export function footballProfilePath(locale: Locale, slug: string) {
  return `/${locale}/${footballProfileSection[locale]}/${slug}`;
}
