import { randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { database, transaction } from "./database";
import { credentialVersion, revokeUserSessions } from "./credentials";
import { validateNewPassword } from "./password-policy";
import path from "node:path";
import { eraseAccountRows, recordErasure } from "../../../scripts/account-erasure.mjs";
import { accountExport } from "./account-data";
import {
  ApiError,
  cookieOptions,
  digest,
  randomToken,
  rateLimit,
  requestAddress,
} from "./http";

export type Account = { id: string; username: string; displayName: string };
type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
};
const SESSION_COOKIE = "dailygrid-session";
const GUEST_COOKIE = "dailygrid-guest";
const SESSION_AGE = 30 * 86400;
const authenticationProofs = new WeakMap<Account, {hash: string; version: number}>();
function authenticatedUser(row: UserRow, version: number): Account {
  const user=publicUser(row);
  authenticationProofs.set(user,{hash:row.password_hash,version});
  return user;
}
const publicUser = (u: UserRow): Account => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
});
export function account(request: NextRequest): Account | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 128) return null;
  const user = database()
    .prepare(
      `SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id
    WHERE s.token_hash=? AND s.expires_at>?`,
    )
    .get(digest(token), Date.now()) as UserRow | undefined;
  return user ? publicUser(user) : null;
}
export function identity(request: NextRequest) {
  const user = account(request);
  const raw = request.cookies.get(GUEST_COOKIE)?.value;
  const guestId = raw && /^[A-Za-z0-9_-]{43}$/.test(raw) ? raw : randomToken();
  return { user, guestId, owner: user ? `u:${user.id}` : `g:${guestId}` };
}
export type Identity = ReturnType<typeof identity>;
export function setGuest(
  response: NextResponse,
  request: NextRequest,
  guestId: string,
) {
  response.cookies.set(
    GUEST_COOKIE,
    guestId,
    cookieOptions(request, 365 * 86400),
  );
}
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export async function hashPassword(password: string) {
  const salt = randomToken();
  const hash = await derive(password, salt);
  return `scrypt:32768:8:3:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const parts = encoded.split(":");
  if (parts.length !== 6 || parts.slice(0, 4).join(":") !== "scrypt:32768:8:3")
    return false;
  const expected = Buffer.from(parts[5], "hex"),
    actual = await derive(password, parts[4]);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
// A missing username follows the same expensive verification path.
let dummyHash: Promise<string> | undefined;
export async function authenticate(
  request: NextRequest,
  body: Record<string, unknown>,
  signup: boolean,
) {
  const username =
    typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  rateLimit(`auth-address:${requestAddress(request)}`, 30, 15 * 60000);
  rateLimit(`auth-username:${username}`, 8, 15 * 60000);
  if (
    !/^[a-z0-9_]{3,24}$/.test(username) ||
    password.length < 12 ||
    password.length > 128
  )
    throw new ApiError(signup ? "accountInvalid" : "credentialsInvalid");
  const db = database();
  const existing = db
    .prepare("SELECT * FROM users WHERE username=?")
    .get(username) as UserRow | undefined;
  if (signup) {
    // Deleting an admin must never let a new signup inherit username-based dashboard access.
    if ((process.env.ANALYTICS_ADMIN_USERNAMES ?? "").toLowerCase().split(",").map(s=>s.trim()).includes(username)) throw new ApiError("usernameTaken",409);
    validateNewPassword(password);
    const displayName =
      typeof body.displayName === "string"
        ? body.displayName.trim()
        : (body.username as string).trim();
    if (
      displayName.length < 2 ||
      displayName.length > 32 ||
      /[\p{Cc}\p{Cf}<>]/u.test(displayName)
    )
      throw new ApiError("accountInvalid");
    if (existing) throw new ApiError("usernameTaken", 409);
    const address = requestAddress(request);
    const knownAddress = address !== "direct" && address !== "unknown";
    // Without a trusted proxy, Next does not expose the peer IP: use a shared cap.
    rateLimit(`signup-hour:${address}`, knownAddress ? 5 : 30, 3600000);
    rateLimit(`signup-day:${address}`, knownAddress ? 20 : 100, 86400000);
    const device = request.cookies.get(GUEST_COOKIE)?.value;
    if (device && /^[A-Za-z0-9_-]{43}$/.test(device)) {
      rateLimit(`signup-device-hour:${device}`, 3, 3600000);
      rateLimit(`signup-device-day:${device}`, 10, 86400000);
    }
    const passwordHash = await hashPassword(password),
      id = randomUUID();
    try {
      db.prepare("INSERT INTO users VALUES (?,?,?,?,?)").run(
        id,
        username,
        displayName,
        passwordHash,
        new Date().toISOString(),
      );
    } catch (error) {
      if (db.prepare("SELECT id FROM users WHERE username=?").get(username))
        throw new ApiError("usernameTaken", 409);
      throw error;
    }
    return authenticatedUser({id,username,display_name:displayName,password_hash:passwordHash},0);
  }
  const version = existing ? credentialVersion(existing.id) : 0;
  dummyHash ??= hashPassword(randomToken());
  const valid = await verifyPassword(
    password,
    existing?.password_hash ?? (await dummyHash),
  );
  if (!existing || !valid) throw new ApiError("credentialsInvalid", 401);
  const current=db.prepare("SELECT password_hash FROM users WHERE id=?").get(existing.id) as {password_hash:string}|undefined;
  if(!current || current.password_hash!==existing.password_hash || credentialVersion(existing.id)!==version) throw new ApiError("credentialsInvalid",401);
  return authenticatedUser(existing,version);
}
export function createSession(
  request: NextRequest,
  response: NextResponse,
  user: Account,
) {
  return transaction(() => {
  const proof=authenticationProofs.get(user);
  const row=database().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id) as {password_hash:string}|undefined;
  if(!proof || !row || row.password_hash!==proof.hash || credentialVersion(user.id)!==proof.version) throw new ApiError("credentialsInvalid",401);
  const old = request.cookies.get(SESSION_COOKIE)?.value;
  if (old)
    database()
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(digest(old));
  const token = randomToken();
  database()
    .prepare("INSERT INTO sessions VALUES (?,?,?,?)")
    .run(
      digest(token),
      user.id,
      Date.now() + SESSION_AGE * 1000,
      new Date().toISOString(),
    );
  response.cookies.set(
    SESSION_COOKIE,
    token,
    cookieOptions(request, SESSION_AGE),
  );
  });
}
async function sensitiveCredentials(request: NextRequest, user: Account, password: unknown) {
  rateLimit(`security:${user.id}`,8,15*60000);
  if(typeof password!=="string" || password.length<12 || password.length>128) throw new ApiError("credentialsInvalid",401);
  const row=database().prepare("SELECT * FROM users WHERE id=?").get(user.id) as UserRow|undefined;
  const version=credentialVersion(user.id);
  if(!row || !await verifyPassword(password,row.password_hash)) throw new ApiError("credentialsInvalid",401);
  return {row,version};
}
function assertSensitive(request: NextRequest, user: Account, proof: {row: UserRow;version:number}) {
  const current=database().prepare("SELECT password_hash FROM users WHERE id=?").get(user.id) as {password_hash:string}|undefined;
  if(account(request)?.id!==user.id || !current || current.password_hash!==proof.row.password_hash || credentialVersion(user.id)!==proof.version) throw new ApiError("credentialsInvalid",401);
}
export async function changePassword(request: NextRequest, response: NextResponse, user: Account, body: Record<string,unknown>) {
  validateNewPassword(body.newPassword);
  if(body.newPassword!==body.confirmPassword) throw new ApiError("passwordMismatch");
  const proof=await sensitiveCredentials(request,user,body.password);
  const hash=await hashPassword(body.newPassword);
  transaction(()=>{
    assertSensitive(request,user,proof);
    database().prepare("UPDATE users SET password_hash=? WHERE id=?").run(hash,user.id);
    revokeUserSessions(user.id);
  });
  // No await between revocation and rotation; retain this browser, revoke every old session.
  const updated=authenticatedUser({...proof.row,password_hash:hash},credentialVersion(user.id));
  createSession(request,response,updated);
}
export async function logoutAll(request: NextRequest, response: NextResponse, user: Account, password: unknown) {
  const proof=await sensitiveCredentials(request,user,password);
  transaction(()=>{assertSensitive(request,user,proof);revokeUserSessions(user.id);});
  response.cookies.set(SESSION_COOKIE,"",cookieOptions(request,0));
}
export async function exportAccount(request: NextRequest, user: Account, password: unknown) {
  const proof = await sensitiveCredentials(request, user, password);
  return transaction(() => { assertSensitive(request, user, proof); return accountExport(user); });
}
export async function deleteAccount(request: NextRequest, response: NextResponse, user: Account, body: Record<string, unknown>) {
  if (body.confirmUsername !== user.username) throw new ApiError("accountInvalid");
  const proof = await sensitiveCredentials(request, user, body.password);
  transaction(() => {
    assertSensitive(request, user, proof);
    // Durable intent precedes deletion so restoring an older backup cannot revive this account.
    recordErasure(process.env.ACCOUNT_DELETION_LOG ?? path.join(process.cwd(), ".data", "account-deletions.jsonl"), user.id);
    eraseAccountRows(database(), user.id);
  });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(request, 0));
  response.cookies.set("puzzoria-measurement", "", cookieOptions(request, 0));
}
export function logout(request: NextRequest, response: NextResponse) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token)
    database()
      .prepare("DELETE FROM sessions WHERE token_hash=?")
      .run(digest(token));
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(request, 0));
}
