"use client";
import { createContext, useContext } from "react";
import type { LocalPreviewFixture } from "@/lib/local-preview";
export const LocalPreviewContext = createContext<(LocalPreviewFixture & {close: () => void; reset: () => void}) | undefined>(undefined);
export function useLocalPreview() {
  const value = useContext(LocalPreviewContext);
  return process.env.NODE_ENV === "production" ? undefined : value;
}
