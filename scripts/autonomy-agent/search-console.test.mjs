import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {collectSearchConsole,GOOGLE_PROVIDER,GOOGLE_READER,searchPeriod} from "./search-console.mjs";

const now=Date.parse("2026-10-26T00:30:00Z"),audience=`https://iam.googleapis.com/${GOOGLE_PROVIDER}`;
const workflow="Aimericv/puzzoria/.github/workflows/autonomy-agent.yml@refs/heads/main";
const env={GITHUB_REPOSITORY:"Aimericv/puzzoria",GITHUB_REF:"refs/heads/main",GITHUB_WORKFLOW_REF:workflow,
  ACTIONS_ID_TOKEN_REQUEST_URL:"https://vstoken.actions.githubusercontent.com/123/idtoken?api-version=2.0",ACTIONS_ID_TOKEN_REQUEST_TOKEN:"github-request-secret-1234567890"};
const claims={iss:"https://token.actions.githubusercontent.com",aud:audience,repository_id:"1426188364",repository_owner_id:"103512403",ref:"refs/heads/main",workflow_ref:workflow,exp:now/1000+300};
const jwt=object=>`eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(object)).toString("base64url")}.fake-signature`;
const federation="federated-secret-1234567890",access="google-readonly-secret-1234567890";
const metric={clicks:2,impressions:10,ctr:0.2,position:4};
function fixture({oidcClaims=claims,sites=[{siteUrl:"sc-domain:puzzoria.com",permissionLevel:"siteRestrictedUser"}],empty=false,intercept}={}) {
  const calls=[],credentials=[env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,jwt(oidcClaims),federation,access];
  const fetchImpl=async(url,options)=>{
    calls.push({url,options});const index=calls.length;
    const override=intercept?.(url,options,index);if(override)return override;
    if(index===1)return Response.json({value:jwt(oidcClaims)});
    if(index===2)return Response.json({access_token:federation});
    if(index===3)return Response.json({accessToken:access,expireTime:new Date(now+600000).toISOString()});
    if(index===4)return Response.json({siteEntry:sites});
    const body=JSON.parse(options.body),dimension=body.dimensions[0];
    if(empty)return Response.json({});
    const key={date:body.startDate,page:"https://puzzoria.com/fr/wordle",query:"puzzoria",country:"fra",device:"MOBILE"}[dimension];
    return Response.json({responseAggregationType:body.aggregationType,rows:[{...metric,...(dimension?{keys:[key]}:{})}]});
  };
  return {calls,credentials,fetchImpl};
}

test("no OIDC configuration or untrusted context never calls an external endpoint",async()=>{
  const fetchImpl=()=>{throw new Error("must not fetch");};
  assert.equal((await collectSearchConsole({env:{},now,fetchImpl})).status,"not_configured");
  for(const change of [{GITHUB_REF:"refs/heads/evil"},{GITHUB_REPOSITORY:"fork/puzzoria"},{GITHUB_WORKFLOW_REF:"other"},
    {ACTIONS_ID_TOKEN_REQUEST_URL:"https://evil.example/idtoken"},{ACTIONS_ID_TOKEN_REQUEST_URL:"https://vstoken.actions.githubusercontent.com.evil.example/idtoken"},
    {ACTIONS_ID_TOKEN_REQUEST_URL:"http://vstoken.actions.githubusercontent.com/idtoken"},{ACTIONS_ID_TOKEN_REQUEST_URL:"https://vstoken.actions.githubusercontent.com/other"}]) {
    const f=fixture();const result=await collectSearchConsole({env:{...env,...change},now,fetchImpl:f.fetchImpl});
    assert.equal(result.status,"unavailable");assert.equal(result.reports,null);assert.equal(f.calls.length,0);
  }
});

test("independent collections mint fresh scoped credentials and expose only observed aggregate reports",async()=>{
  const f=fixture(),seen=[];
  for(let session=0;session<2;session++) {
    const current=session?fixture():f;
    const result=await collectSearchConsole({env,now,fetchImpl:current.fetchImpl,onSecret:value=>seen.push(value)});
    assert.equal(result.status,"available");assert.equal(result.property,"sc-domain:puzzoria.com");assert.equal(result.sha256.length,64);
    assert.equal(result.timezone,"America/Los_Angeles");assert.equal(result.dataState,"final");assert.deepEqual(result.reports[7].totals,metric);
    assert.equal(result.breakdowns.exhaustive,false);assert.equal(current.calls.length,14);
    for(const secret of current.credentials)assert.ok(!JSON.stringify(result).includes(secret));
    assert.equal(new URL(current.calls[0].url).searchParams.get("audience"),audience);
    const exchange=JSON.parse(current.calls[1].options.body);assert.equal(exchange.audience,`//iam.googleapis.com/${GOOGLE_PROVIDER}`);
    assert.equal(current.calls[1].options.headers.Authorization,undefined);
    assert.ok(current.calls[2].url.includes(GOOGLE_READER));
    assert.deepEqual(JSON.parse(current.calls[2].options.body),{scope:["https://www.googleapis.com/auth/webmasters.readonly"],lifetime:"600s"});
    for(const call of current.calls){assert.equal(call.options.redirect,"error");assert.ok(call.options.signal);}
    for(const call of current.calls.slice(4)) {
      const body=JSON.parse(call.options.body);assert.equal(body.dataState,"final");assert.equal(body.type,"web");
      assert.equal(body.startRow,0);assert.ok(body.rowLimit<=100);assert.equal(call.options.headers.Authorization,`Bearer ${access}`);
    }
  }
  assert.equal(seen.length,6);
});

