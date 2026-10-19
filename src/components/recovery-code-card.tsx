"use client";
import type { Locale } from "@/lib/types";
import { rt } from "@/lib/retention-i18n";
import { recoveryMessages } from "@/lib/recovery-i18n";
export function RecoveryCodeCard({
  code,
  username,
  locale,
  onDismiss,
}: {
  code: string;
  username: string;
  locale: Locale;
  onDismiss: () => void;
}) {
  const m = { ...rt(locale), ...recoveryMessages(locale) };
  function download() {
    const text = `Puzzoria\n${m.username}: ${username}\n${m.recoveryCode}: ${code}\n\n${m.recoveryCodeHelp}\n`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "puzzoria-recovery.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  return (
    <section className="recovery-code-card" aria-label={m.recoveryTitle}>
      <h3>{m.recoveryTitle}</h3>
      <p>{m.recoveryCodeHelp}</p>
      <p>
        {m.username}: <strong>{username}</strong>
      </p>
      <code data-recovery-code>{code}</code>
      <div className="recovery-actions">
        <button className="secondary-button" type="button" onClick={download}>
          {m.downloadRecovery}
        </button>
        <button className="text-button" type="button" onClick={onDismiss}>
          {m.savedRecovery}
        </button>
      </div>
    </section>
  );
}
