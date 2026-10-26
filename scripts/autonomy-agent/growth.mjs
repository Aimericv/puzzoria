import {createHash} from 'node:crypto';

export const GROWTH_FILE='/opt/puzzoria-pilot/readonly/growth-context.json';
export const METRICS={
  'retention.d1':{source:'puzzoria',timezone:'UTC',unit:'mature-cohort-percent',lag:1},
  'retention.d7':{source:'puzzoria',timezone:'UTC',unit:'mature-cohort-percent',lag:7},
  'retention.d30':{source:'puzzoria',timezone:'UTC',unit:'mature-cohort-percent',lag:30},
  'playing.owners':{source:'puzzoria',timezone:'UTC',unit:'accounts-or-devices'},
  'playing.starts':{source:'puzzoria',timezone:'UTC',unit:'starts'},
  'visits.sessions':{source:'puzzoria',timezone:'UTC',unit:'consented-sessions'},
  'visits.visitors':{source:'puzzoria',timezone:'UTC',unit:'consented-accounts-or-devices'},
  'google.clicks':{source:'google',timezone:'America/Los_Angeles',unit:'clicks'},
  'google.impressions':{source:'google',timezone:'America/Los_Angeles',unit:'impressions'},
};
const number=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
const day=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const text=(value,max=2000)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
export function validateExperiment(plan,{observationId}={}) {
  const e=plan?.experiment;
  if(!e||!/^([a-z0-9][a-z0-9-]{2,63})$/.test(e.id??'')||!['acquisition','seo','retention'].includes(e.objective)||
    !['product','research','measurement','reliability'].includes(e.kind)||!text(e.hypothesis)||!text(e.expectedImpact)||!text(e.evidence)||
    !METRICS[e.metric]||!Number.isInteger(e.observationDays)||e.observationDays<1||e.observationDays>90||
    !Number.isInteger(e.minimumSamples)||e.minimumSamples<1||e.minimumSamples>10000000||
    typeof e.minimumRelativeImprovement!=='number'||!Number.isFinite(e.minimumRelativeImprovement)||e.minimumRelativeImprovement<=0||e.minimumRelativeImprovement>100||
    !['propose','observe','continue','stop','pivot'].includes(e.decision))throw Error('A bounded, measurable growth experiment is required in PLAN.json');
  // Model descriptions are proposals; baselines, releases and results below are
  // computed by the trusted supervisor, never copied from a model claim.
  if(observationId&&!e.evidence.includes(observationId))throw Error('Cite the actual current observation ID from the read-only growth context');
  return Object.fromEntries(['id','objective','kind','hypothesis','expectedImpact','evidence','metric','observationDays','minimumSamples','minimumRelativeImprovement','decision'].map(k=>[k,e[k]]));
}
export function observation(analytics,google,now=Date.now()) {
  const today=new Date(now).toISOString().slice(0,10),series={};
  const add=(metric,rows,key)=>{
    const seen=new Set();series[metric]=[];
    for(const row of rows??[]) {
      const date=row.day??row.key,value=number(row[key]);
      if(!day(date)||seen.has(date)||value===null)continue;
      seen.add(date);series[metric].push({date,value});
    }
    series[metric].sort((a,b)=>a.date.localeCompare(b.date));
  };
  if(analytics?.status==='available'&&now-Date.parse(analytics.fetchedAt)>=0&&now-Date.parse(analytics.fetchedAt)<86400000) {
    const report=analytics.reports?.[90]?.report;
    const complete=rows=>(rows??[]).filter(row=>row.day<today);
    add('playing.owners',complete(report?.official?.daily),'players');
    add('playing.starts',complete(report?.official?.daily),'starts');
    add('visits.sessions',complete(report?.product?.daily),'sessions');
    add('visits.visitors',complete(report?.product?.daily),'visitors');
  }
  if(google?.status==='available'&&now-Date.parse(google.fetchedAt)>=0&&now-Date.parse(google.fetchedAt)<86400000) {
    add('google.clicks',google.reports?.[90]?.daily?.rows,'clicks');
    add('google.impressions',google.reports?.[90]?.daily?.rows,'impressions');
  }
  const retention={};
  if(analytics?.status==='available'&&now-Date.parse(analytics.fetchedAt)>=0&&now-Date.parse(analytics.fetchedAt)<86400000)for(const [lag,days] of [[1,7],[7,30],[30,90]]) {
    const report=analytics.reports?.[days],value=report?.report?.official?.retention?.[`d${lag}`];
    if(value&&number(value.mature)!==null&&number(value.returned)!==null&&value.returned<=value.mature)retention[`retention.d${lag}`]={...value,period:report.period};
  }
  const data={collectedAt:new Date(now).toISOString(),sources:{puzzoria:{status:analytics?.status??'unavailable',fetchedAt:analytics?.fetchedAt??null,sha256:analytics?.sha256??null},google:{status:google?.status??'unavailable',fetchedAt:google?.fetchedAt??null,sha256:google?.sha256??null}},series,retention};
  return {...data,id:createHash('sha256').update(JSON.stringify(data)).digest('hex')};
}
function window(rows,from,count) {
  const selected=[];
  for(let i=0;i<count;i++) {
    const date=new Date(Date.parse(from+'T00:00:00Z')+i*86400000).toISOString().slice(0,10);
    const row=rows.find(row=>row.date===date);if(!row)return null;selected.push(row.value);
  }
  return {sum:selected.reduce((a,b)=>a+b,0),days:count};
}
export function assessExperiment(experiment,snapshot) {
  if(!experiment.deployment?.releasedAt||experiment.deployment.status!=='deployed')return {status:'awaiting_verified_deployment',causalClaim:false};
  if(!Number.isFinite(Date.parse(experiment.deployment.releasedAt)))return {status:'invalid_rollout_receipt',causalClaim:false};
  const definition=METRICS[experiment.metric];
  const releaseDate=new Intl.DateTimeFormat('en-CA',{timeZone:definition.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(experiment.deployment.releasedAt));
  const shift=n=>new Date(Date.parse(releaseDate+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
  if(definition.lag) {
    const before=experiment.baseline?.retention?.[experiment.metric],after=snapshot.retention?.[experiment.metric];
    if(!before||!after||!day(before.period?.to)||!day(after.period?.from)||before.period.to>releaseDate||after.period.from<=releaseDate||Date.parse(snapshot.collectedAt)<Date.parse(experiment.deployment.releasedAt)+(experiment.observationDays+definition.lag)*86400000)return {status:'waiting_disjoint_mature_cohorts',causalClaim:false};
    if(before.mature<experiment.minimumSamples||after.mature<experiment.minimumSamples)return {status:'insufficient_samples',causalClaim:false};
    const a=before.returned/before.mature,b=after.returned/after.mature,relativeChange=a===0?null:(b-a)/a;
    return {status:relativeChange===null?'inconclusive':relativeChange>=experiment.minimumRelativeImprovement?'improved':relativeChange<=-experiment.minimumRelativeImprovement?'regressed':'inconclusive',before,after,relativeChange,causalClaim:false};
  }
  // Skip the mixed release day, preserve each source's own timezone, require
  // complete equal windows. Missing Google dates are never synthesized as zero.
  const baselineRows=[...(experiment.baseline?.series?.[experiment.metric]??[])];
  for(const row of snapshot.series[experiment.metric]??[])if(row.date<releaseDate&&!baselineRows.some(old=>old.date===row.date))baselineRows.push(row);
  const before=window(baselineRows,shift(-experiment.observationDays),experiment.observationDays);
  if(before&&!experiment.baseline.frozen){experiment.baseline.series[experiment.metric]=baselineRows.filter(row=>row.date>=shift(-experiment.observationDays)&&row.date<releaseDate);experiment.baseline.frozen=true;experiment.baseline.completedFromObservation=snapshot.id;}
  const after=window(snapshot.series[experiment.metric]??[],shift(1),experiment.observationDays);
  if(!before||!after)return {status:'waiting_complete_windows',causalClaim:false};
  if(before.sum<experiment.minimumSamples||after.sum<experiment.minimumSamples)return {status:'insufficient_samples',before,after,causalClaim:false};
  const relativeChange=before.sum===0?null:(after.sum-before.sum)/before.sum;
  return {status:relativeChange===null?'inconclusive':relativeChange>=experiment.minimumRelativeImprovement?'improved':relativeChange<=-experiment.minimumRelativeImprovement?'regressed':'inconclusive',before,after,relativeChange,timezone:definition.timezone,causalClaim:false,limitation:'Before/after observation, not randomized causal evidence; compare seasonality and other releases.'};
}
export function growthContext(state,snapshot,trends,control) {
  state.growth??={schemaVersion:1,experiments:[],legacyWork:{sha:state.codeSha??null,wipSha:state.wipSha??null,branch:'codex/agent-work'}};
  const ledger=state.growth;
  for(const e of ledger.experiments)e.assessment=assessExperiment(e,snapshot);
  ledger.lastObservation={id:snapshot.id,collectedAt:snapshot.collectedAt,sources:snapshot.sources};
  return {schemaVersion:1,goal:control.growth.goal,observation:{...snapshot,series:Object.fromEntries(Object.entries(snapshot.series).map(([key,rows])=>[key,rows.slice(-30)])),coverage:'Context includes the latest 30 observed daily points; the separate source snapshots retain their full 90-day reports.'},trends:{status:trends.status,sha256:trends.sha256},experiments:ledger.experiments.map(({baseline,...rest})=>({...rest,baselineId:baseline?.id})),archives:ledger.archived??[],legacyWork:ledger.legacyWork,
    instructions:'Prioritize evidence-backed acquisition, SEO and retention. You may research, wait for mature data, pivot, or propose new games. Do not manufacture minor fixes or claim an unpublished change affected production. Retention aggregates describe mature cohorts but are not release-specific cohorts.'};
}
export function recordExperiment(state,experiment,snapshot,publication,now=Date.now()) {
  const ledger=state.growth;if(!ledger)throw Error('Growth context was not initialized');
  const existing=ledger.experiments.find(row=>row.id===experiment.id);
  if(existing&&existing.candidateSha&&publication?.sha&&existing.candidateSha!==publication.sha)throw Error('Use a fresh experiment ID for a new isolated proposal');
  const row=existing??{...experiment,createdAt:new Date(now).toISOString(),baseline:{id:snapshot.id,collectedAt:snapshot.collectedAt,sources:snapshot.sources,series:{[experiment.metric]:snapshot.series[experiment.metric]??[]},retention:{[experiment.metric]:snapshot.retention?.[experiment.metric]??null}}};
  if(existing&&['metric','observationDays','minimumSamples','minimumRelativeImprovement','hypothesis'].some(key=>existing[key]!==experiment[key]))throw Error('Use a fresh experiment ID to change recorded success criteria');
  // A model may choose its strategy, but cannot rewrite a recorded baseline,
  // rollout date, machine assessment or success criterion after publication.
  if(existing) {row.decision=experiment.decision;row.latestReason=experiment.expectedImpact;}
  if(publication){row.candidateSha=publication.sha;row.prNumber=publication.number;row.prUrl=publication.url;row.status='proposed';}
  else if(!row.candidateSha)row.status='research';
  if(!existing) {
    if(ledger.archived?.some(row=>row.id===experiment.id))throw Error('An archived experiment ID cannot be reused');
    if(ledger.experiments.length>=12) {
      const index=ledger.experiments.findIndex(row=>['stop','pivot'].includes(row.decision));
      if(index<0)throw Error('Close an existing experiment before opening more than twelve active experiments');
      const archived=ledger.experiments.splice(index,1)[0];
      ledger.archiveQueue??=[];ledger.archiveQueue.push(archived);
      const key=createHash('sha256').update(JSON.stringify(archived)).digest('hex');
      ledger.archived??=[];ledger.archived.push({id:archived.id,path:`agent/autonomy/experiments/${key}.json`,status:archived.assessment?.status??archived.status});
      ledger.totalArchived=(ledger.totalArchived??0)+1;ledger.archived=ledger.archived.slice(-64);
    }
    ledger.experiments.push(row);
  }
  return row;
}
