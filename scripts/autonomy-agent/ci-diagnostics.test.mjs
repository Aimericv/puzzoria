import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {unitSummary} from './ci-diagnostics.mjs';

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
