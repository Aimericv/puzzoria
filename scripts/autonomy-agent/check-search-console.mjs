import {readFileSync,appendFileSync} from "node:fs";
import {assertFunding} from "./policy.mjs";
import {collectSearchConsole} from "./search-console.mjs";

assertFunding(JSON.parse(readFileSync("agent/autonomy/control.json","utf8")));
const result=await collectSearchConsole();
if(result.status!=="available") throw new Error(`Search Console: ${result.status} (${result.reason ?? "OIDC unavailable"})`);
const summary=`Search Console : **available**.\n\nPropriété observée : \`${result.property}\`.\n\nCollecte : ${result.fetchedAt}. Données finales, fuseau ${result.timezone}.\n\nFenêtres 7/30/90 jours et ventilations sur 30 jours accessibles. Dernier jour présent : ${result.reports[90].lastReportedDate ?? "aucune ligne retournée"}.\n\nSHA-256 : ${result.sha256}\n\nConnexion OIDC renouvelée pour cette exécution ; aucun jeton ou rapport brut publié, aucune inférence Codex, aucun déploiement.\n`;
appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
console.log(JSON.stringify({status:result.status,property:result.property,fetchedAt:result.fetchedAt,sha256:result.sha256,lastReportedDate:result.reports[90].lastReportedDate}));
