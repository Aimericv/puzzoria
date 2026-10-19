import { resolveSiteOrigin, isPublicSiteOrigin } from "../src/lib/site-origin";
import { missingLegalDetails } from "../src/lib/server/legal";
const problems: string[] = [];
try {
  const origin = resolveSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (!isPublicSiteOrigin(origin)) problems.push("NEXT_PUBLIC_SITE_URL doit être le domaine HTTPS public définitif.");
  if (process.env.TRUST_PROXY !== "true") problems.push("TRUST_PROXY=true exige un proxy qui remplace X-Forwarded-For.");
  if (process.env.AUTH_ORIGIN && process.env.AUTH_ORIGIN !== origin) problems.push("AUTH_ORIGIN doit correspondre exactement au domaine public.");
} catch { problems.push("Origine publique invalide."); }
const legal = missingLegalDetails();
if (legal.length) problems.push(`Informations de publication manquantes ou invalides : ${legal.join(", ")}.`);
if (!(process.env.ANALYTICS_ADMIN_USERNAMES ?? "").split(",").some(name => /^[a-z0-9_]{3,24}$/.test(name.trim()))) problems.push("Renseigner ANALYTICS_ADMIN_USERNAMES avec un compte existant.");
if (process.env.OPERATIONS_WEBHOOK_URL) {
  try { if (new URL(process.env.OPERATIONS_WEBHOOK_URL).protocol !== "https:") throw new Error(); }
  catch { problems.push("OPERATIONS_WEBHOOK_URL doit être une destination HTTPS."); }
} else problems.push("Configurer OPERATIONS_WEBHOOK_URL pour recevoir les alertes hors des logs du serveur.");
if (!process.env.OFFSITE_REMOTE) problems.push("Configurer OFFSITE_REMOTE pour la copie chiffrée hors machine.");
if (problems.length) { for (const problem of problems) console.error(`Publication : ${problem}`); process.exitCode = 1; }
else console.log("Configuration renseignée. Vérifier les comptes existants, le proxy, la réception des alertes, la copie hors machine et le vrai domaine avant ouverture.");