test("rejects wrong immutable claims, workflow, audience or expired identity before STS",async()=>{
  for(const change of [{repository_id:"1"},{repository_owner_id:"1"},{ref:"refs/heads/evil"},{workflow_ref:"other"},{aud:"other"},{iss:"other"},{exp:now/1000-1},{exp:null}]) {
    const f=fixture({oidcClaims:{...claims,...change}}),result=await collectSearchConsole({env,now,fetchImpl:f.fetchImpl});
    assert.equal(result.reason,"invalid_oidc_claims");assert.equal(f.calls.length,1);
  }
});

test("selects only a real authorized Puzzoria property; unknown, foreign or unverified properties fail closed",async()=>{
  const f=fixture({sites:[{siteUrl:"https://puzzoria.com/",permissionLevel:"siteRestrictedUser"}]});
  const result=await collectSearchConsole({env,now,fetchImpl:f.fetchImpl});assert.equal(result.property,"https://puzzoria.com/");
  assert.ok(f.calls[4].url.includes(encodeURIComponent("https://puzzoria.com/")));
  for(const sites of [[],[{siteUrl:"sc-domain:evil.example",permissionLevel:"siteOwner"}],[{siteUrl:"sc-domain:puzzoria.com",permissionLevel:"siteUnverifiedUser"}]]) {
    const current=fixture({sites});const rejected=await collectSearchConsole({env,now,fetchImpl:current.fetchImpl});
    assert.equal(rejected.reason,"property_not_authorized");assert.equal(current.calls.length,4);
  }
});

test("Pacific calendar windows exclude today across UTC midnight and daylight saving changes",()=>{
  assert.deepEqual(searchPeriod(now,7),{startDate:"2026-10-18",endDate:"2026-10-24"});
  assert.deepEqual(searchPeriod(Date.parse("2026-03-09T07:30:00Z"),7),{startDate:"2026-03-02",endDate:"2026-03-08"});
  assert.deepEqual(searchPeriod(Date.parse("2026-11-02T08:30:00Z"),30),{startDate:"2026-10-03",endDate:"2026-11-01"});
});

test("empty reports remain explicit no-data with null totals, not invented zero traffic",async()=>{
  const f=fixture({empty:true}),result=await collectSearchConsole({env,now,fetchImpl:f.fetchImpl});
  assert.equal(result.status,"available");
  for(const days of [7,30,90]){assert.equal(result.reports[days].totals,null);assert.equal(result.reports[days].lastReportedDate,null);assert.deepEqual(result.reports[days].daily.rows,[]);}
});

test("HTTP failures, malformed/oversized bodies and echoed credentials never leak or publish partial success",async()=>{
  for(const [index,response] of [[1,new Response(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,{status:401})],[2,new Response(access,{status:400})],[3,new Response(access,{status:403})],
    [4,new Response(access,{status:403})],[5,new Response(access,{status:429})],[6,Response.json({responseAggregationType:"byProperty",rows:[{...metric,keys:["2020-01-01"]}]})],
    [5,Response.json({responseAggregationType:"byProperty",rows:[{...metric,ctr:NaN}]})],[5,Response.json({echo:access})],
    [5,new Response("x".repeat(2*1024*1024+1),{headers:{"Content-Type":"application/json"}})],[5,new Response("html",{headers:{"Content-Type":"text/html"}})],
    [3,Response.json({accessToken:access,expireTime:new Date(now+3600000).toISOString()})]]) {
    const f=fixture({intercept:(_url,_options,i)=>i===index?response:null}),result=await collectSearchConsole({env,now,fetchImpl:f.fetchImpl});
    assert.equal(result.status,"unavailable");assert.equal(result.reports,null);
    for(const secret of f.credentials)assert.ok(!JSON.stringify(result).includes(secret));
  }
  const result=await collectSearchConsole({env,now,fetchImpl:()=>{throw new Error(access);}});
  assert.equal(result.reason,"request_failed");assert.ok(!JSON.stringify(result).includes(access));
});

test("workflow check uses main-only OIDC without Plus or deployment; model environment is an explicit whitelist",()=>{
  const text=readFileSync(".github/workflows/autonomy-agent.yml","utf8"),check=text.split("  search-console-check:")[1].split("  first:")[0];
  assert.match(check,/github\.ref == 'refs\/heads\/main'/);assert.match(check,/id-token: write/);
  assert.doesNotMatch(check,/CODEX_PILOT|PUZZORIA_ANALYTICS_READ_TOKEN|ssh|scp|docker/);
  const run=readFileSync("scripts/autonomy-agent/run.mjs","utf8"),modelEnv=run.split("const env={")[1].split("};")[0];
  assert.doesNotMatch(modelEnv,/ACTIONS_ID_TOKEN|GOOGLE_|process\.env|\.\.\./);
  assert.match(run,/evidence\.searchConsole\.readOnlySnapshot=true/);
  const isolation=readFileSync("scripts/autonomy-pilot/isolation.mjs","utf8");
  assert.match(isolation,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);assert.match(isolation,/ACTIONS_ID_TOKEN_REQUEST_URL/);
});
