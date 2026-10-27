import{existsSync,readFileSync}from'node:fs';
import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria');
const value=existsSync('.ci-results/restricted-ssh.json')?JSON.parse(readFileSync('.ci-results/restricted-ssh.json')):{status:'failed',phase:'before_structured_diagnostic'};
if(value.status!=='failed'||value.productionContacted===true||JSON.stringify(value).length>32768)throw Error('Only a bounded failed disposable fixture diagnostic is allowed');
const report={source:process.env.CANDIDATE_SOURCE,runId:process.env.GITHUB_RUN_ID,fixture:value,vpsContacted:false};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'restricted-transport-fault.json',mode:'100644',type:'blob',content:JSON.stringify(report,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record only structured isolated SSH test failure categories; no raw keys or logs',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/restricted-transport-fault/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(report));
