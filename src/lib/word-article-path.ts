import type { Locale } from "./types";
import { normalizeWord } from "./word-normalization";
export const articleSection: Record<Locale, string> = {fr: "mots", en: "words", es: "palabras", de: "woerter"};
export const wordSlug = (word: string) => normalizeWord(word).toLowerCase();
export const wordArticlePath = (locale: Locale, word: string) => `/${locale}/${articleSection[locale]}/${wordSlug(word)}`;
