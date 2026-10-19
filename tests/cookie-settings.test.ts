import { it, expect, vi } from "vitest";
import { requestCookieSettings, consumeCookieSettingsRequest } from "../src/lib/cookie-settings";
it("retains an early cookie-settings request until the provider can receive it", () => {
  const dispatch = vi.fn(); vi.stubGlobal("window", { dispatchEvent: dispatch });
  try {
    consumeCookieSettingsRequest(); requestCookieSettings(); expect(dispatch).toHaveBeenCalledOnce();
    expect(consumeCookieSettingsRequest()).toBe(true); expect(consumeCookieSettingsRequest()).toBe(false);
  } finally { vi.unstubAllGlobals(); }
});
