"use client";
import { useState } from "react";
import type { Locale } from "@/lib/types";
import { rt } from "@/lib/retention-i18n";
import { recoveryMessages } from "@/lib/recovery-i18n";
import { postJson } from "@/lib/play-client";
import { useAccount } from "./account-provider";
import { RecoveryCodeCard } from "./recovery-code-card";
import { accountSecurityCopy } from "@/lib/account-security-i18n";
import { AccountDataSettings } from "./account-data-settings";
export function AccountView({ locale }: { locale: Locale }) {
  const m = { ...rt(locale), ...recoveryMessages(locale), ...accountSecurityCopy(locale) },
    account = useAccount(),
    [mode, setMode] = useState<"signup" | "login" | "recover">("signup"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      if (mode === "recover") {
        const result = await postJson("/api/account", {
          action: "recover",
          username: form.get("username"),
          recoveryCode: form.get("recoveryCode"),
          password: form.get("password"),
          confirmPassword: form.get("confirmPassword"),
        });
        account.showRecoveryCode(
          result.recoveryCode as string,
          String(form.get("username")).trim().toLowerCase(),
        );
        setMessage(m.recoverySuccess);
        setMode("login");
      } else
        await account.authenticate(mode, {
          username: form.get("username"),
          password: form.get("password"),
          ...(mode === "signup" ? { displayName: form.get("username") } : {}),
        });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!account.ready) return <p>{m.loading}</p>;
  const recoveryCard = account.recoveryDetails ? (
    <RecoveryCodeCard
      {...account.recoveryDetails}
      locale={locale}
      onDismiss={account.dismissRecoveryCode}
    />
  ) : null;
  if (account.user)
    return (
      <section className="account-card">
        <h2>{account.user.displayName}</h2>
        <p>{m.savedAccount}</p>
        {recoveryCard}
        <p>
          {m.username}: <strong>{account.user.username}</strong>
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await postJson("/api/account", {
                action: "profile",
                displayName: new FormData(e.currentTarget).get("displayName"),
              });
              await account.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            {m.displayName}
            <input
              name="displayName"
              defaultValue={account.user.displayName}
              minLength={2}
              maxLength={32}
              required
            />
          </label>
          <button className="secondary-button" disabled={busy}>
            {m.saveName}
          </button>
        </form>
        <details className="recovery-settings">
          <summary>{m.recoveryTitle}</summary>
          <p>
            {account.recoveryEnabled ? m.recoveryEnabled : m.recoveryMissing}
          </p>
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              setError("");
              const form = event.currentTarget;
              try {
                const result = await postJson("/api/account", {
                  action: "recovery-code",
                  password: new FormData(form).get("password"),
                });
                account.showRecoveryCode(
                  result.recoveryCode as string,
                  account.user!.username,
                );
                form.reset();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              {m.currentPassword}
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                minLength={12}
                maxLength={128}
                required
              />
            </label>
            <small>{m.recoveryRotateHelp}</small>
            <button className="secondary-button" disabled={busy}>
              {m.generateRecovery}
            </button>
          </form>
        </details>
        <details className="recovery-settings" data-account-security>
          <summary>{m.securityTitle}</summary>
          <p>{m.changeHelp}</p>
          <form onSubmit={async event=>{
            event.preventDefault();const form=event.currentTarget;setBusy(true);setError("");setMessage("");
            const values=new FormData(form);
            try {await postJson("/api/account",{action:"change-password",password:values.get("password"),newPassword:values.get("newPassword"),confirmPassword:values.get("confirmPassword")});form.reset();await account.refresh();setMessage(m.passwordChanged);}
            catch(e){setError((e as Error).message);}finally{setBusy(false);}
          }}>
            <label>{m.currentPassword}<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required /></label>
            <label>{m.newPassword}<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <label>{m.confirmPassword}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label>
            <button className="secondary-button" disabled={busy}>{m.changePassword}</button>
          </form>
          <p>{m.logoutAllHelp}</p>
          <form onSubmit={async event=>{
            event.preventDefault();const form=event.currentTarget;setBusy(true);setError("");
            try{await account.logout(String(new FormData(form).get("password")));}catch(e){setError((e as Error).message);}finally{setBusy(false);}
          }}>
            <label>{m.currentPassword}<input name="password" type="password" autoComplete="current-password" minLength={12} maxLength={128} required /></label>
            <button className="secondary-button" disabled={busy}>{m.logoutAll}</button>
          </form>
        </details>
        <AccountDataSettings locale={locale} busy={busy} setBusy={setBusy} onDeleted={setMessage} />
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert">{m[error as keyof typeof m] ?? m.syncIssue}</p>
        )}
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => {
            void account.logout().catch(() => setError("syncIssue"));
          }}
        >
          {m.logout}
        </button>
      </section>
    );
  return (
    <section className="account-card">
      <div className="mode-nav">
        <button
          className={mode === "signup" ? "selected" : ""}
          onClick={() => {
            setMode("signup");
            setError("");
          }}
        >
          {m.signup}
        </button>
        <button
          className={mode === "login" ? "selected" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          {m.login}
        </button>
      </div>
      {recoveryCard}
      {message && <p role="status">{message}</p>}
      {mode === "recover" && <p>{m.recoveryIntro}</p>}
      <form key={mode} onSubmit={submit}>
        <label>
          {m.username}
          <input
            name="username"
            autoComplete="username"
            pattern="[a-zA-Z0-9_]{3,24}"
            minLength={3}
            maxLength={24}
            required
          />
        </label>
        <small>{m.usernameHelp}</small>
        {mode === "recover" && (
          <label>
            {m.recoveryCode}
            <input
              name="recoveryCode"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={100}
              required
            />
          </label>
        )}
        <label>
          {mode === "recover" ? m.newPassword : m.password}
          <input
            name="password"
            type="password"
            autoComplete={
              mode !== "login" ? "new-password" : "current-password"
            }
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        <small>{m.passwordHelp}</small>
        {mode === "recover" && (
          <label>
            {m.confirmPassword}
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </label>
        )}
        {error && (
          <p className="game-error" role="alert">
            {m[error as keyof typeof m] ?? m.syncIssue}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {mode === "recover" ? m.resetPassword : m[mode]}
        </button>
      </form>
      {mode !== "recover" && (
        <button
          className="text-button"
          onClick={() => {
            setMode("recover");
            setError("");
            setMessage("");
          }}
        >
          {m.forgotPassword}
        </button>
      )}
      <p className="save-notice">{m.savedGuest}</p>
    </section>
  );
}
