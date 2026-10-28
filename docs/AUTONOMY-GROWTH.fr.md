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
4. Configurer la clé dédiée dans les secrets du dépôt. Elle est injectée
   uniquement dans le job de production, après les contrôles de main, de politique
   et de reçu approuvé ; elle n'est jamais transmise aux sessions du modèle.
   Les environnements privés GitHub peuvent exiger une offre payante et ne sont
   donc pas une condition de cette installation. Renseigner la politique
   approuvée et la cible ; activer
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

## Installation initiale depuis Windows

`deploy/setup-release-from-windows.ps1` ne fait rien sans `-Apply`. Après la
seule autorisation initiale, il vérifie le reçu d'approbation protégé, le SHA256
du paquet validé et l'empreinte SSH confirmée, réutilise uniquement la connexion
administrative locale pour installer le contrôleur, et crée une autre clé
ED25519 pour les publications ordinaires. La clé administrative ne quitte pas
le PC. La clé privée distincte est transmise à `gh secret set` par son entrée
standard ; le VPS reçoit uniquement sa clé publique. Le fichier Compose et les
volumes existants sont conservés. Le script vérifie la présence de `.env.docker`
ou `.env` sans afficher leur contenu. L'installateur refuse un contrôleur déjà
installé ; une mise à niveau demande une revue distincte.

La lecture de la clé publique hôte réutilise `ssh`, la clé administrative locale
et le fichier `known_hosts` déjà approuvé, avec `StrictHostKeyChecking=yes` et
sans mot de passe ni authentification interactive. L'empreinte ED25519 est
ensuite comparée à celle confirmée indépendamment par le propriétaire. Cette
lecture ne modifie pas le serveur et ne dépend plus de `ssh-keyscan`, dont la
négociation peut échouer sous Windows alors que `ssh` fonctionne. Une connexion
administrative vérifiée doit donc avoir déjà été établie depuis ce PC.

Les contrôles du runner installent les dépendances applicatives verrouillées
avant les tests Node qui importent TypeScript. Cette installation utilise
`--ignore-scripts` et précède toute exposition des identifiants Plus.

Le reçu du VPS est enregistré avant les comparaisons GitHub d'attribution et
le commentaire de rapport. Une panne réseau de ces opérations facultatives
ne remet donc pas en attente une publication déjà confirmée. Si l'écriture
primaire échoue, l'état précédent est restauré avant de programmer la reprise
bornée ; aucun statut « deployed » sans commit confirmé n'est conservé.

Après la première publication, une maintenance du superviseur reste une
opération humaine distincte : PR exacte revue, bundle et paquet contrôlés,
clé administrative locale et liste fermée de fichiers non applicatifs. Le
script root `release-reviewed-maintenance.mjs` exige un journal sain, les quatre
modules hôtes inchangés et un arbre identique à la source validée. Il conserve
le vrai commit précédent et réutilise la transaction existante de construction,
sauvegarde restaurable, prévisualisation, schéma, santé publique et rollback.
La nouvelle politique n'est activée qu'après réussite ; le compte SSH restreint
n'obtient aucune commande ni aucun droit supplémentaire. La configuration est
sauvegardée et remplacée atomiquement. Les mises à jour de mémoire Windows
utilisent un JSON compact et un contrôle de concurrence ; aucune troncature.

Un lancement manuel `deploy-pending` ignore volontairement les sessions Codex.
Le job de production utilise donc `always()` avec résultat réussi et sortie
`allowed` du verrou ; les ancêtres ignorés ne doivent pas faire sauter une
publication autorisée. Un verrou échoué ou refusé n'autorise aucune publication.

