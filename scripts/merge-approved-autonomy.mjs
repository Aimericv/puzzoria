import {github} from './autonomy-pilot/github.mjs';
import {assertFunding} from './autonomy-agent/policy.mjs';
import {readFileSync} from 'node:fs';
assertFunding(JSON.parse(readFileSync('agent/autonomy/control.json','utf8')));
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const expected='5ece3ee5f72a6eefd592a1b5c6a20a87f5a97151',base='37aa7654be9393173c4d5c7d3446cc0832bb9818';
const proof={authorizedAt:new Date().toISOString(),operation:'merge-approved-infrastructure-pr-4',ownerDeclaration:{webhooks:'Owner inspected settings: empty list, Add webhook only.',production:'Owner deploys manually to Hetzner VPS; no known external service watching main.',permission:'Owner explicitly authorizes PR 4 merge and six-hour autonomous wakes; no production deployment or automatic development PR merges.'},expectedHead:expected,mainBefore:(await api('/git/ref/heads/main')).object.sha};
try {
 const run=await api('/actions/runs/39632711143');
 if(run.status!=='completed'||run.conclusion!=='success'||run.head_sha!==expected)throw Error('The approved full CI is not successful on the expected head');
 const file=await api('/contents/conditional-final.json?ref=codex%2Fci-conditional-final%2F39831867798');
 const extra=JSON.parse(Buffer.from(file.content,'base64').toString('utf8'));
 if(extra.source!==expected||extra.allConditionalTestsPassed!==true)throw Error('The complete conditional browser validation is not successful');
 let pr=await api('/pulls/4');
 if(pr.head.sha!==expected||pr.base.ref!=='main'||pr.base.sha!==base||proof.mainBefore!==base||pr.merged)throw Error('Unexpected PR or main state; do not merge changed code');
 if(pr.draft) {
  const response=await fetch('https://api.github.com/graphql',{method:'POST',headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({query:'mutation Ready($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{isDraft}}}',variables:{id:pr.node_id}}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();
  if(!response.ok||result.errors?.length||result.data?.markPullRequestReadyForReview?.pullRequest?.isDraft!==false)throw Error(`Cannot mark PR 4 ready for review (HTTP ${response.status})`);
 }
 const result=await api('/pulls/4/merge','PUT',{sha:expected,merge_method:'merge',commit_title:'Merge PR #4: persistent Puzzoria autonomous agent infrastructure',commit_message:'Owner-approved merge after full CI including four Playwright projects and conditional browser coverage. Production remains manual; no VPS access or automatic development PR merges.'});
 if(!result.merged)throw Error('GitHub did not confirm the PR merge');
 pr=await api('/pulls/4');proof.merged=pr.merged;proof.mergeCommit=pr.merge_commit_sha;proof.prUrl=pr.html_url;
 if(!pr.merged)throw Error('The PR merge could not be read back');
 const comment=await api('/issues/3/comments','POST',{body:`La PR d’infrastructure #4 a été fusionnée après validation complète de la CI. Le propriétaire confirme une liste de webhooks vide et des déploiements manuels sur Hetzner.\n\nLa configuration d’activation et son interrupteur restent à finaliser avant le premier réveil. Aucun déploiement en production, achat ou fusion de PR de développement n’a été effectué.\n\nCommit de fusion : ${proof.mergeCommit}.`});proof.reportUrl=comment.html_url;
} catch(error){proof.error={message:error.message,httpStatus:error.status??null};process.exitCode=1;}
proof.mainAfter=(await api('/git/ref/heads/main')).object.sha;
const parent=process.env.GITHUB_SHA,commit=await api(`/git/commits/${parent}`);
const tree=await api('/git/trees','POST',{base_tree:commit.tree.sha,tree:[{path:'operator-result.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]});
const next=await api('/git/commits','POST',{message:'Record authorized infrastructure merge result without deploying',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/operator-result/${process.env.GITHUB_RUN_ID}`,sha:next.sha});
console.log(JSON.stringify(proof));
