import test from 'node:test';
import assert from 'node:assert/strict';
import {observation,assessExperiment,validateExperiment,growthContext,recordExperiment} from './growth.mjs';
const now=Date.parse('2026-10-26T12:00:00Z');
const experiment=()=>({id:'seo-word-fr',kind:'product',objective:'seo',hypothesis:'A clearer title will acquire relevant visitors',expectedImpact:'More qualified organic clicks',evidence:'Search Console snapshot, not invented traffic',metric:'google.clicks',observationDays:2,minimumSamples:2,minimumRelativeImprovement:0.1,decision:'propose'});
test('growth requires an objective, hypothesis and predeclared measurable criterion',()=>{
 assert.equal(validateExperiment({experiment:experiment()}).metric,'google.clicks');
 for(const patch of [{id:'../escape'},{objective:'random-fixes'},{minimumSamples:0},{observationDays:NaN},{metric:'invented.dau'},{hypothesis:''}])assert.throws(()=>validateExperiment({experiment:{...experiment(),...patch}}));
});
test('snapshots retain unknown data, exclude partial UTC day and do not fill Google gaps',()=>{
 const a={status:'available',fetchedAt:new Date(now).toISOString(),reports:{90:{report:{official:{daily:[{day:'2026-10-25',players:4,starts:6},{day:'2026-10-26',players:999,starts:999},{day:'2026-99-01',players:3}]},product:{daily:[]}}}}};
 const s=observation(a,{status:'unavailable'},now);
 assert.deepEqual(s.series['playing.owners'],[{date:'2026-10-25',value:4}]);assert.equal(s.series['google.clicks'],undefined);
 assert.deepEqual(observation({...a,fetchedAt:'2020-01-01'},null,now).series,{});
});
test('unpublished and merely merged proposals never get production results',()=>{
 for(const deployment of [null,{status:'merged',releasedAt:'2026-10-22T12:00:00Z'}])assert.equal(assessExperiment({...experiment(),deployment},{series:{}}).status,'awaiting_verified_deployment');
});
test('evaluation skips the release day, needs complete independent windows and adequate samples',()=>{
 const e={...experiment(),deployment:{status:'deployed',releasedAt:'2026-10-22T12:00:00Z'},baseline:{series:{'google.clicks':[{date:'2026-10-20',value:10},{date:'2026-10-21',value:10}]}}};
 const s={series:{'google.clicks':[{date:'2026-10-22',value:999},{date:'2026-10-23',value:15},{date:'2026-10-24',value:15}]}};
 const result=assessExperiment(e,s);assert.equal(result.status,'improved');assert.equal(result.after.sum,30);assert.equal(result.causalClaim,false);
 assert.equal(assessExperiment(e,{series:{'google.clicks':s.series['google.clicks'].slice(0,2)}}).status,'waiting_complete_windows');
 assert.equal(assessExperiment({...e,minimumSamples:100},s).status,'insufficient_samples');
});
test('retention does not compare overlapping or immature cohorts',()=>{
 const e={...experiment(),metric:'retention.d7',deployment:{status:'deployed',releasedAt:'2026-10-22T12:00:00Z'},baseline:{retention:{'retention.d7':{mature:20,returned:5,period:{from:'2026-09-22',to:'2026-10-21'}}}}};
 assert.equal(assessExperiment(e,{retention:{'retention.d7':{mature:30,returned:20,period:{from:'2026-10-01',to:'2026-10-30'}}}}).status,'waiting_disjoint_mature_cohorts');
});
test('ledger preserves old work, immutable baselines and success criteria',()=>{
 const state={codeSha:'old-work'},snapshot={id:'real',collectedAt:new Date(now).toISOString(),sources:{},series:{'google.clicks':[{date:'2026-10-20',value:10}]},retention:{}};
 growthContext(state,snapshot,{status:'unavailable'}, {growth:{goal:'growth'}});
 assert.equal(state.growth.legacyWork.sha,'old-work');recordExperiment(state,experiment(),snapshot,{sha:'candidate',number:7,url:'pr'},now);
 assert.throws(()=>recordExperiment(state,{...experiment(),minimumSamples:1},snapshot,null,now));
 assert.equal(state.growth.experiments[0].baseline.id,'real');
});
