import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";
import { generateChallenge, validateChallenge } from "../src/lib/challenges";
import { normalizeWord } from "../src/lib/word-normalization";
import { dictionaries } from "../src/lib/word";
import { nt } from "../src/lib/new-games-i18n";
import { rt } from "../src/lib/retention-i18n";
import { utcDay } from "../src/lib/date";
import type { Challenge, PublicChallenge } from "../src/lib/types";
import { savedPracticeChallenge } from "./saved-play";
import {
  isWebKitFetchDiagnostic,
  recordUnhandledRejections,
  unhandledRejections,
} from "./browser-errors";
const today = utcDay();
async function guess(page: Page, text: string) {
  await expect(page.locator(".touch-keyboard .wide-key").first()).toBeEnabled();
  await page.getByRole("group", { name: "Mot de cinq lettres" }).focus();
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("Delete");
  await page.keyboard.type(normalizeWord(text));
}
async function practice(
  page: Page,
  game: "word" | "sudoku" | "math",
  difficulty = "easy",
): Promise<PublicChallenge> {
  await expect
    .poll(() =>
      page.evaluate(
        (key) =>
          JSON.parse(localStorage.getItem(key) ?? "null")?.challenge ?? null,
        `dailygrid:practice:${game}:fr:${difficulty}`,
      ),
    )
    .not.toBeNull();
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).challenge,
    `dailygrid:practice:${game}:fr:${difficulty}`,
  );
}
function full(c: PublicChallenge): Challenge {
  return generateChallenge(
    c.kind,
    c.locale,
    c.date,
    c.kind === "sudoku" ? c.difficulty : "easy",
    c.id.split(":")[2],
  );
}
async function completeWord(
  page: Page,
  puzzle: Extract<Challenge, { kind: "word" }>,
) {
  await guess(page, puzzle.answer);
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.locator(".completion-panel")).toBeVisible();
}
test("unlimited losses show a neutral result and replay actions before statistics", async ({
  page,
}, info) => {
  await page.goto("/fr/mot/practice");
  const c = full(await practice(page, "word"));
  if (c.kind !== "word") throw new Error("Expected a word challenge");
  const wrong = [...new Set(dictionaries.fr.allowed.map(normalizeWord))]
    .filter((word) => word.length === 5 && word !== normalizeWord(c.answer))
    .slice(0, 6);
  expect(wrong).toHaveLength(6);
  for (const word of wrong) {
    await guess(page, word);
    await page.getByRole("button", { name: "Valider", exact: true }).click();
    await expect(page.locator(".game-error")).toHaveCount(0);
  }
  const result = page.locator(".completion-panel");
  await expect(result).toBeVisible();
  await expect(result.locator("h2")).toHaveText(nt("fr").ended);
  await expect(result).not.toContainText("C’était le défi du jour.");
  await expect(result.locator(".replay-actions")).toContainText(
    rt("fr").playAgain,
  );
  await expect(result.locator(".replay-actions")).toContainText(
    rt("fr").otherGame,
  );
  expect(
    await result.evaluate((node) => {
      const actions = node.querySelector(".replay-actions")!;
      return [".completion-metrics", ".personal-progress"].every(
        (selector) =>
          !!(
            actions.compareDocumentPosition(node.querySelector(selector)!) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      );
    }),
  ).toBe(true);
  await result.screenshot({ path: info.outputPath("unlimited-result.png") });
  await result
    .getByRole("button", { name: rt("fr").playAgain, exact: true })
    .click();
  await expect(result).toHaveCount(0);
  await expect
    .poll(async () => (await practice(page, "word")).id)
    .not.toBe(c.id);
  await page.goto("/fr");
  await expect(page.locator(".time-estimate")).toHaveCount(0);
});
async function signup(page: Page, username: string, displayName: string) {
  await page.goto("/fr/account");
  await expect(page.locator("form input")).toHaveCount(2);
  await page.getByLabel("Pseudo", { exact: true }).fill(username);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("correct long password");
  await page
    .getByRole("button", { name: "Créer un compte", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: username, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Pseudo public").fill(displayName);
  await page.getByRole("button", { name: "Enregistrer le pseudo" }).click();
  await expect(
    page.getByRole("heading", { name: displayName, exact: true }),
  ).toBeVisible();
}
async function login(page: Page, username: string) {
  await page.goto("/fr/account");
  await page
    .locator(".mode-nav")
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await page.getByLabel("Pseudo", { exact: true }).fill(username);
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("correct long password");
  await page
    .locator("form")
    .getByRole("button", { name: "Se connecter", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Se déconnecter" }),
  ).toBeVisible();
}
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, browserName }) => {
  await recordUnhandledRejections(page);
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", (e) => {
    if (!isWebKitFetchDiagnostic(e, browserName)) list.push(e.message);
  });
  page.on("console", (e) => {
    if (e.type() === "error" && !/status of 4\d\d/.test(e.text()))
      list.push(e.text());
  });
  await page.addInitScript(() => {
    window.addEventListener("dailygrid:analytics", (event) => {
      const name = (event as CustomEvent<{ name: string }>).detail.name;
      const names = JSON.parse(sessionStorage.getItem("test:events") ?? "[]");
      names.push(name);
      sessionStorage.setItem("test:events", JSON.stringify(names));
    });
  });
});
test.afterEach(async ({ page }) => {
  expect(
    await unhandledRejections(page),
    "Unhandled browser rejections",
  ).toEqual([]);
  expect(errors.get(page) ?? [], "Browser runtime errors").toEqual([]);
});
test("Unlimited word restores drafts, replays endlessly and never increments Daily progress", async ({
  page,
}, testInfo) => {
  await page.goto("/fr/mot/practice");
  await expect(page.locator(".word-board")).toBeVisible();
  const first = await practice(page, "word");
  const solution = full(first);
  if (solution.kind !== "word") throw new Error();
  await guess(page, "OUTI");
  await page.reload();
  await expect(page.locator(".word-row").first()).toHaveText("OUTI");
  expect((await practice(page, "word")).id).toBe(first.id);
  await completeWord(page, solution);
  await expect(page.locator(".comparison-panel:not([data-comparison-preview])")).toHaveCount(0);
  await expect(page.locator(".account-prompt")).toHaveCount(0);
  await page.getByRole("button", { name: "Rejouer", exact: true }).click();
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  await expect
    .poll(async () => (await practice(page, "word")).id)
    .not.toBe(first.id);
  const second = full(await practice(page, "word"));
  if (second.kind !== "word") throw new Error();
  await completeWord(page, second);
  await page.goto("/fr");
  await expect(page.locator(".progress-count")).toHaveCount(0);
  await expect(page.locator(".header-streak")).toHaveText("0");
  await page.goto("/fr/stats");
  await page
    .locator(".mode-nav")
    .getByRole("button", { name: "Illimité", exact: true })
    .click();
  await expect(page.locator(".stats-game-grid article").first()).toContainText(
    "2",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("dailygrid:stats:v1") ?? "[]").every(
        (r: { mode: string }) => r.mode === "practice",
      ),
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/unlimited-stats-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("Unlimited Sudoku has a unique solution, difficulty, saved grid and a new puzzle after victory", async ({
  page,
}) => {
  await page.goto("/fr/sudoku/practice/hard");
  const publicPuzzle = await practice(page, "sudoku", "hard"),
    puzzle = full(publicPuzzle);
  if (puzzle.kind !== "sudoku") throw new Error();
  validateChallenge(puzzle);
  await expect(page.locator(".difficulty-badge")).toContainText("Difficile");
  const empty = puzzle.grid.findIndex((n) => !n),
    cells = page.locator(".sudoku-cell");
  await cells.nth(empty).click();
  await page.keyboard.press(String(puzzle.solution[empty]));
  await page.reload();
  await expect(cells.nth(empty)).toHaveText(String(puzzle.solution[empty]));
  for (let i = 0; i < 81; i++)
    if (!puzzle.grid[i]) {
      await cells.nth(i).click();
      await page.keyboard.press(String(puzzle.solution[i]));
    }
  await page.getByRole("button", { name: "Vérifier la grille" }).click();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await page.getByRole("button", { name: "Rejouer", exact: true }).click();
  await expect
    .poll(async () => (await practice(page, "sudoku", "hard")).id)
    .not.toBe(puzzle.id);
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("Unlimited math hides hints, refuses hint requests and supports immediate replay", async ({
  page,
}) => {
  await page.goto("/fr/compte/practice");
  const puzzle = full(await practice(page, "math"));
  if (puzzle.kind !== "math") throw new Error();
  validateChallenge(puzzle);
  await expect(page.locator(".hint-control")).toHaveCount(0);
  const response = await page.request.post("/api/play", {
    data: { action: "hint" },
  });
  expect(response.status()).toBe(409);
  expect(await response.json()).toMatchObject({ error: "hintUnavailable" });
  await page.locator("#math-expression").fill(puzzle.reference);
  await expect(page.locator("#math-expression")).toHaveValue(puzzle.reference);
  await page.getByRole("button", { name: "Terminer le défi" }).click();
  await expect(page.locator(".completion-panel")).toContainText("Bien joué");
  await expect(page.locator(".comparison-panel:not([data-comparison-preview])")).toHaveCount(0);
  await page.getByRole("button", { name: "Rejouer", exact: true }).click();
  await expect
    .poll(async () => (await practice(page, "math")).id)
    .not.toBe(puzzle.id);
  await expect(page.locator("#math-expression")).toHaveValue("");
});
test("optional signup migrates guest history and drafts; login on a fresh device restores both", async ({
  page,
  browser,
}, testInfo) => {
  const puzzle = generateChallenge("word", "fr", today);
  if (puzzle.kind !== "word") throw new Error();
  await page.goto("/fr/mot");
  await completeWord(page, puzzle);
  await page.goto("/fr/mot/practice");
  const active = await practice(page, "word");
  await guess(page, "AIM");
  const username =
      `sync_${testInfo.project.name.replace(/-/g, "_")}_${Date.now()}`.slice(
        -24,
      ),
    displayName = `Sync ${testInfo.project.name}`;
  await signup(page, username, displayName);
  await page.goto("/fr/stats");
  await expect(page.locator(".stats-game-grid article").first()).toContainText(
    "1",
  );
  const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    other = await context.newPage();
  try {
    await login(other, username);
    await other.goto("/fr/mot/practice");
    await expect(other.locator(".word-row").first()).toHaveText("AIM");
    const profile = await other.request.get("/api/account");
    const data = await profile.json();
    expect(data.completions).toHaveLength(1);
    expect(data.completions[0]).toMatchObject({
      game: "word",
      mode: "daily",
      provenance: "server",
    });
    const drafts = data.snapshots as {
      key: string;
      value: { challenge?: PublicChallenge };
    }[];
    expect(
      drafts.find((r) => r.key === "dailygrid:practice:word:fr:easy")?.value
        .challenge?.id,
    ).toBe(active.id);
    // UI snapshots are disposable; the canonical completed run remains recoverable.
    const discarded = await other.request.post("/api/account", {
      data: {
        action: "sync",
        snapshots: [
          {
            key: `dailygrid:game:${puzzle.id}`,
            value: {},
            updatedAt: Date.now(),
          },
          {
            key: `dailygrid:session:${puzzle.id}`,
            value: {},
            updatedAt: Date.now(),
          },
        ],
      },
    });
    expect(discarded.ok()).toBe(true);
    await other.goto("/fr/mot");
    await expect(other.locator(".completion-panel")).toBeVisible();
    await expect(other.locator(".word-row").first()).toHaveText(
      normalizeWord(puzzle.answer),
    );
    await other.goto("/fr");
    await expect(other.locator(".progress-count")).toHaveCount(0);
  } finally {
    await context.close();
  }
  await page.goto("/fr/account");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.getByLabel("Pseudo", { exact: true })).toBeVisible();
  await page.goto("/fr");
  await expect(page.locator(".progress-count")).toHaveCount(0);
  const names = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("test:events") ?? "[]"),
  );
  expect(names).toEqual(
    expect.arrayContaining([
      "signup_start",
      "signup_complete",
      "local_data_migrated",
      "stats_view",
    ]),
  );
});
test("logout ignores delayed profiles and lets the original guest draft continue", async ({
  page,
}, testInfo) => {
  const username =
    `race_${testInfo.project.name.replace(/-/g, "_")}_${Date.now()}`.slice(-24);
  await page.goto("/fr/mot");
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/play") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === "start",
  );
  await guess(page, "OUTI");
  await started;
  await expect(page.locator(".word-row").first()).toHaveText("OUTI");
  await signup(page, username, "Session race");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let captured: () => void = () => {};
  const intercepted = new Promise<void>((resolve) => {
    captured = resolve;
  });
  let delayed = false;
  await page.route("**/api/account", async (route) => {
    if (route.request().method() === "GET" && !delayed) {
      delayed = true;
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await page.evaluate(() =>
      window.dispatchEvent(new CustomEvent("dailygrid:completed")),
    );
    await intercepted;
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(page.getByLabel("Pseudo", { exact: true })).toBeVisible();
    const returned = page.waitForResponse(
      (r) => r.url().endsWith("/api/account") && r.request().method() === "GET",
    );
    release();
    await returned;
    await expect(page.getByLabel("Pseudo", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Se déconnecter" }),
    ).toHaveCount(0);
    await page.goto("/fr/mot");
    await expect(page.locator(".word-row").first()).toHaveText("OUTI");
    const puzzle = generateChallenge("word", "fr", today);
    if (puzzle.kind !== "word") throw new Error();
    await completeWord(page, puzzle);
  } finally {
    release();
  }
});
test("account suggestions appear occasionally and Never show persists across Unlimited replays", async ({
  page,
}) => {
  await page.goto("/fr/mot/practice");
  for (let i = 0; i < 3; i++) {
    const puzzle = full(await practice(page, "word"));
    if (puzzle.kind !== "word") throw new Error();
    await completeWord(page, puzzle);
    if (i < 2) {
      await expect(page.locator(".account-prompt")).toHaveCount(0);
      await page.getByRole("button", { name: "Rejouer", exact: true }).click();
      await expect(page.locator(".completion-panel")).toHaveCount(0);
    }
  }
  await expect(page.locator(".account-prompt")).toBeVisible();
  await page.getByRole("button", { name: "Ne plus me le proposer" }).click();
  await expect(page.locator(".account-prompt")).toHaveCount(0);
  await page.getByRole("button", { name: "Rejouer", exact: true }).click();
  await expect(page.locator(".completion-panel")).toHaveCount(0);
  const next = full(await practice(page, "word"));
  if (next.kind !== "word") throw new Error();
  await completeWord(page, next);
  await page.reload();
  await expect(page.locator(".account-prompt")).toHaveCount(0);
  const names = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("test:events") ?? "[]"),
  );
  expect(names).toEqual(
    expect.arrayContaining([
      "practice_start",
      "practice_complete",
      "play_again",
      "account_prompt_view",
      "account_prompt_never_show",
    ]),
  );
});
async function board(request: APIRequestContext) {
  return (
    await request.get(
      "/api/leaderboards?game=word&locale=fr&period=today&dimension=performance",
    )
  ).json();
}
test("registered Daily results enter the server leaderboard; local score tampering cannot alter it", async ({
  page,
}, testInfo) => {
  const username =
      `rank_${testInfo.project.name.replace(/-/g, "_")}_${Date.now()}`.slice(
        -24,
      ),
    displayName = `Verified ${testInfo.project.name}`;
  await signup(page, username, displayName);
  await page.goto("/fr/mot");
  const puzzle = generateChallenge("word", "fr", today);
  if (puzzle.kind !== "word") throw new Error();
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/play") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === "start",
  );
  await guess(page, puzzle.answer);
  await started;
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: "Valider", exact: true }).click();
  await expect(page.locator(".completion-panel")).toBeVisible();
  const before = await board(page.request);
  expect(
    before.entries.some(
      (r: { displayName: string }) => r.displayName === displayName,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.endsWith("dailygrid:stats:v1")) {
        const values = JSON.parse(localStorage.getItem(key) ?? "[]");
        values.forEach(
          (r: { score: number; duration: number; attempts: number }) => {
            r.score = 999999;
            r.duration = 0;
            r.attempts = 0;
          },
        );
        localStorage.setItem(key, JSON.stringify(values));
      }
    }
  });
  expect(await board(page.request)).toEqual(before);
  await page.waitForLoadState("networkidle");
  await page.goto("/fr/leaderboards", { waitUntil: "networkidle" });
  await expect(page.locator("table")).toContainText(displayName);
  await page
    .getByRole("combobox", { name: "Critère", exact: true })
    .selectOption("winRate");
  await expect(page.locator(".empty-leaderboard")).toBeVisible();
  await expect(page.locator(".result-footnote")).toContainText("10 parties");
});
test("new routes preserve all four locales, canonical URLs and noindex practice strategy", async ({
  page,
  request,
}) => {
  for (const [locale, slug, label] of [
    ["en", "word", "Unlimited"],
    ["fr", "mot", "Illimité"],
    ["es", "palabra", "Ilimitado"],
    ["de", "wort", "Unbegrenzt"],
  ]) {
    await page.waitForLoadState("networkidle");
    await page.goto(`/${locale}/${slug}/practice`, {
      waitUntil: "networkidle",
    });
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator(".mode-nav .selected")).toHaveText(label);
    await expect(page.locator("meta[name=robots]")).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.locator("link[rel=canonical]")).toHaveAttribute(
      "href",
      new RegExp(`/${locale}/${slug}/practice$`),
    );
    await expect(page.locator("link[hreflang]")).toHaveCount(4);
    await expect(page.locator(".word-board")).toBeVisible();
    await expect(page.locator(".hint-control")).toHaveCount(0);
    const challenge = await savedPracticeChallenge(page,`dailygrid:practice:word:${locale}:easy`);
    const puzzle = full(challenge);
    if (puzzle.kind !== "word") throw new Error();
    // Use the shared board's physical-keyboard path in every locale.
    await expect(
      page.locator(".touch-keyboard .wide-key").first(),
    ).toBeEnabled();
    await page.locator(".word-board").focus();
    for (const letter of normalizeWord(puzzle.answer)) {
      if (letter === "ẞ")
        await page
          .locator(".touch-keyboard")
          .getByRole("button", { name: "ẞ", exact: true })
          .click();
      else await page.keyboard.type(letter);
    }
    await page.locator(".word-board").focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".completion-panel")).toBeVisible();
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/practice");
  expect(sitemap).not.toContain("/account");
});

