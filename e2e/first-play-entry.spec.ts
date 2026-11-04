import { test, expect } from "@playwright/test";
import { gamePath, t } from "../src/lib/i18n";
import { locales } from "../src/lib/types";
import { rt } from "../src/lib/retention-i18n";
import { resultCopy } from "../src/lib/result-metrics";

for (const locale of locales) {
  test(`Word base entry accepts the first letter without signup (${locale})`, async ({ page }) => {
    await page.goto(gamePath(locale, "word"));
    const key = page.locator(".touch-keyboard").getByRole("button", { name: "A", exact: true });
    await expect(key).toBeEnabled();
    await expect(page.locator(".play-surface [data-game-preview]")).toHaveCount(0);
    await key.click();
    await expect(page.locator(".word-row").first().locator(".letter-tile").first()).toHaveText("A");
    await expect(page.locator(".game-error")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${gamePath(locale, "word")}$`));
  });

  test(`Word search base entry waits for Start and recovers a rejected start (${locale})`, async ({ page }, info) => {
    const actions: string[] = [];
    let rejectStart = true;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let newRequested!: () => void;
    const requested = new Promise<void>((resolve) => { newRequested = resolve; });
    let runId = "";
    let confirmStart!: () => void;
    const startGate = new Promise<void>((resolve) => { confirmStart = resolve; });
    let startRequested!: () => void;
    const pendingStart = new Promise<void>((resolve) => { startRequested = resolve; });
    await page.route("**/api/play", async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.continue();
      const body = request.postDataJSON();
      actions.push(body.action);
      if (body.action === "new") {
        newRequested();
        await gate;
        const response = await route.fetch();
        const data = await response.json();
        runId = data.runId;
        return route.fulfill({ response });
      }
      if (body.action === "start" && rejectStart) {
        rejectStart = false;
        return route.fulfill({ status: 503, json: { error: "networkError" } });
      }
      if (body.action === "start") {
        startRequested();
        await startGate;
      }
      return route.continue();
    });
    try {
      await page.goto(gamePath(locale, "wordsearch"), { waitUntil: "domcontentloaded" });
      await requested;
      const preview = page.locator(".play-surface [data-game-preview]");
      await expect(preview).toBeVisible();
      await info.attach(`preview-${locale}`, { body: await preview.ariaSnapshot(), contentType: "text/plain" });
      expect(actions).toEqual(["new"]);
    } finally {
      release();
    }
    const start = page.getByRole("button", { name: resultCopy(locale).start, exact: true });
    const board = page.locator(".classic-game .board-wordsearch");
    await expect(start).toBeEnabled();
    await expect(board).toHaveAttribute("data-locked", "true");
    await expect(board.locator("button").first()).toBeDisabled();
    await expect(board.locator("button").first()).toHaveCSS("color", "rgba(0, 0, 0, 0)");
    const cells = board.locator("button");
    const expectHiddenLetters = async () => {
      const hidden = await cells.evaluateAll((buttons) => buttons.map((button) => ({
        text: button.textContent,
        label: button.getAttribute("aria-label"),
      })));
      expect(hidden.length).toBeGreaterThan(0);
      for (const [index, cell] of hidden.entries()) {
        expect(cell.text).toBe("");
        const size = Math.sqrt(hidden.length);
        expect(cell.label).toBe(`${t(locale).cell} ${Math.floor(index / size) + 1}, ${(index % size) + 1}: ${t(locale).hidden}`);
      }
    };
    await expectHiddenLetters();
    await info.attach(`before-start-${locale}`, { body: await board.ariaSnapshot(), contentType: "text/plain" });
    expect(actions.filter((action) => action === "start")).toHaveLength(0);
    expect(runId).not.toBe("");
    const reserved = await page.request.get(`/api/play?runId=${encodeURIComponent(runId)}`);
    expect(reserved.ok()).toBe(true);
    expect((await reserved.json()).startedAt).toBeNull();

    await start.click();
    await expect(page.locator(".game-error")).toContainText(t(locale).networkError);
    await expect(start).toBeEnabled();
    await expect(board).toHaveAttribute("data-locked", "true");
    await expectHiddenLetters();
    const rejected = await page.request.get(`/api/play?runId=${encodeURIComponent(runId)}`);
    expect((await rejected.json()).startedAt).toBeNull();

    try {
      await start.click();
      await pendingStart;
      await expect(start).toBeDisabled();
      await expect(board).toHaveAttribute("data-locked", "true");
      await expect(cells.first()).toBeDisabled();
      await expectHiddenLetters();
      const pending = await page.request.get(`/api/play?runId=${encodeURIComponent(runId)}`);
      expect(pending.ok()).toBe(true);
      expect((await pending.json()).startedAt).toBeNull();
    } finally {
      confirmStart();
    }
    await expect(start).toHaveCount(0);
    await expect(board).not.toHaveAttribute("data-locked", "true");
    await expect(board.locator("button").first()).toBeEnabled();
    await expect(page.locator(".game-error")).toHaveCount(0);
    const started = await page.request.get(`/api/play?runId=${encodeURIComponent(runId)}`);
    expect(started.ok()).toBe(true);
    expect((await started.json()).startedAt).toEqual(expect.any(String));
    expect(actions.filter((action) => action === "start")).toHaveLength(2);
    const revealedCells = await cells.evaluateAll((buttons) => buttons.map((button) => ({
      text: button.textContent,
      label: button.getAttribute("aria-label"),
    })));
    for (const [index, cell] of revealedCells.entries()) {
      expect(cell.text).toMatch(/^[A-Z]$/);
      const size = Math.sqrt(revealedCells.length);
      expect(cell.label).toBe(`${t(locale).cell} ${Math.floor(index / size) + 1}, ${(index % size) + 1}: ${cell.text}`);
    }
    await board.locator("button").first().click();
    await expect(board.locator(".selecting")).toHaveCount(1);
  });
  test(`Word search retries failed preparation without leaving its base page (${locale})`, async ({ page }) => {
    let failed = false;
    await page.route("**/api/play", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.postDataJSON().action === "new" && !failed) {
        failed = true;
        return route.fulfill({ status: 503, json: { error: "networkError" } });
      }
      return route.continue();
    });
    await page.goto(gamePath(locale, "wordsearch"));
    const retry = page.getByRole("button", { name: rt(locale).retry, exact: true });
    await expect(retry).toBeVisible();
    await expect(page.getByText(rt(locale).syncIssue, { exact: true })).toBeVisible();
    await retry.click();
    await expect(page.getByRole("button", { name: resultCopy(locale).start, exact: true })).toBeEnabled();
    await expect(page.locator(".classic-game .board-wordsearch")).toHaveAttribute("data-locked", "true");
    await expect(retry).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`${gamePath(locale, "wordsearch")}$`));
  });

}
