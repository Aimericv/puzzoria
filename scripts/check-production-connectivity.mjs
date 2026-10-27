import net from 'node:net';
import {lookup} from 'node:dns/promises';
import {spawnSync,execFileSync} from 'node:child_process';
import {writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {github} from './autonomy-pilot/github.mjs';
const host='37.27.24.173',expected='SHA256:7wiefI6XYd5fbKwZfx9Dyvk2UNY2sqnHgMc7CD+oXeg';
const proof={at:new Date().toISOString(),vantage:'GitHub-hosted Ubuntu deployment runner',host,port:22,ssh:{tcpConnected:false},site:{url:'https://puzzoria.com/api/health'},credentialsUsedForVps:false,vpsChanged:false,deployRequested:false};
proof.ssh=await new Promise(resolve=>{const socket=net.createConnection({host,port:22});let done=false;const finish=r=>{if(done)return;done=true;socket.destroy();resolve(r);};socket.setTimeout(12000);socket.once('connect',()=>finish({tcpConnected:true}));socket.once('timeout',()=>finish({tcpConnected:false,error:'timeout'}));socket.once('error',e=>finish({tcpConnected:false,error:['ECONNREFUSED','ETIMEDOUT','EHOSTUNREACH','ENETUNREACH','ECONNRESET'].includes(e.code)?e.code:'network_error'}));});
if(proof.ssh.tcpConnected){
 const scan=spawnSync('ssh-keyscan',['-T','10','-t','ed25519',host],{encoding:'utf8',timeout:15000,maxBuffer:65536});proof.ssh.scanExitCode=scan.status;
 const folder=mkdtempSync(join(tmpdir(),'puzzoria-public-host-key-'));
 try{for(const line of (scan.stdout??'').split('\n')){const match=line.match(/^\S+\s+ssh-ed25519\s+([A-Za-z0-9+/=]+)(?:\s|$)/);if(!match)continue;const file=join(folder,'public');writeFileSync(file,'ssh-ed25519 '+match[1]+'\n');const fingerprint=execFileSync('ssh-keygen',['-lf',file,'-E','sha256'],{encoding:'utf8'}).trim().split(/\s+/)[1];proof.ssh.fingerprintMatches=fingerprint===expected;if(proof.ssh.fingerprintMatches){proof.ssh.verifiedPublicKnownHost=host+' ssh-ed25519 '+match[1];break;}}}finally{rmSync(folder,{recursive:true,force:true});}
}
try{proof.site.dns=(await lookup('puzzoria.com',{all:true})).map(r=>({address:r.address,family:r.family}));}catch{proof.site.dnsUnavailable=true;}
try{const response=await fetch(proof.site.url,{redirect:'error',signal:AbortSignal.timeout(15000)});proof.site.httpStatus=response.status;const value=await response.json();proof.site.healthOk=response.status===200&&value?.status==='ok';}catch{proof.site.requestFailed=true;}
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'production-connectivity.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record public deployment-path TCP and HTTPS checks without credentials or server changes',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/production-connectivity/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});
await api('/issues/3/comments','POST',{body:`Diagnostic réseau avant installation : depuis le runner GitHub, SSH TCP/22 ${proof.ssh.tcpConnected?'accessible':'inaccessible'} ; santé HTTPS ${proof.site.healthOk?'OK':'non confirmée'}. ${proof.ssh.fingerprintMatches?'Empreinte SSH conforme à celle du propriétaire. ':''}Le PC du propriétaire signale TCP/22 inaccessible. Aucun identifiant VPS utilisé, aucune modification du serveur ni activation. [Diagnostic](https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}).`});console.log(JSON.stringify(proof));
