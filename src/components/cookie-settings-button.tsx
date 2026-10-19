"use client";
import {measurementCopy} from "@/lib/measurement-i18n";
import { requestCookieSettings } from "@/lib/cookie-settings";
import type {Locale} from "@/lib/types";
export function CookieSettingsButton({locale}:{locale:Locale}) {
  return <button className="text-button" onClick={requestCookieSettings}>{measurementCopy(locale).settings}</button>;
}
