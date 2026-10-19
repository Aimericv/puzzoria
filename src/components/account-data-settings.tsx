"use client";
import { useState } from "react";
import type { Locale } from "@/lib/types";
import { accountDataCopy } from "@/lib/account-data-i18n";
import { rt } from "@/lib/retention-i18n";
import { recoveryMessages } from "@/lib/recovery-i18n";
import { useAccount } from "./account-provider";

export function AccountDataSettings({ locale, busy, setBusy, onDeleted }: { locale: Locale; busy: boolean; setBusy: (value: boolean) => void; onDeleted: (message: string) => void }) {
  const m = accountDataCopy(locale), errors = { ...rt(locale), ...recoveryMessages(locale) }, account = useAccount();
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, values = new FormData(form);
    setBusy(true); setError("");
    try {
      await account.deleteAccount(String(values.get("password")), String(values.get("confirmUsername")));
      onDeleted(m.deleted);
      form.reset();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="recovery-settings" data-account-data>
    <summary>{m.title}</summary>
    <p>{m.deleteHelp}</p>
    <form onSubmit={event => void submit(event)}>
      <label>{m.confirm}<input name="confirmUsername" autoComplete="off" pattern={account.user?.username} required /></label>
      <label>{errors.currentPassword}<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required /></label>
      <button className="secondary-button account-delete" disabled={busy}>{m.remove}</button>
    </form>
    {error && <p role="alert">{errors[error as keyof typeof errors] ?? errors.syncIssue}</p>}
  </details>;
}
