import { defineConfig, devices } from "@playwright/test";
import { createHash } from "node:crypto";
const fixture = `.sites-runtime/e2e-${Date.now()}`;
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.11" },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.12" },
      },
    },
    {
      name: "android",
      use: {
        ...devices["Pixel 5"],
        extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.13" },
      },
    },
    {
      name: "iphone-webkit",
      use: {
        ...devices["iPhone 13"],
        extraHTTPHeaders: { "X-Forwarded-For": "192.0.2.14" },
      },
    },
  ],
  webServer: {
    command: "node --import tsx scripts/start-e2e-server.mjs",
    url: "http://127.0.0.1:3100/fr",
    reuseExistingServer: false,
    env: {
      DAILYGRID_DB_PATH: `${fixture}.sqlite`,
      ACCOUNT_DELETION_LOG: `${fixture}-deletions.jsonl`,
      NEXT_TEST_DIST_DIR: ".next-e2e",
      AUTH_ORIGIN: "http://127.0.0.1:3100",
      // Controlled test headers simulate distinct devices behind a trusted proxy.
      TRUST_PROXY: "true",
      // Dedicated accounts in Playwright's isolated, disposable database only.
      ANALYTICS_ADMIN_USERNAMES: "measure_desktop,measure_mobile,measure_android,measure_webkit",
      // Public fixture capability for this disposable test server only.
      ANALYTICS_READER_TOKEN_SHA256: createHash("sha256").update("e".repeat(43)).digest("hex"),
    },
    timeout: 120000,
  },
});
