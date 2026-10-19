import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";
import { identity, setGuest, type Identity } from "./auth";
import { database, transaction } from "./database";
import { ApiError, cookieOptions, digest, randomToken } from "./http";
import { acquisition, measurementEvents, measurementPage, type MeasurementEvent } from "../measurement";
import type { LiveView } from "../live-types";

export const MEASUREMENT_COOKIE = "puzzoria-measurement";
const choiceCookie = "puzzoria-measurement-choice";
const sessionMs = 30 * 60000;
const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);
function interfaceLocale(request:NextRequest,fallback:string) {
  try {const referrer=request.headers.get("referer");return referrer?measurementPage(new URL(referrer).pathname)?.locale??fallback:fallback;}catch{return fallback;}
}
function ownedRoomContext(challenge:unknown,who:Identity) {
  if(typeof challenge!=="string" || !/^duel:guess:[A-Z2-9]{8}$/.test(challenge))return null;
  const row=database().prepare("SELECT state_json,expires_at FROM number_rooms WHERE code=?").get(challenge.slice(11)) as {state_json:string;expires_at:number}|undefined;
  if(!row || row.expires_at<Date.now())return null;
  const room=JSON.parse(row.state_json),player=room.players.find((p:{owner:string})=>p.owner===who.owner);
  if(!player)return null;
  return {challenge:`duel:${digest(challenge)}`,game:"guess" as const,mode:"practice" as const,locale:player.locale as string,started_at:room.startedAt as string|null,completed:room.completed as boolean};
}
function excluded(request: NextRequest) {
  const user = identity(request).user;
  const admin=!!user && (process.env.ANALYTICS_ADMIN_USERNAMES ?? "").toLowerCase().split(",").map(s => s.trim()).includes(user.username.toLowerCase());
  if(admin){const who=identity(request);database().prepare("UPDATE measurement_sessions SET owner_hash=? WHERE device_hash=? AND owner_hash=?").run(digest(who.owner),digest(`device:${who.guestId}`),digest(`g:${who.guestId}`));}
  return /bot|crawler|spider|headless/i.test(request.headers.get("user-agent") ?? "") || admin;
}
export function measurementQuality(kind: "accepted" | "duplicate" | "invalid" | "declined" | "privacy_signal", count = 1, now = Date.now()) {
  database().prepare("INSERT INTO measurement_quality VALUES(?,?,?) ON CONFLICT(day,kind) DO UPDATE SET count=count+excluded.count").run(new Date(now).toISOString().slice(0,10),kind,count);
}
export function measurementChoice(response: NextResponse, request: NextRequest, enabled: boolean) {
  response.cookies.set(choiceCookie, enabled ? "yes" : "no", cookieOptions(request, 180 * 86400));
  if (!enabled) response.cookies.set(MEASUREMENT_COOKIE,"",cookieOptions(request,0));
}
export function collectMeasurement(request: NextRequest, response: NextResponse, body: Record<string,unknown>, now = Date.now()) {
  if (excluded(request)) return { accepted: 0, excluded: true };
  if (request.headers.get("sec-gpc") === "1" || request.headers.get("dnt") === "1") { measurementQuality("privacy_signal",1,now); measurementChoice(response,request,false); return { accepted:0 }; }
  if (body.choice === "no") { measurementQuality("declined",1,now); measurementChoice(response,request,false); return {accepted:0}; }
  if (body.choice !== "yes" && request.cookies.get(choiceCookie)?.value !== "yes") throw new ApiError("forbidden",403);
  if (!Array.isArray(body.events) || body.events.length > 30) throw new ApiError("invalid");
  const incoming=body.events as unknown[];
  const who = identity(request), db = database(), owner = digest(who.owner), device = digest(`device:${who.guestId}`);
  let raw = request.cookies.get(MEASUREMENT_COOKIE)?.value;
  let session = raw ? db.prepare("SELECT id,owner_hash,device_hash,updated_at FROM measurement_sessions WHERE id=?").get(digest(raw)) as {id:string;owner_hash:string;device_hash:string;updated_at:number}|undefined : undefined;
  if (session && (session.device_hash !== device || session.updated_at < now-sessionMs || (session.owner_hash !== owner && session.owner_hash !== digest(`g:${who.guestId}`)))) session=undefined;
  let accepted=0;
  transaction(() => {
    if (who.user) db.prepare("UPDATE measurement_sessions SET owner_hash=? WHERE device_hash=? AND owner_hash=?").run(owner,device,digest(`g:${who.guestId}`));
    if (!session) {
      raw=randomToken();
      const first=incoming.find((e:unknown) => e && typeof e === "object" && typeof (e as MeasurementEvent).path === "string") as MeasurementEvent|undefined;
      const page=measurementPage(first?.path ?? "/en");
      const a=acquisition(body.referrer,body.source,body.medium,body.campaign,process.env.AUTH_ORIGIN ?? request.nextUrl.origin);
      const ua=request.headers.get("user-agent") ?? "";
      const deviceType=/iPad|Tablet/i.test(ua)?"tablet":/Mobile|Android|iPhone/i.test(ua)?"mobile":"desktop";
      session={id:digest(raw),owner_hash:owner,device_hash:device,updated_at:now};
      db.prepare("INSERT INTO measurement_sessions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(session.id,owner,device,now,now,page?.page ?? "/en",page?.locale ?? "en",deviceType,page?.page.endsWith("/friend") || page?.page.endsWith("/live")?"friend":a.channel,a.referrer,a.source,a.medium,a.campaign);
    }
    for (const unknownEvent of incoming) {
      if (!unknownEvent || typeof unknownEvent !== "object") {measurementQuality("invalid",1,now);continue;}
      const e=unknownEvent as MeasurementEvent, page=typeof e.path === "string" && e.path.length <= 512 ? measurementPage(e.path) : null;
      if (!isUuid(e.id) || !measurementEvents.includes(e.name) || !page || e.locale !== page.locale || ((e.name.startsWith("ad_") || e.name.startsWith("video_")) && process.env.ANALYTICS_ADS_ENABLED !== "true")) {measurementQuality("invalid",1,now);continue;}
      if (db.prepare("SELECT 1 FROM measurement_events WHERE id=?").get(e.id)) {measurementQuality("duplicate",1,now);continue;}
      let game=page.game, mode=page.mode, puzzleLocale:string|null=null, difficulty:string|null=null, challenge:string|null=null, started=false, beganAt=now;
      if (typeof e.challenge_id === "string" && e.challenge_id.length <= 200) {
        const run=db.prepare("SELECT game,mode,challenge_json,started_at FROM runs WHERE owner=? AND challenge_id=?").get(who.owner,e.challenge_id) as {game:typeof game;mode:typeof mode;challenge_json:string;started_at:string|null}|undefined;
        if (run) {const c=JSON.parse(run.challenge_json);game=run.game;mode=run.mode;puzzleLocale=c.locale;difficulty=c.difficulty ?? null;challenge=c.roomId?`live:${digest(e.challenge_id)}`:e.challenge_id;started=!!run.started_at;beganAt=run.started_at?Date.parse(run.started_at):now;}
        else {const room=ownedRoomContext(e.challenge_id,who);if(room){game=room.game;mode=room.mode;puzzleLocale=room.locale;difficulty="friends";challenge=room.challenge;started=!!room.started_at;beganAt=room.started_at?Date.parse(room.started_at):now;}}
      }
      let value=0, detail:string|null=null;
      if (e.name === "active_time") {
        if (!game || !challenge || !started || !Number.isFinite(e.seconds) || e.seconds!<=0 || e.seconds!>15) {measurementQuality("invalid",1,now);continue;}
        const last=db.prepare("SELECT until_at FROM measurement_activity WHERE device_hash=?").get(device) as {until_at:number}|undefined;
        // Arrival-clock intervals overlap across tabs; count their union, never client timestamps.
        value=Math.max(0,now-Math.max(beganAt,now-e.seconds!*1000,last?.until_at ?? 0))/1000;
        db.prepare("INSERT INTO measurement_activity VALUES(?,?) ON CONFLICT(device_hash) DO UPDATE SET until_at=max(until_at,excluded.until_at)").run(device,now);
      }
      if (e.name === "share") detail=["native","clipboard","image"].includes(e.method ?? "") ? e.method! : "unknown";
      if (e.name === "client_error") {detail=Number.isInteger(e.status)&&e.status!>=0&&e.status!<=599?String(e.status):"unknown";value=Number.isFinite(e.latency)?Math.min(60000,Math.max(0,e.latency!)):0;}
      if (e.name.startsWith("ad_") || e.name.startsWith("video_")) {
        if (!isUuid(e.impression_id)) {measurementQuality("invalid",1,now);continue;}
        if (db.prepare("SELECT 1 FROM measurement_events WHERE name=? AND detail=?").get(e.name,e.impression_id)) {measurementQuality("duplicate",1,now);continue;}
        detail=e.impression_id!;
      }
      db.prepare("INSERT INTO measurement_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(e.id,session!.id,e.name,now,page.page,game ?? null,mode ?? null,page.locale,puzzleLocale,difficulty,challenge,value,detail);
      accepted++;
    }
    db.prepare("UPDATE measurement_sessions SET updated_at=? WHERE id=?").run(now,session!.id);
    measurementQuality("accepted",accepted,now);
    db.prepare("DELETE FROM measurement_events WHERE at<?").run(now-90*86400000);
    db.prepare("DELETE FROM measurement_sessions WHERE updated_at<?").run(now-390*86400000);
    db.prepare("DELETE FROM measurement_activity WHERE until_at<?").run(now-86400000);
    db.prepare("DELETE FROM measurement_quality WHERE day<?").run(new Date(now-390*86400000).toISOString().slice(0,10));
  });
  setGuest(response,request,who.guestId);
  measurementChoice(response,request,true);
  response.cookies.set(MEASUREMENT_COOKIE,raw!,cookieOptions(request,1800));
  return {accepted};
}
export function recordMeasuredRoom(request:NextRequest,code:unknown,now=Date.now()) {
  try {
    if(excluded(request)||request.cookies.get(choiceCookie)?.value!=="yes"||request.headers.get("sec-gpc")==="1"||request.headers.get("dnt")==="1")return;
    const raw=request.cookies.get(MEASUREMENT_COOKIE)?.value,who=identity(request),room=ownedRoomContext(`duel:guess:${code}`,who),db=database();
    if(!raw||!room?.started_at)return;
    const s=db.prepare("SELECT id,created_at,locale FROM measurement_sessions WHERE id=? AND device_hash=? AND updated_at>=?").get(digest(raw),digest(`device:${who.guestId}`),now-sessionMs) as {id:string;created_at:number;locale:string}|undefined;
    if(!s)return;
    for(const name of ["run_started","run_finished"]){if(name==="run_started"&&Date.parse(room.started_at)<s.created_at)continue;if(name==="run_finished"&&(!room.completed||!db.prepare("SELECT 1 FROM results WHERE owner=? AND challenge_id=? AND provenance='server'").get(who.owner,`duel:guess:${code}`)))continue;
      db.prepare("INSERT OR IGNORE INTO measurement_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(`${name}:${room.challenge}:${digest(who.owner)}`,s.id,name,now,"room",room.game,room.mode,interfaceLocale(request,s.locale),room.locale,"friends",room.challenge,0,null);
    }
  }catch{/* Optional measurement never changes a room. */}
}
// Telemetry must never prevent a move, change a score, or reveal an answer.
export function recordMeasuredRun(request: NextRequest, runId: unknown, name: "run_started"|"run_finished"|"run_error", status=0, now=Date.now()) {
  try {
    if (excluded(request) || request.cookies.get(choiceCookie)?.value !== "yes" || request.headers.get("sec-gpc")==="1" || request.headers.get("dnt")==="1" || typeof runId !== "string") return;
    const raw=request.cookies.get(MEASUREMENT_COOKIE)?.value;
    if (!raw) return;
    const db=database(),who=identity(request),session=db.prepare("SELECT id,created_at,locale FROM measurement_sessions WHERE id=? AND device_hash=? AND updated_at>=?").get(digest(raw),digest(`device:${who.guestId}`),now-sessionMs) as {id:string;created_at:number;locale:string}|undefined;
    const run=db.prepare("SELECT * FROM runs WHERE id=? AND owner=?").get(runId,who.owner) as {game:string;mode:string;challenge_id:string;challenge_json:string;started_at:string|null;response_json:string|null}|undefined;
    if (!session || !run || !run.started_at || (name==="run_finished" && !db.prepare("SELECT 1 FROM results WHERE owner=? AND challenge_id=? AND provenance='server'").get(who.owner,run.challenge_id))) return;
    if(name==="run_started" && Date.parse(run.started_at)<session.created_at)return;
    const c=JSON.parse(run.challenge_json);
    db.prepare("INSERT OR IGNORE INTO measurement_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(name==="run_error"?randomUUID():`${name}:${runId}`,session.id,name,now,"game",run.game,run.mode,interfaceLocale(request,session.locale),c.locale,c.difficulty ?? null,c.roomId?`live:${digest(run.challenge_id)}`:run.challenge_id,0,name==="run_error"?String(status):null);
  } catch { /* Optional analytics never changes the game response. */ }
}

export function recordMeasuredLive(request: NextRequest, room: LiveView, event?: "duel_created" | "duel_joined" | "duel_rematch") {
  try {
    if(room.you<0 || excluded(request) || request.cookies.get(choiceCookie)?.value!=="yes" || request.headers.get("dnt")==="1" || request.headers.get("sec-gpc")==="1") return;
    const raw=request.cookies.get(MEASUREMENT_COOKIE)?.value;if(!raw)return;
    const who=identity(request),now=Date.now(),session=database().prepare("SELECT id,locale FROM measurement_sessions WHERE id=? AND device_hash=? AND updated_at>=?").get(digest(raw),digest(`device:${who.guestId}`),now-sessionMs) as {id:string;locale:string}|undefined;
    if(!session)return;
    const names=[...(event?[event]:[]),...(["playing","finished"].includes(room.phase)?["duel_started"]:[]),...(room.phase==="finished"?["duel_finished"]:[])];
    for(const name of names)database().prepare("INSERT OR IGNORE INTO measurement_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(`${name}:${digest(room.code)}:${room.round}:${digest(who.owner)}`,session.id,name,now,"live",room.game,"practice",interfaceLocale(request,session.locale),room.locale,room.difficulty,`live:${digest(room.challenge?.id??room.code)}`,0,null);
    if(room.runId && ["playing","finished"].includes(room.phase)){recordMeasuredRun(request,room.runId,"run_started");recordMeasuredRun(request,room.runId,"run_finished");}
  } catch { /* Measurement is optional and never blocks a room. */ }
}
