import {github} from './autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const data=await api('/contents/agent/autonomy/state.json?ref=codex%2Fagent-state'),state=JSON.parse(Buffer.from(data.content,'base64'));
const main=(await api('/git/ref/heads/main')).object.sha;
const f=await api(`/contents/agent/autonomy/control.json?ref=${main}`),control=JSON.parse(Buffer.from(f.content,'base64'));
const reserved=state.releaseValidationHistory.filter(r=>Date.now()-Date.parse(r.at)<7*86400000).reduce((n,r)=>n+r.minutes,0);
if(main!=='d5dc9dab3b541d1b8dabf9d71327e7282727c89b'||state.status!=='ready'||state.paused||state.pendingMessages?.length||state.completedSessions!==21||state.growth.releaseCandidate.prNumber!==11||state.growth.releaseCandidate.status!=='validation_failed'||reserved<control.release.validationBudgetMinutes7d||control.release.productionEnabled!==false||control.release.productionAuthorization!==null)throw Error('Budget stop test assumptions changed');
await api('/actions/workflows/autonomy-agent.yml/dispatches','POST',{ref:'main',inputs:{'validate-pending':true,'deploy-pending':false,'check-search-console':false}});
console.log(JSON.stringify({metadataOnly:true,modelRequested:false,expected:'waiting_validation_budget',reserved,limit:control.release.validationBudgetMinutes7d,productionEnabled:false}));
