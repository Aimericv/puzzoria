import { test, expect, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { generateChallenge } from "../src/lib/challenges";
import { normalizeWord } from "../src/lib/word-normalization";
import { utcDay } from "../src/lib/date";
import { et } from "../src/lib/engagement-i18n";
import { rt } from "../src/lib/retention-i18n";
import { pg } from "../src/lib/post-game-i18n";
import { dailyWordLabel } from "../src/components/word-mode-label";
import { comparisonPreviewCopy } from "../src/lib/comparison-preview-i18n";
import { t, gamePath } from "../src/lib/i18n";
import { practicePath } from "../src/lib/play-path";
import type { PublicChallenge, Locale } from "../src/lib/types";
import {
  recordUnhandledRejections,
  unhandledRejections,
  isWebKitFetchDiagnostic,
} from "./browser-errors";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, browserName }) => {
  await recordUnhandledRejections(page);
  errors.set(page, []);
  page.on("pageerror", (error) => {
    if (!isWebKitFetchDiagnostic(error, browserName))
      errors.get(page)!.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.get(page)!.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(await unhandledRejections(page)).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});
async function guess(page: Page, word: string, locale: Locale = "fr") {
  await expect(page.locator(".touch-keyboard .wide-key").first()).toBeEnabled();
  await page.locator(".word-board").focus();
  await page.keyboard.type(normalizeWord(word));
  await page
    .getByRole("button", { name: t(locale).enter, exact: true })
    .click();
}
async function cachedPractice(page: Page, game: "word" | "math") {
  const key = `dailygrid:practice:${game}:fr:easy`;
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "null")?.challenge ?? null,
        key,
      ),
    )
    .not.toBeNull();
  return page.evaluate(
    (key) =>
      JSON.parse(localStorage.getItem(key)!).challenge as PublicChallenge,
    key,
  );
}
test("favorite persists, unfinished play resumes and activity records unlimited wins", async ({
  page,
}) => {
  await page.goto("/fr", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Favori · Le Compte" }).click();
  await expect(page.locator(".game-card").first()).toHaveClass(/math/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".game-card").first()).toHaveClass(/math/);
  await page.goto("/fr/mot/practice");
  const challenge = await cachedPractice(page, "word");
  const full = generateChallenge(
    "word",
    "fr",
    challenge.date,
    "easy",
    challenge.id.split(":")[2],
  );
  if (full.kind !== "word") throw new Error();
  await expect(page.locator(".touch-keyboard .wide-key").first()).toBeEnabled();
  await page.locator(".word-board").focus();
  await page.keyboard.type("AIM");
  await page.getByRole("link", { name: "Jeux", exact: true }).click();
  await page.locator(".resume-game").click();
  await expect(page.locator(".word-row").first()).toHaveText("AIM");
  await page.locator(".word-board").focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Delete");
  await guess(page, full.answer);
  await expect(page.locator("[data-personal-progress]")).toContainText(
    "Première victoire",
  );
  await page.getByRole("link", { name: "Jeux", exact: true }).click();
  await expect(page.locator(".resume-game")).toHaveCount(0);
  await expect(page.locator(".activity-calendar li.played")).toHaveCount(1);
  await expect(page.locator(".activity-calendar li")).toHaveCount(28);
  await expect(page.locator(".progress-count")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("a guest shares a Word result beside statistics and compares the exact puzzle with a friend", async ({
  page,
  browser,
  browserName,
}, info) => {
  await page.goto("/fr/mot", { waitUntil: "networkidle" });
  const full = generateChallenge("word", "fr", utcDay());
  if (full.kind !== "word") throw new Error();
  await guess(page, full.answer);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async ({ text }: { text: string }) => {
        sessionStorage.setItem("test:shared-result", text);
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  });
  await page.getByRole("button", { name: t("fr").share, exact: true }).click();
  const sharedText = await page.evaluate(() =>
    sessionStorage.getItem("test:shared-result"),
  );
  expect(sharedText).toContain("1/6");
  expect(sharedText).toContain("🟩🟩🟩🟩🟩");
  expect(sharedText).toContain("/play/word?date=");
  await expect(
    page.getByRole("button", { name: et("fr").shareImage, exact: true }),
  ).toHaveCount(0);
  // Preserve already shared asynchronous invitations; the visible button now opens a live duel.
  const runId = await page.evaluate(id => JSON.parse(localStorage.getItem(`dailygrid:run:${id}`)!), full.id);
  const invitation = await page.request.post("/api/friends", {data:{action:"create",runId}});
  expect(invitation.ok()).toBe(true);
  const id = (await invitation.json()).id, url = `http://127.0.0.1:3100/fr/friend/${id}`;
  // Invitation previews retain their spoiler-free poster without a second share button.
  const response = await page.request.get(
    `/api/share-image?id=${id}&locale=fr`,
  );
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const png = await response.body();
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
  await info.attach("result-poster", { body: png, contentType: "image/png" });
  await writeFile(info.outputPath("word-poster.png"), png);
  const peerContext = await browser.newContext({
    baseURL: "http://127.0.0.1:3100",
    viewport: info.project.use.viewport,
    extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.21" },
  });
  try {
    const peer = await peerContext.newPage();
    await recordUnhandledRejections(peer);
    const peerErrors: string[] = [];
    peer.on("pageerror", (error) => {
      if (!isWebKitFetchDiagnostic(error, browserName))
        peerErrors.push(error.message);
    });
    await peer.goto(url, { waitUntil: "networkidle" });
    await expect(peer.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    const publicView = await (
      await peer.request.get(`/api/friends?id=${id}`)
    ).json();
    expect(publicView.you).toBeNull();
    expect(publicView.challenge).not.toHaveProperty("answer");
    await peer
      .getByRole("button", { name: "Jouer ce défi", exact: true })
      .click();
    await guess(peer, full.answer);
    await expect(
      peer.locator("[data-friend-comparison] .friend-scores article").last(),
    ).toContainText("1/6");
    const result = await (
      await peer.request.get(`/api/friends?id=${id}`)
    ).json();
    expect(result.you.success).toBe(true);
    const completions = await peer.evaluate(() =>
      JSON.parse(localStorage.getItem("dailygrid:stats:v1") ?? "[]"),
    );
    expect(completions).toHaveLength(1);
    expect(completions[0]).toMatchObject({
      friendId: id,
      mode: "practice",
      eligible: false,
    });
    await peer.reload({ waitUntil: "networkidle" });
    await peer
      .getByRole("button", { name: "Jouer ce défi", exact: true })
      .click();
    await expect(peer.locator(".completion-panel")).toBeVisible();
    expect(await unhandledRejections(peer)).toEqual([]);
    expect(peerErrors).toEqual([]);
    await page.goto(url, { waitUntil: "networkidle" });
    await expect(
      page.locator("[data-friend-comparison] .friend-scores article"),
    ).toHaveCount(2);
    await expect(
      page.locator("[data-friend-comparison] .friend-scores article").last(),
    ).toContainText("1/6");
    await page
      .getByRole("link", { name: "Revanche demain", exact: true })
      .click();
    await expect(page.locator("main")).toContainText("minuit UTC");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await peerContext.close();
  }
});
test("Word results keep one share action beside statistics and no external dictionary in four languages", async ({
  page,
}, info) => {
  for (const locale of ["fr", "en", "es", "de"] as const) {
    await page.goto(gamePath(locale, "word"), { waitUntil: "networkidle" });
    const puzzle = generateChallenge("word", locale, utcDay());
    if (puzzle.kind !== "word") throw new Error();
    await guess(page, puzzle.answer, locale);
    await expect(page.locator("[data-daily-challenge]")).toHaveCount(0);
    await expect(page.locator('[data-word-mode="daily"]')).toContainText(
      dailyWordLabel(locale),
    );
    const modeBox = await page.locator("[data-word-mode]").boundingBox();
    const boardBox = await page.locator(".word-board").boundingBox();
    expect(modeBox).not.toBeNull();
    expect(boardBox).not.toBeNull();
    expect(boardBox!.y - modeBox!.y - modeBox!.height).toBeLessThanOrEqual(13);
    await expect(page.locator("[data-result-mode]")).toContainText(
      pg(locale).daily,
    );
    const playActions = page.locator(".result-play-actions");
    await expect(
      playActions.getByRole("button", {
        name: et(locale).challengeFriend,
        exact: true,
      }),
    ).toBeVisible();
    await expect(playActions).toContainText(rt(locale).playAgain);
    await expect(playActions).toContainText(rt(locale).otherGame);
    await expect(page.locator("[data-personal-summary]")).toContainText("100%");
    await expect(page.locator("[data-comparison-preview]")).toContainText(
      comparisonPreviewCopy(locale).title,
    );
    await expect(page.locator("[data-comparison-preview]")).toContainText(
      comparisonPreviewCopy(locale).pending,
    );
    await expect(page.locator("[data-comparison-preview]")).not.toContainText("%");
    await expect(page.locator("[data-comparison-preview] dd")).toHaveText(["—", "—", "—"]);
    await expect(page.locator("[data-personal-progress]")).toContainText(
      et(locale).personalProgress,
    );
    await expect(page.locator("[data-discovery]")).toHaveCount(0);
    await expect(
      page.locator('a[href*="wiktionary.org"], a[href*="wikipedia.org"]'),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: et(locale).shareImage, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: t(locale).share, exact: true }),
    ).toHaveCount(1);
    const utilities = page.locator(".result-utility-actions");
    await expect(
      utilities.getByRole("link", { name: rt(locale).viewStats, exact: true }),
    ).toBeVisible();
    await expect(
      utilities.getByRole("button", { name: t(locale).share, exact: true }),
    ).toBeVisible();
    if (locale === "fr")
      await page.setViewportSize({ width: 320, height: 780 });
    const [statsBox, shareBox] = await utilities.evaluate(node => [node.querySelector("a")!, node.querySelector("button")!].map(element => {
      const box = element.getBoundingClientRect(); return {x: box.x, y: box.y, width: box.width, height: box.height};
    }));
    expect(statsBox).not.toBeNull();
    expect(shareBox).not.toBeNull();
    expect(statsBox!.x + statsBox!.width).toBeLessThanOrEqual(shareBox!.x);
    expect(Math.abs(statsBox!.y - shareBox!.y)).toBeLessThan(2);
    await expect(
      page.locator(".result-play-actions").getByRole("button", {
        name: et(locale).challengeFriend,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (locale === "de" || locale === "fr")
      await page.screenshot({
        path: info.outputPath(`word-result-${locale}.png`),
        fullPage: true,
      });
    await page.emulateMedia({reducedMotion:"reduce"});
    await playActions.getByRole("link", {name: rt(locale).playAgain, exact: true}).click();
    await expect(page).toHaveURL(new RegExp(practicePath(locale, "word") + "$"));
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    await expect(page.locator(".word-board")).toBeFocused();
    await expect.poll(async () => (await page.locator("[data-word-mode]").boundingBox())!.y).toBeGreaterThanOrEqual(0);
    expect((await page.locator("[data-word-mode]").boundingBox())!.y).toBeLessThan(50);
  }
});
test("comparison previews hide percentages until an available API comparison replaces them", async ({
  page,
}) => {
  let available = false;
  // Controlled comparison response for this isolated UI test; no population is seeded.
  await page.route(/\/api\/play\?comparison=1&runId=/, async (route) => {
    await route.fulfill({
      json: {
        comparison: available
          ? {
              samples: 50,
              successes: 50,
              successRate: 100,
              averageTime: 42,
              fasterThanPercent: 68,
              betterScoreThanPercent: null,
              averageAttempts: 4,
              fewerAttemptsThanAverage: 0,
              commonAttempts: [4],
            }
          : null,
      },
    });
  });
  await page.goto(practicePath("fr", "word"));
  const publicPuzzle = await cachedPractice(page, "word");
  const c = generateChallenge(
    "word",
    "fr",
    publicPuzzle.date,
    "easy",
    publicPuzzle.id.split(":")[2],
  );
  if (c.kind !== "word") throw new Error();
  await expect(page.locator('[data-word-mode="practice"]')).toHaveText(
    rt("fr").practice,
  );
  await guess(page, c.answer, "fr");
  await expect(page.locator("[data-comparison-preview]")).toContainText(
    comparisonPreviewCopy("fr").title,
  );
  await expect(page.locator("[data-comparison-preview]")).not.toContainText("%");
  available = true;
  await page.reload();
  await expect(page.locator(".comparison-panel")).toContainText("50");
  await expect(page.locator(".comparison-highlight")).toContainText(/68\s*%/);
  await expect(page.locator("[data-comparison-preview]")).toHaveCount(0);
  await expect(page.locator("[data-outcome-bar]")).toContainText("100 %");
});

test("math offers a checked calculation after completion and creates its own share image", async ({
  page,
}, info) => {
  await page.goto(practicePath("fr", "math"));
  const challenge = await cachedPractice(page, "math"),
    full = generateChallenge(
      "math",
      "fr",
      challenge.date,
      "easy",
      challenge.id.split(":")[2],
    );
  if (full.kind !== "math") throw new Error();
  await page.locator("#math-expression").fill(full.reference);
  await page.locator(".finish-math").click();
  await expect(page.locator("[data-discovery]")).toContainText(
    "façon d'atteindre la cible",
  );
  await expect(page.locator("[data-discovery] ol li").first()).toBeVisible();
  await page
    .getByRole("button", { name: "Partager une image", exact: true })
    .click();
  await expect(page.locator(".result-image-preview")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".result-image-preview")
        .evaluate(
          (image: HTMLImageElement) =>
            image.complete && image.naturalWidth === 1200,
        ),
    )
    .toBe(true);
  const src = await page.locator(".result-image-preview").getAttribute("src");
  const response = await page.request.get(src!);
  expect(response.headers()["content-type"]).toContain("image/png");
  await writeFile(info.outputPath("math-poster.png"), await response.body());
  await page.screenshot({
    path: `test-results/math-discovery-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
