import { test, expect, type Page, type TestInfo } from "@playwright/test";
import { st } from "../src/lib/social-i18n";
import { gamePath } from "../src/lib/i18n";
import { locales } from "../src/lib/types";
import { generateChallenge } from "../src/lib/challenges";
import { categoryLabel } from "../src/lib/social-categories";
import { rt } from "../src/lib/retention-i18n";
import { pg } from "../src/lib/post-game-i18n";
import {
  recordUnhandledRejections,
  unhandledRejections,
  isWebKitFetchDiagnostic,
} from "./browser-errors";
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
async function saved(page: Page) {
  await expect(page.locator(".social-game")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".game-error")).toHaveCount(0);
}
async function arena(page: Page, secret: string) {
  const you = page.locator('[data-duel-player="you"]');
  const opponent = page.locator('[data-duel-player="opponent"]');
  await expect(page.locator(".number-arena > article")).toHaveCount(2);
  await expect(you.locator(".duel-secret")).toHaveText(secret);
  await expect(opponent.locator(".duel-secret")).toHaveText("?");
  // A replay can still be scrolling. Measure both cards in the same browser
  // task so scroll movement between two protocol calls cannot fake misalignment.
  const {left,right} = await page.locator(".number-arena").evaluate(element => {
    const a=element.querySelector('[data-duel-player="you"]')?.getBoundingClientRect();
    const b=element.querySelector('[data-duel-player="opponent"]')?.getBoundingClientRect();
    return {left:a?{x:a.x,y:a.y,width:a.width}:null,right:b?{x:b.x,y:b.y,width:b.width}:null};
  });
  expect(left).not.toBeNull();
  expect(right).not.toBeNull();
  expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
  expect(Math.abs(left!.y - right!.y)).toBeLessThan(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function card(
  page: Page,
  locale: (typeof locales)[number],
  info: TestInfo,
  name: string,
) {
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: st(locale).image, exact: true })
    .click();
  const file = await download;
  const output = info.outputPath(name);
  await file.saveAs(output);
  const fs = await import("node:fs/promises");
  const png = await fs.readFile(output);
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
}
test("blind ranking locks picks, hides upcoming items, restores and shares in four languages", async ({
  page,
}, info) => {
  for (const locale of locales) {
    const m = st(locale);
    await page.goto(gamePath(locale, "ranking") + "/practice");
    await page.locator(".practice-category select").selectOption("countries");
    await expect(page.locator(".ranking-places button").first()).toBeEnabled();
    await expect(page.locator(".ranking-theme")).toContainText(m.rankingTheme);
    await expect(page.locator(".ranking-theme strong")).toHaveText(
      categoryLabel("countries", locale),
    );
    await expect(page.locator(".ranking-criteria")).toHaveText(
      m.rankingCriteria,
    );
    if (locale === "fr")
      await page
        .locator(".ranking-theme")
        .screenshot({ path: info.outputPath("ranking-theme.png") });
    await expect(page.locator(".blind-item strong")).not.toBeEmpty();
    await page.locator(".ranking-places button").nth(3).click();
    await saved(page);
    await expect(page.locator(".ranking-places button").nth(3)).toBeDisabled();
    await page.reload();
    await expect(page.locator(".ranking-places button").nth(3)).toBeDisabled();
    for (const i of [0, 1, 2, 4]) {
      await expect(page.locator(".ranking-places button").nth(i)).toBeEnabled();
      await page.locator(".ranking-places button").nth(i).click();
      await saved(page);
    }
    await expect(page.locator(".ranking-result li")).toHaveCount(5);
    await expect(
      page.locator(".social-category-heading strong"),
    ).not.toBeEmpty();
    await expect(
      page.locator(".community-result .social-reaction"),
    ).toHaveCount(0);
    await expect(page.locator(".result-top-actions")).toContainText(rt(locale).playAgain);
    await expect(page.locator(".share-card-preview")).toContainText(
      m.rankingName,
    );
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: m.image, exact: true }).click();
    const file = await download;
    await file.saveAs(info.outputPath(`ranking-export-${locale}.png`));
    const path = await file.path();
    expect(path).not.toBeNull();
    const fs = await import("node:fs/promises");
    const png = await fs.readFile(path!);
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.readUInt32BE(16)).toBe(1200);
    expect(png.readUInt32BE(20)).toBe(630);
    if (locale === "fr")
      await page
        .locator(".share-card-preview")
        .screenshot({ path: info.outputPath("ranking-share.png") });
    await page.reload();
    await expect(page.locator(".ranking-result li")).toHaveCount(5);
    await page.getByRole("button", { name: rt(locale).playAgain, exact: true }).click();
    await expect(page.locator(".ranking-places button").first()).toBeEnabled();
    await page.locator(".practice-category select").selectOption("gaming");
    await expect(page.locator(".ranking-theme strong")).toHaveText(
      categoryLabel("gaming", locale),
    );
    await expect(page.locator(".ranking-places button").first()).toBeEnabled();
  }
});
test("would-you-rather gates results until voting, restores locked votes, selects categories and completes", async ({
  page,
}, info) => {
  for (const locale of locales) {
    const m = st(locale);
    await page.goto(gamePath(locale, "rather") + "/practice");
    await expect(page.locator('[data-choice="a"]')).toBeEnabled();
    await expect(page.locator(".vote-percentages")).toHaveCount(0);
    await page.locator(".practice-category select").selectOption("gaming");
    await expect(page.locator(".social-category-heading")).toContainText(
      m.gaming,
    );
    await expect(page.locator('[data-choice="a"]')).toBeEnabled();
    await page.locator('[data-choice="a"]').click();
    await saved(page);
    await expect(page.locator('[data-choice="b"]')).toBeDisabled();
    await page.reload();
    await expect(page.locator('[data-choice="a"]')).toBeDisabled();
    await expect(page.locator(".social-category-heading")).toContainText(
      m.gaming,
    );
    for (let i = 1; i < 5; i++) {
      await page
        .getByRole("button", { name: m.next + " →", exact: true })
        .click();
      await page.locator('[data-choice="b"]').click();
      await saved(page);
    }
    await expect(page.locator(".social-round")).not.toContainText("/");
    await page.getByRole("button", { name: m.review, exact: true }).click();
    await expect(page.locator(".completion-panel")).toContainText(m.summaryNote);
    await expect(page.locator(".share-card-preview")).toContainText(
      m.ratherName,
    );
    if (locale === "fr") await card(page, locale, info, "rather-export.png");
    if (locale === "fr")
      await page
        .locator(".completion-panel")
        .screenshot({ path: info.outputPath("rather-result.png") });
  }
});
test("unlimited dilemmas continue beyond ten, restore their position and let the player request a summary", async ({
  page,
}) => {
  const m = st("fr");
  await page.goto("/fr/tu-preferes/practice");
  // Category changes reserve another server run; vote only after that reservation.
  await Promise.all([
    page.waitForResponse((response) => {
      if (!response.url().endsWith("/api/play") || response.request().method() !== "POST") return false;
      const body = response.request().postDataJSON();
      return body.action === "new" && body.category === "gaming" && response.ok();
    }),
    page.locator(".practice-category select").selectOption("gaming"),
  ]);
  for (let i = 0; i < 12; i++) {
    await expect(page.locator(".social-round")).toHaveText(
      "Dilemme " + (i + 1),
    );
    await expect(page.locator('[data-choice="a"]')).toBeEnabled();
    await page.locator('[data-choice="a"]').click();
    await saved(page);
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    if (i < 11)
      await page
        .getByRole("button", { name: m.next + " →", exact: true })
        .click();
  }
  await page.reload();
  await expect(page.locator(".social-round")).toHaveText("Dilemme 12");
  await expect(page.locator('[data-choice="b"]')).toBeDisabled();
  await page.getByRole("button", { name: m.review, exact: true }).click();
  await expect(page.locator(".completion-panel")).toBeVisible();
  await page.reload();
  await expect(page.locator(".completion-panel")).toBeVisible();
  await page.getByRole("button", { name: m.next + " →", exact: true }).click();
  await expect(page.locator(".social-round")).toHaveText("Dilemme 13");
  await expect(page.locator('[data-choice="a"]')).toBeEnabled();
});
test("number bot accepts manual choices, returns higher/lower, restores and replays in four languages", async ({
  page,
}, info) => {
  for (const locale of locales) {
    await page.context().clearCookies();
    await page.goto("/" + locale);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    const m = st(locale);
    await page.goto(gamePath(locale, "guess", undefined, "hard"));
    const secretInput = page.getByRole("spinbutton", {
      name: m.secret,
      exact: true,
    });
    await expect(secretInput).toHaveValue("");
    await expect(
      page.getByRole("button", { name: m.seal, exact: true }),
    ).toBeDisabled();
    await secretInput.fill("99");
    await page.getByRole("button", { name: m.seal, exact: true }).click();
    await saved(page);
    const publicPuzzle = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).challenge,
      "dailygrid:practice:guess:" + locale + ":hard",
    );
    const c = generateChallenge(
      "guess",
      locale,
      publicPuzzle.date,
      "hard",
      publicPuzzle.id.split(":")[2],
    );
    if (c.kind !== "guess") throw new Error();
    expect(c.rules).toBe("higher-lower");
    await arena(page, "99");
    await expect(
      page.locator(
        ".number-controls select, .number-candidates, .duel-range, .bot-progress",
      ),
    ).toHaveCount(0);
    const input = page.getByRole("spinbutton", { name: m.guess, exact: true });
    const submit = page.getByRole("button", { name: m.guess, exact: true });
    await expect(input).toHaveValue("");
    await expect(submit).toBeDisabled();
    const wrong = c.secret === 1 ? 100 : 1;
    await input.fill(String(wrong));
    await expect(input).toHaveValue(String(wrong));
    await submit.click();
    await saved(page);
    await expect(page.locator(".number-events li")).toHaveCount(2);
    await expect(page.locator(".number-answer")).toContainText(
      c.secret > wrong ? m.higherNumber : m.lowerNumber,
    );
    await expect(page.locator(".number-opponent-answer")).toContainText(
      m.higherNumber,
    );
    await expect(input).toHaveValue("");
    await expect(submit).toBeDisabled();
    if (locale === "fr") {
      await page.evaluate(() => {
        const original = window.fetch.bind(window);
        let failed = false;
        window.fetch = async (input, init) => {
          if (!failed && String(input).startsWith("/api/community?")) {
            failed = true;
            return new Response(JSON.stringify({ error: "networkError" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            });
          }
          return original(input, init);
        };
      });
      // The UI must not reject or automatically correct a number excluded by previous clues.
      await input.fill(String(wrong));
      await expect(submit).toBeEnabled();
      await submit.click();
      await saved(page);
      await expect(page.locator(".community-status")).toHaveText(
        pg(locale).communityUnavailable,
      );
      await page
        .locator(".social-game")
        .screenshot({ path: info.outputPath("number-higher-lower.png") });
    }
    await page.reload();
    await expect(page.locator(".number-events li")).toHaveCount(
      locale === "fr" ? 4 : 2,
    );
    await expect(input).toHaveValue("");
    if (locale === "fr") {
      const runId = await page.evaluate(
        (id) => JSON.parse(localStorage.getItem("dailygrid:run:" + id)!),
        c.id,
      );
      const advanced = await page.request.post("/api/play", {
        data: {
          action: "submit",
          runId,
          sequence: 3,
          step: { kind: "try", value: wrong },
        },
      });
      expect(advanced.ok()).toBe(true);
      // Keep the visible cursor stale, as when another tab has advanced this run.
      await expect(page.locator(".number-events li")).toHaveCount(4);
    }
    await input.fill(String(c.secret));
    await submit.click();
    await saved(page);
    await expect(page.locator(".completion-panel")).toContainText(m.won);
    await expect(page.locator(".number-records")).toContainText(m.wins);
    if (locale === "fr") {
      await page
        .locator(".completion-panel")
        .screenshot({ path: info.outputPath("number-result.png") });
      await card(page, locale, info, "guess-export.png");
    }
    await page.reload();
    await expect(page.locator(".completion-panel")).toContainText(m.won);
    await page.getByRole("button", { name: rt(locale).playAgain, exact: true }).click();
    await expect(secretInput).toHaveValue("");
    await expect(page.locator(".number-controls")).toHaveCount(0);
    await secretInput.fill("27");
    await page.getByRole("button", { name: m.seal, exact: true }).click();
    await saved(page);
    await arena(page, "27");
    await page
      .getByRole("button", { name: m.newNumberGame, exact: true })
      .click();
    await expect(secretInput).toHaveValue("");
    // Wait for the new owned run before navigating to the next language.
    await expect(secretInput).toBeEnabled();
  }
});

