import type { NextRequest } from "next/server";
import {
  authenticate,
  createSession,
  identity,
  logout,
  setGuest,
  changePassword,
  logoutAll,
  exportAccount,
  deleteAccount,
} from "@/lib/server/auth";
import {
  apiError,
  ApiError,
  json,
  readBody,
  rateLimit,
  requestAddress,
} from "@/lib/server/http";
import { migrateProgress, userResults } from "@/lib/server/results";
import { saveSnapshots, snapshots } from "@/lib/server/sync";
import { database } from "@/lib/server/database";
import { achievements } from "@/lib/statistics";
import {
  hasRecoveryCode,
  issueRecoveryCode,
  recoverAccount,
  rotateRecoveryCode,
} from "@/lib/server/recovery";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  try {
    rateLimit("account-read-address:"+requestAddress(request),600,60000);
    const who = identity(request),
      user = who.user;
    const response = json(
      user
        ? {
            user,
            completions: userResults(user.id),
            snapshots: snapshots(user),
            achievements: achievements(userResults(user.id)),
            recoveryEnabled: hasRecoveryCode(user.id),
          }
        : { user: null },
    );
    setGuest(response, request, who.guestId);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request, 768000),
      who = identity(request),
      action = body.action;
    if (action === "signup" || action === "login") {
      const user = await authenticate(request, body, action === "signup");
      const response = json({
        user,
        ...(action === "signup"
          ? { recoveryCode: issueRecoveryCode(user.id) }
          : {}),
      });
      createSession(request, response, user);
      setGuest(response, request, who.guestId);
      return response;
    }
    if (action === "logout") {
      const response = json({ user: null });
      logout(request, response);
      return response;
    }
    if (action === "recover") return json(await recoverAccount(request, body));
    if (!who.user) throw new ApiError("unauthorized", 401);
    rateLimit(`account:${who.user.id}`, 120, 60000);
    if (action === "export") {
      const response = json(await exportAccount(request, who.user, body.password));
      response.headers.set("Content-Disposition", 'attachment; filename="puzzoria-account.json"');
      response.headers.set("X-Content-Type-Options", "nosniff");
      return response;
    }
    if (action === "delete") {
      const response = json({ deleted: true });
      await deleteAccount(request, response, who.user, body);
      return response;
    }
    if(action === "change-password") {
      const response=json({changed:true});
      await changePassword(request,response,who.user,body);
      return response;
    }
    if(action === "logout-all") {
      const response=json({user:null});
      await logoutAll(request,response,who.user,body.password);
      return response;
    }
    if (action === "recovery-code")
      return json({
        recoveryCode: await rotateRecoveryCode(request, who.user, body),
      });
    if (action === "migrate") {
      const migrated = migrateProgress(
        who.user,
        who.guestId,
        body.completions ?? [],
      );
      if (body.snapshots) saveSnapshots(who.user, body.snapshots);
      if (body.summaryOnly === true) return json({ migrated });
      return json({
        migrated,
        completions: userResults(who.user.id),
        snapshots: snapshots(who.user),
      });
    }
    if (action === "sync") {
      saveSnapshots(who.user, body.snapshots);
      return json({ saved: true });
    }
    if (action === "profile") {
      const name = body.displayName;
      if (
        typeof name !== "string" ||
        name.trim().length < 2 ||
        name.trim().length > 32 ||
        /[\p{Cc}\p{Cf}<>]/u.test(name)
      )
        throw new ApiError("accountInvalid");
      database()
        .prepare("UPDATE users SET display_name=? WHERE id=?")
        .run(name.trim(), who.user.id);
      return json({ user: { ...who.user, displayName: name.trim() } });
    }
    throw new ApiError("invalid");
  } catch (error) {
    return apiError(error);
  }
}
