import type { Account } from "./auth";
import { database } from "./database";
import { digest } from "./http";
import { userResults } from "./results";
import { snapshots } from "./sync";

export function accountExport(user: Account) {
  const db = database();
  return {
    format: "puzzoria-account-v1",
    exportedAt: new Date().toISOString(),
    profile: { username: user.username, displayName: user.displayName,
      createdAt: db.prepare("SELECT created_at FROM users WHERE id=?").get(user.id)?.created_at },
    results: userResults(user.id),
    savedDrafts: snapshots(user),
    savedRuns: (db.prepare("SELECT game,mode,challenge_id AS challengeId,created_at AS createdAt,started_at AS startedAt,progress_json FROM runs WHERE user_id=? OR owner=? ORDER BY created_at").all(user.id, `u:${user.id}`) as {game:string;mode:string;challengeId:string;createdAt:string;startedAt:string|null;progress_json:string}[]).map(({progress_json, ...run}) => {
      const progress = JSON.parse(progress_json);
      // Export only the owner's submitted actions, never private puzzle/solver state.
      return { ...run, guesses: progress.guesses ?? [], actions: progress.actions ?? [], hints: progress.hints ?? 0 };
    }),
    invitations: db.prepare("SELECT f.id,f.created_at AS createdAt,f.expires_at AS expiresAt,r.game FROM friend_challenges f JOIN runs r ON f.host_run_id=r.id WHERE r.user_id=? OR r.owner=?").all(user.id, `u:${user.id}`),
    liveMatches: (db.prepare("SELECT code,state_json FROM live_rooms WHERE json_extract(state_json,'$.players[0].owner')=? OR json_extract(state_json,'$.players[1].owner')=?").all(`u:${user.id}`,`u:${user.id}`) as {code:string;state_json:string}[]).map(row=>{const r=JSON.parse(row.state_json),p=r.players.find((p:{owner:string})=>p.owner===`u:${user.id}`);return {code:row.code,game:r.game,round:r.round,startAt:r.startAt,endAt:r.endAt,completed:r.done,ownSecret:p.secret,ownGuesses:p.guesses,ownRun:p.runId};}),
    duels: (db.prepare("SELECT code,state_json FROM number_rooms WHERE json_extract(state_json,'$.players[0].owner')=? OR json_extract(state_json,'$.players[1].owner')=?").all(`u:${user.id}`, `u:${user.id}`) as {code:string;state_json:string}[]).map(row => {
      const room = JSON.parse(row.state_json), self = room.players.find((player:{owner:string}) => player.owner === `u:${user.id}`);
      return { code: row.code, createdAt: room.createdAt, startedAt: room.startedAt, completedAt: room.completedAt, completed: room.completed, ownNumber: self?.number ?? null, events: room.events };
    }),
    votes: db.prepare("SELECT kind,cohort,payload_json AS answers,created_at AS createdAt FROM community_votes WHERE owner=?").all(`u:${user.id}`),
    visits: db.prepare("SELECT created_at,updated_at,entry_page,locale,device,channel,referrer,source,medium,campaign FROM measurement_sessions WHERE owner_hash=? ORDER BY created_at").all(digest(`u:${user.id}`)),
    actions: db.prepare("SELECT e.name,e.at,e.page,e.game,e.mode,e.locale,e.value,e.detail FROM measurement_events e JOIN measurement_sessions s ON e.session_id=s.id WHERE s.owner_hash=? ORDER BY e.at").all(digest(`u:${user.id}`)),
  };
}
