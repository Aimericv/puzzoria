import type { Page } from "@playwright/test";

export function isWebKitFetchDiagnostic(error: Error, browserName: string) {
  // WebKit emits caught resource-load failures as pageerror, including requests
  // canceled by navigation. Keep actual unhandled rejections checked separately.
  return (
    browserName === "webkit" &&
    error.stack?.startsWith(
      "Fetch API cannot load http://127.0.0.1:3100/api/",
    ) &&
    /^\/127\.0\.0\.1:3100\/api\/(account|(?:play\?comparison=1&runId=|discovery\?runId=)[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}) due to access control checks\.$/.test(
      error.message,
    )
  );
}
export async function recordUnhandledRejections(page: Page, disableMeasurement = true) {
  await page.addInitScript((disableMeasurement) => {
    // Existing game tests exercise gameplay; measurement-choice UI has its own tests.
    if(disableMeasurement)localStorage.setItem("puzzoria:measurement-choice", "no");
    window.addEventListener("unhandledrejection", (event) => {
      const key = "test:unhandled-rejections";
      const errors: string[] = JSON.parse(sessionStorage.getItem(key) ?? "[]");
      errors.push(String(event.reason?.message ?? event.reason));
      sessionStorage.setItem(key, JSON.stringify(errors));
    });
  }, disableMeasurement);
}
export async function unhandledRejections(page: Page): Promise<string[]> {
  if (!/^https?:/.test(page.url())) return []; // API-only tests never open a page.
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("test:unhandled-rejections") ?? "[]"),
  );
}
