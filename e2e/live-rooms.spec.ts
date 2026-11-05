import {
  test,
  expect,
  type Page,
  type Browser,
  type TestInfo,
} from "@playwright/test";
import { liveGames, type LiveGame } from "../src/lib/live-types";
import { lt } from "../src/lib/live-i18n";
import { st } from "../src/lib/social-i18n";
import { t } from "../src/lib/i18n";
import { mapCopy } from "../src/lib/map-i18n";
import { kt } from "../src/lib/knowledge-i18n";
import mapCountries from "../src/lib/server/data/europe-map.v1.json" with { type: "json" };
const m = lt("fr"),
  s = st("fr");
async function pair(
  page: Page,
  browser: Browser,
  info: TestInfo,
  game: LiveGame,
  category = game === "quiz" ? "planets" : undefined,
) {
  await page.addInitScript(() =>
    localStorage.setItem("puzzoria:measurement-choice", "no"),
  );
  await page.goto("/fr/live");
  await expect(
    page.getByRole("button", { name: m.create, exact: true }),
  ).toBeEnabled();
  const decline = page.getByRole("button", { name: "Non merci", exact: true });
  if (await decline.count()) await decline.click();
  const res = await page.request.post("/api/live-rooms", {
    data: { action: "create", game, locale: "fr", name: "Aimeric test", ...(category ? { category } : {}) },
  });
  expect(res.ok()).toBe(true);
  const room = await res.json();
  await page.goto(`/fr/live/${room.code}`);
  const peerContext = await browser.newContext({
      ...info.project.use,
      baseURL: "http://127.0.0.1:3100",
      extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.249" },
    }),
    peer = await peerContext.newPage();
  await peerContext.addInitScript(() =>
    localStorage.setItem("puzzoria:measurement-choice", "no"),
  );
  await peer.goto(`/fr/live/${room.code}`);
  const peerDecline = peer.getByRole("button", {
    name: "Non merci",
    exact: true,
  });
  if (await peerDecline.count()) await peerDecline.click();
  await peer
    .getByRole("textbox", { name: m.name, exact: true })
    .fill("Mon ami");
  await peer.getByRole("button", { name: m.join, exact: true }).click();
  await expect(page.locator(".live-scoreboard")).toContainText("Mon ami");
  await expect(peer.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  if (game === "guess") {
    await page
      .getByRole("spinbutton", { name: s.secret, exact: true })
      .fill("73");
    await page.getByRole("button", { name: s.seal, exact: true }).click();
    await peer
      .getByRole("spinbutton", { name: s.secret, exact: true })
      .fill("42");
    await peer.getByRole("button", { name: s.seal, exact: true }).click();
  }
  await page.getByRole("button", { name: m.ready, exact: true }).click();
  await peer.getByRole("button", { name: m.ready, exact: true }).click();
  await expect(page.locator("[data-live-room]")).toHaveAttribute(
    "data-phase",
    "playing",
    { timeout: 12000 },
  );
  await expect(peer.locator("[data-live-room]")).toHaveAttribute(
    "data-phase",
    "playing",
    { timeout: 12000 },
  );
  if (game !== "guess") {
    await expect(page.locator(".live-board [data-game-root]")).toBeVisible();
    await expect(peer.locator(".live-board [data-game-root]")).toBeVisible();
  }
  return { peer, peerContext, code: room.code };
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
for (const game of liveGames)
  test(`${game} has a shared start, responsive board and common result on separate devices`, async ({
    page,
    browser,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const { peer, peerContext } = await pair(page, browser, info, game);
    try {
      await noOverflow(page);
      await noOverflow(peer);
      if (game === "word")
        await expect(page.locator(".word-board")).toBeVisible();
      if (game === "sudoku")
        await expect(
          page.getByRole("button", { name: t("fr").pause, exact: true }),
        ).toHaveCount(0);
      if (game === "wordsearch") {
        await expect(page.locator(".wordsearch-start")).toHaveCount(0);
        await expect(page.locator(".classic-board")).not.toHaveAttribute(
          "data-locked",
          "true",
        );
      }
      if (game === "guess") {
        await expect(
          page.getByRole("spinbutton", { name: s.guess, exact: true }),
        ).toHaveValue("");
        await expect(
          peer.getByRole("spinbutton", { name: s.guess, exact: true }),
        ).toHaveValue("");
        await expect(
          page.locator('[data-duel-player="opponent"] .duel-secret'),
        ).toHaveText("?");
      }
      if (["word", "sudoku", "guess"].includes(game))
        await page
          .locator("[data-live-room]")
          .screenshot({ path: info.outputPath(`${game}-playing.png`) });
      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: m.resign, exact: true }).click();
      await expect(peer.locator("[data-live-room]")).toHaveAttribute(
        "data-phase",
        "finished",
      );
      await expect(peer.locator(".completion-panel h2")).toHaveText(
        ["rather", "ranking"].includes(game) ? m.together : m.won,
      );
      await expect(page.locator(".completion-panel")).toHaveCount(1);
      await expect(peer.locator(".completion-panel")).toHaveCount(1);
      await expect(page.locator(".completion-panel")).not.toContainText(
        "undefined",
      );
      await expect(peer.locator(".completion-panel")).not.toContainText(
        "undefined",
      );
      if(game === "football") await expect(peer.locator(".completion-panel .football-reveal strong")).not.toBeEmpty();
      if(game === "quiz") {await peer.locator(".knowledge-duel-answers summary").click();await expect(peer.locator(".knowledge-duel-answers dd")).not.toHaveCount(0);}
      await expect(
        page.locator(game === "guess" ? ".number-arena" : ".live-board"),
      ).toBeVisible();
      await expect(
        peer.locator(game === "guess" ? ".number-arena" : ".live-board"),
      ).toBeVisible();
      await expect(
        peer
          .locator(".result-utility-actions")
          .getByRole("button", { name: t("fr").share, exact: true }),
      ).toBeVisible();
      await peer.evaluate(() => {
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async ({ text }: { text: string }) => {
            sessionStorage.setItem("test:duel-share", text);
          },
        });
      });
      await peer
        .locator(".result-utility-actions")
        .getByRole("button", { name: t("fr").share, exact: true })
        .click();
      expect(
        await peer.evaluate(() => sessionStorage.getItem("test:duel-share")),
      ).toContain("Puzzoria");
      await noOverflow(page);
      await noOverflow(peer);
      if (["word", "rather", "ranking"].includes(game))
        await peer
          .locator("[data-live-room]")
          .screenshot({ path: info.outputPath(`${game}-finished.png`) });
      const old =
        game !== "guess"
          ? await peer
              .locator("[data-game-root]")
              .getAttribute("data-challenge-id")
          : null;
      await page.getByRole("button", { name: m.rematch, exact: true }).click();
      await peer.getByRole("button", { name: m.rematch, exact: true }).click();
      await expect(page.locator("[data-live-room]")).toHaveAttribute(
        "data-phase",
        "lobby",
      );
      await expect(page.locator(".completion-panel")).toHaveCount(0);
      await expect(page.locator(".live-board")).toHaveCount(0);
      if (game === "word") {
        await page.getByRole("button", { name: m.ready, exact: true }).click();
        await peer.getByRole("button", { name: m.ready, exact: true }).click();
        await expect(peer.locator("[data-game-root]")).not.toHaveAttribute(
          "data-challenge-id",
          old!,
        );
        await expect(peer.locator(".word-row").first()).toHaveText("");
      }
      expect(errors).toEqual([]);
    } finally {
      await peerContext.close();
    }
  });
