import { expect, test, type Page } from "@playwright/test";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import { normalizeWord } from "../src/lib/word-normalization";
import { wordArticlePath } from "../src/lib/word-article-path";
async function completeWord(page: Page) {
  await page.goto("/fr/mot");
  await expect(page.getByRole("button", {name: "Valider", exact: true})).toBeEnabled();
  const c = generateChallenge("word", "fr", utcDay());
  if (c.kind !== "word") throw new Error();
  await page.locator(".word-board").focus(); await page.keyboard.type(normalizeWord(c.answer));
  await page.getByRole("button", {name: "Valider", exact: true}).click();
  await expect(page.locator(".completion-panel")).toBeVisible(); return c;
}
test("native share denial copies; blocked clipboard opens selected spoiler-free text", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"});
  const c = await completeWord(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {value: () => true, configurable: true});
    Object.defineProperty(navigator, "share", {value: async () => {throw new DOMException("blocked", "NotAllowedError");}, configurable: true});
    Object.defineProperty(navigator, "clipboard", {value: {writeText: async (text: string) => {document.documentElement.dataset.copiedShare = text;}}, configurable: true});
  });
  const button = page.getByRole("button", {name: "Partager le résultat", exact: true});
  await button.click(); await expect(page.getByRole("status")).toContainText("copié");
  const copied = await page.locator("html").getAttribute("data-copied-share");
  expect(copied).toContain("🟩🟩🟩🟩🟩"); expect(copied).not.toContain(c.answer);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", {value: {writeText: async () => {throw new Error("denied");}}, configurable: true}));
  await button.click();
  const text = page.locator(".share-text textarea");
  await expect(text).toBeVisible(); await expect(text).toBeFocused();
  expect(await text.inputValue()).toBe(copied);
  expect(await text.evaluate((e: HTMLTextAreaElement) => e.selectionEnd - e.selectionStart)).toBe(copied!.length);
  await expect(button).toBeEnabled();
});
test("a pending native share disables duplicate requests and cancellation stays quiet", async ({page}) => {
  await page.emulateMedia({reducedMotion: "reduce"}); await completeWord(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {value: () => true, configurable: true});
    Object.defineProperty(navigator, "share", {value: () => new Promise((_resolve, reject) => {
      document.documentElement.dataset.shareCalls = String(Number(document.documentElement.dataset.shareCalls ?? 0) + 1);
      document.querySelector(".share-button")!.addEventListener("test-cancel", () => reject(new DOMException("cancelled", "AbortError")), {once: true});
    }), configurable: true});
  });
  const button = page.getByRole("button", {name: "Partager le résultat", exact: true});
  await button.click(); await expect(button).toBeDisabled();
  expect(await page.locator("html").getAttribute("data-share-calls")).toBe("1");
  await button.dispatchEvent("test-cancel"); await expect(button).toBeEnabled();
  await expect(page.locator(".completion-panel [role=status]")).toHaveCount(0);
  await expect(page.locator(".share-text")).not.toHaveAttribute("open", "");
});
test("replay scroll moves through intermediate positions and reaches the fresh word grid", async ({page}) => {
  await page.emulateMedia({reducedMotion: "no-preference"}); await completeWord(page);
  const replay = page.getByRole("link", {name: "Rejouer", exact: true});
  await replay.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    const points: number[] = [];
    document.addEventListener("focusin", e => {
      if (!(e.target instanceof HTMLElement) || !e.target.classList.contains("word-board")) return;
      const started = performance.now();
      function record() {
        points.push(scrollY);
        document.documentElement.dataset.scrollPoints = JSON.stringify(points);
        if (performance.now() - started < 1300) requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    });
  });
  await replay.click();
  await expect(page).toHaveURL(/\/fr\/mot\/practice$/);
  await expect(page.locator(".word-board")).toBeFocused();
  await expect.poll(async () => (await page.locator("[data-word-mode]").boundingBox())!.y).toBeGreaterThanOrEqual(0);
  await expect.poll(async () => (await page.locator("[data-word-mode]").boundingBox())!.y).toBeLessThan(50);
  const points: number[] = JSON.parse((await page.locator("html").getAttribute("data-scroll-points"))!);
  expect(new Set(points.map(p => Math.round(p))).size).toBeGreaterThan(3);
  expect(points[0]).toBeGreaterThan(points[points.length - 1] + 80);
  await expect.poll(() => page.evaluate(() => document.body.style.minHeight)).toBe("");
  expect(await page.evaluate(() => document.documentElement.style.overflowAnchor)).toBe("");
  await expect(page.locator(".completion-panel")).toHaveCount(0);
});
test("manual scrolling cancels the replay animation and releases temporary page height", async ({page}) => {
  await page.emulateMedia({reducedMotion:"no-preference"}); await completeWord(page);
  const replay = page.getByRole("link", {name:"Rejouer", exact:true});
  await replay.scrollIntoViewIfNeeded(); await replay.click();
  await expect(page.locator(".word-board")).toBeFocused();
  await page.evaluate(() => {
    window.dispatchEvent(new WheelEvent("wheel", {deltaY:-100}));
    window.scrollTo({top:0, behavior:"instant"});
  });
  await expect.poll(() => page.evaluate(() => document.body.style.minHeight)).toBe("");
  // Observe a whole animation duration so a queued frame cannot resume scrolling.
  const resumed = await page.evaluate(() => new Promise<boolean>(resolve => {
    const start = performance.now(); let moved = false;
    function observe() {
      moved ||= scrollY > 1;
      if (performance.now() - start >= 1000) resolve(moved);
      else requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  }));
  expect(resumed).toBe(false);
});
test("word card secondary links share the gray style and future articles stay private", async ({page, browser}) => {
  await page.goto("/fr");
  const card = page.locator(".game-card.word");
  expect(await card.locator(".card-word-variant").evaluate(e => getComputedStyle(e).color)).toBe(await card.locator(".card-practice").first().evaluate(e => getComputedStyle(e).color));
  const c = generateChallenge("rareword", "fr", utcDay());
  if (c.kind !== "rareword") throw new Error();
  const context = await browser.newContext({javaScriptEnabled: false});
  const stranger = await context.newPage();
  const response = await stranger.goto("http://127.0.0.1:3100" + wordArticlePath("fr", c.answer));
  expect(response?.status()).toBe(404); await expect(stranger.locator("[data-word-article]")).toHaveCount(0);
  await context.close();
});
