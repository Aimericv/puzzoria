import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {restoreNextEnv} from './outputs.mjs';
import {E2E_PROJECTS,assertValidation} from './release-policy.mjs';

export function browserCoverage(reports) {
  const cases=new Map();
  function walk(suite,parents=[]) {
    for(const spec of suite.specs??[])for(const test of spec.tests??[]) {
      const key=[test.projectName,spec.file??suite.file,...parents,spec.title].join(':');
      const results=test.results??[],statuses=results.map(result=>result.status);
      const value={project:test.projectName,passed:statuses.length>0&&statuses.every(status=>status==='passed'),failed:statuses.some(status=>!['passed','skipped'].includes(status)),flaky:statuses.includes('passed')&&statuses.some(status=>status!=='passed')};
      const prior=cases.get(key);cases.set(key,{...value,passed:value.passed||prior?.passed,failed:value.failed||prior?.failed,flaky:value.flaky||prior?.flaky});
    }
    for(const child of suite.suites??[])walk(child,[...parents,child.title??'']);
  }
  for(const report of reports){if(report.errors?.length)throw Error('Browser runner reported global errors');for(const suite of report.suites??[])walk(suite);}
  return Object.fromEntries(E2E_PROJECTS.map(project=>{
    const rows=[...cases.values()].filter(row=>row.project===project);
    return [project,{passed:rows.filter(row=>row.passed&&!row.failed).length,failed:rows.filter(row=>row.failed).length,skipped:rows.filter(row=>!row.passed&&!row.failed).length,flaky:rows.filter(row=>row.flaky).length}];
  }));
}
export function releaseDockerArgs({work,dependencies,command,image,env={}}) {
  return ['--host=unix:///var/run/docker.sock','run','--rm','--pull=never','--name',`puzzoria-release-check-${randomUUID()}`,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user','3050:3050','--pids-limit','512','--memory','5g','--cpus','2','--tmpfs','/tmp:rw,nosuid,nodev,size=1g,mode=1777','--mount',`type=bind,src=${work},dst=/work`,'--mount',`type=bind,src=${dependencies},dst=/work/node_modules,readonly`,'--workdir','/work',image,'/usr/bin/env','-i','PATH=/usr/local/bin:/usr/bin:/bin','HOME=/work/.tmp/home','NEXT_TELEMETRY_DISABLED=1','PLAYWRIGHT_BROWSERS_PATH=/ms-playwright',...Object.entries(env).map(([key,value])=>`${key}=${value}`),...command];
}
export function validateRelease({head,base,tree,output='.release/proof.json'}) {
  if(![head,base].every(value=>/^[a-f0-9]{40}$/.test(value)))throw Error('Pinned Git commits required');
  const work=resolve('.release/work'),dependencies=resolve('node_modules'),image='puzzoria-release-verifier:locked';
  mkdirSync(work,{recursive:true});
  const gitOptions=['-c',`safe.directory=${process.cwd()}`];
  const archive=execFileSync('git',[...gitOptions,'archive',head],{maxBuffer:32*1024*1024});execFileSync('tar',['-x','-C',work],{input:archive});
  const paths=execFileSync('git',[...gitOptions,'ls-tree','-r','--name-only',head],{encoding:'utf8'}).trim().split('\n');
  const baseline=new Map(paths.map(path=>[path,readFileSync(join(work,path))]));
  mkdirSync(join(work,'node_modules'),{recursive:true});mkdirSync(join(work,'.tmp'),{recursive:true});mkdirSync(join(work,'.release-results'),{recursive:true});
  execFileSync('sudo',['chown','-R','3050:3050',work]);
  execFileSync('docker',['--host=unix:///var/run/docker.sock','build','--file','.github/containers/release-verifier.Dockerfile','--tag',image,'.'],{stdio:'inherit',timeout:10*60000});
  const proof={head,base,tree,status:'failed',network:'none',credentials:false,checks:{},unit:null,e2e:{}};
  const run=(name,command,env={},timeout=5*60000)=>{
    console.log(`Isolated release validation: ${name}`);
    const args=releaseDockerArgs({work,dependencies,image,command,env}),container=args[args.indexOf('--name')+1];
    let failure;
    try{execFileSync('docker',args,{stdio:'inherit',timeout});}catch(error){failure=error;}
    try{execFileSync('docker',['--host=unix:///var/run/docker.sock','rm','--force',container],{stdio:'ignore',timeout:10000});}catch(error){if(error.status!==1)failure=new Error('Release verifier cleanup failed',{cause:failure??error});}
    if(failure)throw failure;
  };
  try {
    run('isolation',['node','-e',`const fs=require('fs');if(process.getuid()!==3050||process.env.GITHUB_TOKEN||process.env.CODEX_PILOT_VAULT_KEY||fs.existsSync('/var/run/docker.sock'))throw Error('Unsafe verifier');let denied=false;try{fs.writeFileSync('/work/node_modules/.bad','bad')}catch{denied=true}if(!denied)throw Error('Writable dependencies')`]);proof.checks.isolation=true;
    for(const [name,script] of [['lint','lint'],['typecheck','typecheck'],['content','content:validate'],['social','content:social'],['seo','seo:check'],['build','build']]){run(name,['npm','run',script],{NEXT_PUBLIC_SITE_URL:'https://puzzoria.com'});proof.checks[name]=true;}
    run('unit',['npm','test','--','--configLoader=runner','--maxWorkers=2','--reporter=json','--outputFile=.release-results/unit.json']);
    const unit=JSON.parse(readFileSync(join(work,'.release-results/unit.json'),'utf8'));proof.unit={passed:unit.numPassedTests,failed:unit.numFailedTests,skipped:unit.numPendingTests};
    const reports=[];
    for(const project of E2E_PROJECTS)for(const conditional of [false,true]) {
      const file=`.release-results/${project}-${conditional?'conditional':'full'}.json`;
      run(`browser ${project} ${conditional?'conditional':'full'}`,['npm','run','test:e2e','--',...(conditional?['e2e/starter-statistics.spec.ts']:[]),`--project=${project}`,'--reporter=json'],{NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3100',PLAYWRIGHT_JSON_OUTPUT_FILE:file,...(conditional?{COMMUNITY_STARTER_STATS:'true'}:{})},25*60000);
      reports.push(JSON.parse(readFileSync(join(work,file),'utf8')));
    }
    proof.e2e=browserCoverage(reports);restoreNextEnv(work,baseline);
    for(const [path,data] of baseline)if(!data.equals(readFileSync(join(work,path))))throw Error('Validation modified the candidate source');
    proof.sourceDigest=createHash('sha256').update([...baseline].map(([path,data])=>path+':'+createHash('sha256').update(data).digest('hex')).join('\n')).digest('hex');
    assertValidation({...proof,status:'passed'},{head,base});proof.status='passed';
    return proof;
  } finally {
    mkdirSync(resolve(output,'..'),{recursive:true});writeFileSync(output,JSON.stringify(proof,null,2)+'\n');
    // Databases, screenshots, browser state and raw traces never leave the VM.
    rmSync(work,{recursive:true,force:true});
  }
}
