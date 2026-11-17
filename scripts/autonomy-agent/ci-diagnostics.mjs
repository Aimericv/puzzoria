import {relative} from 'node:path';
import {stripVTControlCharacters} from 'node:util';
import {redact} from './policy.mjs';

export function unitSummary(report,{env=process.env,root=process.cwd()}={}) {
  const secrets=Object.entries(env).filter(([key])=>/(?:TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIAL|(?:^|_)KEY$)/i.test(key)).map(([,value])=>value);
  const clean=value=>stripVTControlCharacters(redact(value,secrets)).replace(/(?:password|token|secret|session|cookie|authorization)\s*[:=]\s*[^\s,;]+/gi,'[redacted-assignment]').slice(0,2000);
  const failures=[];
  for(const file of report.testResults??[]){
    const path=relative(root,file.name??'');
    const safePath=path&&!path.startsWith('..')&&!/^[A-Za-z]:|^[/\\]/.test(path)?path.replaceAll('\\','/'):'[outside-workspace]';
    for(const assertion of file.assertionResults??[])if(assertion.status==='failed'&&failures.length<20)failures.push({file:safePath,title:clean(assertion.fullName??assertion.title??''),errors:(assertion.failureMessages??[]).slice(0,3).map(clean)});
    if(file.message&&file.status==='failed'&&!(file.assertionResults??[]).some(a=>a.status==='failed')&&failures.length<20)failures.push({file:safePath,title:'Test suite failed',errors:[clean(file.message)]});
  }
  return {name:'unit',success:report.success,passed:report.numPassedTests,failed:report.numFailedTests,skipped:report.numPendingTests,failures};
}
