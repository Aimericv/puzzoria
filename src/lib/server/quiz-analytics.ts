import { database } from "./database";
import { analyticsAdmins, type AnalyticsFilters } from "./site-analytics";
import { quizTopics, quizTopicPath } from "../knowledge-catalog";
import type { Locale } from "../types";
import { digest } from "./http";

// Aggregates existing verified starts/results and consented entry routes only.
// No new event, identity, input, credential or client-supplied outcome is collected.
export function quizAnalytics(filters:AnalyticsFilters,now:Date) {
  if(filters.game&&filters.game!=="quiz"||filters.mode&&filters.mode!=="practice")return [];
  const db=database(),until=now.toISOString(),from=new Date(Date.parse(until.slice(0,10)+"T00:00:00Z")-(filters.days-1)*86400000).toISOString();
  const admins=analyticsAdmins(),exclude=admins.length?`SELECT id FROM users WHERE lower(username) IN (${admins.map(()=>"?").join(",")})`:"SELECT id FROM users WHERE 0";
  const adminSessions=admins.length?db.prepare(`SELECT id FROM users WHERE lower(username) IN (${admins.map(()=>"?").join(",")})`).all(...admins) as {id:string}[]:[];
  const adminHashes=adminSessions.map(u=>digest(`u:${u.id}`));
  type Run={topic:string;locale:Locale;owner:string;first:number;finished:number;score:number|null;duration:number|null;entryPage:string|null;sourceChannel:string|null;sourceReferrer:string|null;sourceOwner:string|null};
  const runs=db.prepare(`SELECT json_extract(r.challenge_json,'$.topic') AS topic,json_extract(r.challenge_json,'$.locale') AS locale,r.owner,
    NOT EXISTS(SELECT 1 FROM runs p WHERE p.owner=r.owner AND p.started_at IS NOT NULL AND (p.started_at<r.started_at OR (p.started_at=r.started_at AND p.rowid<r.rowid))) AS first,
    s.id IS NOT NULL AS finished,s.score,s.duration,ms.entry_page AS entryPage,ms.channel AS sourceChannel,ms.referrer AS sourceReferrer,ms.owner_hash AS sourceOwner
    FROM runs r LEFT JOIN results s ON s.owner=r.owner AND s.challenge_id=r.challenge_id AND s.provenance='server' AND s.completed_at<=?
    LEFT JOIN measurement_events e ON e.id='run_started:'||r.id AND e.name='run_started' AND e.at<=? AND (? IS NULL OR e.locale=?)
    LEFT JOIN measurement_sessions ms ON ms.id=e.session_id
    WHERE r.game='quiz' AND r.mode='practice' AND r.started_at>=? AND r.started_at<=? AND json_extract(r.challenge_json,'$.roomId') IS NULL
      AND (r.user_id IS NULL OR r.user_id NOT IN (${exclude}))
      AND (? IS NULL OR json_extract(r.challenge_json,'$.locale')=?)`).all(until,now.getTime(),filters.interfaceLocale??null,filters.interfaceLocale??null,from,until,...admins,filters.locale??null,filters.locale??null) as Run[];
  type Landing={page:string;channel:string;referrer:string|null;sessions:number};
  const landings=db.prepare(`SELECT entry_page AS page,channel,referrer,COUNT(*) AS sessions FROM measurement_sessions
    WHERE created_at>=? AND created_at<=? AND (? IS NULL OR locale=?)
      ${adminHashes.length?`AND owner_hash NOT IN (${adminHashes.map(()=>"?").join(",")})`:""}
    GROUP BY entry_page,channel,referrer`).all(Date.parse(from),now.getTime(),filters.interfaceLocale??null,filters.interfaceLocale??null,...adminHashes) as Landing[];
  const median=(values:number[])=>{if(!values.length)return null;values.sort((a,b)=>a-b);const n=values.length;return n%2?values[(n-1)/2]:(values[n/2-1]+values[n/2])/2;};
  return quizTopics.flatMap(topic=>(["en","fr","es","de"] as const).filter(locale=>!filters.locale||filters.locale===locale).map(locale=>{
    const rows=runs.filter(r=>r.topic===topic.id&&r.locale===locale),done=rows.filter(r=>r.finished),landing=landings.filter(r=>r.page===quizTopicPath(locale,topic));
    return {topic:topic.id,locale,page:quizTopicPath(locale,topic),starts:rows.length,players:new Set(rows.map(r=>r.owner)).size,newPlayers:new Set(rows.filter(r=>r.first).map(r=>r.owner)).size,
      measuredGoogleNewPlayers:new Set(rows.filter(r=>r.first&&!adminHashes.includes(r.sourceOwner??"")&&r.entryPage===quizTopicPath(locale,topic)&&r.sourceChannel==="search"&&r.sourceReferrer&&/(^|\.)google\.[a-z.]+$/.test(r.sourceReferrer)).map(r=>r.owner)).size,
      finishes:done.length,finishPercent:rows.length?Math.round(done.length/rows.length*1000)/10:null,
      meanScore:done.length?Math.round(done.reduce((n,r)=>n+(r.score??0),0)/done.length):null,durationMedian:median(done.map(r=>r.duration!).filter(n=>n!==null)),
      landingSessions:landing.reduce((n,r)=>n+r.sessions,0),googleLandingSessions:landing.filter(r=>r.channel==="search"&&r.referrer&&/(^|\.)google\.[a-z.]+$/.test(r.referrer)).reduce((n,r)=>n+r.sessions,0)};
  }));
}
