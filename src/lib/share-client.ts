export type ShareOutcome = "native" | "clipboard" | "manual" | "cancelled";
export async function shareText(text: string): Promise<ShareOutcome> {
  try {
    if (navigator.share && (!navigator.canShare || navigator.canShare({text}))) {
      await navigator.share({text});
      return "native";
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return "cancelled";
    // A missing target or denied native share still has a copy/manual fallback.
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "clipboard";
    }
  } catch { /* Keep the text selectable when the browser refuses clipboard access. */ }
  return "manual";
}
