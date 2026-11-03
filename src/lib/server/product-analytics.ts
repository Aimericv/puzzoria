import { database } from "./database";
import { digest } from "./http";
import { analyticsAdmins, type AnalyticsFilters } from "./site-analytics";
import type { GameId } from "../types";
import { quizAnalytics } from "./quiz-analytics";
type Event={session_id:string;name:string;at:number;page:string;game:GameId|null;mode:string|null;locale:string;puzzle_locale:string|null;difficulty:string|null;challenge_id:string|null;value:number;detail:string|null};
type Session={id:string;owner_hash:string;created_at:number;updated_at:number;entry_page:string;locale:string;device:string;channel:string;referrer:string|null;source:string|null;medium:string|null;campaign:string|null};
const ratio=(n:number,d:number)=>d?Math.round(n*1000/d)/10:null;
const median=(values:number[])=>{if(!values.length)return null;const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
const unique=<T>(values:T[])=>new Set(values).size;
export function productAnalytics(filters:AnalyticsFilters,now=new Date()) {
  const db=database(),end=now.getTime(),today=Date.parse(`${now.toISOString().slice(0,10)}T00:00:00Z`),start=today-(filters.days-1)*86400000;
  const excluded=(db.prepare("SELECT id,username FROM users").all() as {id:string;username:string}[]).filter(u=>analyticsAdmins().includes(u.username.toLowerCase())).map(u=>digest(`u:${u.id}`));
  const allSessions=(db.prepare("SELECT * FROM measurement_sessions WHERE updated_at>=? AND created_at<=?").all(start,end) as Session[]).filter(s=>!excluded.includes(s.owner_hash));
  const ids=new Set(allSessions.map(s=>s.id));
  const events=(db.prepare("SELECT * FROM measurement_events WHERE at>=? AND at<=? ORDER BY at,rowid").all(start,end) as Event[]).filter(e=>ids.has(e.session_id)&&(!filters.game||e.game===filters.game)&&(!filters.locale||(e.puzzle_locale??e.locale)===filters.locale)&&(!filters.interfaceLocale||e.locale===filters.interfaceLocale)&&(!filters.mode||e.mode===filters.mode));
  const selectedIds=new Set(events.map(e=>e.session_id)),sessions=allSessions.filter(s=>selectedIds.has(s.id));
  const eventsBySession=new Map<string,Event[]>();for(const e of events){const rows=eventsBySession.get(e.session_id)??[];rows.push(e);eventsBySession.set(e.session_id,rows);}
  const ownerById=new Map(sessions.map(s=>[s.id,s.owner_hash]));
  const count=(name:string)=>events.filter(e=>e.name===name).length;
  const sessionCount=(predicate:(e:Event)=>boolean)=>unique(events.filter(predicate).map(e=>e.session_id));
  const totalsBySession=sessions.map(s=>{
    const e=eventsBySession.get(s.id)??[];
    return {id:s.id,seconds:e.filter(e=>e.name==="active_time").reduce((n,e)=>n+e.value,0),games:unique(e.filter(e=>["active_time","run_started","run_finished"].includes(e.name)).map(e=>e.game).filter(Boolean))};
  });
  const activeSessions=totalsBySession.filter(s=>s.seconds>0);
  const activeByPlayer=new Map<string,number>();for(const s of activeSessions){const owner=ownerById.get(s.id)!;activeByPlayer.set(owner,(activeByPlayer.get(owner)??0)+s.seconds);}
  const stages=["visit","view","start","finish","replay"].map(stage=>({stage,sessions:stage==="visit"?sessions.length:sessionCount(e=>stage==="view"?!!e.game&&["game_view","page_view"].includes(e.name):stage==="start"?e.name==="run_started":stage==="finish"?e.name==="run_finished":e.name==="play_again")}));
  const groupSources=(rows:Session[])=>{
    const groups=new Map<string,{channel:string;source:string|null;medium:string|null;campaign:string|null;sessions:number;players:Set<string>;starts:number;finishes:number}>();
    for(const s of rows){const key=JSON.stringify([s.channel,s.source??s.referrer,s.medium,s.campaign]);const g=groups.get(key)??{channel:s.channel,source:s.source??s.referrer,medium:s.medium,campaign:s.campaign,sessions:0,players:new Set<string>(),starts:0,finishes:0};g.sessions++;g.players.add(s.owner_hash);const e=eventsBySession.get(s.id)??[];g.starts+=e.filter(e=>e.name==="run_started").length;g.finishes+=e.filter(e=>e.name==="run_finished").length;groups.set(key,g);}
    const retention=(owners:Set<string>,lag:number)=>{let mature=0,returned=0;for(const owner of owners){const first=firstActivity.get(owner);if(!first||Date.parse(first)<start||Date.parse(first)+(lag+1)*86400000>today)continue;mature++;if(activityDays.get(owner)?.has(new Date(Date.parse(first)+lag*86400000).toISOString().slice(0,10)))returned++;}return {mature,returned,percent:ratio(returned,mature)};};
    return [...groups.values()].map(g=>({...g,players:g.players.size,d1:retention(g.players,1),d7:retention(g.players,7)})).sort((a,b)=>b.sessions-a.sessions).slice(0,50);
  };
  const history=db.prepare("SELECT * FROM measurement_sessions WHERE created_at<=? ORDER BY created_at").all(end) as Session[];
  const firsts=new Map<string,Session>();for(const s of history)if(!firsts.has(s.owner_hash))firsts.set(s.owner_hash,s);
  const firstTouch=sessions.map(s=>({...s,...firsts.get(s.owner_hash),id:s.id,owner_hash:s.owner_hash}));
  const entries=[...new Set(sessions.map(s=>s.entry_page))].map(page=>({page,sessions:sessions.filter(s=>s.entry_page===page).length})).sort((a,b)=>b.sessions-a.sessions);
  const transitions=new Map<string,{from:GameId;to:GameId;count:number}>();
  for(const s of sessions){let previous:GameId|undefined;for(const e of (eventsBySession.get(s.id)??[]).filter(e=>e.game&&["game_view","page_view","run_started"].includes(e.name))){if(e.game&&previous&&e.game!==previous){const key=`${previous}:${e.game}`,v=transitions.get(key)??{from:previous,to:e.game,count:0};v.count++;transitions.set(key,v);}if(e.game)previous=e.game;}}
  const adminIds=(db.prepare("SELECT id,username FROM users").all() as {id:string;username:string}[]).filter(u=>analyticsAdmins().includes(u.username.toLowerCase())).map(u=>u.id);
  type Result={game:GameId;mode:string;locale:string;difficulty:string|null;duration:number;attempts:number|null;success:number;owner:string;completed_at:string};
  const results=(db.prepare("SELECT game,mode,locale,CASE WHEN challenge_id LIKE 'duel:guess:%' THEN 'friends' ELSE difficulty END AS difficulty,duration,attempts,success,owner,completed_at,user_id FROM results WHERE provenance='server' AND completed_at>=? AND completed_at<=?").all(new Date(start).toISOString(),now.toISOString()) as (Result&{user_id:string|null})[]).filter(r=>!adminIds.includes(r.user_id??"")&&(!filters.game||r.game===filters.game)&&(!filters.locale||r.locale===filters.locale)&&(!filters.mode||r.mode===filters.mode));
  const gameGroups=new Map<string,{game:GameId;mode:string|null;locale:string|null;difficulty:string|null;activeSeconds:number;activeSamples:number;activeMedian:number|null;finishes:number;wins:number|null;losses:number|null;officialMedian:number|null;attemptsMean:number|null;errors:number}>();
  const keys=[...new Set([...events.filter(e=>e.game&&["active_time","run_error"].includes(e.name)).map(e=>JSON.stringify([e.game,e.mode,e.puzzle_locale??e.locale,e.difficulty])),...results.map(r=>JSON.stringify([r.game,r.mode,r.locale,r.difficulty]))])];
  for(const key of keys){const [game,mode,locale,difficulty]=JSON.parse(key) as [GameId,string|null,string|null,string|null];const e=events.filter(e=>e.game===game&&e.mode===mode&&(e.puzzle_locale??e.locale)===locale&&e.difficulty===difficulty);const r=results.filter(r=>r.game===game&&r.mode===mode&&r.locale===locale&&r.difficulty===difficulty);const failable=["word","rareword","2048","mines","guess","math","football"].includes(game),attempts=r.filter(r=>r.attempts!==null);gameGroups.set(key,{game,mode,locale,difficulty,activeSeconds:e.filter(e=>e.name==="active_time").reduce((n,e)=>n+e.value,0),activeSamples:unique(e.filter(e=>e.name==="active_time"&&e.value>0).map(e=>e.session_id)),activeMedian:median([...new Set(e.filter(e=>e.name==="active_time"&&e.value>0).map(e=>e.session_id))].map(id=>e.filter(e=>e.name==="active_time"&&e.session_id===id).reduce((n,e)=>n+e.value,0))),finishes:r.length,wins:failable?r.filter(r=>r.success).length:null,losses:failable?r.filter(r=>!r.success).length:null,officialMedian:median(r.map(r=>r.duration)),attemptsMean:attempts.length?Math.round(attempts.reduce((n,r)=>n+r.attempts!,0)/attempts.length*10)/10:null,errors:e.filter(e=>e.name==="run_error").length});}
  type Activity={owner:string;game:GameId;mode:string;locale:string;day:string};
  const activity=(db.prepare(`SELECT owner,game,mode,json_extract(challenge_json,'$.locale') AS locale,substr(started_at,1,10) AS day,user_id FROM runs WHERE started_at IS NOT NULL AND started_at<=? UNION SELECT owner,game,mode,locale,substr(completed_at,1,10),user_id FROM results WHERE provenance='server' AND completed_at<=?`).all(now.toISOString(),now.toISOString()) as (Activity&{user_id:string|null})[]).filter(a=>!adminIds.includes(a.user_id??""));
  const firstActivity=new Map<string,string>(),activityDays=new Map<string,Set<string>>();for(const a of activity){const hash=digest(a.owner);if(!firstActivity.has(hash)||a.day<firstActivity.get(hash)!)firstActivity.set(hash,a.day);const days=activityDays.get(hash)??new Set<string>();days.add(a.day);activityDays.set(hash,days);}
  const scopedActivity=activity.filter(a=>(!filters.game||a.game===filters.game)&&(!filters.locale||a.locale===filters.locale)&&(!filters.mode||a.mode===filters.mode));
  const players=(days:number)=>unique(scopedActivity.filter(a=>Date.parse(a.day)>=today-(days-1)*86400000).map(a=>a.owner));
  const weekly=scopedActivity.filter(a=>Date.parse(a.day)>=today-6*86400000),weeklyOwners=[...new Set(weekly.map(a=>a.owner))];
  const perOwner=weeklyOwners.map(o=>unique(weekly.filter(a=>a.owner===o).map(a=>a.day)));
  const sameGameRetention=[1,7,30].map(lag=>{const first=new Map<string,string>();for(const a of scopedActivity){const key=`${a.owner}:${a.game}`;if(!first.has(key)||a.day<first.get(key)!)first.set(key,a.day);}let mature=0,returned=0;for(const [key,day] of first){const target=Date.parse(day)+lag*86400000;if(Date.parse(day)<start||target>=today)continue;mature++;if(scopedActivity.some(a=>`${a.owner}:${a.game}`===key&&Date.parse(a.day)===target))returned++;}return {lag,mature,returned,percent:ratio(returned,mature)};});
  const segments=["locale","device","mode","owner"] as const;
  const breakdown=segments.flatMap(dimension=>{const values=dimension==="mode"?[...new Set(events.map(e=>e.mode).filter(Boolean))]:dimension==="owner"?["accounts","guests"]:[...new Set(sessions.map(s=>s[dimension]))];return values.map(value=>({dimension,value,sessions:dimension==="mode"?sessionCount(e=>e.mode===value):dimension==="owner"?0:sessions.filter(s=>s[dimension]===value).length}));});
  // Account/guest segments are derived from server identities, not client labels.
  const accountHashes=new Set((db.prepare("SELECT id FROM users").all() as {id:string}[]).map(u=>digest(`u:${u.id}`)));
  for(const b of breakdown)if(b.dimension==="owner")b.sessions=sessions.filter(s=>accountHashes.has(s.owner_hash)===(b.value==="accounts")).length;
  const runRows=(db.prepare("SELECT owner,game,mode,challenge_id,started_at,challenge_json,user_id FROM runs WHERE started_at>=? AND started_at<=?").all(new Date(start).toISOString(),now.toISOString()) as {owner:string;game:string;mode:string;challenge_id:string;started_at:string;challenge_json:string;user_id:string|null}[]).filter(r=>!adminIds.includes(r.user_id??"")&&(!filters.game||r.game===filters.game)&&(!filters.mode||r.mode===filters.mode)&&(!filters.locale||JSON.parse(r.challenge_json).locale===filters.locale));
  const officialStartKeys=new Set(runRows.map(r=>`${digest(r.owner)}:${JSON.parse(r.challenge_json).roomId?`live:${digest(r.challenge_id)}`:r.challenge_id}`));
  const roomStarts=(db.prepare("SELECT code,state_json FROM number_rooms WHERE json_extract(state_json,'$.startedAt')>=? AND json_extract(state_json,'$.startedAt')<=?").all(new Date(start).toISOString(),now.toISOString()) as {code:string;state_json:string}[]).flatMap(r=>{const room=JSON.parse(r.state_json);return (room.players as {owner:string;userId:string|null;locale:string}[]).filter(p=>!adminIds.includes(p.userId??"")&&(!filters.game||filters.game==="guess")&&(!filters.mode||filters.mode==="practice")&&(!filters.locale||filters.locale===p.locale)).map(p=>`${digest(p.owner)}:duel:${digest(`duel:guess:${r.code}`)}`);});
  for(const key of roomStarts)officialStartKeys.add(key);
  const measuredStarts=unique(events.filter(e=>e.name==="run_started"&&officialStartKeys.has(`${ownerById.get(e.session_id)}:${e.challenge_id}`)).map(e=>`${ownerById.get(e.session_id)}:${e.challenge_id}`));
  const socialNames=["share","friend_invite","duel_created","duel_joined","duel_started","duel_finished","duel_rematch","play_again","next_game_click","account_prompt_view","account_prompt_dismiss","signup_start","signup_complete","login","local_data_migrated"];
  const adNames=["ad_opportunity","ad_request","ad_render","ad_viewable","video_offer","video_accept","video_start","video_complete"];
  const resumed=sessionCount(e=>!!e.challenge_id&&["active_time","run_finished"].includes(e.name)&&!(eventsBySession.get(e.session_id)??[]).some(a=>a.name==="run_started"&&a.challenge_id===e.challenge_id));
  return {
    totals:{sessions:sessions.length,visitors:unique(sessions.map(s=>s.owner_hash)),pageViews:count("page_view"),activeSeconds:activeSessions.reduce((n,s)=>n+s.seconds,0),activeMedian:median(activeSessions.map(s=>s.seconds)),activeSamples:activeSessions.length,activeMean:activeSessions.length?activeSessions.reduce((n,s)=>n+s.seconds,0)/activeSessions.length:null,activePerPlayerMedian:median([...activeByPlayer.values()]),gamesPerSession:sessions.length?totalsBySession.reduce((n,s)=>n+s.games,0)/sessions.length:null,multiGamePercent:ratio(totalsBySession.filter(s=>s.games>=2).length,sessions.length),finishesPerSession:sessions.length?Math.round(count("run_finished")/sessions.length*100)/100:null,resumed,observedExits:count("game_abandon")},
    funnel:stages,acquisition:groupSources(sessions),firstTouch:groupSources(firstTouch),entries,transitions:[...transitions.values()].sort((a,b)=>b.count-a.count),games:[...gameGroups.values()],
    frequency:{dau:players(1),wau:players(7),mau:players(30),stickiness:ratio(players(1),players(30)),daysPerWeek:perOwner.length?Math.round(perOwner.reduce((n,d)=>n+d,0)/perOwner.length*10)/10:null,multiGameWeekly:ratio(weeklyOwners.filter(o=>unique(weekly.filter(a=>a.owner===o).map(a=>a.game))>=2).length,weeklyOwners.length)},
    quizTopics:quizAnalytics(filters,now),
    sameGameRetention,breakdown,social:socialNames.map(name=>({name,count:count(name),sessions:sessionCount(e=>e.name===name)})),
    distribution:[activeSessions.filter(s=>s.seconds<60).length,activeSessions.filter(s=>s.seconds>=60&&s.seconds<300).length,activeSessions.filter(s=>s.seconds>=300&&s.seconds<900).length,activeSessions.filter(s=>s.seconds>=900).length],
    quality:{coverage:ratio(measuredStarts,officialStartKeys.size),measuredStarts,serverStarts:officialStartKeys.size,failedRequests:count("client_error"),failedLatencyMedian:median(events.filter(e=>e.name==="client_error").map(e=>e.value)),counters:db.prepare("SELECT kind,SUM(count) AS count FROM measurement_quality WHERE day>=? AND day<=? GROUP BY kind").all(new Date(start).toISOString().slice(0,10),now.toISOString().slice(0,10)) as {kind:string;count:number}[]},
    ads:{enabled:process.env.ANALYTICS_ADS_ENABLED==="true",events:adNames.map(name=>({name,count:count(name)})),revenue:null,rewards:null},
    daily:Array.from({length:filters.days},(_,i)=>{const day=new Date(start+i*86400000).toISOString().slice(0,10),e=events.filter(e=>new Date(e.at).toISOString().slice(0,10)===day);return {day,sessions:unique(e.map(e=>e.session_id)),visitors:unique(e.map(e=>ownerById.get(e.session_id))),views:e.filter(e=>e.name==="page_view").length,activeSeconds:e.filter(e=>e.name==="active_time").reduce((n,e)=>n+e.value,0)};})
  };
}
export type ProductAnalytics=ReturnType<typeof productAnalytics>;
