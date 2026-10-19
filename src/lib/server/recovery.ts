import { randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { database, transaction } from "./database";
import { type Account, hashPassword, verifyPassword } from "./auth";
import { ApiError, digest, rateLimit, requestAddress } from "./http";
import { credentialVersion, revokeUserSessions } from "./credentials";
import { validateNewPassword } from "./password-policy";

function newCode() {
  const token = randomBytes(20).toString("hex").toUpperCase();
  return `DG-${token.match(/.{4}/g)!.join("-")}`;
}
function codeHash(value: unknown) {
  if (typeof value !== "string" || value.length > 100) return null;
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  return /^DG[0-9A-F]{40}$/.test(normalized) ? digest(normalized) : null;
}
export function hasRecoveryCode(userId: string) {
  return !!database()
    .prepare("SELECT 1 FROM account_recovery WHERE user_id=?")
    .get(userId);
}
export function issueRecoveryCode(userId: string) {
  const code = newCode();
  database()
    .prepare(
      `INSERT INTO account_recovery VALUES (?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET code_hash=excluded.code_hash, created_at=excluded.created_at`,
    )
    .run(userId, codeHash(code)!, new Date().toISOString());
  return code;
}
export async function rotateRecoveryCode(
  request: NextRequest,
  user: Account,
  body: Record<string, unknown>,
) {
  rateLimit(`recovery-rotate:${user.id}`, 5, 15 * 60000);
  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 12 || password.length > 128)
    throw new ApiError("credentialsInvalid", 401);
  const row = database()
    .prepare("SELECT password_hash FROM users WHERE id=?")
    .get(user.id) as { password_hash: string };
  const version=credentialVersion(user.id);
  if (!(await verifyPassword(password, row.password_hash)))
    throw new ApiError("credentialsInvalid", 401);
  // Recheck after asynchronous scrypt: a concurrent recovery may have replaced it.
  return transaction(() => {
    const current = database()
      .prepare("SELECT password_hash FROM users WHERE id=?")
      .get(user.id) as { password_hash: string };
    if (current.password_hash !== row.password_hash || credentialVersion(user.id)!==version)
      throw new ApiError("credentialsInvalid", 401);
    return issueRecoveryCode(user.id);
  });
}
export async function recoverAccount(
  request: NextRequest,
  body: Record<string, unknown>,
) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  rateLimit(`recover-address:${requestAddress(request)}`, 10, 15 * 60000);
  rateLimit(`recover-user:${username}`, 5, 15 * 60000);
  const password = typeof body.password === "string" ? body.password : "";
  validateNewPassword(password);
  if (password !== body.confirmPassword) throw new ApiError("passwordMismatch");
  const supplied = codeHash(body.recoveryCode);
  const row = database()
    .prepare(
      `SELECT u.id, r.code_hash FROM users u JOIN account_recovery r ON r.user_id=u.id WHERE u.username=?`,
    )
    .get(username) as { id: string; code_hash: string } | undefined;
  const actual = supplied ?? digest("invalid-code");
  const expected = row?.code_hash ?? digest("missing-recovery");
  const valid = timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expected, "hex"),
  );
  if (!row || !supplied || !valid || !/^[a-z0-9_]{3,24}$/.test(username))
    throw new ApiError("recoveryInvalid", 401);
  const passwordHash = await hashPassword(password),
    code = newCode();
  transaction(() => {
    const replaced = database()
      .prepare(
        "UPDATE account_recovery SET code_hash=?,created_at=? WHERE user_id=? AND code_hash=?",
      )
      .run(codeHash(code)!, new Date().toISOString(), row.id, row.code_hash);
    if (Number(replaced.changes) !== 1)
      throw new ApiError("recoveryInvalid", 401);
    database()
      .prepare("UPDATE users SET password_hash=? WHERE id=?")
      .run(passwordHash, row.id);
    revokeUserSessions(row.id);
  });
  return { recovered: true, recoveryCode: code };
}
