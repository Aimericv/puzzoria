"use client";
import { useEffect } from "react";
import type { Locale } from "@/lib/types";
import { finishedToday, streaks } from "@/lib/stats";
import { utcDay } from "@/lib/date";
import { safeRead, STATS_KEY, validCompletions } from "./storage";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function WebMCP({ locale }: { locale: Locale }) {
  useEffect(() => {
    const context = (document as Document & { modelContext?: Context })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tool: Tool = {
      name: "read_daily_progress",
      description:
        "Read the Puzzoria progress saved on this device: completed games today, current streak, best streak and total played. Does not change a game.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        if (
          !input ||
          typeof input !== "object" ||
          Array.isArray(input) ||
          Object.keys(input).length
        )
          throw new Error("Expected an empty object");
        const completions = safeRead(STATS_KEY, [], validCompletions),
          date = utcDay();
        return {
          locale,
          date,
          finished: finishedToday(completions, date),
          ...streaks(completions, date),
          total: completions.length,
        };
      },
    };
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch { /* Optional browser capability: the games work without registration. */ }
    return () => lifecycle.abort();
  }, [locale]);
  return null;
}
