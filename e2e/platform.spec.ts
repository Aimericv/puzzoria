import { test, expect, type Page } from "@playwright/test";
import { normalizeWord } from "../src/lib/word-normalization";
import { generateChallenge } from "../src/lib/challenges";
import { utcDay } from "../src/lib/date";
import {
  isWebKitFetchDiagnostic,
  recordUnhandledRejections,
  unhandledRejections,
} from "./browser-errors";
const today = utcDay();
async function typeGuess(page: Page, text: string) {
  await expect(page.locator(".touch-keyboard .wide-key").first()).toBeEnabled();
  await page.getByRole("group", { name: "Mot de cinq lettres" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Delete");
  await page.keyboard.type(normalizeWord(text));
}
const pageErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page, browserName }) => {
  await recordUnhandledRejections(page);
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => {
    if (!isWebKitFetchDiagnostic(error, browserName))
      errors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("status of 400"))
      errors.push(message.text());
  });
});
test.afterEach(async ({ page }) => {
  expect(
    await unhandledRejections(page),
    "Unhandled browser rejections",
  ).toEqual([]);
  expect(
    pageErrors.get(page) ?? [],
    "Browser runtime and hydration errors",
  ).toEqual([]);
});
test("home, locale navigation and responsive layout", async ({
  page,
}, testInfo) => {
  await page.goto("/fr", { waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator(".game-card")).toHaveCount(11);
  await expect(
    page
      .locator(".game-card")
      .filter({ has: page.locator("h2", { hasText: "2048" }) })
      .locator(".card-play"),
  ).toHaveAttribute("href", "/fr/2048");
  await expect(page.locator("h1")).toContainText("Un petit défi");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/home-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("combobox").selectOption("es");
  await expect(page).toHaveURL(/\/es$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("h1")).toContainText("Un pequeño reto");
  // Let this page's initial profile fetch settle before replacing the document.
  // WebKit reports an interrupted same-origin fetch as an access-control error.
  await page.waitForLoadState("networkidle");
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/es$/);
  await page.getByRole("link", { name: "Archivo", exact: true }).click();
  await expect(page.locator(".archive-row").first()).toBeVisible();
  await page.locator(".archive-game").first().click();
  await expect(page).toHaveURL(/\/archive\//);
  await expect(page.locator(".word-board")).toBeVisible();
});
test("word game saves progress, completes and shares without spoiler", async ({
  page,
  context,
  browserName,
}, testInfo) => {
  const puzzle = generateChallenge("word", "fr", today);
  if (puzzle.kind !== "word") throw new Error();
  if (browserName === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/fr/mot");
  await typeGuess(page, "ZZZZZ");
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.locator('.game-error[role="alert"]')).toContainText(
    "dictionnaire",
  );
  await typeGuess(page, "AIMER");
  await expect(page.locator(".word-row").first()).toHaveText("AIMER");
  await page.reload();
  await expect(page.locator(".word-row").first()).toHaveText("AIMER");
  await typeGuess(page, puzzle.answer);
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await page.screenshot({
    path: `test-results/word-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.evaluate(() =>
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    }),
  );
  if (browserName === "webkit")
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
      }),
    );
  await page.getByRole("button", { name: "Partager le résultat" }).click();
  let shared: string;
  if (browserName === "chromium") {
    await expect(page.getByRole("status")).toContainText("copié");
    shared = await page.evaluate(() => navigator.clipboard.readText());
  } else {
    await expect(page.getByRole("status")).toContainText("Copie indisponible");
    await expect(page.locator(".share-text textarea")).toBeVisible();
    shared = await page.locator(".share-text textarea").inputValue();
  }
  expect(shared).toContain("🟩🟩🟩🟩🟩");
  expect(shared).not.toContain(puzzle.answer);
  expect(shared).toContain("/play/word?date=");
  await page.reload();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await page.locator(".next-game a").click();
  await expect(page).toHaveURL(/\/fr\/sudoku/);
  await page.goto("/fr");
  await expect(page.locator(".progress-count")).toHaveCount(0);
  await expect(page.locator(".progress-streak")).toContainText("1 jours");
});
test("direct word entry, plain-letter keys, active square, edits and broader French guesses", async ({
  page,
}, testInfo) => {
  await page.goto("/fr/mot");
  await expect(
    page.locator("input, textarea, [contenteditable=true]"),
  ).toHaveCount(0);
  await expect(page.locator(".touch-keyboard .key:not(.wide-key)")).toHaveCount(
    26,
  );
  for (const letter of ["É", "À", "Ç"])
    await expect(
      page.getByRole("button", { name: letter, exact: true }),
    ).toHaveCount(0);
  await expect(page.locator(".active-cell")).toHaveCount(1);
  await expect(page.locator(".active-cell")).toHaveAttribute(
    "aria-label",
    /^1, 1:/,
  );
  await page.locator(".active-cell").click();
  // Playwright's US key map cannot emit this AZERTY key; send its browser key event.
  await page
    .getByRole("group", { name: "Mot de cinq lettres" })
    .dispatchEvent("keydown", { key: "é", code: "Digit2" });
  await expect(page.locator(".word-row").first()).toHaveText("E");
  await expect(page.locator(".active-cell")).toHaveAttribute(
    "aria-label",
    /^1, 2:/,
  );
  await page.keyboard.press("Backspace");
  for (const letter of "OUTIL")
    await page.getByRole("button", { name: letter, exact: true }).click();
  await expect(page.locator(".word-row").first()).toHaveText("OUTIL");
  await page
    .locator(".word-row")
    .first()
    .locator(".letter-tile")
    .nth(1)
    .click();
  await page.keyboard.press("a");
  await expect(page.locator(".word-row").first()).toHaveText("OATIL");
  await page
    .locator(".word-row")
    .first()
    .locator(".letter-tile")
    .nth(1)
    .click();
  await page.keyboard.press("u");
  await expect(page.locator(".word-row").first()).toHaveText("OUTIL");
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".word-row").first().locator(".correct,.present,.absent"),
  ).toHaveCount(5);
  await typeGuess(page, "ADULE");
  await page.keyboard.press("Enter");
  await expect(
    page.locator(".word-row").nth(1).locator(".correct,.present,.absent"),
  ).toHaveCount(5);
  await expect(page.locator(".game-error")).toHaveCount(0);
  await expect(page.locator(".active-cell")).toHaveAttribute(
    "aria-label",
    /^3, 1:/,
  );
  await page.screenshot({
    path: `test-results/word-entry-${testInfo.project.name}.png`,
    fullPage: true,
  });
  // Board keyboard shortcuts must not consume Enter on ordinary navigation links.
  await page.locator(".back-link").focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/fr$/);
});
test("Sudoku notes, undo, timer pause, save and validated victory", async ({
  page,
}, testInfo) => {
  const puzzle = generateChallenge("sudoku", "fr", today, "easy");
  if (puzzle.kind !== "sudoku") throw new Error();
  await page.goto("/fr/sudoku");
  await expect(page.locator(".difficulty-nav")).toHaveCount(0);
  await expect(page.locator(".difficulty-badge")).toHaveCount(0);
  const i = puzzle.grid.findIndex((n) => !n),
    cell = page.locator(".sudoku-cell").nth(i);
  await cell.click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.locator(".number-pad button").nth(0).click();
  await expect(cell.locator(".cell-notes")).toContainText("1");
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(cell.locator(".cell-notes")).not.toContainText("1");
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page
    .locator(".number-pad button")
    .nth(puzzle.solution[i] - 1)
    .click();
  await cell.focus();
  const size = await cell.boundingBox();
  await page.keyboard.type(String(puzzle.solution[i]));
  expect(await cell.evaluate(node => getComputedStyle(node).outlineStyle)).toBe("none");
  expect(await cell.boundingBox()).toEqual(size);
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".sudoku-cell.selected")).toBeFocused();
  await page.reload();
  await expect(page.locator(".sudoku-cell").nth(i)).toHaveText(
    String(puzzle.solution[i]),
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.locator(".paused-overlay")).toBeVisible();
  await page.locator(".paused-overlay").click();
  for (let j = 0; j < 81; j++)
    if (!puzzle.grid[j]) {
      await page.locator(".sudoku-cell").nth(j).click();
      await page
        .locator(".number-pad button")
        .nth(puzzle.solution[j] - 1)
        .click();
    }
  await page.getByRole("button", { name: "Vérifier la grille" }).click();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await expect(page.locator("[data-discovery]")).toContainText(
    "déduction dans la grille de départ",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/sudoku-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("math tactile input, invalid expression, result and persistence", async ({
  page,
}, testInfo) => {
  const puzzle = generateChallenge("math", "fr", today);
  if (puzzle.kind !== "math") throw new Error();
  await page.goto("/fr/compte");
  await page.locator(".math-numbers button").first().click();
  await expect(page.getByRole("textbox", { name: "Votre calcul" })).toHaveValue(
    String(puzzle.numbers[0]),
  );
  await page.getByRole("textbox", { name: "Votre calcul" }).fill("1 / 0");
  await page.getByRole("button", { name: "Vérifier le calcul" }).click();
  await expect(page.locator('.game-error[role="alert"]')).toBeVisible();
  await page
    .getByRole("textbox", { name: "Votre calcul" })
    .fill(puzzle.reference);
  await page.getByRole("button", { name: "Vérifier le calcul" }).click();
  await expect(page.locator(".math-preview-result")).toContainText("1000");
  await page.getByRole("button", { name: "Terminer le défi" }).click();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await expect(page.locator(".math-reference")).toContainText(puzzle.reference);
  await page.reload();
  await expect(page.locator(".completion-panel")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/math-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("API publication, spoiler boundaries and locale-neutral share links", async ({
  request,
}) => {
  const word = await request.get(`/api/challenges/fr/word?date=${today}`);
  expect(word.ok()).toBe(true);
  expect(await word.json()).not.toHaveProperty("answer");
  const sudoku = await request.get(
    `/api/challenges/fr/sudoku?date=${today}&difficulty=hard`,
  );
  expect(await sudoku.json()).not.toHaveProperty("solution");
  expect(
    (await request.get("/api/challenges/fr/word?date=2099-01-01")).status(),
  ).toBe(404);
  expect(
    (
      await request.post(`/api/challenges/fr/sudoku?date=${today}`, {
        data: { grid: Array(81).fill(1) },
      })
    ).status(),
  ).toBe(400);
  const shared = await request.get(`/play/math?date=${today}`, {
    headers: { "Accept-Language": "de-DE" },
    maxRedirects: 0,
  });
  expect(shared.status()).toBe(307);
  expect(shared.headers().location).toContain("/de/play/math");
  const home = await request.get("/fr");
  const html = await home.text();
  expect(/hreflang="es"/i.test(html)).toBe(true);
  expect(html.includes('lang="fr"')).toBe(true);
  expect(html.includes("Tous les jeux")).toBe(true);
  expect((await request.get("/sitemap.xml")).ok()).toBe(true);
  expect((await request.get("/robots.txt")).ok()).toBe(true);
});
test("anonymous events and WebMCP use the same saved progress", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tools: Record<string, { execute: (input: unknown) => unknown }> = {};
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: (tool: {
          name: string;
          execute: (input: unknown) => unknown;
        }) => {
          tools[tool.name] = tool;
        },
      },
    });
    Object.assign(window, { testTools: tools, testEvents: [] });
    window.addEventListener("dailygrid:analytics", (event) =>
      (window as unknown as { testEvents: unknown[] }).testEvents.push(
        (event as CustomEvent).detail,
      ),
    );
  });
  await page.goto("/fr/mot");
  await typeGuess(page, "AIMER");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { testEvents: { name: string }[] }
        ).testEvents.some((e) => e.name === "game_start"),
      ),
    )
    .toBe(true);
  const result = await page.evaluate(() =>
    (
      window as unknown as {
        testTools: Record<string, { execute: (input: unknown) => unknown }>;
      }
    ).testTools.read_daily_progress.execute({}),
  );
  expect(result).toMatchObject({ locale: "fr", total: 0, finished: [] });
  expect(
    await page.evaluate(() => {
      try {
        (
          window as unknown as {
            testTools: Record<string, { execute: (input: unknown) => unknown }>;
          }
        ).testTools.read_daily_progress.execute({ unexpected: 1 });
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
});
