import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,appendFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {github} from "../autonomy-pilot/github.mjs";
import {REPOSITORY,redact} from "./policy.mjs";
import {unitSummary} from './ci-diagnostics.mjs';

const mode=process.argv[2];
if(mode==="summarize") {
  mkdirSync(".ci-results",{recursive:true});
  const result={project:process.env.CI_PROOF_PROJECT,sha:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),mode:process.env.CI_VALIDATION_MODE??'final',reports:[]};
  if(existsSync('.ci-results/development-selection.json'))result.selection=JSON.parse(readFileSync('.ci-results/development-selection.json','utf8'));
  if(result.mode==='final'&&result.selection)throw Error('A development selection cannot supply final evidence');
  for(const name of ["unit","preflight","full"]) {
    const file=`.ci-results/${name}.json`;if(!existsSync(file))continue;
    const report=JSON.parse(readFileSync(file,"utf8"));
    if(name==="unit") result.reports.push(unitSummary(report));
    else {
      const failures=[];
      function walk(suite) {
        for(const spec of suite.specs ?? []) for(const test of spec.tests ?? []) {
          for(const run of test.results ?? []) if(!["passed","skipped"].includes(run.status)) failures.push({title:spec.title,file:spec.file,line:spec.line,status:run.status,errors:(run.errors ?? []).map(error=>redact(error.message ?? "",[]).slice(0,2000))});
        }
        for(const child of suite.suites ?? [])walk(child);
      }
      for(const suite of report.suites ?? [])walk(suite);
      result.reports.push({name,stats:report.stats,failures,errors:(report.errors ?? []).map(error=>redact(error.message ?? "",[]).slice(0,2000))});
    }
  }
  writeFileSync(".ci-results/summary.json",JSON.stringify(result,null,2)+"\n");
  const failures=result.reports.flatMap(report=>report.failures??[]);
  if(failures.length&&process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'\nTest failures (bounded and redacted):\n```json\n'+JSON.stringify(failures,null,2).replaceAll('`','\\u0060').slice(0,12000)+'\n```\n');
  console.log(JSON.stringify(result));
} else if(["publish","inspect"].includes(mode)) {
  if(process.env.GITHUB_REPOSITORY!==REPOSITORY)throw Error("Unexpected repository");
  const api=github(process.env.GITHUB_TOKEN,REPOSITORY),runId=process.env.GITHUB_RUN_ID;
  const {jobs}=await api(`/actions/runs/${runId}/jobs?per_page=100`);
  const repository=await api("");
  const inspections={};
  for(const [name,path,extract] of [
    ["webhooks","/hooks?per_page=100",rows=>rows.map(row=>({id:row.id,active:row.active,events:row.events,destinationHost:row.config?.url?new URL(row.config.url).hostname:null}))],
    ["installations","/installations",rows=>({totalCount:rows.total_count,apps:rows.installations?.map(row=>({id:row.id,appId:row.app_id}))})],
    ["deployments","/deployments?per_page=100",rows=>rows.map(row=>({id:row.id,ref:row.ref,environment:row.environment,createdAt:row.created_at}))],
    ["environments","/environments?per_page=100",rows=>({totalCount:rows.total_count,names:rows.environments?.map(row=>row.name)})],
    ["mainChecks","/commits/main/check-runs?per_page=100",rows=>({totalCount:rows.total_count,checks:rows.check_runs.map(row=>({name:row.name,app:row.app?.slug,status:row.status,conclusion:row.conclusion}))})],
    ["mainStatuses","/commits/main/status",rows=>({state:rows.state,statuses:rows.statuses.map(row=>({context:row.context,state:row.state,targetHost:row.target_url?new URL(row.target_url).hostname:null}))})],
    ["communication","/issues/3/comments?per_page=100",rows=>({comments:rows.length,ownerMessageIds:rows.filter(row=>row.user?.id===repository.owner.id&&row.user?.type==="User").map(row=>row.id)})],
    ["variables","/actions/variables?per_page=100",rows=>rows.variables.filter(row=>["PUZZORIA_AGENT_ENABLED","PUZZORIA_ACTIONS_NO_PAYMENT_METHOD","PUZZORIA_PILOT_ENABLED"].includes(row.name)).map(row=>({name:row.name,value:["true","false"].includes(row.value)?row.value:"unexpected"}))]
  ]) {
    try {inspections[name]={status:"observed",result:extract(await api(path))};}
    catch(error) {inspections[name]={status:"unavailable",httpStatus:error.status ?? null};}
  }
  const reports=[];
  if(existsSync(".ci-evidence"))for(const dir of readdirSync(".ci-evidence")) {
    const file=`.ci-evidence/${dir}/summary.json`;if(existsSync(file))reports.push(JSON.parse(readFileSync(file,"utf8")));
  }
  const pr=await api("/pulls/4");
  const evidence={schemaVersion:1,runId,url:`https://github.com/${REPOSITORY}/actions/runs/${runId}`,sha:process.env.GITHUB_SHA,pr:{number:4,head:pr.head.sha,base:pr.base.sha,mergeable:pr.mergeable,draft:pr.draft},jobs:jobs.map(job=>({name:job.name,status:job.status,conclusion:job.conclusion,steps:job.steps?.map(step=>({name:step.name,conclusion:step.conclusion}))})),inspections,reports,productionAccess:false};
  const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
  const tree=await api("/git/trees","POST",{base_tree:commit.tree.sha,tree:[{path:"agent/autonomy/ci-evidence.json",mode:"100644",type:"blob",content:JSON.stringify(evidence,null,2)+"\n"}]});
  const next=await api("/git/commits","POST",{message:"Record complete CI validation and deployment visibility",tree:tree.sha,parents:[parent]});
  const branch=`codex/${mode==="inspect"?"ci-preflight":"ci-evidence"}/${runId}`;
  await api("/git/refs","POST",{ref:`refs/heads/${branch}`,sha:next.sha});
  console.log(JSON.stringify({branch,runUrl:evidence.url,inspections}));
} else throw Error("Use summarize or publish");
