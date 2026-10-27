import { test, expect } from "@playwright/test";
import { locales } from "../src/lib/types";
import { slugs } from "../src/lib/i18n";
import { seoCopy } from "../src/lib/seo-content";
import articleCatalog from "../content/rare-words/catalog.json" with { type: "json" };
import { wordArticleCopy } from "../src/lib/word-article-i18n";
import { wordArticlePath } from "../src/lib/word-article-path";
import { previousDay, utcDay, DAY_MS } from "../src/lib/date";

test("four languages expose usable HTML and canonical alternatives without JavaScript", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    userAgent: "Googlebot",
  });
  const page = await context.newPage();
  try {
    for (const locale of locales) {
      expect((await page.goto(`/${locale}`))?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page).toHaveTitle(seoCopy(locale).homeTitle);
      await expect(page.locator(".language-links a")).toHaveCount(4);
      await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(
        5,
      );
      await expect(page.locator('link[hreflang="x-default"]')).toHaveAttribute(
        "href",
        /\/en$/,
      );
      // The domain is intentionally still local; launch preflight switches this at the public origin.
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
      const homeGraph = JSON.parse(
        (await page
          .locator('script[type="application/ld+json"]')
          .textContent()) ?? "{}",
      );
      expect(homeGraph["@graph"][0]["@type"]).toBe("WebSite");
      for (const game of ["word", "rareword", "sudoku", "math", "2048", "mines", "wordsearch"] as const) {
        expect(
          (await page.goto(`/${locale}/${slugs[locale][game]}`))?.status(),
        ).toBe(200);
        const sections = seoCopy(locale).games[game].sections;
        expect(sections.length).toBeGreaterThanOrEqual(3);
        const guide = page.locator("[data-seo-guide]");
        const ruleSections = guide.locator(":scope > section:not([data-published-word-articles])");
        await expect(ruleSections).toHaveCount(sections.length);
        await expect(ruleSections.locator("h2")).toHaveText(
          sections.map((section) => section.title),
        );
        await expect(ruleSections.locator("p")).toHaveText(
          sections.map((section) => section.text),
        );
        const published = game === "rareword"
          ? articleCatalog[locale].filter((_, index) => utcDay(new Date(Date.parse(articleCatalog.startsAt) + (index + 1) * DAY_MS)) <= utcDay())
          : [];
        const discovery = guide.locator("[data-published-word-articles]");
        await expect(discovery).toHaveCount(published.length ? 1 : 0);
        if (published.length) {
          await expect(discovery.locator("h2")).toHaveText(wordArticleCopy(locale).collection);
          await expect(discovery.locator("p")).toHaveText(wordArticleCopy(locale).publishedIntro);
          await expect(discovery.locator("a")).toHaveText(published.map(article => wordArticleCopy(locale).title.replace("{word}", article.word)));
          expect(await discovery.locator("a").evaluateAll(links => links.map(link => link.getAttribute("href")))).toEqual(published.map(article => wordArticlePath(locale, article.word)));
        }
        await expect(page.locator("[data-game-preview]")).toBeVisible();
        expect(await page.locator("noscript").textContent()).toContain(
          seoCopy(locale).noScript,
        );
        if (game === "sudoku") {
          await expect(page.locator(".preview-sudoku span")).toHaveCount(81);
          expect(
            (await page.locator(".preview-sudoku").innerText()).replace(
              /\s/g,
              "",
            ),
          ).toMatch(/[1-9]/);
        }
        if (game === "math")
          await expect(page.locator(".preview-numbers span")).toHaveCount(6);
        const graph = JSON.parse(
          (await page
            .locator('script[type="application/ld+json"]')
            .textContent()) ?? "{}",
        );
        expect(graph["@graph"][1]["@type"]).toBe("BreadcrumbList");
      }
    }
  } finally {
    await context.close();
  }
});

test("archive aliases, sitemap, noindex and missing pages agree", async ({
  browser,
  request,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL,
    userAgent: "Googlebot",
  });
  const page = await context.newPage();
  const yesterday = previousDay(utcDay());
  try {
    await page.goto(`/fr/sudoku/archive/${yesterday}/easy`);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/fr/sudoku/archive/${yesterday}$`),
    );
    await expect(page.locator('link[hreflang="de"]')).toHaveAttribute(
      "href",
      new RegExp(`/de/sudoku/archive/${yesterday}$`),
    );
    await page.goto("/fr/sudoku/easy");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      /\/fr\/sudoku$/,
    );
    for (const path of [
      "/fr/account",
      "/fr/stats",
      "/fr/leaderboards",
      "/fr/mot/practice",
    ]) {
      await page.goto(path);
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
    expect(
      (
        await request.get("/fr/mot/archive/2099-01-01", {
          headers: { "User-Agent": "Googlebot" },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.get("/fr/inexistant", {
          headers: { "User-Agent": "Googlebot" },
        })
      ).status(),
    ).toBe(404);
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain(`/${yesterday}/hard`);
    expect(xml).not.toMatch(
      /\/easy<|\/practice|\/account|\/stats|\/leaderboards/,
    );
    expect(xml).toContain('hreflang="x-default"');
    const txt = await (await request.get("/robots.txt")).text();
    expect(txt).toContain("Allow: /");
    expect(txt).not.toContain("Disallow: /");
    const api = await request.get(`/api/challenges/fr/word?date=${utcDay()}`);
    expect(api.status()).toBe(200);
    expect(api.headers()["x-robots-tag"]).toBe("noindex");
  } finally {
    await context.close();
  }
});

test("localized social previews return real 1200 by 630 PNGs", async ({
  request,
}) => {
  for (const locale of locales) {
    const response = await request.get(`/${locale}/social-image`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBe(1200);
    expect(bytes.readUInt32BE(20)).toBe(630);
  }
});
