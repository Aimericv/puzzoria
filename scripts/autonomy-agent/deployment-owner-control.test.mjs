import test from 'node:test';
import assert from 'node:assert/strict';
import {deploymentStateAdmissible,deploymentOwnerControl} from './deployment-owner-control.mjs';
import {pendingDeploymentAllowed} from './release-client.mjs';
const state=()=>({status:'ready',paused:false,ownerId:42,issueNumber:3,lastMessageId:5,pendingMessages:[]});
const comment=(id,text,user={id:42,type:'User'})=>({id,body:text,user,issue_url:'https://api.github.com/repos/Aimericv/puzzoria/issues/3'});
const api=(messages=[],ownerId=42)=>async path=>path===''?{full_name:'Aimericv/puzzoria',owner:{id:ownerId}}:messages;
test('pause and pending directives block deployment without consulting credentials or the network',async()=>{
 for(const patch of [{paused:true},{status:'paused'},{pendingMessages:[{id:6,text:'hold release'}]}]){
  const s={...state(),...patch};assert.equal(deploymentStateAdmissible(s),false);
  assert.equal(await deploymentOwnerControl(async()=>{throw Error('Must not request');},s),false);
  const control={release:{target:{initialCommit:'a'.repeat(40)}}};s.growth={pendingDeployment:{status:'awaiting_activation',mergeSha:'b'.repeat(40)}};
  assert.equal(pendingDeploymentAllowed(control,s),false);
 }
});
test('an unread owner pause or directive blocks even before its queued workflow preflight runs',async()=>{
 assert.equal(await deploymentOwnerControl(api([comment(6,'/pause')]),state()),false);
 assert.equal(await deploymentOwnerControl(api([comment(6,'Do not publish the current proposal')]),state()),false);
 assert.equal(await deploymentOwnerControl(api([comment(4,'old directive'),comment(6,'/status')]),state()),true);
 assert.equal(await deploymentOwnerControl(api([comment(7,'/resume',{id:9,type:'User'}),comment(8,'/pause',{id:42,type:'Bot'})]),state()),true);
});
test('unknown owner, repository ownership changes or unreadable inbox never admit production',async()=>{
 assert.equal(await deploymentOwnerControl(api([],99),state()),false);
 assert.equal(await deploymentOwnerControl(api(),{...state(),ownerId:null}),false);
 assert.equal(await deploymentOwnerControl(api(),{...state(),issueNumber:null}),false);
 assert.equal(await deploymentOwnerControl(api([{id:6,body:'/pause'}]),state()),false);
 assert.equal(await deploymentOwnerControl(async()=>{throw Error('Unavailable');},state()),false);
});
