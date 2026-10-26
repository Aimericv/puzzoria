import{createHash}from'node:crypto';
import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const {workflow_runs:runs}=await api('/actions/runs?branch=codex%2Fci-inspection&per_page=5');
const observations=[];
for(const run of runs.slice(0,3)){const{jobs}=await api(`/actions/runs/${run.id}/jobs?per_page=100`);observations.push({id:run.id,sha:run.head_sha,status:run.status,conclusion:run.conclusion,jobs:jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}))});}
const pr=await api('/pulls/11'),main=(await api('/git/ref/heads/main')).object.sha,branch=(await api('/git/ref/heads/codex/experiments/word-guide-worked-deductions')).object.sha;
const contents=[];
for(const ref of ['3d0c1fa8b2b1d5f45f7d8d3a866acb2ef078b402',pr.head.sha,branch]){const f=await api(`/contents/src/lib/seo-content.ts?ref=${ref}`);contents.push({ref,encoding:f.encoding,size:f.size,blob:f.sha,decodedHash:createHash('sha256').update(Buffer.from(f.content??'','base64')).digest('hex')});}
const compare=await api(`/compare/${main}...${branch}`);
const proof={observedAt:new Date().toISOString(),observations,main,pr:{number:pr.number,state:pr.state,merged:pr.merged,draft:pr.draft,head:pr.head.sha,headRef:pr.head.ref,headRepo:pr.head.repo.full_name,base:pr.base.sha,mergeable:pr.mergeable,mergeableState:pr.mergeable_state},branch,contents,comparison:{status:compare.status,behind:compare.behind_by,files:compare.files.map(f=>({path:f.filename,status:f.status}))}};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'handoff-metadata.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]}),next=await api('/git/commits','POST',{message:'Record structured handoff metadata only; no logs or secret export',tree:tree.sha,parents:[parent]});
await api('/git/refs','POST',{ref:`refs/heads/codex/handoff-metadata/${process.env.GITHUB_RUN_ID}`,sha:next.sha});console.log(JSON.stringify(proof));
