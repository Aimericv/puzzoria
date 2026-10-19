import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import {
  recordUnhandledRejections,
  unhandledRejections,
  isWebKitFetchDiagnostic,
} from "./browser-errors";
import { resultCopy } from "../src/lib/result-metrics";
import { directions, slide } from "../src/lib/tile2048";
import type { PuzzleState } from "../src/lib/new-play";
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, browserName }) => {
  await recordUnhandledRejections(page);
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => {
    if (!isWebKitFetchDiagnostic(e, browserName)) list.push(e.message);
  });
  page.on("console", (e) => {
    if (e.type() === "error") list.push(e.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(await unhandledRejections(page)).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});
async function tap(page: Page, index: number, info: TestInfo) {
  const cell = page.locator(`[data-puzzle-cell="${index}"]`);
  await expect(cell).toBeEnabled();
  if (info.project.use.hasTouch) await cell.tap();
  else await cell.click();
}
async function saved(page: Page) {
  await expect(page.locator(".classic-game")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".game-error")).toHaveCount(0);
}
test("2048 supports keyboard, swipes, reload, finish and replay", async ({
  page,
}, info) => {
  await page.goto("/fr/2048/practice", { waitUntil: "networkidle" });
  const board = page.locator(".board-tiles");
  await expect(
    page.locator(".direction-controls button").first(),
  ).toBeEnabled();
  const initial = await page
    .locator("[data-tile-value]")
    .evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute("data-tile-value"))),
    );
  const direction = directions.find((d) => slide(initial, d).changed)!;
  await board.focus();
  await page.keyboard.press(
    {
      left: "ArrowLeft",
      right: "ArrowRight",
      up: "ArrowUp",
      down: "ArrowDown",
    }[direction],
  );
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*1/);
  await saved(page);
  const second = await page
    .locator("[data-tile-value]")
    .evaluateAll((nodes) =>
      nodes.map((n) => Number(n.getAttribute("data-tile-value"))),
    );
  expect(second.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*1/);
  expect(
    await page
      .locator("[data-tile-value]")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number(n.getAttribute("data-tile-value"))),
      ),
  ).toEqual(second);
  const d = directions.find((dir) => slide(second, dir).changed)!;
  await board.scrollIntoViewIfNeeded();
  const box = await board.boundingBox();
  if (!box) throw new Error();
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2,
    delta = { left: [-50, 0], right: [50, 0], up: [0, -50], down: [0, 50] }[d];
  // Native pointer drag exercises the shared swipe path; word-search endpoints use real touch input.
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + delta[0], y + delta[1], { steps: 4 });
  await page.mouse.up();
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*2/);
  await saved(page);
  await page
    .getByRole("button", { name: "Terminer et enregistrer le score" })
    .click();
  await expect(page.locator(".completion-panel")).toContainText(
    "Partie terminée",
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".completion-panel")).toBeVisible();
  await page.getByRole("button", { name: "Rejouer", exact: true }).click();
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*0/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/2048-${info.project.name}.png`,
    fullPage: true,
  });
});
test("minefield has a safe start, tactile flags, saved progress and scrollable hard board", async ({
  page,
}, info) => {
  const c = generateChallenge("mines", "fr", utcDay());
  if (c.kind !== "mines") throw new Error();
  await page.goto("/fr/demineur", { waitUntil: "networkidle" });
  await tap(page, c.start, info);
  await saved(page);
  await expect(page.locator(`[data-puzzle-cell="${c.start}"]`)).toHaveClass(
    /revealed/,
  );
  const hidden = await page
    .locator(".board-mines .puzzle-cell:not(.revealed)")
    .first()
    .getAttribute("data-puzzle-cell");
  if (!hidden) throw new Error();
  await page.getByRole("button", { name: "Drapeau", exact: false }).click();
  await tap(page, Number(hidden), info);
  await saved(page);
  await expect(page.locator(`[data-puzzle-cell="${hidden}"]`)).toHaveClass(
    /flagged/,
  );
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(`[data-puzzle-cell="${hidden}"]`)).toHaveClass(
    /flagged/,
  );
  await expect(page.locator(`[data-puzzle-cell="${c.start}"]`)).toHaveClass(
    /revealed/,
  );
  await page.getByRole("link", { name: "Difficile", exact: true }).click();
  await expect(page.locator(".board-mines .puzzle-cell")).toHaveCount(256);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/mines-${info.project.name}.png`,
    fullPage: true,
  });
});
test("word search selects endpoints, persists and completes in four languages", async ({
  page,
}, info) => {
  for (const [locale, slug] of [
    ["fr", "mots-meles"],
    ["en", "word-search"],
    ["es", "sopa-de-letras"],
    ["de", "wortsuche"],
  ] as const) {
    const c = generateChallenge("wordsearch", locale, "2026-10-03");
    if (c.kind !== "wordsearch") throw new Error();
    await page.goto(`/${locale}/${slug}/archive/2026-10-03`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("button", {name: resultCopy(locale).start, exact: true}).click();
    for (let i = 0; i < c.placements.length; i++) {
      await tap(page, c.placements[i].from, info);
      await tap(page, c.placements[i].to, info);
      await expect(page.locator(".search-word-list li.found")).toHaveCount(
        i + 1,
      );
      await saved(page);
      if (i === 0) {
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.locator(".search-word-list li.found")).toHaveCount(1);
      }
    }
    await expect(page.locator(".completion-panel")).toBeVisible();
    await expect(page.locator(".search-word-list li.found")).toHaveCount(c.placements.length);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (locale === "fr")
      await page.screenshot({
        path: `test-results/wordsearch-${info.project.name}.png`,
        fullPage: true,
      });
  }
});
test("legacy archived 2048 finishes at its fixed budget and produces a private identical friend challenge", async ({
  page,
}) => {
  await page.goto("/en/2048/archive/2026-10-03", { waitUntil: "networkidle" });
  const c = generateChallenge("2048", "en", "2026-10-03");
  if (c.kind !== "2048") throw new Error();
  const created = await page.request.post("/api/play", {
    data: {
      action: "new",
      game: "2048",
      locale: "en",
      mode: "archive",
      date: "2026-10-03",
    },
  });
  const run = await created.json();
  await page.request.post("/api/play", {
    data: { action: "start", runId: run.runId },
  });
  let grid = c.grid,
    result:
      | { state: PuzzleState; completion?: { score: number; success: boolean } }
      | undefined;
  for (let sequence = 0; sequence < 100; sequence++) {
    const choices = directions
      .map((d) => ({ d, next: slide(grid, d) }))
      .filter((x) => x.next.changed)
      .sort(
        (a, b) =>
          b.next.grid.filter((n) => !n).length * 10 +
          b.next.gain -
          (a.next.grid.filter((n) => !n).length * 10 + a.next.gain),
      );
    if (!choices.length) break;
    const response = await page.request.post("/api/play", {
      data: {
        action: "submit",
        runId: run.runId,
        sequence,
        step: { kind: "move", direction: choices[0].d },
        score: 999999,
      },
    });
    expect(response.ok()).toBe(true);
    result = await response.json();
    grid = result!.state.grid;
    if (result!.completion) break;
  }
  expect(result?.completion).toBeDefined();
  expect(result?.completion?.score).toBe(result?.state.score);
  expect(result!.state.moves).toBeLessThanOrEqual(100);
  if (result!.state.moves === 100)
    expect(result!.completion?.success).toBe(true);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".completion-panel")).toBeVisible();
  const invite = await page.request.post("/api/friends", {
      data: { action: "create", runId: run.runId },
    }),
    { id } = await invite.json();
  const view = await (await page.request.get(`/api/friends?id=${id}`)).json();
  expect(view.challenge.moveLimit).toBe(100);
  expect(view.challenge.grid).toEqual(c.grid);
  expect(view.challenge.spawnSeed).toBeUndefined();
  const poster = await page.request.get(`/api/share-image?id=${id}&locale=de`);
  expect(poster.ok()).toBe(true);
  expect(poster.headers()["content-type"]).toContain("image/png");
});
test("word search supports native drag and keyboard selection", async ({
  page,
}) => {
  const c = generateChallenge("wordsearch", "fr", "2026-10-03");
  if (c.kind !== "wordsearch") throw new Error();
  await page.goto("/fr/mots-meles/archive/2026-10-03", {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", {name: resultCopy("fr").start, exact: true}).click();
  const first = c.placements[0],
    board = page.locator(".board-wordsearch");
  await expect(
    page.locator(`[data-puzzle-cell="${first.from}"]`),
  ).toBeEnabled();
  await board.scrollIntoViewIfNeeded();
  const start = await page
      .locator(`[data-puzzle-cell="${first.from}"]`)
      .boundingBox(),
    end = await page.locator(`[data-puzzle-cell="${first.to}"]`).boundingBox();
  if (!start || !end) throw new Error();
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.locator(".search-word-list li.found")).toHaveCount(1);
  await saved(page);
  const second = c.placements[1],
    from = page.locator(`[data-puzzle-cell="${second.from}"]`);
  await from.focus();
  await page.keyboard.press("Enter");
  const dr = Math.sign(
      Math.floor(second.to / c.size) - Math.floor(second.from / c.size),
    ),
    dc = Math.sign((second.to % c.size) - (second.from % c.size));
  const steps = Math.max(
    Math.abs(Math.floor(second.to / c.size) - Math.floor(second.from / c.size)),
    Math.abs((second.to % c.size) - (second.from % c.size)),
  );
  for (let i = 0; i < steps; i++) {
    if (dr) await page.keyboard.press(dr > 0 ? "ArrowDown" : "ArrowUp");
    if (dc) await page.keyboard.press(dc > 0 ? "ArrowRight" : "ArrowLeft");
  }
  await page.keyboard.press("Enter");
  await expect(page.locator(".search-word-list li.found")).toHaveCount(2);
  await saved(page);
});
test("a saved 2048 move survives a lost response and the next move uses the restored sequence", async ({
  page,
}) => {
  await page.goto("/fr/2048/practice", { waitUntil: "networkidle" });
  await expect(
    page.locator(".direction-controls button").first(),
  ).toBeEnabled();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    let dropped = false;
    window.fetch = async (input, init) => {
      const response = await original(input, init);
      if (
        !dropped &&
        typeof init?.body === "string" &&
        JSON.parse(init.body).action === "submit" &&
        response.ok
      ) {
        dropped = true;
        throw new TypeError("Simulated lost response after commit");
      }
      return response;
    };
  });
  const readGrid = () =>
    page
      .locator("[data-tile-value]")
      .evaluateAll((nodes) =>
        nodes.map((n) => Number(n.getAttribute("data-tile-value"))),
      );
  const keys = {
    left: "ArrowLeft",
    right: "ArrowRight",
    up: "ArrowUp",
    down: "ArrowDown",
  };
  const first = await readGrid(),
    d = directions.find((dir) => slide(first, dir).changed)!;
  await page.locator(".board-tiles").focus();
  await page.keyboard.press(keys[d]);
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*1/);
  await expect(page.locator(".classic-game")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".game-error")).toBeVisible();
  const recovered = await readGrid(),
    next = directions.find((dir) => slide(recovered, dir).changed)!;
  await page.locator(".board-tiles").focus();
  await page.keyboard.press(keys[next]);
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*2/);
  await saved(page);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator(".classic-status")).toContainText(/Coups\s*2/);
});
