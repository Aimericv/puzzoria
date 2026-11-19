import {relative} from 'node:path';
import {stripVTControlCharacters} from 'node:util';
import {redact} from './policy.mjs';

export function resultLayoutSummary(attachments) {
  const body=Array.isArray(attachments)&&attachments.find(item=>item?.name==='result-layout'&&item.contentType==='application/json')?.body;
  if(typeof body!=='string'||body.length>3000)return undefined;
  const numericRow=(values,length)=>Array.isArray(values)&&values.length===length&&
    values.every(value=>Number.isFinite(value)&&Math.abs(value)<=100000);
  try {
    const value=JSON.parse(Buffer.from(body,'base64').toString('utf8'));
    if(!numericRow(value?.viewport,7)||!Array.isArray(value.samples)||value.samples.length<1||value.samples.length>3)return undefined;
    const [width,height,visualWidth,visualHeight,viewportTop,reducedMotion,documentVisible]=value.viewport;
    const control=row=>{
      if(row===null)return null;
      if(!numericRow(row,9))throw Error('Invalid result control sample');
      const [x,y,w,h,enabled,visible,centerHit,runningAnimations,sameNode]=row;
      return {x,y,width:w,height:h,enabled,visible,centerHit,runningAnimations,sameNode};
    };
    const samples=value.samples.map(row=>{
      if(!Array.isArray(row)||row.length!==3||!numericRow([row[0]],1))throw Error('Invalid result layout sample');
      return {scrollY:row[0],close:control(row[1]),share:control(row[2])};
    });
    return {viewport:{width,height,visualWidth,visualHeight,viewportTop,reducedMotion,documentVisible},samples};
  } catch {
    return undefined;
  }
}

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
