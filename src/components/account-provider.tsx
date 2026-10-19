"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Completion, Locale } from "@/lib/types";
import {
  activeUser,
  setStorageUser,
  localUpdated,
  readLocal,
  writeLocal,
  clearAccountStorage,
} from "@/lib/browser-storage";
import {
  postJson,
  resetPlayClient,
  rememberCompletion,
} from "@/lib/play-client";
import { track } from "@/lib/analytics";
import { rt } from "@/lib/retention-i18n";
import { migrateGuestProgress, snapshotBatches } from "@/lib/migration-client";
import { readAccountProfile } from "@/lib/account-client";
type User = { id: string; username: string; displayName: string };
type Snapshot = { key: string; value: unknown; updatedAt: number };
type Profile = {
  user: User | null;
  completions?: Completion[];
  snapshots?: Snapshot[];
  recoveryEnabled?: boolean;
};
const Context = createContext<{
  user: User | null;
  ready: boolean;
  syncError: boolean;
  recoveryEnabled: boolean;
  recoveryDetails: { code: string; username: string } | null;
  showRecoveryCode: (code: string, username: string) => void;
  dismissRecoveryCode: () => void;
  refresh: () => Promise<void>;
  authenticate: (
    action: "login" | "signup",
    body: Record<string, unknown>,
  ) => Promise<void>;
  logout: (password?: string) => Promise<void>;
  deleteAccount: (password: string, confirmUsername: string) => Promise<void>;
} | null>(null);
const syncKey = (key: string) =>
  /^dailygrid:(game|session|practice|run|preferences):[A-Za-z0-9:_-]{1,220}$/.test(
    key,
  );
