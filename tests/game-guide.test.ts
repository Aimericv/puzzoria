import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameGuide } from "../src/components/game-guide";
import { locales, type GameId, type Locale } from "../src/lib/types";
import { wordArticles } from "../src/lib/server/word-articles";
import { wordArticlePath } from "../src/lib/word-article-path";

afterEach(() => vi.useRealTimers());

function articleLinks(locale: Locale, game: GameId = "rareword") {
  const html = renderToStaticMarkup(createElement(GameGuide, { locale, game }));
  return Array.from(html.matchAll(/href="([^"]+)"/g), match => match[1]);
}

describe("published vocabulary discovery in game guides", () => {
  it.each(locales)("reveals %s article links only after their UTC publication day", locale => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T23:59:59Z"));
    expect(articleLinks(locale)).toEqual([]);

    vi.setSystemTime(new Date("2026-10-05T00:00:00Z"));
    const articles = wordArticles(locale);
    expect(articleLinks(locale)).toEqual([wordArticlePath(locale, articles[0].word)]);

    vi.setSystemTime(new Date("2026-10-06T00:00:00Z"));
    expect(articleLinks(locale)).toEqual(articles.slice(0, 2).map(a => wordArticlePath(locale, a.word)));
  });

  it.each(locales)("keeps all eight published %s articles reachable at stable public URLs", locale => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-26T12:00:00Z"));
    const links = articleLinks(locale);
    expect(links).toEqual(wordArticles(locale).map(a => wordArticlePath(locale, a.word)));
    expect(new Set(links).size).toBe(8);
    expect(links.every(link => !link.includes("?"))).toBe(true);
    expect(articleLinks(locale, "word")).toEqual([]);
    expect(articleLinks(locale, "sudoku")).toEqual([]);
  });
});
