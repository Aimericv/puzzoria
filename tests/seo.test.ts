import { afterEach, describe, expect, it, vi } from "vitest";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import {
  canonicalGamePath,
  gameMetadata,
  homeMetadata,
  siteOrigin,
} from "../src/lib/seo";
import { isPublicSiteOrigin, resolveSiteOrigin } from "../src/lib/site-origin";
import {
  gameStructuredData,
  homeStructuredData,
  jsonLd,
} from "../src/lib/structured-data";
import { localizedPath } from "../src/lib/locale-path";
import { locales } from "../src/lib/types";

afterEach(() => vi.useRealTimers());
describe("SEO canonicalization and international versions", () => {
  it.each(locales)("distinguishes difficulty pages without changing their canonical URLs in %s", (locale) => {
    for (const [game, date] of [["mines", undefined], ["guess", undefined], ["sudoku", "2026-10-01"], ["mines", "2026-10-01"], ["guess", "2026-10-01"]] as const) {
      const pages = (["easy", "medium", "hard"] as const).map(level => {
        const metadata = gameMetadata(locale, game, date, level);
        expect(metadata.alternates?.canonical).toBe(canonicalGamePath(locale, game, date, level));
        expect(gameStructuredData(locale, game, date, level)["@graph"][0].description).toBe(metadata.description);
        expect(metadata.openGraph?.description).toBe(metadata.description);
        expect(metadata.twitter?.description).toBe(metadata.description);
        return metadata;
      });
      expect(new Set(pages.map(page => page.description)).size).toBe(3);
    }
  });
  it.each(locales)(
    "publishes one Daily Sudoku and preserves old archive levels in %s",
    (locale) => {
      expect(canonicalGamePath(locale, "sudoku", undefined, "easy")).toBe(
        `/${locale}/sudoku`,
      );
      expect(canonicalGamePath(locale, "sudoku", "2026-10-01", "easy")).toBe(
        `/${locale}/sudoku/archive/2026-10-01`,
      );
      for (const level of ["medium", "hard"])
        expect(canonicalGamePath(locale, "sudoku", undefined, level)).toBe(
          `/${locale}/sudoku`,
        );
      const daily = gameMetadata(locale, "sudoku", undefined, "easy");
      expect(daily.alternates?.languages?.["x-default"]).toBe("/en/sudoku");
      expect(daily.alternates?.languages?.fr).toBe("/fr/sudoku");
      expect(homeMetadata(locale).alternates?.languages?.["x-default"]).toBe(
        "/en",
      );
    },
  );
  it("keeps the same archive date and difficulty across all alternatives", () => {
    const metadata = gameMetadata("fr", "sudoku", "2026-10-01", "hard");
    expect(metadata.alternates?.languages).toEqual({
      en: "/en/sudoku/archive/2026-10-01/hard",
      fr: "/fr/sudoku/archive/2026-10-01/hard",
      es: "/es/sudoku/archive/2026-10-01/hard",
      de: "/de/sudoku/archive/2026-10-01/hard",
      "x-default": "/en/sudoku/archive/2026-10-01/hard",
    });
    expect(
      gameMetadata("de", "word", "2026-10-01").alternates?.languages?.es,
    ).toBe("/es/palabra/archive/2026-10-01");
  });
  it("treats an archive alias for today as the daily page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    expect(gameMetadata("fr", "word", "2026-10-03").alternates?.canonical).toBe(
      "/fr/mot",
    );
    expect(
      gameStructuredData("fr", "word", "2026-10-03")["@graph"][0].url,
    ).toBe(`${siteOrigin}/fr/mot`);
  });
  it("preserves today's historical Sudoku level while the base page has one grid", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const path = "/fr/sudoku/archive/2026-10-04/hard";
    expect(gameMetadata("fr", "sudoku", "2026-10-04", "hard").alternates?.canonical).toBe(path);
    expect(gameStructuredData("fr", "sudoku", "2026-10-04", "hard")["@graph"][0].url).toBe(`${siteOrigin}${path}`);
  });
  it("publishes only canonical URLs with reciprocal hreflang in the sitemap", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    const entries = sitemap();
    expect(entries).toHaveLength(684);
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(
      entries.length,
    );
    for (const entry of entries) {
      expect(entry.url).not.toMatch(
        /\/easy$|\/practice|\/account|\/stats|\/leaderboards|archive\/2026-10-03/,
      );
      const languages = entry.alternates?.languages;
      expect(Object.keys(languages ?? {})).toHaveLength(5);
      expect(languages?.["x-default"]).toBe(languages?.en);
      for (const locale of locales) {
        const counterpart = entries.find(
          (other) => other.url === languages?.[locale],
        );
        expect(counterpart?.alternates?.languages).toEqual(languages);
      }
    }
    expect(
      entries.some((entry) =>
        entry.url.endsWith("/fr/sudoku/archive/2026-10-01/hard"),
      ),
    ).toBe(true);
  });
  it("keeps unlimited landing pages indexable without publishing new daily archive URLs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    const entries = sitemap();
    for (const game of [
      "2048",
      "wordsearch",
      "ranking",
      "guess",
      "rather",
    ] as const) {
      const path = canonicalGamePath("fr", game);
      expect(
        entries.find((entry) => entry.url === siteOrigin + path)
          ?.changeFrequency,
      ).toBe("monthly");
      expect(
        entries.some((entry) =>
          entry.url.startsWith(siteOrigin + path + "/archive/2026-10-05"),
        ),
      ).toBe(false);
      expect(
        entries.some(
          (entry) => entry.url === siteOrigin + path + "/archive/2026-10-03",
        ),
      ).toBe(true);
      expect(
        gameMetadata("fr", game).alternates?.languages?.["x-default"],
      ).toBe(canonicalGamePath("en", game));
    }
  });
  it("keeps current Daily coverage and reciprocal alternatives after historical games leave the rolling window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));
    const entries = sitemap();
    const byUrl = new Map(entries.map(entry => [entry.url, entry]));
    expect(byUrl.size).toBe(entries.length);
    for (const locale of locales) {
      for (const game of ["word", "rareword", "sudoku", "math", "mines"] as const) {
        for (const date of [undefined, "2026-10-05", "2026-11-04"]) {
          const path = canonicalGamePath(locale, game, date);
          expect(byUrl.has(siteOrigin + path), path).toBe(true);
        }
        expect(byUrl.has(siteOrigin + canonicalGamePath(locale, game, "2026-10-04"))).toBe(false);
        expect(byUrl.has(siteOrigin + canonicalGamePath(locale, game, "2026-11-05"))).toBe(false);
      }
      for (const game of ["2048", "wordsearch", "ranking", "guess", "rather"] as const) {
        expect(byUrl.has(siteOrigin + canonicalGamePath(locale, game))).toBe(true);
        expect(entries.some(entry => entry.url.startsWith(siteOrigin + canonicalGamePath(locale, game) + "/archive/"))).toBe(false);
      }
    }
    for (const entry of entries) {
      expect(entry.url).not.toMatch(/\/easy$|\/practice|\/account|\/stats|\/leaderboards|[?#]/);
      const languages = entry.alternates?.languages;
      expect(languages?.["x-default"]).toBe(languages?.en);
      for (const url of Object.values(languages ?? {})) {
        expect(byUrl.get(String(url))?.alternates?.languages).toEqual(languages);
      }
    }
  });
  it("advances the archive window at UTC midnight while retaining the Daily landing page", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T23:59:59.999Z"));
    const before = new Set(sitemap().map(entry => entry.url));
    vi.setSystemTime(new Date("2026-11-02T00:00:00Z"));
    const after = new Set(sitemap().map(entry => entry.url));
    for (const locale of locales) {
      const url = (date?: string) => siteOrigin + canonicalGamePath(locale, "word", date);
      expect(before.has(url())).toBe(true);
      expect(after.has(url())).toBe(true);
      expect(before.has(url("2026-11-01"))).toBe(false);
      expect(after.has(url("2026-11-01"))).toBe(true);
      expect(before.has(url("2026-10-01"))).toBe(true);
      expect(after.has(url("2026-10-01"))).toBe(false);
    }
  });
  it("lets robots fetch noindex pages and rendering endpoints", () => {
    expect(robots().rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [],
    });
  });
  it("translates links without losing mode, date or level", () => {
    expect(localizedPath("/fr/mot/archive/2026-10-01", "fr", "de")).toBe(
      "/de/wort/archive/2026-10-01",
    );
    expect(localizedPath("/es/numeros/practice", "es", "en")).toBe(
      "/en/numbers/practice",
    );
    expect(localizedPath("/de/sudoku/hard", "de", "fr")).toBe(
      "/fr/sudoku/hard",
    );
  });
});
describe("public domain preflight", () => {
  it("normalizes origins and rejects URLs that would corrupt metadata", () => {
    expect(resolveSiteOrigin(" https://dailygrid.fr/ ")).toBe(
      "https://dailygrid.fr",
    );
    expect(resolveSiteOrigin()).toBe("http://localhost:3000");
    for (const value of [
      "file:///tmp",
      "https://dailygrid.fr/fr",
      "https://dailygrid.fr?x=1",
      "https://user:pass@dailygrid.fr",
      "https://dailygrid.fr/#section",
    ])
      expect(() => resolveSiteOrigin(value)).toThrow();
  });
  it.each([
    "http://localhost:3000",
    "https://127.0.0.1",
    "https://192.168.1.10",
    "https://172.20.1.2",
    "https://[::1]",
    "https://dailygrid.local",
    "https://your-domain.example",
    "https://dailygrid.example.com",
  ])("keeps %s out of the public index", (origin) => {
    expect(isPublicSiteOrigin(origin)).toBe(false);
  });
  it("accepts an HTTPS public hostname", () =>
    expect(isPublicSiteOrigin("https://dailygrid.fr")).toBe(true));
});
describe("structured data", () => {
  it("escapes HTML script delimiters while preserving JSON values", () => {
    const value = { text: "</script><script>alert('x')</script>" };
    expect(jsonLd(value)).not.toContain("<");
    expect(JSON.parse(jsonLd(value))).toEqual(value);
  });
  it("uses the canonical archive and level in breadcrumb links", () => {
    const graph = gameStructuredData("fr", "sudoku", "2026-10-01", "easy")[
      "@graph"
    ];
    expect(graph[0].url).toBe(`${siteOrigin}/fr/sudoku/archive/2026-10-01`);
    expect(graph[1].itemListElement?.map((item) => item.item)).toEqual([
      `${siteOrigin}/fr`,
      `${siteOrigin}/fr/sudoku`,
      `${siteOrigin}/fr/sudoku/archive/2026-10-01`,
    ]);
    expect(jsonLd(graph)).not.toMatch(/aggregateRating|Review|FAQPage/);
  });
  it("identifies eleven games with Word variants in one catalogue entry", () => {
    const graph = homeStructuredData("es")["@graph"];
    expect(graph[0].inLanguage).toEqual(["en", "fr", "es", "de"]);
    expect(
      graph[1].mainEntity?.itemListElement.map((item) => item.url),
    ).toEqual([
      `${siteOrigin}/es/palabra`,
      `${siteOrigin}/es/sudoku`,
      `${siteOrigin}/es/numeros`,
      `${siteOrigin}/es/2048`,
      `${siteOrigin}/es/buscaminas`,
      `${siteOrigin}/es/sopa-de-letras`,
      `${siteOrigin}/es/ranking-a-ciegas`,
      `${siteOrigin}/es/adivina-el-numero`,
      `${siteOrigin}/es/que-prefieres`,
      `${siteOrigin}/es/quiz`,
      `${siteOrigin}/es/adivina-el-futbolista`,
    ]);
  });
});