`-RefreshBootstrapPolicy` est réservé à la préparation initiale : le journal
hôte doit encore être sain sur le commit inconnu initial, sans publication ni
transaction, les quatre modules installés doivent être identiques au paquet,
et l'image et le schéma existants doivent être observables. Sous le même verrou
hôte, seuls l'empreinte de politique et le SHA initial approuvé peuvent être
actualisés, avec copie privée et écriture atomique de la configuration. Aucun
code hôte, service, volume ou journal n'est remplacé. GitHub conserve l'état
`awaiting_policy_refresh` jusqu'à la vérification de l'accès restreint ; une
confirmation avec contrôle de concurrence le rend ensuite admissible. Toute
mise à niveau après une publication reste hors de cette procédure.

Cette installation unique requiert les commandes gratuites GitHub CLI (`gh`,
connecté au compte propriétaire), OpenSSH et tar sur Windows. `-Activate` est
une option séparée ; elle demande le premier `deploy-pending` seulement après
installation et enregistrement des secrets. Le SHA approuvé reste protégé des
nouvelles fusions applicatives jusqu'à son reçu réel. Une absence de reçu
conserve le même SHA pour une reprise idempotente, au plus tôt six heures plus
tard et au maximum trois échecs avant intervention. Un rollback confirmé n'est
pas un succès ; ses données courantes restent conservées.


## Transport SSH réservé au contrôleur

Le port administratif 22 conserve sa règle Hetzner limitée à l'IP du
propriétaire. Les IP variables des runners GitHub ne doivent pas être ajoutées
à cet accès administratif. Le contrôleur utilise un autre serveur OpenSSH,
`puzzoria-release-sshd.service`, sur **TCP 2222 en IPv4**. Ce serveur n'inclut
pas la configuration SSH administrative : seul `puzzoria-release` est accepté,
avec une clé publique, une commande forcée et aucun mot de passe, terminal,
tunnel, transfert d'agent ou script utilisateur. Root y est interdit, même avec
une clé valide. Le compte ne rejoint pas le groupe Docker. Le pare-feu peut
admettre Any IPv4 sur ce port dédié ; cette règle n'expose pas le port 22.

`check` est la seule opération de lecture ajoutée à la commande forcée. Elle
renvoie l'image et le schéma observés et l'état privé du contrôleur, sans
contenu de base ni secret. L'installateur Windows la vérifie sur 2222 avec la
clé dédiée et l'empreinte hôte approuvée **avant** toute activation GitHub.
La publication initiale conserve ses vérifications de sauvegarde restaurable,
image privée, schéma et site public. Les sources applicatives n'ont pas changé.

Si le chemin administratif 22 reste filtré avant le VPS, le paramètre
`-AdminSshPort 2223` permet une installation par un accès temporaire **limité à
l'IP du propriétaire dans Hetzner**, avec la même clé administrative locale.
Ce paramètre n'ouvre aucun port, n'installe aucun serveur SSH administratif et
n'accepte aucun autre numéro de port. Un éventuel accès initial alternatif
est démarré manuellement dans la console Hetzner comme unité transitoire, avec
clé uniquement et durée maximale de vingt minutes ; sa règle Hetzner est
retirée après installation. La production ordinaire utilise uniquement 2222.
Ne pas rendre l'accès root accessible à Any IPv4 pour contourner un filtrage.

La validation de transport utilise un vrai serveur SSH sur loopback dans un
runner jetable : authentification de la clé dédiée, refus de root avec cette
même clé autorisée, refus des commandes arbitraires et des tunnels, acceptation
des seuls `check` et `release` bornés. Elle ne contacte pas le VPS. Les fichiers
du contrôleur de sauvegarde/rollback restent identiques aux deux fixtures
Docker déjà validées ; aucun nouvel effet de production n'est revendiqué.

Le banc SSH réutilise le compte non privilégié du runner jetable avec un fichier
de clés temporaire distinct, au lieu de créer un compte système. La fixture
substitue uniquement ce nom de compte, le port loopback et les chemins privés
de test dans la configuration de production ; la règle `AllowUsers` originale
reste vérifiée avant substitution. Aucun fichier de clés existant n'est écrasé.