test("a resumed legacy number game accepts a manual proposal through the real UI", async ({
  page,
}) => {
  await page.goto("/fr");
  const created = await page.request.post("/api/play", {
    data: {
      action: "new",
      game: "guess",
      locale: "fr",
      date: "2026-10-03",
      mode: "archive",
      difficulty: "easy",
    },
  });
  expect(created.ok()).toBe(true);
  const run = await created.json();
  expect(run.challenge.rules).toBeUndefined();
  expect(
    (
      await page.request.post("/api/play", {
        data: { action: "start", runId: run.runId },
      })
    ).ok(),
  ).toBe(true);
  expect(
    (
      await page.request.post("/api/play", {
        data: {
          action: "submit",
          runId: run.runId,
          sequence: 0,
          step: { kind: "secret", value: 99 },
        },
      })
    ).ok(),
  ).toBe(true);
  await page.goto(gamePath("fr", "guess", "2026-10-03", "easy"));
  const input = page.getByRole("spinbutton", {
    name: st("fr").guess,
    exact: true,
  });
  await expect(input).toBeEnabled();
  await input.fill("1");
  const response = page.waitForResponse(
    async (r) =>
      r.url().endsWith("/api/play") &&
      r.request().method() === "POST" &&
      r.request().postDataJSON()?.action === "submit",
  );
  await page.getByRole("button", { name: st("fr").guess, exact: true }).click();
  expect((await response).ok()).toBe(true);
  await saved(page);
  await expect(page.locator(".number-events li")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".number-events li")).toHaveCount(2);
});