function guestProgress() {
  const snapshots: Snapshot[] = [];
  let completions: Completion[] = [];
  try {
    completions = JSON.parse(
      localStorage.getItem("dailygrid:stats:v1") ?? "[]",
    );
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !syncKey(key)) continue;
      const value = JSON.parse(localStorage.getItem(key) ?? "null");
      snapshots.push({
        key,
        value,
        updatedAt: Number(localStorage.getItem(`${key}:updated`)) || Date.now(),
      });
    }
  } catch {
    /* An unreadable local snapshot does not block authentication. */
  }
  return {
    completions: Array.isArray(completions) ? completions : [],
    snapshots: snapshots
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 150),
  };
}
function mergeProfile(profile: Profile) {
  if (activeUser() !== (profile.user?.id ?? null)) resetPlayClient();
  setStorageUser(profile.user?.id ?? null);
  if (!profile.user) return;
  try {
    const key = "dailygrid:stats:v1";
    const local: Completion[] = JSON.parse(readLocal(key) ?? "[]");
    const records = new Map<string, Completion>();
    if (Array.isArray(local))
      local.forEach((c) => records.set(c.challengeId, c));
    profile.completions?.forEach((c) => {
      records.set(c.challengeId, c);
      rememberCompletion(c);
    });
    writeLocal(
      key,
      [...records.values()].sort((a, b) =>
        a.completedAt.localeCompare(b.completedAt),
      ),
      { sync: false },
    );
    for (const snapshot of profile.snapshots ?? []) {
      if (!syncKey(snapshot.key)) continue;
      const localTime = localUpdated(snapshot.key);
      if (snapshot.updatedAt > localTime || !readLocal(snapshot.key)) {
        writeLocal(snapshot.key, snapshot.value, {
          sync: false,
          updatedAt: snapshot.updatedAt,
        });
      }
    }
  } catch {
    /* The server history remains available when device storage is disabled. */
  }
  window.dispatchEvent(new CustomEvent("dailygrid:storage"));
}
export function AccountProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [syncError, setSyncError] = useState(false),
    [recoveryEnabled, setRecoveryEnabled] = useState(false),
    [recoveryDetails, setRecoveryDetails] = useState<{
      code: string;
      username: string;
    } | null>(null);
  const pending = useRef(new Map<string, Snapshot>());
  const migrationPending = useRef<string | null>(null);
  const revision = useRef(0);
  const flush = useCallback(async (keepalive = false) => {
    const expectedOwner = activeUser(),
      expectedRevision = revision.current;
    if (!expectedOwner || !pending.current.size) return true;
    const values = [...pending.current.values()];
    // Keepalive requests share a small browser quota. Larger drafts stay local
    // and use the regular synchronization path rather than failing on unload.
    if (
      keepalive &&
      new TextEncoder().encode(
        JSON.stringify({ action: "sync", snapshots: values }),
      ).byteLength > 60000
    )
      return false;
    pending.current.clear();
    try {
      for (const batch of snapshotBatches(values)) {
        if (
          activeUser() !== expectedOwner ||
          revision.current !== expectedRevision
        )
          return true;
        await postJson(
          "/api/account",
          { action: "sync", snapshots: batch },
          { keepalive },
        );
      }
      if (
        activeUser() === expectedOwner &&
        revision.current === expectedRevision
      )
        setSyncError(false);
      return true;
    } catch {
      if (
        activeUser() !== expectedOwner ||
        revision.current !== expectedRevision
      )
        return true;
      values.forEach((v) => {
        if (!pending.current.has(v.key)) pending.current.set(v.key, v);
      });
      setSyncError(true);
      return false;
    }
  }, []);
  const refresh = useCallback(async () => {
    const expectedRevision = revision.current;
    try {
      if (!(await flush())) throw new Error();
      const profile = await readAccountProfile<Profile>();
      if (expectedRevision !== revision.current) return;
      mergeProfile(profile);
      setUser(profile.user);
      setRecoveryDetails((details) =>
        profile.user && details?.username !== profile.user.username
          ? null
          : details,
      );
      setRecoveryEnabled(!!profile.user && !!profile.recoveryEnabled);
      setSyncError(false);
      if (profile.user) {
        let pendingMigration = migrationPending.current === profile.user.id;
        try {
          pendingMigration ||=
            localStorage.getItem(
              `dailygrid:migration-pending:${profile.user.id}`,
            ) === "true";
        } catch {
          /* In-memory retry remains available. */
        }
        if (pendingMigration) {
          const migrated = await migrateGuestProgress(guestProgress());
          const updated = await readAccountProfile<Profile>();
          if (expectedRevision !== revision.current) return;
          mergeProfile(updated);
          migrationPending.current = null;
          try {
            localStorage.removeItem(
              `dailygrid:migration-pending:${profile.user.id}`,
            );
          } catch {
            /* No persistence available. */
          }
          track("local_data_migrated", {
            locale,
            count: migrated,
          });
        }
      }
    } catch {
      if (expectedRevision === revision.current) setSyncError(true);
    } finally {
      if (expectedRevision === revision.current) setReady(true);
    }
  }, [flush, locale]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (!user) return;
    const queue = (event: Event) => {
      const value = (event as CustomEvent<Snapshot>).detail;
      pending.current.set(value.key, value);
    };
    const complete = () => {
      void refresh();
    };
    window.addEventListener("dailygrid:sync", queue);
    window.addEventListener("dailygrid:completed", complete);
    const timer = setInterval(() => {
      void flush();
    }, 3000);
    const onHide = () => {
      void flush(true);
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(timer);
      window.removeEventListener("dailygrid:sync", queue);
      window.removeEventListener("dailygrid:completed", complete);
      window.removeEventListener("pagehide", onHide);
    };
  }, [user, flush, refresh]);
  async function authenticate(
    action: "login" | "signup",
    body: Record<string, unknown>,
  ) {
    revision.current++;
    setRecoveryDetails(null);
    track(action === "signup" ? "signup_start" : "login", { locale });
    const progress = guestProgress();
    const authenticated = await postJson("/api/account", { ...body, action });
    const signedIn = authenticated.user as User;
    if (typeof authenticated.recoveryCode === "string")
      setRecoveryDetails({
        code: authenticated.recoveryCode,
        username: signedIn.username,
      });
    resetPlayClient();
    // Migration can be retried without creating another account or losing guest records.
    try {
      const migrated = await migrateGuestProgress(progress);
      track("local_data_migrated", {
        locale,
        count: migrated,
      });
    } catch {
      migrationPending.current = signedIn.id;
      setSyncError(true);
      try {
        localStorage.setItem(
          `dailygrid:migration-pending:${signedIn.id}`,
          "true",
        );
      } catch {
        /* Retry stays available for this session. */
      }
    }
    await refresh();
    if (action === "signup") track("signup_complete", { locale });
  }
  async function logoutAccount(password?:string) {
    revision.current++;
    await flush();
    await postJson("/api/account", password===undefined ? {action:"logout"} : {action:"logout-all",password});
    pending.current.clear();
    resetPlayClient();
    setStorageUser(null);
    setUser(null);
    setRecoveryEnabled(false);
    setRecoveryDetails(null);
    setSyncError(false);
    window.dispatchEvent(new CustomEvent("dailygrid:storage"));
  }
  const forgetAccount = useCallback((id: string) => {
    revision.current++;
    clearAccountStorage(id);
    pending.current.clear();
    migrationPending.current = null;
    resetPlayClient();
    setStorageUser(null);
    setUser(null);
    setRecoveryEnabled(false);
    setRecoveryDetails(null);
    setSyncError(false);
    window.dispatchEvent(new CustomEvent("dailygrid:storage"));
  }, []);
  useEffect(() => {
    const removed = (event: StorageEvent) => {
      if (event.key === "dailygrid:account-removed" && event.newValue === activeUser()) forgetAccount(event.newValue!);
    };
    window.addEventListener("storage", removed);
    return () => window.removeEventListener("storage", removed);
  }, [forgetAccount]);
  async function removeAccount(password: string, confirmUsername: string) {
    const id = user?.id;
    if (!id) return;
    await postJson("/api/account", { action: "delete", password, confirmUsername });
    forgetAccount(id);
    try { localStorage.setItem("dailygrid:account-removed", id); localStorage.removeItem("dailygrid:account-removed"); } catch { /* No storage available. */ }
  }
  return (
    <Context.Provider
      value={{
        user,
        ready,
        syncError,
        recoveryEnabled,
        recoveryDetails,
        showRecoveryCode: (code, username) => {
          setRecoveryDetails({ code, username });
          setRecoveryEnabled(true);
        },
        dismissRecoveryCode: () => setRecoveryDetails(null),
        refresh,
        authenticate,
        logout: logoutAccount,
        deleteAccount: removeAccount,
      }}
    >
      {syncError && user && (
        <div className="sync-notice" role="status">
          {rt(locale).syncIssue}{" "}
          <button onClick={() => void refresh()}>{rt(locale).retry}</button>
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
export function useAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("AccountProvider missing");
  return context;
}
