import test from "node:test";
import assert from "node:assert/strict";
import {collectAnalytics,ANALYTICS_URL} from "./analytics.mjs";

const token="a".repeat(43), now=Date.parse("2026-10-26T12:00:00Z");
const report=days=>({schema:"puzzoria.analytics",schemaVersion:1,timezone:"UTC",generatedAt:new Date(now).toISOString(),filters:{days},
  period:{from:"2026-10-01",to:"2026-10-26",currentDayIsPartial:true},definitions:{identity:"accounts/devices"},report:{official:{retention:{d30:{percent:null}}},product:{}}});
test("unconfigured/invalid collection never calls the network or fabricates zero metrics",async()=>{
  const fetchImpl=()=>{throw new Error("must not fetch");};
  assert.equal((await collectAnalytics({fetchImpl,now})).status,"not_configured");
  const invalid=await collectAnalytics({token:"bad",fetchImpl,now});assert.equal(invalid.status,"unavailable");assert.equal(invalid.reports,null);
});
test("collects three fresh reports only from the fixed HTTPS endpoint without forwarding redirects",async()=>{
  const calls=[];
  const result=await collectAnalytics({token,now,fetchImpl:async(url,options)=>{
    calls.push({url,options});return Response.json(report(Number(new URL(url).searchParams.get("days"))));
  }});
  assert.equal(result.status,"available");assert.equal(result.sha256.length,64);
  assert.deepEqual(calls.map(call=>call.url),[7,30,90].map(days=>`${ANALYTICS_URL}?days=${days}`));
  for(const {options} of calls){assert.equal(options.redirect,"error");assert.equal(options.headers.Authorization,`Bearer ${token}`);assert.ok(options.signal);}
  assert.equal(result.reports[90].report.official.retention.d30.percent,null);
  assert.ok(!JSON.stringify(result).includes(token));
});
test("does not publish error bodies or credentials, and reports failure without a partial success",async()=>{
  for(const response of [new Response(token,{status:401}),new Response("html",{headers:{"content-type":"text/html"}}),Response.json({unexpected:true}),Response.json(report(30)),Response.json({...report(7),generatedAt:"2020-01-01T00:00:00Z"}),Response.json({...report(7),leaked:token})]) {
    const result=await collectAnalytics({token,now,fetchImpl:async()=>response});
    assert.equal(result.status,"unavailable");assert.equal(result.reports,null);assert.ok(!JSON.stringify(result).includes(token));
  }
  const result=await collectAnalytics({token,now,fetchImpl:async()=>{throw new Error(token);}});
  assert.equal(result.reason,"request_failed");assert.ok(!JSON.stringify(result).includes(token));
});
test("limits response bodies even when Content-Length is absent",async()=>{
  const result=await collectAnalytics({token,now,fetchImpl:async()=>new Response("x".repeat(2*1024*1024+1),{headers:{"content-type":"application/json"}})});
  assert.equal(result.reason,"report_too_large");
});
