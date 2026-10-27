import {readFileSync,writeFileSync,openSync,closeSync,fsyncSync,renameSync,statSync,realpathSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const zero='0'.repeat(40),modules=['release-host.mjs','deployment-transaction.mjs','release-policy.mjs','public-probe.mjs'];
const comparable=c=>JSON.stringify(Object.entries(c).filter(([key])=>!['policyHash','bootstrapApprovedCommit'].includes(key)).sort(([a],[b])=>a.localeCompare(b)));
export async function refreshBootstrapPolicy({configPath,next,expectedPolicy,packageDirectory,installedDirectory,state,driver}) {
  const previous=JSON.parse(readFileSync(configPath,'utf8')),manifest=JSON.parse(readFileSync(join(packageDirectory,'VALIDATION.json'),'utf8'));
  if(!/^[a-f0-9]{64}$/.test(expectedPolicy??'')||!/^[a-f0-9]{64}$/.test(next.policyHash??'')||!/^[a-f0-9]{40}$/.test(next.bootstrapApprovedCommit??'')||next.policyHash!==manifest.policyHash)throw Error('Exact reviewed policy and source required');
  if(previous.policyHash!==expectedPolicy&&previous.policyHash!==next.policyHash)throw Error('Installed policy differs from the reviewed previous policy');
  if(comparable(previous)!==comparable(next)||previous.initialCommit!==zero||next.initialCommit!==zero)throw Error('Only the policy hash and initial approved source may change');
  if(state?.phase!=='healthy'||state.currentCommit!==zero||state.legacyBaselineUnknown!==true||state.sha)throw Error('Policy refresh is limited to an unpublished initial controller');
  for(const name of modules)if(!readFileSync(join(installedDirectory,name)).equals(readFileSync(join(packageDirectory,name))))throw Error('Installed controller modules differ from the reviewed unchanged source');
  if(await driver.currentImage()!==state.currentImage||!/^[a-f0-9]{64}$/.test(await driver.schema()))throw Error('Existing production image or schema could not be verified');
  if(previous.policyHash===next.policyHash&&previous.bootstrapApprovedCommit===next.bootstrapApprovedCommit)return {productionChanged:false,policyAlreadyCurrent:true};
  // Keep a private, fsynced copy. No application, data, state journal, key or service is replaced.
  const backup=configPath+'.before-'+expectedPolicy;
  const original=readFileSync(configPath);
  try {writeFileSync(backup,original,{mode:0o600,flag:'wx'});}catch(error){if(error.code!=='EEXIST'||!readFileSync(backup).equals(original))throw error;}
  const backupFd=openSync(backup,'r');try{fsyncSync(backupFd);}finally{closeSync(backupFd);}
  const temporary=configPath+'.policy-new';
  writeFileSync(temporary,JSON.stringify(next,null,2)+'\n',{mode:0o600,flag:'wx'});
  const fd=openSync(temporary,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
  renameSync(temporary,configPath);
  const folder=openSync(dirname(configPath),'r');try{fsyncSync(folder);}finally{closeSync(folder);}
  return {productionChanged:false,policyRefreshed:true,configurationBackup:backup};
}
async function main(){
  if(process.getuid()!==0||process.argv.length!==5)throw Error('Explicit root bootstrap policy refresh required');
  const [nextPath,expectedPolicy,packageDirectory]=process.argv.slice(2),configPath='/etc/puzzoria-release/config.json',installedDirectory='/usr/local/lib/puzzoria-release';
  const metadata=statSync(configPath);
  if(metadata.uid!==0||(metadata.mode&0o077)!==0||realpathSync(configPath)!==configPath)throw Error('Private root-owned installed configuration required');
  const {validateHostConfig,hostDriver,durableStore}=await import(pathToFileURL(join(installedDirectory,'release-host.mjs')));
  const previous=validateHostConfig(JSON.parse(readFileSync(configPath,'utf8'))),next=validateHostConfig(JSON.parse(readFileSync(nextPath,'utf8')));
  return refreshBootstrapPolicy({configPath,next,expectedPolicy,packageDirectory,installedDirectory,state:await durableStore(previous.stateDirectory).read(),driver:hostDriver(previous)});
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().then(r=>console.log(JSON.stringify(r))).catch(error=>{console.error(error.message);process.exitCode=1;});
