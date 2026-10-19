import { afterEach, describe, expect, it, vi } from "vitest";
import { shareText } from "../src/lib/share-client";
afterEach(() => vi.unstubAllGlobals());
describe("result sharing browser fallbacks", () => {
  it("opens native sharing directly without unnecessary clipboard access", async () => {
    const share = vi.fn().mockResolvedValue(undefined), writeText = vi.fn();
    vi.stubGlobal("navigator", {share, clipboard: {writeText}});
    expect(await shareText("🟩 result")).toBe("native");
    expect(share).toHaveBeenCalledWith({text: "🟩 result"}); expect(writeText).not.toHaveBeenCalled();
  });
  it.each(["NotAllowedError", "InvalidStateError", "TypeError"])("falls back to copying after %s", async name => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {share: vi.fn().mockRejectedValue(new DOMException("blocked", name)), clipboard: {writeText}});
    expect(await shareText("result")).toBe("clipboard"); expect(writeText).toHaveBeenCalledWith("result");
  });
  it("respects cancellation without copying or showing a failure", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", {share: vi.fn().mockRejectedValue(new DOMException("cancelled", "AbortError")), clipboard: {writeText}});
    expect(await shareText("result")).toBe("cancelled"); expect(writeText).not.toHaveBeenCalled();
  });
  it("keeps a manual fallback when native sharing and clipboard are both denied", async () => {
    vi.stubGlobal("navigator", {share: vi.fn().mockRejectedValue(new DOMException("blocked", "NotAllowedError")), clipboard: {writeText: vi.fn().mockRejectedValue(new Error("denied"))}});
    expect(await shareText("result")).toBe("manual");
  });
  it("supports browsers without either API", async () => {
    vi.stubGlobal("navigator", {}); expect(await shareText("result")).toBe("manual");
  });
  it("copies when the browser cannot share that data", async () => {
    const share = vi.fn(), writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", {share, canShare: () => false, clipboard: {writeText}});
    expect(await shareText("result")).toBe("clipboard"); expect(share).not.toHaveBeenCalled();
  });
});
