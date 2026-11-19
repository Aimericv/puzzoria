import type { Page, TestInfo } from "@playwright/test";

// The public CI summary can retain these measurements without DOM, screenshots
// or browser credentials. Full Playwright traces stay in the local test output.
export async function attachResultLayout(page: Page, info: TestInfo) {
  if (info.status === info.expectedStatus || page.isClosed()) return;
  try {
    const layout = await page.locator("body").evaluate(async () => {
      const controls = [".local-test-controls button", ".completion-panel .share-button"];
      const original = controls.map(selector => document.querySelector(selector));
      const describe = (index: number) => {
        const node = document.querySelector(controls[index]);
        if (!node) return null;
        const { x, y, width, height } = node.getBoundingClientRect();
        const target = document.elementFromPoint(x + width / 2, y + height / 2);
        const style = getComputedStyle(node);
        // Center hit: -1 outside, 0 other, 1 button, 2 cookie banner, 3 dialog.
        const hit = !target ? -1 : node.contains(target) ? 1 :
          target.closest(".measurement-notice") ? 2 : target.closest("dialog[open]") ? 3 : 0;
        return [x, y, width, height, Number(!node.matches(":disabled") && !node.closest("[inert]")),
          Number(style.visibility === "visible" && style.display !== "none" && width > 0 && height > 0),
          hit,
          document.getAnimations().filter(animation => animation.playState === "running").length,
          Number(node === original[index])];
      };
      const sample = () => [scrollY, describe(0), describe(1)];
      const samples = [sample()];
      let frame = 0;
      await new Promise<void>(resolve => {
        // This observation also ends when the compositor delivers no frames.
        const timer = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 180);
        const measure = () => {
          samples.push(sample());
          if (samples.length < 3) frame = requestAnimationFrame(measure);
          else { clearTimeout(timer); resolve(); }
        };
        frame = requestAnimationFrame(measure);
      });
      return {
        viewport: [innerWidth, innerHeight, visualViewport?.width ?? 0, visualViewport?.height ?? 0,
          visualViewport?.offsetTop ?? 0, Number(matchMedia("(prefers-reduced-motion: reduce)").matches),
          Number(document.visibilityState === "visible")],
        samples,
      };
    }, undefined, { timeout: 1500 });
    await info.attach("result-layout", { contentType: "application/json", body: JSON.stringify(layout) });
  } catch {
    // A closed or unresponsive page still has Playwright's failure report.
  }
}
