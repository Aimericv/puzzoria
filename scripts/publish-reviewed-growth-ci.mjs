import{readFileSync,existsSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{github}from'./autonomy-pilot/github.mjs';
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),read=p=>existsSync(p)?JSON.parse(readFileSync(p)):null;
const plan=read('.ci-results/review-plan.json'),validation=read('.release/proof.json');
const tap=existsSync('.ci-results/control.tap')?readFileSync('.ci-results/control.tap','utf8'):'',count=n=>Number(tap.match(new RegExp(`^# ${n} (\\d+)`,'m'))?.[1]??0);
const {jobs}=await api(`/actions/runs/${process.env.GITHUB_RUN_ID}/jobs?per_page=100`);
const steps=jobs.flatMap(j=>j.steps).map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}));
const current=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),unchanged=execFileSync('git',['diff','a3e138ff59679473171d5baa47725ff6c8c8c878',current,'--','scripts/autonomy-agent/release-host.mjs','scripts/autonomy-agent/deployment-transaction.mjs','scripts/autonomy-agent/release-policy.mjs','scripts/autonomy-agent/public-probe.mjs'],{encoding:'utf8'}).length===0;
const old=await api('/contents/release-continuity.json?ref=codex%2Frelease-continuity-validation%2F40534259927'),fixtures=JSON.parse(Buffer.from(old.content,'base64')).fixtures;
const evidence={plan,source:current,controls:{tests:count('tests'),passed:count('pass'),failed:count('fail')},validation,steps,rollback:{modulesUnchanged:unchanged,sourceRun:40534259927,fixtures},controller:read('.release/controller/VALIDATION.json'),protectedStateChanged:false,productionEnabled:false,url:`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`};
if(plan&&validation?.status==='passed'&&count('tests')===73&&count('pass')===73&&unchanged&&fixtures.length===2){
 const pr=await api(`/pulls/${plan.pr.number}`);
 if(pr.head.sha!==current)throw Error('Review branch changed');
 await api(`/statuses/${current}`,'POST',{state:'success',context:'autonomy/reviewed-growth-complete',description:'Exact isolated full CI, 73 controls, PS dry-run; production remains off',target_url:evidence.url});
}
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'reviewed-growth-validation.json',mode:'100644',type:'blob',content:JSON.stringify(evidence,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record exact full review CI and sanitized results; no activation or merge',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/reviewed-growth-validation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify({source:current,controls:evidence.controls,validation:validation?.status,pr:plan?.pr,productionEnabled:false}));