test("Europe map duel keeps placements private, resolves both real runs and rematches on a fresh map", async ({page,browser},info) => {
  const map=mapCopy("fr"),quiz=kt("fr"),{peer,peerContext,code}=await pair(page,browser,info,"quiz","europe-map");
  try {
    const oldId=await page.locator('[data-game-root]').getAttribute('data-challenge-id');
    for(const player of [page,peer]){
      await expect(player.locator('[data-map-region]')).toHaveCount(44);
      await expect(player.getByRole('button',{name:map.skip,exact:true})).toBeEnabled();
      await expect(player.locator('.knowledge-answer-form')).toHaveCount(0);
      await expect(player.locator('.knowledge-duel-answers')).toHaveCount(0);
      await noOverflow(player);
    }
    await expect(peer.locator('.map-target strong')).toHaveText((await page.locator('.map-target strong').textContent())!);
    const prompt=await page.locator('.map-target strong').textContent(),country=mapCountries.find(c=>c.name.fr===prompt)!;
    const region=page.locator(`[data-map-region="${country.region}"]`);
    await region.focus();await page.keyboard.press('Enter');
    await page.getByRole('button',{name:map.confirm,exact:true}).click();
    await expect(region).toHaveClass(/correct/);
    await expect(peer.locator('.live-player').first().locator('.live-player-metric b')).toHaveText('1');
    await expect(peer.locator(`[data-map-region="${country.region}"]`)).not.toHaveClass(/correct|incorrect/);
    await expect(peer.locator('.knowledge-scoreboard strong').first()).toHaveText('0/44');
    const peerView=await(await peer.request.get(`/api/live-rooms?code=${code}`)).json();
    expect(JSON.stringify(peerView)).not.toContain(country.region);
    for(const player of [page,peer]){
      player.once('dialog',dialog=>dialog.accept());
      await player.getByRole('button',{name:quiz.finish,exact:true}).click();
      await expect(player.locator('.map-target')).toContainText(map.ended);
    }
    for(const player of [page,peer]){
      await expect(player.locator('[data-live-room]')).toHaveAttribute('data-phase','finished');
      await expect(player.locator('[data-map-region]')).toHaveCount(44);
      await expect(player.locator('.completion-panel')).toHaveCount(1);
      await expect(player.locator('.knowledge-duel-answers')).toHaveCount(0);
      await noOverflow(player);
    }
    await expect(page.locator('.completion-panel h2')).toHaveText(m.won);
    await expect(peer.locator('.completion-panel h2')).toHaveText(m.lost);
    await page.getByRole('button',{name:m.rematch,exact:true}).click();
    await peer.getByRole('button',{name:m.rematch,exact:true}).click();
    await expect(page.locator('[data-live-room]')).toHaveAttribute('data-phase','lobby');
    await page.getByRole('button',{name:m.ready,exact:true}).click();
    await peer.getByRole('button',{name:m.ready,exact:true}).click();
    await expect(page.locator('[data-game-root]')).not.toHaveAttribute('data-challenge-id',oldId!);
    await expect(page.locator('[data-map-region]')).toHaveCount(44);
    await expect(page.locator('.knowledge-scoreboard strong').first()).toHaveText('0/44');
  } finally { await peerContext.close(); }
});
test("Wordle exchanges live attempts, retains both grids and waits for the second finish", async ({
  page,
  browser,
}, info) => {
  const { peer, peerContext, code } = await pair(page, browser, info, "word");
  async function guess(p: Page) {
    await expect(
      p.getByRole("button", { name: t("fr").enter, exact: true }),
    ).toBeEnabled();
    const response = p.waitForResponse(
      (r) =>
        r.url().endsWith("/api/live-rooms") &&
        r.request().postDataJSON()?.action === "submit",
    );
    await p.locator(".word-board").focus();
    await p.keyboard.type("OUTIL");
    await p.getByRole("button", { name: t("fr").enter, exact: true }).click();
    expect((await response).ok()).toBe(true);
    return (await response).json();
  }
  try {
    await guess(page);
    await expect(
      peer.locator(".live-player").first().locator(".live-player-metric b"),
    ).toHaveText("1");
    await page.reload();
    await expect(page.locator(".word-row").first()).toHaveText("OUTIL");
    for (let i = 1; i < 6; i++) {
      const state = await (
        await page.request.get(`/api/live-rooms?code=${code}`)
      ).json();
      if (state.players[0].finished) break;
      await guess(page);
    }
    await expect(page.locator(".live-wait-finish")).toBeVisible();
    await expect(page.locator(".completion-panel")).toHaveCount(0);
    for (let i = 0; i < 6; i++) {
      const result = await guess(peer);
      if (result.completed) break;
    }
    await expect(page.locator(".completion-panel")).toHaveCount(1);
    await expect(peer.locator(".completion-panel")).toHaveCount(1);
    await expect(page.locator(".revealed-answer")).toBeVisible();
    await expect(peer.locator(".revealed-answer")).toBeVisible();
    await expect(page.locator(".word-board")).toBeVisible();
    await expect(peer.locator(".word-board")).toBeVisible();
  } finally {
    await peerContext.close();
  }
});
test("number proposals are simultaneous and fewer guesses wins, with saved results after reload", async ({
  page,
  browser,
}, info) => {
  const { peer, peerContext } = await pair(page, browser, info, "guess");
  async function guess(p: Page, value: string) {
    await p.getByRole("spinbutton", { name: s.guess, exact: true }).fill(value);
    await p.getByRole("button", { name: s.guess, exact: true }).click();
  }
  try {
    await guess(page, "10");
    await expect(page.locator(".live-guess-history")).toContainText(
      s.higherNumber,
    );
    await expect(
      peer.getByRole("spinbutton", { name: s.guess, exact: true }),
    ).toBeEnabled();
    await guess(page, "42");
    await expect(page.locator(".live-wait-finish")).toBeVisible();
    await guess(peer, "73");
    await expect(peer.locator(".completion-panel h2")).toHaveText(m.won);
    await expect(page.locator(".completion-panel h2")).toHaveText(m.lost);
    await peer.reload();
    await expect(peer.locator(".completion-panel h2")).toHaveText(m.won);
    await expect(peer.locator(".duel-secret")).toHaveText(["42", "73"]);
    await noOverflow(peer);
  } finally {
    await peerContext.close();
  }
});
test("all four languages can create a private room without exposing a puzzle", async ({
  page,
}) => {
  for (const locale of ["en", "fr", "es", "de"] as const) {
    await page.goto(`/${locale}/live`);
    await expect(
      page.getByRole("button", { name: lt(locale).create, exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: lt(locale).create, exact: true })
      .click();
    await expect(page.locator("[data-live-room]")).toHaveAttribute(
      "data-phase",
      "lobby",
    );
    await expect(page.locator(".live-scoreboard article")).toHaveCount(2);
    await expect(page.locator(".word-board")).toHaveCount(0);
    await noOverflow(page);
  }
});
for (const game of ["ranking", "rather"] as const)
  test(`${game} finishes through real choices and reveals genuine agreements`, async ({
    page,
    browser,
  }, info) => {
    const { peer, peerContext, code } = await pair(page, browser, info, game);
    async function choose(p: Page, index: number, other: boolean) {
      const button =
        game === "ranking"
          ? p.locator(".ranking-places button").nth(other ? 4 - index : index)
          : p.locator(`[data-choice="${other ? "b" : "a"}"]`);
      await expect(button).toBeEnabled();
      const response = p.waitForResponse(
        (r) =>
          r.url().endsWith("/api/live-rooms") &&
          r.request().postDataJSON()?.action === "submit",
      );
      await button.click();
      expect((await response).ok()).toBe(true);
      if (game === "rather" && index < 9)
        await p
          .getByRole("button", { name: `${s.next} →`, exact: true })
          .click();
    }
    try {
      const count = game === "ranking" ? 5 : 10;
      for (let i = 0; i < count; i++) await choose(page, i, false);
      await expect(page.locator(".live-wait-finish")).toBeVisible();
      expect(
        (await (await peer.request.get(`/api/live-rooms?code=${code}`)).json())
          .choices,
      ).toBeUndefined();
      for (let i = 0; i < count; i++) await choose(peer, i, true);
      await expect(peer.locator(".completion-panel h2")).toHaveText(m.together);
      if (game === "ranking")
        await expect(
          peer.locator(".live-ranking .live-choice-row"),
        ).toHaveCount(5);
      else
        await expect(peer.locator(".live-agreement strong")).toHaveText("0/10");
      await peer.evaluate(() =>
        Object.defineProperty(navigator, "share", {
          configurable: true,
          value: async ({ text }: { text: string }) =>
            sessionStorage.setItem("test:real-choice-share", text),
        }),
      );
      await peer
        .locator(".result-utility-actions")
        .getByRole("button", { name: t("fr").share, exact: true })
        .click();
      const shared = await peer.evaluate(() =>
        sessionStorage.getItem("test:real-choice-share"),
      );
      expect(shared).toContain(game === "ranking" ? "#5" : "0/10");
      if (game === "ranking") {
        await expect(peer.locator(".live-ranking")).not.toContainText("—");
        expect(shared).not.toContain("—");
      }
      await noOverflow(peer);
      await peer
        .locator("[data-live-room]")
        .screenshot({ path: info.outputPath(`${game}-real-result.png`) });
      await peer.reload();
      await expect(peer.locator("[data-live-room]")).toHaveAttribute(
        "data-phase",
        "finished",
        { timeout: 15000 },
      );
      await expect(peer.locator(".completion-panel h2")).toHaveText(m.together);
      await expect(peer.locator(".live-board")).toBeVisible();
    } finally {
      await peerContext.close();
    }
  });

test("a game's invitation opens a fresh real-time lobby, including the unusual Wordle variant", async ({
  page,
}) => {
  for (const path of ["/fr/mot", "/fr/mot-insolite"]) {
    await page.goto(path);
    const button = page.locator(".live-entry [data-invite-button]");
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page).toHaveURL(/\/fr\/live\/[A-Za-z0-9_-]{43}$/);
    await expect(page.locator("[data-live-room]")).toHaveAttribute(
      "data-phase",
      "lobby",
    );
    await expect(page.locator(".word-board")).toHaveCount(0);
    const code = page.url().split("/").at(-1);
    const state = await (
      await page.request.get(`/api/live-rooms?code=${code}`)
    ).json();
    expect(state.game).toBe("word");
    expect(state.challenge).toBeUndefined();
  }
});

test("HTTP fallback keeps a number duel playable when event streams are unavailable", async ({
  page,
  browser,
}, info) => {
  await page.route("**/api/live-rooms?**stream=1", (route) => route.abort());
  const { peer, peerContext } = await pair(page, browser, info, "guess");
  try {
    await peer.route("**/api/live-rooms?**stream=1", (route) => route.abort());
    await peer.reload();
    await page
      .getByRole("spinbutton", { name: s.guess, exact: true })
      .fill("42");
    await page.getByRole("button", { name: s.guess, exact: true }).click();
    await expect(page.locator(".live-wait-finish")).toBeVisible();
    await expect(
      peer.getByRole("spinbutton", { name: s.guess, exact: true }),
    ).toBeEnabled();
    await peer
      .getByRole("spinbutton", { name: s.guess, exact: true })
      .fill("73");
    await peer.getByRole("button", { name: s.guess, exact: true }).click();
    await expect(page.locator(".completion-panel")).toHaveCount(1);
    await expect(peer.locator(".completion-panel")).toHaveCount(1);
  } finally {
    await peerContext.close();
  }
});
