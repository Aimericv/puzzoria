import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
const head='4820729e4815111c16e404212f7c0f7fac182e1d',base='d5dc9dab3b541d1b8dabf9d71327e7282727c89b',fixture='3d0c1fa8b2b1d5f45f7d8d3a866acb2ef078b402';
const git=(...a)=>execFileSync('git',['-c',`safe.directory=${process.cwd()}`,...a],{encoding:'utf8'}).trim();
if(git('rev-parse','HEAD')!==head||git('diff','--name-only',base,head)!=='e2e/game-modes.spec.ts')throw Error('Only reviewed test readiness may change');
const {releaseDockerArgs}=await import(pathToFileURL(resolve('scripts/autonomy-agent/release-validation.mjs')));
const {restoreNextEnv}=await import(pathToFileURL(resolve('scripts/autonomy-agent/outputs.mjs')));
const work=resolve('.release/readiness-work'),image='puzzoria-release-verifier:locked',dependencies=resolve('node_modules');
mkdirSync(work,{recursive:true});
execFileSync('tar',['-x','-C',work],{input:execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'archive',head],{maxBuffer:33554432})});
writeFileSync(join(work,'src/lib/seo-content.ts'),execFileSync('git',['-c',`safe.directory=${process.cwd()}`,'show',`${fixture}:src/lib/seo-content.ts`],{maxBuffer:1048576}));
const baseline=new Map(git('ls-tree','-r','--name-only',head).split('\n').map(p=>[p,readFileSync(join(work,p))]));
for(const p of ['node_modules','.tmp','.release-results'])mkdirSync(join(work,p),{recursive:true});
execFileSync('chown',['-R','3050:3050',work]);
execFileSync('docker',['--host=unix:///var/run/docker.sock','build','--file','.github/containers/release-verifier.Dockerfile','--tag',image,'.'],{stdio:'inherit',timeout:600000});
const proof={head,base,fixtureSeoCommit:fixture,scope:'targeted existing modes case and checked preflight; not full PR validation',network:'none',credentials:false,status:'failed',projects:{}};
try {
 for(const project of ['desktop','mobile','android','iphone-webkit']){
  for(const kind of ['preflight','readiness']) {
   const file=`.release-results/${project}-${kind}.json`;
   const selected=kind==='preflight'?['e2e/social-games.spec.ts','e2e/site-analytics.spec.ts','e2e/rare-word.spec.ts','--grep','new SEO pages|internal analytics require|Unusual Word plays']:['e2e/game-modes.spec.ts','--grep','Word variants share one catalogue'];
   const args=releaseDockerArgs({work,dependencies,image,command:['npm','run','test:e2e','--',...selected,`--project=${project}`,'--reporter=line,json'],env:{NEXT_PUBLIC_SITE_URL:'http://127.0.0.1:3100',PLAYWRIGHT_JSON_OUTPUT_FILE:file}});
   const name=args[args.indexOf('--name')+1];
   try{execFileSync('docker',args,{stdio:'inherit',timeout:360000});}finally{try{execFileSync('docker',['--host=unix:///var/run/docker.sock','rm','--force',name],{stdio:'ignore'});}catch{}}
   const r=JSON.parse(readFileSync(join(work,file))),s=r.stats;
   if(r.errors?.length||s.expected!==(kind==='preflight'?3:1)||s.unexpected!==0||s.skipped!==0||s.flaky!==0)throw Error('Every selected assertion must pass without skips or retries');
   proof.projects[project]??={};proof.projects[project][kind]={passed:s.expected,failed:s.unexpected,skipped:s.skipped,flaky:s.flaky};
  }
 }
 restoreNextEnv(work,baseline);
 for(const [p,b]of baseline)if(!b.equals(readFileSync(join(work,p))))throw Error('Test changed source');
 proof.status='passed';proof.sourceUnchanged=true;
}finally{
 mkdirSync('.ci-results',{recursive:true});writeFileSync('.ci-results/game-modes-readiness.json',JSON.stringify(proof,null,2)+'\n');
 rmSync(work,{recursive:true,force:true});
}
