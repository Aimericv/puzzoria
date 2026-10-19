import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { locales } from "../src/lib/types";
import { wordArticles, publishedWordArticles, articleAlternatives, canReadWordArticle, findWordArticle } from "../src/lib/server/word-articles";
import { wordArticlePath } from "../src/lib/word-article-path";
import { localizedPath } from "../src/lib/locale-path";
import { closeDatabase } from "../src/lib/server/database";
import { createRun, beginRun, submitRun, ownedRun } from "../src/lib/server/play";
import type { Identity } from "../src/lib/server/auth";
import sitemap from "../src/app/sitemap";
const who: Identity = {user: null, guestId: "article-owner", owner: "g:article-owner"};
beforeEach(() => {
  closeDatabase(); vi.stubEnv("DAILYGRID_DB_PATH", ":memory:");
  vi.useFakeTimers({toFake: ["Date"]}); vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
});
afterEach(() => {closeDatabase(); vi.useRealTimers(); vi.unstubAllEnvs();});
describe("unusual word discovery articles", () => {
  it.each(locales)("covers every %s word with a full sourced article without changing the short definition", locale => {
    const entries = wordArticles(locale); expect(entries).toHaveLength(8);
    for (const a of entries) {
      expect(a.definition.length).toBeGreaterThanOrEqual(2); expect(a.examples.length).toBeGreaterThanOrEqual(2);
      expect(a.definition.join(" ").length).toBeGreaterThan(a.summary.length);
      expect(a.etymology.length).toBeGreaterThan(50); expect(a.anecdote.length).toBeGreaterThan(50);
      expect(a.pronunciation).toBeTruthy(); expect(a.related.length).toBeGreaterThanOrEqual(2);
      expect(a.sources.every(url => new URL(url).protocol === "https:")).toBe(true);
      expect(localizedPath(wordArticlePath(locale, a.word), locale, "en")).toBe("/en/unusual-word");
    }
  });
  it("does not publish today's or future answers through articles or the sitemap", () => {
    expect(locales.flatMap(l => publishedWordArticles(l))).toHaveLength(0);
    expect(sitemap().some(e => /\/(mots|words|palabras|woerter)\//.test(e.url))).toBe(false);
    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    for (const locale of locales) expect(publishedWordArticles(locale).map(a => a.slug)).toEqual([wordArticles(locale)[0].slug]);
    expect(sitemap().filter(e => /\/(mots|words|palabras|woerter)\//.test(e.url))).toHaveLength(4);
  });
  it("unlocks a private article only after its owner completes the matching word", async () => {
    const run = await createRun({game: "rareword", locale: "fr", mode: "daily"}, who);
    const c = JSON.parse(ownedRun(run.runId, who).challenge_json), article = findWordArticle("fr", c.answer.toLowerCase())!;
    expect(canReadWordArticle(article, run.runId, who)).toBe(false);
    beginRun(run.runId, who); vi.setSystemTime(new Date(Date.now() + 30000));
    submitRun(run.runId, who, {guesses: [c.answer]});
    expect(canReadWordArticle(article, run.runId, who)).toBe(true);
    expect(canReadWordArticle(article, run.runId, {...who, owner: "g:another"})).toBe(false);
    expect(canReadWordArticle(wordArticles("fr")[1], run.runId, who)).toBe(false);
    expect(canReadWordArticle(wordArticles("de")[0], run.runId, who)).toBe(false);
    expect(canReadWordArticle(article)).toBe(false);
    expect(canReadWordArticle(article, undefined, undefined, "2026-10-05")).toBe(true);
  });
  it("publishes canonical article URLs and reciprocal alternatives only for matching concepts", () => {
    vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
    const articles = locales.flatMap(l => publishedWordArticles(l));
    const entries = sitemap().filter(e => /\/(mots|words|palabras|woerter)\//.test(e.url));
    expect(entries).toHaveLength(32); expect(new Set(entries.map(e => e.url)).size).toBe(32);
    for (const article of articles) {
      const entry = entries.find(e => new URL(e.url).pathname === wordArticlePath(article.locale, article.word))!;
      expect(entry.url).not.toContain("?");
      const alternatives = articleAlternatives(article);
      for (const [locale, path] of Object.entries(alternatives)) {
        const other = articles.find(a => a.locale === locale && wordArticlePath(a.locale, a.word) === path)!;
        expect(other.concept).toBe(article.concept); expect(articleAlternatives(other)[article.locale]).toBe(wordArticlePath(article.locale, article.word));
      }
      expect(entry.alternates?.languages?.["x-default"]).toBe(entry.alternates?.languages?.en);
    }
  });
});
