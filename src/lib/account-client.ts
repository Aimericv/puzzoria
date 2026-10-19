let pendingProfile: Promise<unknown> | null = null;

// React may repeat the initial effect before the first guest cookie exists.
// Share that request so a later response cannot replace the identity already
// used to reserve a game or join a private room.
export function readAccountProfile<T>(): Promise<T> {
  if (!pendingProfile) {
    const request = fetch("/api/account", { cache: "no-store" }).then(
      async (r) => {
        if (!r.ok) throw new Error("Account unavailable");
        return r.json();
      },
    );
    pendingProfile = request;
    void request
      .finally(() => {
        if (pendingProfile === request) pendingProfile = null;
      })
      .catch(() => {});
  }
  return pendingProfile as Promise<T>;
}
