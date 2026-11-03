import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { FootballDiscovery } from "../src/components/football-discovery";
import { gameIds, locales, type GameId, type Locale } from "../src/lib/types";
import { quizTopics } from "../src/lib/knowledge-catalog";
import { localizedPath } from "../src/lib/locale-path";
import sitemap from "../src/app/sitemap";
import { siteOrigin } from "../src/lib/site-origin";

afterEach(() => vi.useRealTimers());

const paths = {
  en: ["/en/guess-the-football-player", "/en/quiz/world-cup-winners-1930-2022"],
  fr: ["/fr/devine-le-footballeur", "/fr/quiz/vainqueurs-coupe-du-monde-1930-2022"],
  es: ["/es/adivina-el-futbolista", "/es/quiz/campeones-mundial-1930-2022"],
  de: ["/de/fussballspieler-erraten", "/de/quiz/fussball-weltmeister-1930-2022"],
};

function render(locale: Locale, game: GameId, quizCategory?: string) {
  return renderToStaticMarkup(createElement(FootballDiscovery, { locale, game, quizCategory }));
}

it.each(locales)("connects both football formats through stable translated public URLs in %s", locale => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-03T12:00:00Z"));
  const entries = sitemap();
  const cases = [
    [render(locale, "football"), paths[locale][1]],
    [render(locale, "quiz", "world-cup"), paths[locale][0]],
  ];
  for (const [html, path] of cases) {
    expect(html).toContain("<h2>");
    const links = Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g));
    expect(links).toHaveLength(1);
    expect(links[0][1]).toBe(path);
    expect(links[0][2].trim().length).toBeGreaterThan(10);
    expect(path).not.toMatch(/practice|archive|\?|#/);
    const entry = entries.find(e => e.url === siteOrigin + path);
    expect(entry).toBeDefined();
    for (const next of locales) {
      expect(entry?.alternates?.languages?.[next]).toBe(siteOrigin + localizedPath(path, locale, next));
    }
    expect(entry?.alternates?.languages?.["x-default"]).toBe(siteOrigin + localizedPath(path, locale, "en"));
  }
  expect(render(locale, "football")).toContain("1930");
  expect(render(locale, "football")).toContain("2022");
  expect(render(locale, "football")).toContain("60");
});

it.each(locales)("keeps the football bridge scoped to the two related pages in %s", locale => {
  for (const game of gameIds.filter(g => g !== "football")) {
    expect(render(locale, game)).toBe("");
  }
  for (const topic of quizTopics.filter(t => t.id !== "world-cup")) {
    expect(render(locale, "quiz", topic.id)).toBe("");
  }
  expect(render(locale, "quiz", "unknown")).toBe("");
});
