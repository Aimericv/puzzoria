# Test ponctuel GitHub Actions → nouvel environnement Codex Cloud

Ce test réutilise le runtime Codex 0.163.0, le contrôle Plus/quota inclus,
le protocole natif de renouvellement et le chiffrement du pilote existant.
Il ne relance pas la preuve des deux sessions et n'ajoute ni ordonnanceur,
ni interface, ni déploiement. Les fichiers du pilote restent inchangés.

## Avant le lancement

- Confirmer l'identifiant exact du **nouvel** environnement dans
  `agent/cloud-handoff/target.json`. L'outil natif
  `cloud_environment.environment_status` a maintenant fourni le
  `source_config_id` de l'environnement lié à ce chat, sa version et
  l'identifiant de la machine. La cible utilise le **source_config_id**,
  et conserve les métadonnées de provenance. Sa compatibilité avec le CLI
  reste à tester : ne pas confondre découverte de configuration et acceptation
  par `codex cloud exec`. Un lien de paramètres contenant l'ID exact constitue
  une autre méthode de découverte. Ne pas choisir par nom, par dépôt,
  par ancien environnement ou par identifiant de la machine d'onboarding.
- Vérifier que le nouvel environnement est publié et utilisable pour de
  nouvelles tâches. Un brouillon enregistré ne démontre pas cette publication.
- Conserver le blocage externe des dépenses Actions à zéro déjà confirmé par
  le propriétaire, et la variable `PUZZORIA_FREE_ACTIONS_VERIFIED=true`.
  Lire les minutes incluses disponibles si l'accès à la facturation le permet.
- Vérifier que l'artifact `pilot-39465013048-1-session-2` (ID `12285785640`)
  est encore disponible et reste le dernier checkpoint. Le superviseur refuse
  tout checkpoint plus ancien qu'un artifact d'authentification ultérieur.
  Le secret existant `CODEX_PILOT_VAULT_KEY` reste uniquement dans Actions.
- Depuis la machine cloud, `api.github.com` doit être autorisé pour inspecter
  les runs et résultats. L'ajout est enregistré dans les paramètres réseau ;
  son application doit être vérifiée par une requête réelle.

Lancer une seule fois en poussant la branche `codex/cloud-handoff-smoke` avec
sa configuration de cible complète. Le workflow n'est pas programmé et n'a
aucun événement `workflow_dispatch`. Ne pas pousser de nouvelle version pour
relancer sans examiner l'authentification préservée et l'état de la tâche.

## Ce que fait le runner

1. Installer le runtime avec son lockfile existant et exécuter les tests des
   limites de cible/confidentialité, avant d'exposer la clé du checkpoint.
2. Restaurer l'artifact chiffré de la seconde session. Contrôler sa provenance,
   renouveler avec Codex natif et préserver immédiatement le nouveau cache
   chiffré. Aucun client OAuth personnalisé, seed retiré ou clé API.
3. Refuser un compte autre que Plus, une autorisation d'usage inclus inconnue,
   un quota épuisé ou des crédits payants non nuls/invérifiables.
4. Appeler `codex cloud exec --env ID_EXACT --branch main --attempts 1`.
   La mission demande seulement la lecture d'AGENTS/README, le contexte Git,
   Node et un calcul SQLite en mémoire. Aucun serveur, fichier, commit, PR
   ou accès de production n'est demandé à la tâche.
5. Publier le lien retourné dans le résumé du run, comparer l'environnement
   des métadonnées de tâche à l'identifiant exact, suivre l'état pendant deux
   minutes au maximum et relire les quotas. Aucun autre modèle n'est lancé
   sur le runner. Aucun repli vers un environnement hérité ou une API payante.
6. Conserver uniquement `auth.enc` et `evidence.json` dans un artifact privé
   `cloud-handoff-RUN-ATTEMPT`, avec rétention de 30 jours. Le cache déchiffré
   temporaire est supprimé ; aucun flux de protocole brut n'est publié.

Le runner Linux standard est plafonné à dix minutes, sans permission
d'écriture GitHub. Il partage le verrou de concurrence du pilote pour éviter
un renouvellement simultané du même login. Le temps Actions réel et les quotas
observés doivent être rapportés après le run ; un timeout n'est pas une mesure
de consommation et le budget humain à zéro n'est pas vérifiable par la seule
variable d'activation.

## Résultats à distinguer

- **Soumission** : lien de tâche effectivement retourné par le CLI.
- **Cible confirmée** : métadonnées contenant l'ID exact demandé.
- **Exécution terminée** : état `ready` et résultat du contrôle consulté.
- **Discussion vérifiée** : le propriétaire ouvre le lien, répond et constate
  une nouvelle réponse dans la même tâche. Ce point reste manuel.
- **Quotas** : relever les fenêtres Plus avant/après et la durée Actions ; si
  la tâche reste en cours, le relevé après soumission n'est pas son coût final.

Un échec `environment not found` pour l'identifiant exact est une limitation
de la passerelle du CLI vers ce nouvel environnement ; ne pas sélectionner
un ancien environnement pour obtenir artificiellement un lien.
Si la création a pu être acceptée avant une erreur réseau, rechercher la tâche
par le nonce du test avant toute nouvelle soumission.

**Après tout renouvellement, le nouvel artifact est l'autorité.** L'original
peut être périmé même si la tâche n'a pas pu être soumise. Le test refuse alors
une nouvelle utilisation de l'ancien checkpoint ; adapter explicitement la
provenance et la source d'une reprise, sans réensemencement. Un arrêt brutal
avant l'upload peut toujours nécessiter une nouvelle connexion dédiée.

## Validation locale

```sh
node --test scripts/cloud-handoff/run.test.mjs
node --check scripts/cloud-handoff/run.mjs
npx --no-install eslint scripts/cloud-handoff/*.mjs --max-warnings 0
npx --no-install vitest run tests/autonomy-pilot.test.ts --maxWorkers=2
```

Ces contrôles ne prouvent ni un lancement GitHub, ni l'accès au nouvel
environnement. Ne pas présenter un test local comme une preuve cloud.
