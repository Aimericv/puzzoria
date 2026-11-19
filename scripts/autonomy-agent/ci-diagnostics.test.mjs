import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {resultLayoutSummary,unitSummary} from './ci-diagnostics.mjs';

test('unit diagnostics identify assertions and suites while bounding and redacting content',()=>{
  const report={success:false,numPassedTests:409,numFailedTests:1,numPendingTests:0,testResults:[
    {name:resolve('tests/seo.test.ts'),assertionResults:[{status:'failed',fullName:'sitemap has 692 URLs',failureMessages:['expected 684; actual 692; Bearer abcdef; token=abcdef; https://host/path?token=abcdef; hidden-value '+ 'x'.repeat(5000)]}]},
    {name:resolve('..','outside.test.ts'),status:'failed',message:'A suite failed',assertionResults:[]},
  ]};
  const result=unitSummary(report,{env:{GITHUB_TOKEN:'hidden-value'}}),json=JSON.stringify(result);
  assert.equal(result.failed,1);assert.equal(result.failures[0].file,'tests/seo.test.ts');assert.match(result.failures[0].title,/sitemap/);
  assert.match(result.failures[0].errors[0],/expected 684/);assert.doesNotMatch(json,/abcdef|hidden-value|outside.test.ts/);
  assert.ok(result.failures[0].errors[0].length<=2000);assert.equal(result.failures[1].file,'[outside-workspace]');
  const many=structuredClone(report);many.testResults[0].assertionResults=Array(1000).fill(report.testResults[0].assertionResults[0]);
  assert.equal(unitSummary(many).failures.length,20);
  assert.deepEqual(unitSummary({success:true,numPassedTests:1,numFailedTests:0,numPendingTests:0}).failures,[]);
});

test('result diagnostics publish bounded numeric measurements and exclude raw trace data',()=>{
  const encode=value=>[{name:'trace',path:'/private/trace.zip'},{name:'result-layout',contentType:'application/json',
    body:Buffer.from(JSON.stringify(value)).toString('base64')}];
  const layout={viewport:[393,727,393,727,0,1,1],samples:[[100,[16,20,120,44,1,1,1,0,1],null]],
    html:'private browser data'};
  const result=resultLayoutSummary(encode(layout));
  assert.equal(result.viewport.width,393);
  assert.deepEqual(result.samples,[{scrollY:100,close:{x:16,y:20,width:120,height:44,enabled:1,visible:1,centerHit:1,runningAnimations:0,sameNode:1},share:null}]);
  assert.doesNotMatch(JSON.stringify(result),/private|trace/);
  for(const damaged of [{...layout,viewport:['token',...layout.viewport.slice(1)]},{...layout,samples:[...Array(4).fill(layout.samples[0])]},
    {...layout,samples:[[0,null,[0,0,101000,44,1,1,0,0,1]]]},{...layout,html:'x'.repeat(4000)}]){
    assert.equal(resultLayoutSummary(encode(damaged)),undefined);
  }
});
