"use client";
import { useEffect, useState } from "react";
import { readLocal, writeLocal } from "@/lib/browser-storage";
import {
  PREFERENCES_KEY,
  validPreferences,
  type Preferences,
} from "@/lib/engagement";
import { useAccount } from "./account-provider";
export const readPreferences = (): Preferences => {
  try {
    const value = JSON.parse(readLocal(PREFERENCES_KEY) ?? "null");
    return validPreferences(value) ? value : { favorite: null, last: null };
  } catch {
    return { favorite: null, last: null };
  }
};
export function usePreferences() {
  const account = useAccount(),
    [value, setValue] = useState<Preferences>({ favorite: null, last: null });
  useEffect(() => {
    if (!account.ready) return;
    const load = () => setValue(readPreferences());
    load();
    window.addEventListener("dailygrid:storage", load);
    return () => window.removeEventListener("dailygrid:storage", load);
  }, [account.ready, account.user?.id]);
  return {
    value,
    update: (next: Preferences) => writeLocal(PREFERENCES_KEY, next),
  };
}
