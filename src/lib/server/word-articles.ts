import articles from "../../../content/rare-words/articles.json" with {type: "json"};
import catalog from "../../../content/rare-words/catalog.json" with {type: "json"};
import { DAY_MS, utcDay } from "../date";
import { locales, type Locale } from "../types";
import { wordSlug, wordArticlePath } from "../word-article-path";
import { ownedRun } from "./play";
import type { Identity } from "./auth";
type ArticleDetails = {concept: string; pronunciation: string; grammar: string; definition: string[]; etymology: string; examples: string[]; related: string[]; nuance: string; anecdote: string; sources: string[]};
const details: Record<Locale, Record<string, ArticleDetails>> = articles;

export function wordArticles(locale: Locale) {
  return catalog[locale].map((entry, i) => {
    const slug = wordSlug(entry.word);
    const article = details[locale][slug];
    if (!article) throw new Error(`Missing word article: ${locale}/${slug}`);
    // The first eight Daily answers are frozen. Publish the article after that day ends.
    const publicFrom = utcDay(new Date(Date.parse(catalog.startsAt) + (i + 1) * DAY_MS));
    return {...entry, ...article, summary: entry.definition, slug, locale, publicFrom};
  });
}
export type WordArticle = ReturnType<typeof wordArticles>[number];
export const publishedWordArticles = (locale: Locale, today = utcDay()) => wordArticles(locale).filter(a => a.publicFrom <= today);
export function findWordArticle(locale: Locale, slug: string) {return wordArticles(locale).find(a => a.slug === slug);}
export function canReadWordArticle(article: WordArticle, runId?: string, who?: Identity, today = utcDay()) {
  if (article.publicFrom <= today) return true;
  if (!runId || !who) return false;
  try {
    const run = ownedRun(runId, who);
    if (run.game !== "rareword" || !run.response_json) return false;
    const challenge = JSON.parse(run.challenge_json);
    return challenge.locale === article.locale && wordSlug(challenge.answer) === article.slug;
  } catch {return false;}
}
export function articleAlternatives(article: WordArticle, today = utcDay()) {
  const matching = locales.flatMap(locale => publishedWordArticles(locale, today).filter(a => a.concept === article.concept));
  return Object.fromEntries(matching.map(a => [a.locale, wordArticlePath(a.locale, a.word)]));
}