test("two separate devices share a real room, protect numbers and alternate turns", async ({
  page,
  browser,
}, info) => {
  const m = st("fr");
  // Historical turn-based number rooms remain readable. New entry points use simultaneous live rooms.
  await page.goto("/fr");
  const legacy = await page.request.post("/api/number-rooms", {data:{action:"create",locale:"fr"}});
  const legacyCode = (await legacy.json()).code;
  await page.goto(`/fr/number-room/${legacyCode}`);
  await expect(page.locator(".room-code strong")).toHaveText(/^[A-Z2-9]{8}$/);
  const code = (await page.locator(".room-code strong").innerText()).trim();
  await page
    .getByRole("spinbutton", { name: m.secret, exact: true })
    .fill("42");
  await page.getByRole("button", { name: m.seal, exact: true }).click();
  const friendContext = await browser.newContext({
    ...info.project.use,
    extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.250" },
  });
  const friend = await friendContext.newPage();
  const friendErrors: string[] = [];
  await recordUnhandledRejections(friend);
  friend.on("pageerror", (e) => friendErrors.push(e.message));
  friend.on("console", (e) => {
    if (e.type() === "error") friendErrors.push(e.text());
  });
  let initialProfiles = 0;
  friend.on("request", (request) => {
    if (
      request.method() === "GET" &&
      new URL(request.url()).pathname === "/api/account"
    )
      initialProfiles++;
  });
  await friend.goto("http://127.0.0.1:3100/fr/number-room/" + code);
  await expect(friend.locator(".room-code strong")).toHaveText(code);
  expect(initialProfiles).toBe(1);
  await expect(friend.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  const response = await friend.request.get("/api/number-rooms?code=" + code);
  const state = await response.json();
  expect(state.number).toBeNull();
  expect(state).not.toHaveProperty("numbers");
  await friend
    .getByRole("spinbutton", { name: m.secret, exact: true })
    .fill("73");
  await friend.getByRole("button", { name: m.seal, exact: true }).click();
  await expect(friend.locator(".turn-banner")).toContainText(m.opponentTurn);
  await expect(page.locator(".turn-banner")).toContainText(m.yourTurn);
  await arena(page, "42");
  await arena(friend, "73");
  await expect(
    friend.getByRole("button", { name: m.guess, exact: true }),
  ).toBeDisabled();
  await page
    .locator(".number-arena")
    .screenshot({ path: info.outputPath("number-friends.png") });
  await page.getByRole("spinbutton", { name: m.guess, exact: true }).fill("50");
  await page.getByRole("button", { name: m.guess, exact: true }).click();
  await expect(page.locator(".turn-banner")).toContainText(m.opponentTurn);
  await expect(friend.locator(".turn-banner")).toContainText(m.yourTurn);
  await expect(
    page.getByRole("button", { name: m.guess, exact: true }),
  ).toBeDisabled();
  await expect(
    friend.getByRole("spinbutton", { name: m.guess, exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".number-answer")).toContainText(m.higherNumber);
  await friend
    .getByRole("spinbutton", { name: m.guess, exact: true })
    .fill("100");
  await friend.getByRole("button", { name: m.guess, exact: true }).click();
  await expect(friend.locator(".number-answer")).toContainText(m.lowerNumber);
  await expect(page.locator(".turn-banner")).toContainText(m.yourTurn);
  await page.getByRole("spinbutton", { name: m.guess, exact: true }).fill("75");
  await page.getByRole("button", { name: m.guess, exact: true }).click();
  await expect(page.locator(".number-answer")).toContainText(m.lowerNumber);
  await expect(friend.locator(".turn-banner")).toContainText(m.yourTurn);
  await friend
    .getByRole("spinbutton", { name: m.guess, exact: true })
    .fill("42");
  await friend.getByRole("button", { name: m.guess, exact: true }).click();
  await expect(friend.locator(".completion-panel")).toContainText(m.won);
  await expect(page.locator(".completion-panel")).toContainText(m.lost);
  await expect(page.locator(".number-arena")).toBeVisible();
  await expect(friend.locator(".number-arena")).toBeVisible();
  await expect(page.locator(".duel-secret")).not.toContainText(["?", "?"]);
  await page
    .locator(".completion-panel")
    .screenshot({ path: info.outputPath("friend-result.png") });
  await friend.reload();
  await expect(friend.locator(".completion-panel")).toContainText(m.won);
  await page.getByRole("button", { name: m.replay, exact: true }).click();
  await expect(page.locator(".room-code strong")).not.toHaveText(code);
  await expect(
    page.getByRole("spinbutton", { name: m.secret, exact: true }),
  ).toHaveValue("");
  expect(friendErrors).toEqual([]);
  expect(await unhandledRejections(friend)).toEqual([]);
  await friendContext.close();
});
test("real isolated test votes unlock community reactions without exposing unvoted questions", async ({
  page,
  playwright,
  browser,
}, info) => {
  test.setTimeout(120000);
  const m = st("fr");
  // These fixtures use only Playwright's fresh ignored database, never the user's database.
  for (let batch = 0; batch < 10; batch++)
    await Promise.all(
      Array.from({ length: 5 }, async (_, offset) => {
        const n = batch * 5 + offset,
          peer = await playwright.request.newContext({
            baseURL: "http://127.0.0.1:3100",
            extraHTTPHeaders: {
              Origin: "http://127.0.0.1:3100",
              "X-Forwarded-For": `198.51.100.${n + 1}`,
            },
          });
        try {
          for (const game of ["ranking", "rather"]) {
            const r = await peer.post("/api/play", {
              data: {
                action: "new",
                game,
                locale: "fr",
                mode: "archive",
                date: "2026-10-03",
              },
            });
            expect(r.ok()).toBeTruthy();
            const run = await r.json();
            await peer.post("/api/play", {
              data: { action: "start", runId: run.runId },
            });
            for (
              let sequence = 0;
              sequence < (game === "ranking" ? 5 : 10);
              sequence++
            ) {
              const response = await peer.post("/api/play", {
                data: {
                  action: "submit",
                  runId: run.runId,
                  sequence,
                  step:
                    game === "ranking"
                      ? { kind: "rank", position: sequence + 1 }
                      : { kind: "vote", choice: n < 19 ? "a" : "b" },
                },
              });
              expect(response.ok()).toBeTruthy();
            }
          }
        } finally {
          await peer.dispose();
        }
      }),
    );
  await page.goto("/fr/tu-preferes/archive/2026-10-03");
  await expect(page.locator('[data-choice="a"]')).toBeEnabled();
  await expect(page.locator(".vote-percentages")).toHaveCount(0);
  await page.locator('[data-choice="a"]').click();
  await saved(page);
  const data = await page.evaluate(async () => {
    const ids = Object.keys(localStorage).filter(
      (k) =>
        k.includes("run:") &&
        k.includes("rather:") &&
        !k.includes("practice:") &&
        !k.endsWith(":updated"),
    );
    const id = JSON.parse(localStorage.getItem(ids[0])!);
    return (await (await fetch("/api/community?runId=" + id)).json()).community;
  });
  const q = data.questions[0];
  expect(q.samples).toBeGreaterThanOrEqual(50);
  expect(q.a + q.b).toBe(100);
  await expect(page.locator(".vote-percentages")).toContainText(q.a + "%");
  await expect(page.locator(".vote-percentages")).toContainText(q.b + "%");
  await expect(page.locator(".vote-reveal")).toContainText(m.minority);
  await page.getByRole("button", { name: m.next + " →", exact: true }).click();
  await expect(page.locator(".vote-percentages")).toHaveCount(0);
  await page.goto("/fr/classement-aveugle/archive/2026-10-03");
  for (let i = 0; i < 5; i++) {
    await expect(page.locator(".ranking-places button").nth(i)).toBeEnabled();
    await page.locator(".ranking-places button").nth(i).click();
    await saved(page);
  }
  await expect(page.locator(".community-result")).toContainText(m.community);
  await expect(page.locator(".ranking-result")).toContainText(/\d+\s?%/);
  await expect(page.locator(".community-result")).not.toContainText(m.waiting);
  await expect(page.locator(".community-average")).toContainText(
    m.averageRanking,
  );
  await expect(page.locator(".average-ranking li")).toHaveCount(5);
  await page
    .locator(".community-result")
    .screenshot({ path: info.outputPath("ranking-average.png") });
  const rareContext = await browser.newContext({ ...info.project.use });
  const rarePage = await rareContext.newPage();
  await recordUnhandledRejections(rarePage);
  const rareErrors: string[] = [];
  rarePage.on("pageerror", (e) => rareErrors.push(e.message));
  rarePage.on("console", (e) => {
    if (e.type() === "error") rareErrors.push(e.text());
  });
  await rarePage.goto(
    "http://127.0.0.1:3100/fr/classement-aveugle/archive/2026-10-03",
  );
  for (const i of [4, 3, 2, 1, 0]) {
    await expect(
      rarePage.locator(".ranking-places button").nth(i),
    ).toBeEnabled();
    await rarePage.locator(".ranking-places button").nth(i).click();
    await saved(rarePage);
  }
  await expect(
    rarePage.locator(".community-result > .social-reaction").first(),
  ).toContainText("l’ont placé ailleurs");
  await expect(
    rarePage.locator(".community-result > .social-reaction").first(),
  ).toContainText(/\d+\s%/);
  await rarePage
    .locator(".community-result")
    .screenshot({ path: info.outputPath("ranking-reactions.png") });
  expect(rareErrors).toEqual([]);
  expect(await unhandledRejections(rarePage)).toEqual([]);
  await rareContext.close();
});
test("new SEO pages work without JavaScript in all locales, rooms remain noindex and cards fit 320px", async ({
  browser,
  page,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    for (const locale of locales) {
      const p = await context.newPage();
      for (const game of ["ranking", "rather", "guess"] as const) {
        await p.goto("http://127.0.0.1:3100" + gamePath(locale, game));
        await expect(p.locator("h1")).not.toBeEmpty();
        await expect(p.locator(".game-guide")).toBeVisible();
        await expect(p.locator('link[rel="alternate"][hreflang]')).toHaveCount(
          5,
        );
        await expect(p.locator("[data-game-preview]")).toBeVisible();
      }
      await p.close();
    }
  } finally {
    await context.close();
  }
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/fr");
  await expect(page.locator(".game-card")).toHaveCount(9);
  await page
    .locator(".game-cards")
    .screenshot({ path: "test-results/social-home-320.png" });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const buttons = await page.locator(".card-play").evaluateAll((nodes) =>
    nodes.map((n) => ({
      background: getComputedStyle(n).backgroundColor,
      color: getComputedStyle(n).color,
      height: n.getBoundingClientRect().height,
    })),
  );
  for (const b of buttons) {
    expect(b.background).not.toBe(b.color);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  // The hard bot opens at 50, so protecting 99 keeps this layout fixture active.
  // An easy bot can legitimately guess 99 immediately and reveal the result.
  await page.goto(gamePath("fr", "guess", undefined, "hard"));
  const m = st("fr");
  await page
    .getByRole("spinbutton", { name: m.secret, exact: true })
    .fill("99");
  await page
    .locator(".number-arena")
    .screenshot({ path: "test-results/number-setup-320.png" });
  await page.getByRole("button", { name: m.seal, exact: true }).click();
  await saved(page);
  await arena(page, "99");
  const publicPuzzle = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("dailygrid:practice:guess:fr:hard")!)
        .challenge,
  );
  const puzzle = generateChallenge(
    "guess",
    "fr",
    publicPuzzle.date,
    "hard",
    publicPuzzle.id.split(":")[2],
  );
  if (puzzle.kind !== "guess") throw new Error();
  await page
    .getByRole("spinbutton", { name: m.guess, exact: true })
    .fill(puzzle.secret === 1 ? "100" : "1");
  await page.getByRole("button", { name: m.guess, exact: true }).click();
  await saved(page);
  await arena(page, "99");
  await page
    .locator(".social-game")
    .screenshot({ path: "test-results/number-playing-320.png" });
});

test("a saved blind placement survives a lost response without being overwritten", async ({
  page,
}) => {
  await page.goto("/fr/classement-aveugle/practice");
  await expect(page.locator(".ranking-places button").first()).toBeEnabled();
  await page.evaluate(() => {
    const original = window.fetch.bind(window);
    let dropped = false;
    window.fetch = async (input, init) => {
      const r = await original(input, init);
      if (
        !dropped &&
        typeof init?.body === "string" &&
        JSON.parse(init.body).action === "submit" &&
        r.ok
      ) {
        dropped = true;
        throw new TypeError("Simulated lost response after commit");
      }
      return r;
    };
  });
  await page.locator(".ranking-places button").nth(2).click();
  await expect(page.locator(".ranking-places button").nth(2)).toBeDisabled();
  await expect(page.locator(".social-game")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".game-error")).toBeVisible();
  await page.locator(".ranking-places button").nth(0).click();
  await saved(page);
  await expect(page.locator(".ranking-places .locked")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".ranking-places .locked")).toHaveCount(2);
});
