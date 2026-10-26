import test from 'node:test';
import assert from 'node:assert/strict';
import {browserCoverage,releaseDockerArgs} from '../../scripts/autonomy-agent/release-validation.mjs';
import {deploymentAllowed} from '../../scripts/autonomy-agent/release-policy.mjs';
import {validateHostConfig} from '../../scripts/autonomy-agent/release-host.mjs';
const report=(status,title='case',projectName='desktop')=>({suites:[{file:'e2e/test.spec.ts',specs:[{title,tests:[{projectName,results:[{status}]}]}]}]});
test('conditional browser runs must actually cover every skipped default case',()=>{
 assert.equal(browserCoverage([report('skipped')]).desktop.skipped,1);
 assert.equal(browserCoverage([report('skipped'),report('passed')]).desktop.skipped,0);
 assert.equal(browserCoverage([report('failed'),report('passed')]).desktop.failed,1);
 assert.equal(browserCoverage([report('skipped','different'),report('passed')]).desktop.skipped,1);
});
test('candidate validation has neither secrets, host namespaces, a Docker socket nor Internet',()=>{
 const args=releaseDockerArgs({work:'/work/source',dependencies:'/approved/deps',image:'locked',command:['npm','test']});
 assert.ok(args.includes('--network=none'));assert.ok(args.includes('--read-only'));assert.ok(args.includes('--cap-drop=ALL'));assert.ok(args.includes('-i'));assert.ok(args.includes('3050:3050'));
 assert.ok(!args.some(value=>/GITHUB_TOKEN|VAULT|DEPLOY_KEY|docker.sock.*dst/.test(value)));
});
test('first production activation requires every explicit approval and target field',()=>{
 const control={release:{productionEnabled:true,productionAuthorization:{approvedAt:'2026-10-26T00:00:00Z',policyHash:'hash'},target:{origin:'https://puzzoria.com',sshHost:'37.27.24.173',sshUser:'puzzoria-release',sshPort:22,hostKeyFingerprint:'SHA256:'+'a'.repeat(43),initialCommit:'a'.repeat(40)}}};
 assert.equal(deploymentAllowed(control,'true','hash'),true);
 for(const patch of [c=>c.release.productionEnabled=false,c=>c.release.productionAuthorization=null,c=>c.release.productionAuthorization.policyHash='changed',c=>c.release.target.sshHost='host;command',c=>c.release.target.hostKeyFingerprint=null]){const c=structuredClone(control);patch(c);assert.equal(deploymentAllowed(c,'true','hash'),false);}
 assert.equal(deploymentAllowed(control,'false','hash'),false);
 assert.throws(()=>validateHostConfig({schemaVersion:1,origin:'https://evil.example'}));
});
