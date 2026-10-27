import{readFileSync}from'node:fs';
import{execFileSync}from'node:child_process';
import{github}from'./autonomy-pilot/github.mjs';
const source='71af9ebe30e911d57bd2df5f43b79727190e46d3',appSource='8b8d23691427c4ba78e4fabbc2de45cfb6987fd9';
const git=(...a)=>execFileSync('git',a,{encoding:'utf8'}).trim();
const baseline='45bef6497b0d6e2afc3e46e307d21e0ce0f255c0';
const paths=git('diff','--name-only',baseline,source).split('\n');
const allowed=['scripts/autonomy-agent/release-continuity.test.mjs','scripts/autonomy-agent/release-queue.mjs','scripts/autonomy-agent/release-selection.mjs'];
if(git('rev-parse','HEAD')!==source||JSON.stringify(paths)!==JSON.stringify(allowed))throw Error('Only the strategic-stop guard may differ from tested main; all application and E2E bytes remain identical');
const tap=readFileSync('.ci-results/control.tap','utf8'),count=n=>Number(tap.match(new RegExp(`^# ${n} (\\d+)`,'m'))?.[1]??0);
if(count('tests')!==77||count('pass')!==77||count('fail')!==0)throw Error('77 passing controller tests required');
const api=github(process.env.GITHUB_TOKEN,'Aimericv/puzzoria'),url=`https://github.com/Aimericv/puzzoria/actions/runs/${process.env.GITHUB_RUN_ID}`;
const existing=await api('/pulls?state=all&head=Aimericv:codex/respect-stopped-experiments');
const pr=existing[0]??await api('/pulls','POST',{head:'codex/respect-stopped-experiments',base:'main',draft:true,title:'Respecter l’abandon ou le pivot d’une expérience avant sa fusion',body:`Une proposition déjà en file pouvait rester fusionnable après la décision stratégique stop/pivot de l’agent. Le superviseur annule maintenant ce reçu avant tout appel GitHub. Les états annulés sont terminaux.

Validation : 77 contrôles, lint, syntaxe et mode sans changement de l’installateur PowerShell ; paquet contrôleur préparé. Sources applicatives, Playwright et contrôleur VPS inchangés depuis main ${baseline} (359 tests unitaires et 424 cas navigateur déjà validés, deux fixtures de sauvegarde/rollback). Aucun accès VPS ni activation. [Validation](${url}).`});
const proof={source,baseline,appSource,applicationAndBrowserSourcesUnchanged:true,allowedControllerChanges:paths,controls:{tests:77,passed:77,failed:0},lint:true,bootstrapParseAndDryRun:true,controller:JSON.parse(readFileSync('.release/controller/VALIDATION.json')),archiveSha256:readFileSync('.release/puzzoria-controller.sha256','utf8').trim().split(/\s/)[0],pr:{number:pr.number,url:pr.html_url},productionEnabled:false,protectedStateChanged:false,url};
const parent=process.env.GITHUB_SHA,c=await api('/git/commits/'+parent),tree=await api('/git/trees','POST',{base_tree:c.tree.sha,tree:[{path:'strategic-stop-controls.json',mode:'100644',type:'blob',content:JSON.stringify(proof,null,2)+'\n'}]}),commit=await api('/git/commits','POST',{message:'Record strategic-stop guard tests, unchanged application sources and prepared controller artifact',tree:tree.sha,parents:[parent]});await api('/git/refs','POST',{ref:`refs/heads/codex/strategic-stop-validation/${process.env.GITHUB_RUN_ID}`,sha:commit.sha});console.log(JSON.stringify(proof));
