import { quizTopics, quizTopicPath } from "./knowledge-catalog";
import { locales } from "./types";
type RecordValue=Record<string,unknown>;
const record=(value:unknown):RecordValue=>value&&typeof value==="object"&&!Array.isArray(value)?value as RecordValue:{};
const finite=(value:unknown)=>typeof value==="number"&&Number.isFinite(value)&&value>=0?value:null;
const day=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
const timestamp=(value:unknown)=>typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)&&Number.isFinite(Date.parse(value))?value:null;
// Offline join of the existing trusted read-only exports. No Google credentials,
// network requests, identities or raw search queries enter the resulting report.
export function quizAcquisitionReport(googleInput:unknown,analyticsInput:unknown){
 const google=record(googleInput),wrapper=record(analyticsInput),analytics=wrapper.schema==="puzzoria.analytics"?wrapper:record(record(wrapper.reports)[30]);
 const product=record(record(analytics.report).product),stats=product.quizTopics;
 if(!Array.isArray(stats))throw Error("Analytics export must include report.product.quizTopics");
 const breakdowns=record(google.breakdowns),pageRows=record(breakdowns.page).rows;
 const pages=google.status==="available"&&Array.isArray(pageRows)?pageRows.map(record):[];
 const rows=quizTopics.flatMap(topic=>locales.map(locale=>{
  const path=quizTopicPath(locale,topic),observed=stats.map(record).find(r=>r.topic===topic.id&&r.locale===locale)??null;
  const page=pages.find(row=>{try{const url=new URL(String(row.key??""));return url.origin==="https://puzzoria.com"&&url.pathname===path&&!url.search;}catch{return false;}});
  return {topic:topic.id,locale,page:`https://puzzoria.com${path}`,
   google:{impressions:finite(page?.impressions),clicks:finite(page?.clicks),position:finite(page?.position),rowReturned:!!page},
   playing:observed?Object.fromEntries(["starts","finishes","players","newPlayers","measuredGoogleNewPlayers","googleLandingSessions","finishPercent","meanScore","durationMedian"].map(key=>[key,finite(observed[key])])):null};
 }));
 const googlePeriod=record(breakdowns.period),playingPeriod=record(analytics.period);
 return {schema:"puzzoria.quiz-acquisition",schemaVersion:1,
  google:{status:google.status==="available"?"available":"unavailable",fetchedAt:timestamp(google.fetchedAt),period:{startDate:day(googlePeriod.startDate),endDate:day(googlePeriod.endDate)},timezone:google.timezone==="America/Los_Angeles"?google.timezone:null,rowsExhaustive:breakdowns.exhaustive===true},
  analytics:{generatedAt:timestamp(analytics.generatedAt),period:{from:day(playingPeriod.from),to:day(playingPeriod.to),currentDayIsPartial:playingPeriod.currentDayIsPartial===true},timezone:analytics.timezone==="UTC"?"UTC":null},
  definitions:{missingGoogleRow:"null means absent from the returned page breakdown, not zero impressions, not proof of non-indexation. The trusted collector currently returns the top 100 pages.",identity:"Accounts/devices, not unique humans. New players are first observed site starts; Google attribution requires a consented session and authoritative run-start event on the same entry quiz.",comparison:"Search Console uses Pacific reporting dates; Puzzoria uses UTC. Do not divide all-source starts by Google clicks or claim user-level attribution across these exports.",privacy:"Aggregates only. Optional collection and existing admin/bot exclusions remain in force."},rows};
}
