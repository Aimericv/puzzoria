// Separate browser namespaces preserve guest progress and prevent accounts sharing personal history.
let userId: string | null = null;
const memory = new Map<string, string>(),
  times = new Map<string, number>();
// Failed writes must not be shadowed by an older, still-readable disk value.
const unsaved = new Set<string>();
export const storageKey = (key: string) =>
  userId ? `dailygrid:account:${userId}:${key}` : key;
export const activeUser = () => userId;
export function setStorageUser(id: string | null) {
  userId = id;
}
export function clearAccountStorage(id: string) {
  const prefix = `dailygrid:account:${id}:`;
  for (const key of memory.keys()) if (key.startsWith(prefix)) { memory.delete(key); times.delete(key); unsaved.delete(key); }
  try {
    for (const key of Object.keys(localStorage))
      if (key.startsWith(prefix) || key === `dailygrid:migration-pending:${id}`) localStorage.removeItem(key);
  } catch { /* Server erasure remains effective if browser storage is unavailable. */ }
}
export function readLocal(key: string) {
  const actual = storageKey(key);
  if (unsaved.has(actual)) return memory.get(actual) ?? null;
  try {
    return localStorage.getItem(actual) ?? memory.get(actual) ?? null;
  } catch {
    return memory.get(actual) ?? null;
  }
}
export function localUpdated(key: string) {
  const actual = storageKey(key);
  if (unsaved.has(actual)) return times.get(actual) ?? 0;
  try {
    return (
      Number(localStorage.getItem(`${actual}:updated`)) ||
      times.get(actual) ||
      0
    );
  } catch {
    return times.get(actual) || 0;
  }
}
export function writeLocal(
  key: string,
  value: unknown,
  options: { sync?: boolean; updatedAt?: number } = {},
) {
  const actual = storageKey(key),
    updatedAt = options.updatedAt ?? Date.now(),
    encoded = JSON.stringify(value);
  memory.set(actual, encoded);
  times.set(actual, updatedAt);
  let saved = true;
  try {
    localStorage.setItem(actual, encoded);
    localStorage.setItem(`${actual}:updated`, String(updatedAt));
    unsaved.delete(actual);
  } catch {
    saved = false;
    unsaved.add(actual);
  }
  window.dispatchEvent(new CustomEvent("dailygrid:storage", { detail: key }));
  if (
    options.sync !== false &&
    userId &&
    /^dailygrid:(game|session|practice|run|preferences):/.test(key)
  )
    window.dispatchEvent(
      new CustomEvent("dailygrid:sync", { detail: { key, value, updatedAt } }),
    );
  return saved;
}
