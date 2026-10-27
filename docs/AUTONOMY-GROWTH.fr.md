# Croissance autonome, expériences et publications

## État de cette évolution

La stratégie de croissance et la gestion des propositions réutilisent le
superviseur Plus, ses quotas, le ticket #3, la mémoire Git et les collectes
Puzzoria/Search Console existantes. La production reste **désactivée** :
`release.productionEnabled=false`, `productionAuthorization=null`, et aucun
secret SSH n'est fourni au modèle. Installer le contrôleur ou autoriser sa
première publication demande encore l'accord explicite du propriétaire.

Le but reste un million d'utilisateurs quotidiens avant le 22 avril 2027,
six mois après le début du mandat. C'est une ambition, pas une prévision.
Les comptes/appareils et les visites consenties ne sont pas des personnes
uniques. La capacité du VPS et les quotas gratuits limitent le fonctionnement.

## Décisions et mesures

Chaque session choisit une hypothèse d'acquisition, SEO ou rétention et ses
critères dans `PLAN.json.experiment`. Elle cite l'identifiant imprévisible
de l'observation réellement fournie en lecture seule. Une session peut analyser,
rechercher, attendre des cohortes matures ou abandonner une piste sans modifier
le code ; le superviseur ne relance pas le build sans changement applicatif.

Le superviseur conserve baseline, critères, proposition, fusion, déploiement
et évaluation comme des événements distincts. Le modèle ne peut ni inventer
une date de publication, ni déplacer les critères d'une expérience déjà créée.
Un pivot reçoit un nouvel identifiant. Les fenêtres avant/après ont la même
durée, excluent le jour mixte de publication et respectent UTC pour Puzzoria
et America/Los_Angeles pour Google. Les trous Google ne deviennent pas zéro.
La rétention attend des cohortes matures et des périodes disjointes ; des
cohortes trop petites ou chevauchantes restent non concluantes. Une évolution
avant/après n'est pas une preuve causale randomisée.

Le registre est dans `codex/agent-state`. Douze expériences peuvent rester
actives ; les expériences arrêtées sont archivées atomiquement dans
`agent/autonomy/experiments/` sur cette branche. Les 64 références récentes
restent dans le contexte ; les fichiers et l'historique Git restent conservés.
L'ancienne PR de travail et son SHA sont référencés avant la transition : ils
ne sont ni écrasés ni automatiquement fusionnés. Les nouvelles propositions
partent de main sur `codex/experiments/<id>`. Les instantanés interrompus sont
isolés par run et repris uniquement avec une base compatible.

## Tendances publiques

Le superviseur collecte les flux RSS publics Google Trends FR/US/DE/ES et
essaie la page publique TikTok Creative Center. Aucun compte TikTok, API
payante, cookie de connexion, navigateur automatisé ou contournement n'est
employé. Un refus, une page dynamique sans données structurées ou une panne
est enregistré `unavailable`, avec sa raison. La disponibilité réelle doit
être lue dans la preuve de validation, pas déduite de la présence du code.

Les titres restent des données non fiables, jamais des instructions. Le
modèle lit un fichier root en lecture seule et ne reçoit ni réseau général
ni jetons Google/Puzzoria. Les signaux publics ne prouvent pas une demande
des joueurs de Puzzoria. Les nouveaux jeux sont autorisés comme propositions
de développement ; ils préservent les validations serveur et les anciennes
parties, sans dépendance ou service payant ajouté par le modèle.

## Fusion des changements à faible risque

La classification est indépendante du modèle et porte sur **toute** la PR.
Le périmètre initial automatique comprend les valeurs littérales de texte
des quatre modules SEO autorisés, avec structure TypeScript, clés, imports,
fonctions et commentaires identiques. HTML, URL et texte monétaire nouveau
sont refusés. Certains documents produit sont admissibles sans publication
runtime. Les suppressions, liens, changements de logique/tests, comptes,
confidentialité, migrations, nouveaux jeux, configuration et infrastructure
restent en revue humaine. Ce périmètre est volontairement explicite : passer
les tests ne rend pas arbitrairement tout code « sûr ».

