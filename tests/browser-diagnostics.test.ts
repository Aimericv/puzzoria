import { describe, expect, it } from "vitest";
import { isWebKitFetchDiagnostic } from "../e2e/browser-errors";
const id = "88d9180b-961a-4a1d-a4ff-80b591640c0f";
function diagnostic(path: string) {
  const error = new Error(
    `/127.0.0.1:3100/api/${path} due to access control checks.`,
  );
  error.stack = `Fetch API cannot load http://127.0.0.1:3100/api/${path} due to access control checks.`;
  return error;
}
describe("handled WebKit resource diagnostics", () => {
  it("recognises only the three known caught read-only loading paths on the local WebKit test origin", () => {
    for (const path of [
      "account",
      `play?comparison=1&runId=${id}`,
      `discovery?runId=${id}`,
    ]) {
      expect(isWebKitFetchDiagnostic(diagnostic(path), "webkit")).toBe(true);
      expect(isWebKitFetchDiagnostic(diagnostic(path), "chromium")).toBe(false);
    }
  });
  it("retains JavaScript errors, other APIs, invalid IDs and unrelated origins", () => {
    for (const path of [
      "friends",
      `play?runId=${id}`,
      "discovery?runId=invalid",
      "discovery?runId=aaaa",
      `discovery?runId=${id}&extra=1`,
    ])
      expect(isWebKitFetchDiagnostic(diagnostic(path), "webkit")).toBe(false);
    const error = diagnostic(`discovery?runId=${id}`);
    error.stack = "TypeError: invalid state";
    expect(isWebKitFetchDiagnostic(error, "webkit")).toBe(false);
    error.stack =
      "Fetch API cannot load https://another-origin.example/api/discovery";
    expect(isWebKitFetchDiagnostic(error, "webkit")).toBe(false);
  });
});
