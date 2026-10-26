import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),runId='40418453890';
const run=await api(`/actions/runs/${runId}`);
if(run.status!=='completed')throw Error('Completed validation only; never read live job logs');
const{jobs}=await api(`/actions/runs/${runId}/jobs?per_page=100`);
const failed=jobs.find(j=>j.name==='release-validation'&&j.status==='completed'&&j.conclusion==='failure');
const result={runId,runStatus:run.status,conclusion:run.conclusion,cases:[],errorCategories:[]};
if(failed){
 const response=await fetch(`https://api.github.com/repos/Aimericv/puzzoria/actions/jobs/${failed.id}/logs`,{headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Completed validation diagnostic unavailable');
 const log=await response.text();if(log.length>8388608)throw Error('Unexpected diagnostic size');
 for(const match of log.matchAll(/\s\d+\) \[(desktop|mobile|android|iphone-webkit)\] › (e2e\/[a-z0-9-]+\.spec\.ts):(\d+):/g))result.cases.push({project:match[1],file:match[2],line:Number(match[3])});
 const categories={count_assertion:/Error: expect\(locator\)\.toHaveCount/,text_assertion:/Error: expect\(locator\)\.toHaveText/,visible_assertion:/Error: expect\(locator\)\.toBeVisible/,page_closed:/Target page, context or browser has been closed/,browser_crash:/Page crashed|browser.*crashed/i,server_timeout:/Timed out waiting.*webServer/i,test_timeout:/Test timeout of|Test ended while|TimeoutError/,missing_runtime:/Cannot find module|executable doesn't exist/i,disk_full:/ENOSPC/};
 result.errorCategories=Object.entries(categories).filter(([,re])=>re.test(log)).map(([name])=>name);
 const expected=log.match(/Expected:\s+(\d+)/),received=log.match(/Received:\s+(\d+|undefined)/);
 if(expected)result.expectedCount=Number(expected[1]);if(received)result.receivedCount=received[1]==='undefined'?'undefined':Number(received[1]);
}
// Export only enumerated categories and static test locations, never log text,
// messages, stack traces, URLs, fixture values, credentials or database data.
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'validation-failure-summary.json',mode:'100644',type:'blob',content:JSON.stringify(result,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record only filtered completed test locations and error categories, no logs',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/validation-failure-summary/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(result));