Les tableaux `content.<locale>.games.<word|sudoku|math>.sections` du seul module
`seo-content.ts` acceptent aussi l'insertion de paragraphes littéraux
`{title, text}`. Tous les blocs existants restent identiques et dans l'ordre ;
le reste du fichier reste identique octet par octet. Aucun appel, expression,
getter, spread, champ supplémentaire, commentaire ajouté ou suppression n'est
accepté. Au plus seize blocs et 32 000 caractères nouveaux sont permis, avec
les mêmes restrictions de texte. Cette règle est aussi vérifiée sur le VPS.

Le validateur utilise les mêmes dépendances verrouillées et un environnement
Playwright/Node épinglé par digests, sans réseau, secrets, socket Docker ou
capacité privilégiée dans les conteneurs exécutant le candidat. Lint, types,
tests unitaires, contenus, SEO, build et les quatre projets Playwright sont
exigés, y compris les tests conditionnels avec leur configuration dédiée.
Une assertion ignorée non couverte ou une reprise instable bloque la fusion.
Les traces, captures et bases de test ne sont pas publiées.

Le SHA de PR, la base main et l'arbre Git doivent être exactement ceux testés.
La mise à jour de main n'est jamais forcée : une modification concurrente
arrête la tentative. Aucun auto-merge différé n'est armé. Le plafond interne reste de 180 minutes de validation sur sept jours. Avant
allocation, le superviseur réserve le délai maximal du job (90 minutes pour
l'application, 5 pour la documentation), plus deux minutes de marge. Après
terminaison, seules les métadonnées GitHub du job exact, terminé sur le workflow
main attendu et la bonne tentative, permettent de remplacer la réservation par
sa durée arrondie à la minute supérieure, plus la même marge. Une exécution en
cours, une reprise ambiguë, des dates invalides ou une API indisponible gardent
la réservation entière. Ce calcul ne mesure pas le quota partagé du compte
GitHub et ne crée ni budget à 0 € ni droit à des minutes payantes.

Le transfert vers la CI relit le reçu protégé après la session et transmet
uniquement un booléen entre les jobs. L'entrée `validate-pending` du workflow
permet de reprendre les contrôles d'une proposition déjà vérifiée sans nouvelle
inférence ni secret Plus. La boîte de réception est relue auparavant ; pause,
consignes non traitées, état bloqué ou base main périmée empêchent la reprise.
Une attente du quota du modèle n'autorise aucune nouvelle inférence, mais peut
laisser terminer cette validation dans son plafond de ressources distinct.

Les publications vérifiées entrent dans une file protégée ; un nouveau réveil
ne remplace plus les propositions précédentes. La documentation produit traduite
(`.fr.md`, etc.) est admissible, tandis que les documents de sécurité,
confidentialité et politique restent soumis à revue. Une proposition ordinaire
sur une ancienne base peut recevoir automatiquement main uniquement si sa
branche n'a pas changé, sans conflit : les parents de la fusion, son nouveau
delta complet puis les tests sur son SHA exact sont contrôlés à nouveau.
Un conflit, une tête de branche inattendue ou un delta devenu sensible impose
une revue. Après une fusion réussie, une continuation de validation sans modèle
peut traiter la proposition suivante. Les échecs et attentes de ressources
arrêtent cette chaîne et sont signalés dans le ticket #3.

La publication en attente de déploiement est conservée séparément dans
`growth.pendingDeployment`. Les sessions de développement suivantes ne peuvent
pas remplacer ce reçu par une nouvelle proposition. Le verrou initial de
production, la clé SSH distincte et les contrôles du VPS restent exigés.

## Déploiement préparé, activation séparée

Cible confirmée par le propriétaire : Hetzner `37.27.24.173`, projet existant
`dailygrid`, fichier `/opt/puzzoria/compose.yaml`. Empreinte ED25519 :
`SHA256:7wiefI6XYd5fbKwZfx9Dyvk2UNY2sqnHgMc7CD+oXeg`.
Le chemin `.env.docker` reste à confirmer par le précontrôle de l'installateur.
La clé administrative Windows existante ne doit pas être copiée dans GitHub.

Le paquet contrôleur est produit par la validation CI. Après autorisation,
il installe un utilisateur `puzzoria-release` avec une clé distincte et une
seule commande SSH forcée. Pas de shell libre, transfert de ports ou groupe
Docker pour cet utilisateur. Node est extrait de l'image déjà épinglée ;
aucune installation globale Node ni nouveau serveur n'est nécessaire. Le
serveur vérifie aussi le hash de la politique installée et le delta Git.
Le code arrive dans un bundle Git borné ; aucun jeton GitHub permanent n'est
nécessaire sur le VPS. L'empreinte SSH est vérifiée avant l'utilisation de la
clé privée, avec `StrictHostKeyChecking=yes`.

Une publication construit une image immuable sans copier les secrets, vérifie
une sauvegarde SQLite et sa restauration avec le journal d'effacement, puis
démarre l'image sur une **copie privée** de la base sans réseau. Un changement
de schéma est refusé avant de toucher à l'application. Ensuite seulement,
le service `app` existant est remplacé sans modifier le projet ou les volumes.
Contrôles internes, quatre langues, CSP/cache, robots et sitemap sont vérifiés
plusieurs fois. L'identité réelle de l'image est contrôlée.

Un échec revient à l'image précédente en conservant **la base courante**.
Les écritures récentes et le journal d'effacement ne sont jamais remplacés
automatiquement par une sauvegarde ancienne. Un journal fsync et un timer
systemd permettent la récupération après interruption, y compris si le
nouveau conteneur s'est arrêté. Un schéma inattendu exige une intervention.
L'espace Docker est vérifié ; seules les anciennes images étiquetées par ce
contrôleur, non utilisées et hors des deux versions de récupération peuvent
être retirées. Aucun volume ou cache partagé n'est supprimé automatiquement.

## Première activation : étapes restant à autoriser

1. Examiner la PR et ses preuves CI, puis sélectionner le SHA exact du premier
   déploiement et le hash de politique (`release-client.mjs policy-hash`).
2. Donner l'autorisation explicite de ce premier déploiement. Avant cela,
   ne pas exécuter l'installateur avec `--apply` ni activer la production.
3. Créer une clé ED25519 dédiée, vérifier le SHA256 du paquet contrôleur et
   installer le paquet sur le VPS avec le projet existant et le SHA approuvé.
   `initialCommit=000…000` signifie explicitement que la révision de l'ancienne
   image n'est pas attestée. Seul `bootstrapApprovedCommit` pourra alors la
   remplacer, avec sauvegarde, test privé, refus de migration et rollback vers
   l'image réellement observée. Le contrôleur n'invente pas une révision Git.
4. Configurer la clé dédiée dans l'environnement GitHub `puzzoria-production`,
   limité à main. Renseigner la politique approuvée et la cible ; activer
   seulement alors `productionEnabled` et `PUZZORIA_AUTODEPLOY_ENABLED`.
5. Après le commit de configuration, l'opérateur enregistre dans l'état protégé
   `growth.productionBootstrapApproval` (SHA main exact, hash de politique,
   date d'autorisation) et un reçu initial `ownerApprovedBootstrap`, distinct
   d'une expérience produit, puis traite `deploy-pending`. L'approbation du SHA
   est externe au commit lui-même : aucun hash Git autoréférent n'est requis.
   Ce SHA doit aussi correspondre au `bootstrapApprovedCommit` installé sur le
   VPS. Le reçu réel du VPS détermine le
   succès ; une absence de confirmation n'est pas un déploiement réussi.

L'absence de moyen de paiement reste une déclaration du propriétaire. Le
budget GitHub à 0 € n'a pas été créé ni techniquement vérifié. Aucune API
payante, publicité, achat, autoscaling ou repli payant n'est ajouté. Si GitHub
ne peut plus allouer de VM dans le quota gratuit, la reprise dépend de GitHub.
