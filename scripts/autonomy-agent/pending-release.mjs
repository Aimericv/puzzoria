import {readFileSync,writeFileSync} from 'node:fs';
import {github} from '../autonomy-pilot/github.mjs';
import {StateStore} from './store.mjs';
import {assertFunding,pendingReleaseReady,REPOSITORY} from './policy.mjs';

const output=value=>{if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,`eligible=${value}\n`,{flag:'a'});};
output(false);
if(process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,'deploy=false\n',{flag:'a'});
if(process.env.GITHUB_REPOSITORY!==REPOSITORY||process.env.GITHUB_REF!=='refs/heads/main'||process.env.PUZZORIA_AGENT_ENABLED!=='true')process.exit(0);
const control=JSON.parse(readFileSync('agent/autonomy/control.json','utf8'));assertFunding(control);
if(control.permanentActivationApproved!==true||control.release?.safeMergeEnabled!==true)process.exit(0);
const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
if(process.env.GITHUB_EVENT_NAME==='issue_comment'&&event.comment?.body?.trim().toLowerCase()==='/status')process.exit(0);
const api=github(process.env.GITHUB_TOKEN,REPOSITORY),store=new StateStore(api,control,process.env.GITHUB_SHA),state=await store.load();
const main=(await api('/git/ref/heads/main')).object.sha;
if(!state.paused&&state.growth?.pendingDeployment?.status==='awaiting_activation'&&process.env.GITHUB_OUTPUT)writeFileSync(process.env.GITHUB_OUTPUT,'deploy=true\n',{flag:'a'});
const eligible=pendingReleaseReady(state,main);
output(eligible);
console.log(JSON.stringify({pendingValidationEligible:eligible,state:state.status,modelInferenceRequested:false}));
