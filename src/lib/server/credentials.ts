import { database } from "./database";

// A generation also invalidates authentications that are still hashing when sessions are revoked.
export function credentialVersion(userId: string): number {
  return (database().prepare("SELECT version FROM credential_versions WHERE user_id=?").get(userId) as {version:number}|undefined)?.version ?? 0;
}
export function revokeUserSessions(userId: string) {
  database().prepare("INSERT INTO credential_versions VALUES (?,1) ON CONFLICT(user_id) DO UPDATE SET version=version+1").run(userId);
  database().prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
}
