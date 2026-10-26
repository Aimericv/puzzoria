import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyRelease,safeCopyEdit,assertValidation,deploymentAllowed,E2E_PROJECTS} from '../../scripts/autonomy-agent/release-policy.mjs';
import {mergeSafeCandidate} from '../../scripts/autonomy-agent/release-controller.mjs';
import {pendingDeploymentAllowed} from '../../scripts/autonomy-agent/release-client.mjs';
const before='const content = {fr: {title: "Old", text: "Original"}}; export function get(){return content;}';
const after=before.replace('Old','Better Wordle title');
test('only bounded editorial literals with identical executable syntax are automatic',()=>{
 assert.equal(safeCopyEdit(before,after),true);
 for(const value of [after.replace('return content','return\n content'),after+'\nprocess.exit(0)',after.replace('"Original"','fetch("https://evil.example")'),after.replace('title:','other:'),after+'\n// @ts-ignore',after.replace('Better Wordle title','<script>bad</script>'),after.replace('Better Wordle title','Buy $500')])assert.equal(safeCopyEdit(before,value),false,value);
 assert.equal(classifyRelease([{path:'src/lib/seo-content.ts',before,after,mode:'100644'}]).risk,'low');
 for(const path of ['src/lib/server/auth.ts','src/app/api/play/route.ts','.github/workflows/ci.yml','src/app/globals.css','docs/SECURITY.fr.md','tests/old.test.ts'])assert.equal(classifyRelease([{path,before,after,mode:'100644'}]).risk,'manual');
 assert.equal(classifyRelease([{path:'src/lib/seo-content.ts',before,after,mode:'120000'}]).risk,'manual');
});
const head='a'.repeat(40),base='b'.repeat(40);
const validation=()=>({head,base,tree:'tree',status:'passed',network:'none',credentials:false,checks:Object.fromEntries(['isolation','lint','typecheck','content','social','seo','build'].map(k=>[k,true])),unit:{passed:350,failed:0,skipped:0},e2e:Object.fromEntries(E2E_PROJECTS.map(p=>[p,{passed:84,failed:0,skipped:0,flaky:0}]))});
test('exact source, all browsers, no skipped tests or failures are required',()=>{
 assert.doesNotThrow(()=>assertValidation(validation(),{head,base}));
 for(const mutate of [v=>v.head='other',v=>v.checks.build=false,v=>v.unit.skipped=1,v=>v.e2e.mobile.failed=1,v=>delete v.e2e['iphone-webkit'],v=>v.credentials=true]){const v=validation();mutate(v);assert.throws(()=>assertValidation(v,{head,base}));}
 assert.equal(deploymentAllowed({release:{productionEnabled:false}},'true','policy'),false);
});
test('safe merge rejects changed PRs and main races without forced ref updates',async()=>{
 const calls=[],api=async(path,method='GET',body)=>{calls.push({path,method,body});if(path==='/pulls/7')return {head:{sha:head,ref:'codex/experiments/test',repo:{full_name:'Aimericv/puzzoria'}},base:{sha:base,ref:'main'},merged:false};if(path==='/git/ref/heads/main')return {object:{sha:base}};if(path.startsWith('/git/commits/'))return {tree:{sha:'tree'}};if(path==='/git/commits')return {sha:'merge'};if(path==='/git/refs/heads/main'){const e=Error('race');e.status=422;throw e;}throw Error(path);};
 const result=await mergeSafeCandidate({api,receipt:{sha:head,base,prNumber:7,verified:true,experimentId:'test'},validation:validation(),files:[{path:'src/lib/seo-content.ts',before,after}],policy:{safeMergeEnabled:true},agentEnabled:'true'});
 assert.equal(result.status,'stale_main');assert.equal(calls.find(c=>c.path==='/git/refs/heads/main').body.force,false);
});
test('the exact initial approval gates bootstrap, then verified receipts permit later releases',()=>{
 const initial='a'.repeat(40),later='b'.repeat(40);
 const control={release:{target:{initialCommit:'0'.repeat(40)},productionAuthorization:{policyHash:'policy'}}};
 const state={growth:{productionBootstrapApproval:{sha:initial,policyHash:'policy',approvedAt:'2026-10-26T00:00:00Z'},releaseCandidate:{mergeSha:later,status:'awaiting_activation',ownerApprovedBootstrap:true}}};
 assert.equal(pendingDeploymentAllowed(control,state),false);
 state.growth.releaseCandidate.mergeSha=initial;assert.equal(pendingDeploymentAllowed(control,state),true);
 state.growth.productionBootstrapApproval.policyHash='changed';assert.equal(pendingDeploymentAllowed(control,state),false);
 state.growth.productionBootstrapApproval.policyHash='policy';delete state.growth.releaseCandidate.ownerApprovedBootstrap;assert.equal(pendingDeploymentAllowed(control,state),false);
 state.growth.releaseCandidate.ownerApprovedBootstrap=true;
 state.growth.lastDeployedCommit=initial;state.growth.releaseCandidate.mergeSha=later;assert.equal(pendingDeploymentAllowed(control,state),true);
 state.growth.releaseCandidate.status='validation_failed';assert.equal(pendingDeploymentAllowed(control,state),false);
 delete state.growth.lastDeployedCommit;delete control.release.productionAuthorization;
 assert.equal(pendingDeploymentAllowed(control,state),false);
});
