import { test, expect } from "@playwright/test";
import { directions, slide } from "../src/lib/tile2048";

for (const game of ["2048", "ranking"] as const) {
  for (const leave of [false, true]) {
    test(`${game}: late failed submission ${leave ? "does not restore after leaving" : "restores while active"}`, async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem("puzzoria:measurement-choice", "no");
        const original = window.fetch.bind(window);
        const probe = {
          pending: false,
          recoveries: 0,
          release: () => {},
        };
        Object.assign(window, { recoveryProbe: probe });
        window.fetch = async (input, init) => {
          const url = String(input);
          if (url.startsWith("/api/play") && init?.method === "POST" &&
              JSON.parse(String(init.body)).action === "submit") {
            probe.pending = true;
            // Fail locally before sending a move: recovery should still work
            // for the active component, but must not run after its cleanup.
            await new Promise<void>((resolve) => { probe.release = resolve; });
            return Response.json({ error: "invalid" }, { status: 409 });
          }
          if (probe.pending && url.startsWith("/api/play?runId=")) probe.recoveries++;
          return original(input, init);
        };
      });
      await page.goto(game === "2048" ? "/fr/2048/practice" : "/fr/classement-aveugle/practice");
      if (game === "2048") {
        const controls = page.locator(".direction-controls button");
        await expect(controls.first()).toBeEnabled();
        const grid = await page.locator("[data-tile-value]").evaluateAll(
          (nodes) => nodes.map((n) => Number(n.getAttribute("data-tile-value"))),
        );
        const direction = directions.find((d) => slide(grid, d).changed)!;
        await page.locator(".board-tiles").focus();
        await page.keyboard.press({ left: "ArrowLeft", right: "ArrowRight", up: "ArrowUp", down: "ArrowDown" }[direction]);
      } else {
        await expect(page.locator(".ranking-places button").first()).toBeEnabled();
        await page.locator(".ranking-places button").first().click();
      }
      await expect.poll(() => page.evaluate(() =>
        (window as unknown as { recoveryProbe: { pending: boolean } }).recoveryProbe.pending,
      )).toBe(true);
      if (leave) {
        // A client navigation preserves the pending fetch and its JS realm.
        await page.locator("a.brand").click();
        await expect(page.locator(".classic-game, .social-game")).toHaveCount(0);
      }
      await page.evaluate(async () => {
        (window as unknown as { recoveryProbe: { release: () => void } }).recoveryProbe.release();
        // Drain the response JSON and the consumer's catch/finally callbacks.
        await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      });
      if (!leave) {
        await expect.poll(() => page.evaluate(() =>
          (window as unknown as { recoveryProbe: { recoveries: number } }).recoveryProbe.recoveries,
        )).toBe(1);
        await expect(page.locator(".classic-game, .social-game")).toHaveAttribute("aria-busy", "false");
      } else {
        expect(await page.evaluate(() =>
          (window as unknown as { recoveryProbe: { recoveries: number } }).recoveryProbe.recoveries,
        )).toBe(0);
      }
    });
  }
}