test("recovery codes can be saved, replaced and used once to recover the same account without email", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/fr/mot");
  const puzzle = generateChallenge("word", "fr", today);
  if (puzzle.kind !== "word") throw new Error();
  await completeWord(page, puzzle);
  const username =
    `backup_${testInfo.project.name.replace(/-/g, "_")}_${Date.now()}`.slice(
      -24,
    );
  await signup(page, username, "Recovery player");
  const codeLocator = page.locator("[data-recovery-code]");
  await expect(codeLocator).toBeVisible();
  const initialCode = (await codeLocator.textContent())!;
  expect(initialCode).toMatch(/^DG(?:-[A-F0-9]{4}){10}$/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le code" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "puzzoria-recovery.txt",
  );
  expect(
    await page.evaluate(
      (secret) =>
        [...Object.values(localStorage), ...Object.values(sessionStorage)].some(
          (v) => v.includes(secret),
        ),
      initialCode,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "J'ai conservé mon code" }).click();
  await expect(codeLocator).toHaveCount(0);
  await page.locator(".recovery-settings:not([data-account-security]):not([data-account-data]) summary").click();
  await page.locator(".recovery-settings:not([data-account-security]):not([data-account-data])")
    .getByLabel("Mot de passe actuel", { exact: true })
    .fill("correct long password");
  await page
    .getByRole("button", { name: "Créer un nouveau code de secours" })
    .click();
  await expect(codeLocator).toBeVisible();
  const code = (await codeLocator.textContent())!;
  expect(code).not.toBe(initialCode);
  const newPassword = "a new correct long password";
  const oldCodeRequest = await page.request.post("/api/account", {
    data: {
      action: "recover",
      username,
      recoveryCode: initialCode,
      password: newPassword,
      confirmPassword: newPassword,
    },
  });
  expect(oldCodeRequest.status()).toBe(401);
  const secondContext = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    }),
    second = await secondContext.newPage();
  try {
    await login(second, username);
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await page.getByRole("button", { name: "Mot de passe oublié ?" }).click();
    await page.getByLabel("Pseudo", { exact: true }).fill(username);
    await page.getByLabel("Code de secours", { exact: true }).fill(code);
    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill(newPassword);
    await page
      .getByLabel("Confirmer le nouveau mot de passe", { exact: true })
      .fill(newPassword);
    await page
      .getByRole("button", { name: "Réinitialiser le mot de passe" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Mot de passe réinitialisé",
    );
    const nextCode = (await codeLocator.textContent())!;
    expect(nextCode).not.toBe(code);
    expect(
      (await (await second.request.get("/api/account")).json()).user,
    ).toBeNull();
    const replay = await page.request.post("/api/account", {
      data: {
        action: "recover",
        username,
        recoveryCode: code,
        password: newPassword,
        confirmPassword: newPassword,
      },
    });
    expect(replay.status()).toBe(401);
    await page.getByRole("button", { name: "J'ai conservé mon code" }).click();
    await page.getByLabel("Pseudo", { exact: true }).fill(username);
    await page.getByLabel("Mot de passe", { exact: true }).fill(newPassword);
    await page
      .locator("form")
      .getByRole("button", { name: "Se connecter", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Recovery player", exact: true }),
    ).toBeVisible();
    const profile = await (await page.request.get("/api/account")).json();
    expect(profile.completions).toHaveLength(1);
    expect(profile.recoveryEnabled).toBe(true);
    expect(JSON.stringify(profile)).not.toContain(nextCode);
    await page.reload();
    await expect(codeLocator).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});

test("small portrait and landscape layouts remain usable with touch input", async ({
  page,
}, testInfo) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
  ]) {
    await page.setViewportSize(viewport);
    for (const path of [
      "/fr",
      "/fr/mot/practice",
      "/fr/sudoku/practice/easy",
      "/fr/compte/practice",
      "/fr/account",
    ]) {
      // Finish initial account/practice requests before the next full navigation.
      await page.goto(path, { waitUntil: "networkidle" });
      if (path === "/fr/account")
        await expect(page.getByLabel("Pseudo", { exact: true })).toBeVisible();
      else if (path.includes("mot"))
        await expect(page.locator(".word-board")).toBeVisible();
      else if (path.includes("sudoku"))
        await expect(page.locator(".sudoku-board")).toBeVisible();
      else if (path.includes("compte"))
        await expect(page.locator("#math-expression")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        path,
      ).toBe(true);
      await expect(
        page.locator(".progress-count, .progress-dots, .hint-control"),
      ).toHaveCount(0);
    }
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/fr/mot/practice", { waitUntil: "networkidle" });
  await expect(page.locator(".word-board")).toBeVisible();
  const tap = async (letter: string) => {
    const button = page
      .locator(".touch-keyboard")
      .getByRole("button", { name: letter, exact: true });
    if (testInfo.project.use.hasTouch) await button.tap();
    else await button.click();
  };
  for (const letter of "OUTIL") await tap(letter);
  await expect(page.locator(".word-row").first()).toHaveText("OUTIL");
  await page.reload();
  await expect(page.locator(".word-row").first()).toHaveText("OUTIL");
  await page.screenshot({
    path: `test-results/touch-small-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
