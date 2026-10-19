# Puzzoria — V1, modes illimités et comptes facultatifs

Déploiement : [préparation de publication](docs/PREPRODUCTION.fr.md), [Docker et sauvegardes](docs/DOCKER.fr.md). Mesure : [tableau interne actuel](docs/ANALYTICS.fr.md) et [vision des métriques produit](docs/ANALYTICS-PLAN.fr.md).

Plateforme de jeux quotidiens et illimités, mobile et desktop, sans compte obligatoire. Le projet existant reste entièrement dans `C:\GameAD`. Il fonctionne avec **Node.js 24.15+** et npm ; SQLite utilise le module intégré à Node, sans nouvelle dépendance npm.

Le [rapport de livraison et d'architecture](docs/RETENTION.md) détaille les comptes, la migration, l'illimité, les comparaisons, les classements et la préparation Ranked. Les trois moteurs initiaux sont conservés ; le catalogue comprend désormais dix jeux.

Les [améliorations des jeux existants](docs/ENGAGEMENT.fr.md) ajoutent les défis entre amis sans compte, les records et progrès en fin de partie, le favori et la reprise sur l'accueil, un calendrier personnel et des découvertes après résolution. Wordle garde un seul partage texte avec ses cases de couleur, à côté des statistiques, sans redirection vers un dictionnaire externe. Le partage d'image reste disponible dans les autres jeux. Tous les textes sont disponibles en français, anglais, espagnol et allemand.

Les [trois nouveaux jeux](docs/NEW-GAMES.fr.md) — 2048, démineur et mots mêlés — sont intégrés dans les quatre langues, avec sauvegarde, statistiques, partage et pages SEO. Le Démineur conserve le quotidien ; 2048 et Mots mêlés proposent uniquement l’Illimité.

Les [jeux sociaux et leur catalogue éditorial](docs/SOCIAL-GAMES.fr.md) — Classement à l'aveugle, Devine le nombre et Tu préfères — ajoutent les choix verrouillés, les réactions communautaires réelles, les cartes PNG et les duels privés entre deux appareils. Les boutons Jouer ont un contraste renforcé et restent alignés en bas des cartes.

Les écrans de fin placent Rejouer et Essayer un autre jeu avant les statistiques et la progression. Une défaite en Illimité affiche un message de fin neutre. Les durées estimées ont été retirées. Devine le nombre présente les deux joueurs côte à côte : chacun choisit son secret puis propose un nombre et reçoit +/− ou Trouvé. Un seul champ vide sert à jouer, sans suggestion ni plage calculée ; nouvelles parties et replay entre amis demandent un nouveau choix manuel. Les sauvegardes anciennes et leurs preuves restent conservées.

## Lancer localement

Avant `npm ci`, arrêter les serveurs de ce projet (`npm run dev` ou `npm start`) avec `Ctrl+C` dans leurs terminaux. Sous Windows, un serveur Next.js actif verrouille son module natif SWC : une réinstallation peut échouer avec `EPERM` et laisser les dépendances incomplètes. Une fois l’installation faite, les démarrages suivants nécessitent seulement `npm run dev`.

```powershell
cd C:\GameAD
npm ci
npm run dev
```

Ouvrir http://127.0.0.1:3000/fr. `/` choisit la langue via le cookie de préférence, puis `Accept-Language`, puis l’anglais. Les pages localisées restent directement accessibles aux robots.

Pour essayer sur un téléphone du même Wi-Fi : `npm run dev:lan`, puis ouvrir l'adresse IPv4 du PC sur le port 3000. Le [protocole mobile](docs/MOBILE-QA.md) détaille la configuration et les vérifications sur appareil. Les [idées et prochaines étapes](docs/ROADMAP.fr.md) sont conservées séparément des fonctions livrées.

Pour la production locale :

```powershell
npm run build
npm start
```

`npm start` sert le dernier build de `.next` : les modifications de source exigent un nouveau `npm run build` avant redémarrage. Pour travailler sur le code en direct, utiliser `npm run dev`. Les builds de validation dans `.next-validation` ne mettent pas à jour celui utilisé par `npm start`.

Avant une publication, copier `.env.example` en `.env.local`, configurer le domaine HTTPS (`NEXT_PUBLIC_SITE_URL`, `AUTH_ORIGIN`), le volume privé persistant (`DAILYGRID_DB_PATH`) et le proxy fiable si nécessaire (`TRUST_PROXY`), puis reconstruire. La base locale se crée automatiquement dans `.data/dailygrid.sqlite`. Aucun service de production n'a été publié. Un hébergement serverless à disque éphémère ne convient pas à cette configuration SQLite.

## Fonctionnalités livrées

- Mot quotidien : 5 lettres, 6 essais, saisie directement dans la grille au clavier physique ou tactile, case active soulignée et cases de la ligne en cours cliquables pour corriger une lettre. Aucun champ texte séparé. Les touches françaises sont les 26 lettres AZERTY ; les accents sont ramenés à leur lettre simple, `ß` compte comme une lettre et `Œ` devient `OE`. Retours correct/présent/absent avec gestion des lettres répétées.
- Français : 5 037 mots proposables (dont les conjugaisons, « adule » et « outil »), issus de Lexique 3.83, et 849 réponses possibles privilégiant les mots fréquents. Les réponses des défis antérieurs au 3 octobre 2026 restent inchangées ; les fichiers déjà programmés conservent leur priorité. [Sources, attribution et licence du dictionnaire](content/dictionaries/SOURCES.md).
- Anglais : 6 355 propositions / 1 219 réponses ; espagnol : 6 863 / 1 003 ; allemand : 4 123 / 590. Données Hunspell et wordfreq, filtrées et normalisées ; les nouveaux pools sont immédiats en Illimité et actifs le 4 octobre en Quotidien, sans changer les défis déjà publiés. [Sources et régénération](content/dictionaries/SOURCES.md).
- Sudoku quotidien facile/moyen/difficile : grilles distinctes, solution unique contrôlée, saisie tactile/physique, notes, annulation, affichage facultatif des conflits, chronomètre actif seulement dans un onglet visible, pause, validation serveur et victoire.
- Défi de calcul : six nombres, cible atteignable, saisie tactile ou texte, opérateurs et parenthèses, vérification sans `eval`, utilisation de chaque nombre selon son nombre d’occurrences, entiers intermédiaires strictement positifs, aperçu du résultat, score et solution de référence après validation finale.
- 2048 : classique Illimité depuis Jouer sur l’accueil, sans bouton quotidien. Les anciennes parties et URL datées des 3 et 4 octobre conservent leurs règles de score en 100 coups. Clavier, boutons, glissements, fusions uniques, score serveur, poursuite après 2048 et reprise.
- Démineur : trois niveaux, premier clic imposé et sûr, grilles vérifiées par résolution logique sans deviner, drapeaux tactiles/clic droit/clavier, mines cachées jusqu’à la fin et sauvegarde serveur.
- Mots mêlés : huit mots dans une grille 12 × 12, quatre thèmes et listes propres aux quatre langues, sélection par glissement/deux extrémités/clavier, huit directions, mots trouvés persistants et observations après partie.
- Anglais, français, espagnol, allemand : URLs et slugs localisés, sélecteur visible, cookie et préférence locale. Sudoku, calcul, 2048 et démineur partagent leurs défis entre langues ; Mot et mots mêlés utilisent des listes et défis propres à leur langue.
- Progression locale par défi : restauration après rechargement, statistiques par jeu et mode, historique des 30 derniers résultats, records de temps/score, essais moyens et succès calculés. La série quotidienne exclut l'illimité. Le compteur des trois jeux terminés aujourd'hui et ses indicateurs ont été retirés, sans objectif de terminer tous les jeux.
- Classement à l'aveugle : cinq éléments révélés successivement, places irréversibles, catégorie visible et cinq choix tirés dans des pools de vingt éléments (120 au total). Rejouer est placé en haut du résultat. Réactions fondées sur les votes réels et tableau des positions moyennes, avec le seuil de population habituel. Les journées publiées sont conservées.
- Devine le nombre : nombres secrets de 1 à 100, bot déterministe facile/moyen/difficile ou ami sur un autre appareil via lien/code privé. Tours, possibilités et éliminations vérifiés par le serveur ; records et historique personnel. Les duels privés expirent après sept jours et restent hors classement compétitif.
- Tu préfères : uniquement en Illimité, soixante questions au catalogue. L'Illimité enchaîne sans total ni arrêt à dix, reprend son compteur et permet un bilan des derniers choix à la demande. Vote obligatoire avant les résultats ; choix verrouillés, barres animées, majorité et rareté vérifiées.
- Quotidien uniquement pour Mot, Sudoku, Calcul et Démineur, avec objectif propre affiché sur la carte et la page. Les cinq autres jeux ouvrent une partie illimitée sur leur URL principale ; les anciens résultats sont conservés et les URL historiques restent accessibles.
- Illimité pour les dix jeux : reprise du défi actif, catégorie ou difficulté selon le jeu, Rejouer et statistiques séparées. Les dilemmes et classements utilisent une bibliothèque finie enrichissable en JSON ; des contenus peuvent revenir.
- Comptes facultatifs avec seulement pseudo unique et mot de passe à l'inscription. Le pseudo sert à la connexion et devient le nom public initial, modifiable ensuite. Sessions HttpOnly, sauvegarde serveur et reprise sur un autre appareil. La création et la connexion fusionnent les anciens résultats et brouillons invités sans les supprimer. Le stockage invité et celui de chaque compte sont séparés. Aucun email ni service externe n'est nécessaire ; un code de secours affiché une fois et téléchargeable permet de récupérer le compte sans email. Les comptes existants peuvent générer ce code depuis leur profil avec leur mot de passe actuel. Après récupération, le code est remplacé et toutes les anciennes sessions sont révoquées. Inscriptions limitées à 5/h et 20/j par IP fiable, et 3/h et 10/j par cookie d'appareil existant ; configurer `TRUST_PROXY` uniquement avec un proxy qui remplace l'en-tête d'adresse. Sans IP fiable, un plafond partagé de 30/h et 100/j s'applique.
- Invitation discrète à créer un compte après trois parties, au maximum une fois par semaine sur l'appareil, avec Plus tard et Ne plus me le proposer.
- Comparaisons après partie uniquement avec au moins 20 autres comptes/appareils admissibles ; temps et essais gagnants nécessitent 20 réussites. « Plus rapide que X % » exclut les égalités ; « X essais de moins que la moyenne » apparaît lorsque la différence est positive. Les données viennent des vrais résultats, sans population fictive.
- Classements des joueurs inscrits : défis quotidiens validés et chronométrés par le serveur, filtres par jeu/période/critère, langue du Mot/des mots mêlés et niveau Sudoku/démineur. Les données locales importées ne peuvent pas y entrer. Le taux de victoire exige 10 parties dans la période.
- Les indices sont désactivés : aucun bouton et l'API publique refuse une demande. L'abstraction reste disponible pour une future intégration publicitaire ; aucun SDK publicitaire ou vidéo récompensée.
- Archives : sélection des 31 derniers jours publiés, liens datés, difficulté Sudoku sélectionnable, sauvegardes distinctes. Début des jeux initiaux : 1 septembre 2026 ; nouveaux jeux : 3 octobre 2026.
- Partage Web Share API ou presse-papiers, avec copie manuelle de secours. Les résumés ne contiennent ni mot, ni grille, ni expression de solution. Le lien passe par `/play/{game}` et choisit la langue du destinataire avant d’ouvrir le défi daté et son niveau.
- Après chaque résultat, y compris une défaite : Rejouer, Essayer un autre jeu, Voir mes statistiques. Wordle regroupe le partage du résultat à côté des statistiques, avant les métriques et la progression.
- Emplacements publicitaires réservés, aucun script publicitaire ni collecte distante d’audience.

## Architecture et décisions

Next.js 16 App Router, React 19, TypeScript strict, CSS responsive et Lucide. Les pages utilisent le rendu serveur : contenus, liens et métadonnées existent dans le HTML avant JavaScript. Le serveur charge les défis directement via la couche de contenu ; les mêmes défis sont accessibles par l’API, sans requête HTTP interne inutile.

```text
src/lib/types.ts          Contrats de défi, résultat, langue et difficulté
src/lib/registry.ts       Catalogue partagé : nom, catégorie, règles, langues, couleur
src/lib/i18n.ts           Messages, slugs, négociation Accept-Language, chemins
src/lib/challenges.ts     Génération déterministe, contenu planifié, validation, projection publique
src/lib/word.ts           Normalisation des mots, dictionnaires, feedback des lettres
src/lib/word-normalization.ts Normalisation légère partagée, sans dictionnaire envoyé au navigateur
src/lib/sudoku.ts         Générateur, validateur et solveur à comptage de solutions
src/lib/math.ts           Générateur et analyseur syntaxique arithmétique sûr
src/lib/date.ts           Journée UTC, publication et dates d’archives
src/lib/stats.ts          Série, déduplication et jeux terminés aujourd’hui
src/lib/statistics.ts     Statistiques par jeu/mode, cohortes, distributions et succès
src/lib/server/           SQLite, comptes/sessions, runs, résultats, migration et classements
src/lib/play-client.ts    Début/soumission d'une partie serveur, reprise et indices
src/lib/browser-storage.ts Namespaces invité/compte, secours mémoire, événements de sync
src/lib/share.ts          Résumés sans spoiler et liens neutres en langue
src/lib/analytics.ts      Événements typés et adaptateur de mesure d’audience
src/components/storage.ts Sauvegarde, session, chronomètre et statistiques partagés
src/components/*-game.tsx Interfaces propres aux jeux, utilisant la session commune
src/components/game-common.tsx Validation API, partage, résultat et jeu suivant
src/proxy.ts             Redirection des entrées neutres, langue HTML des pages localisées
src/app/api/challenges/   GET public / POST exigeant une partie serveur possédée
src/app/api/play/         Réservation, début, validation, reprise et comparaison
src/app/api/account/      Inscription, connexion, profil, migration et snapshots privés
src/app/api/leaderboards/ Classements publics sans information d'identification privée
content/dictionaries/    Listes distinctes par langue
content/daily/            Fichiers programmés par date/langue/jeu/niveau
scripts/                 Génération, validation et lanceur E2E
tests/ et e2e/           Tests des moteurs et parcours utilisateurs
```

Un registre et des contrats discriminés évitent trois applications indépendantes. La session, le chronomètre, l’enregistrement d’un résultat, les statistiques, les archives, le partage, les liens et le cadre visuel sont communs. L’interface et les règles de chaque jeu constituent son adaptateur.

Les quatre langues ont des titres/descriptions localisés, canoniques cohérentes, alternatives `hreflang` réciproques avec `x-default`, liens HTML entre langues et images OpenGraph/X PNG 1200 × 630. Règles et conseils sont lisibles avant JavaScript ; le HTML du jeu contient ses données publiques, jamais ses solutions. Des données structurées décrivent le site, les jeux et le fil d'Ariane. Le sitemap propose les trois niveaux de Sudoku, démineur et bot Devine le nombre et leurs archives récentes sans alias `/easy`, jamais les graines des parties illimitées. Il contient 692 URLs uniques au 3 octobre 2026. Statistiques, comptes, classements, duels privés et Illimité restent en `noindex`, accessibles aux robots pour lire cette directive. Les origines locales/d'exemple restent aussi en noindex ; `npm run seo:check` exige le domaine HTTPS définitif avant publication. Voir [l'audit SEO et le lancement dans les quatre langues](docs/SEO.fr.md).

### Ajouter un autre jeu

1. Ajouter un contrat de défi et son identifiant à `types.ts`.
2. Ajouter les métadonnées au registre, les libellés et les slugs aux messages.
3. Ajouter son générateur/validateur et sa projection publique à la couche de contenu.
4. Ajouter son composant au dispatcher `GamePlayer` et le traitement POST de validation.
5. Définir son résumé dans `share.ts` et ses tests. Les pages génériques, les archives et la liste de jeux réutilisent le registre.

L'accueil utilise le registre pour présenter les jeux ; aucun objectif de terminer tous les jeux n'est affiché.

### Ajouter une cinquième langue

Ajouter son code à `locales`, ses messages (contrat `Messages` vérifié par TypeScript), ses noms/slugs, ses informations OpenGraph, le clavier approprié et son dictionnaire. Déclarer la langue dans les jeux du registre. La négociation, les fichiers de défis et les URLs utilisent ces configurations. Aucune traduction automatique du mot du jour n’est utilisée.

## Données quotidiennes et publication

```powershell
# Préparer les 30 prochains jours à partir d’une date
npm run content:generate -- 2026-10-01 30
npm run content:validate
npm run content:social
```

Les fichiers suivent le format `content/daily/YYYY-MM-DD/fr-word.json`, `fr-sudoku-hard.json`, `fr-math.json`. Un fichier programmé prime sur le générateur. Sans fichier, le serveur produit un défi déterministe à partir de la date et de la famille de jeu, et le mot utilise une graine et une liste propres à sa langue. Le contenu n’est jamais codé en dur dans l’interface. Les 60 défis d’exemple du 30 septembre au 2 octobre 2026 sont générés, validés et enregistrés.

L’API et les pages bloquent les dates futures, même si leurs fichiers sont déjà prêts. À minuit UTC elles deviennent accessibles sans intervention ni cron ; l’accueil se recharge à la nouvelle journée. Une partie ouverte conserve la date de son défi. Modifier les fichiers d’une journée déjà publiée peut invalider des sauvegardes : prévoir le contenu avant publication, conserver ensuite les fichiers et leurs IDs. Pour le Sudoku et les nombres, conserver le même contenu dans les quatre fichiers de langue.

```text
GET  /api/challenges/fr/word?date=2026-10-01
GET  /api/challenges/fr/sudoku?date=2026-10-01&difficulty=hard
POST /api/play  { "action": "new", "game": "word", "locale": "fr", "mode": "daily" }
POST /api/play  { "action": "start", "runId": "ID renvoyé par new" }
POST /api/play  { "action": "submit", "runId": "même ID", "guesses": ["AIMER"] }
POST /api/play  { "action": "new", "game": "sudoku", "locale": "fr", "mode": "practice", "difficulty": "hard" }
```

Le GET et le HTML n'exposent aucune réponse. Les soumissions de mots renvoient les feedbacks et ne révèlent le mot qu'à la victoire ou au sixième essai. Les soumissions Sudoku contrôlent les données initiales et toutes les contraintes ; le Calcul valide l'expression et renvoie la référence à la fin. `submit` conserve le résultat, utilise l'heure serveur et ignore score/durée/réussite proposés par le client. Les anciens POST `/api/challenges/{locale}/{game}` restent disponibles avec les paramètres date/niveau, mais exigent désormais le `runId` d'une partie commencée et possédée. Ils ne constituent plus un accès stateless aux solutions. Les jeux sociaux rejouent les actions verrouillées côté serveur ; `/api/community` exige le propriétaire du run et masque les questions non votées. `/api/number-rooms` gère les participants et tours privés. Le schéma SQLite reçoit une migration additive 4, détaillée dans le guide des jeux sociaux.

### Séries et scores

Une journée commune en UTC garantit des défis et séries cohérents entre appareils et langues, y compris lors des changements d’heure. Une série compte les jours où au moins un défi **du jour** est terminé, gagné ou perdu. Hier reste une série active tant que la journée actuelle n’est pas finie. Une archive terminée aujourd’hui ne compte pas. Un défi passé terminé après minuit ne compte pas rétroactivement. Jouer à un seul jeu suffit pour la série ; aucun compteur de jeux à terminer n'est affiché.

Mot : `(7 - essais) × 100` en cas de victoire. Sudoku : 1 000 points à la grille valide, avec durée enregistrée. Calcul : `max(0, 1000 - 20 × écart - 25 × max(0, opérations - 3))`. Le score Sudoku n’est pas un classement de performance ; les niveaux permettent d’adapter le jeu.

## Analytics

Aucun fournisseur n’est chargé par défaut. `track` émet un `CustomEvent('dailygrid:analytics')` local et appelle un adaptateur optionnel installé avec `setAnalyticsAdapter`. Brancher Plausible/PostHog à cet endroit plutôt que dans les moteurs. Les événements ne contiennent ni saisie du joueur, ni solution, ni nom/email/identifiant utilisateur. Un prestataire externe devra être configuré selon les exigences de consentement avant activation.

| Événement         | Champs utiles                                                             |
| ----------------- | ------------------------------------------------------------------------- |
| `game_view`       | `locale`, `game_id`, `challenge_id`, `date`                               |
| `game_start`      | `locale`, `game_id`, `challenge_id`                                       |
| `game_complete`   | mêmes champs, `mode`, `duration` affichée active, `success`, `score`      |
| `game_abandon`    | mêmes champs, `duration` ; navigation ou fermeture d’une partie commencée |
| `next_game_click` | `locale`, jeu suivant et identifiant du défi terminé                      |
| `share`           | `locale`, `game_id`, `challenge_id`, `method` (`native` / `clipboard`)    |
| `streak`          | `locale`, `streak`                                                        |
| `locale`          | nouvelle `locale`                                                         |

Les durées et abandons à la fermeture sont des signaux best effort. Un éventuel transport distant devra utiliser le mécanisme adapté aux fermetures d’onglets. Il n’y a aucune persistance serveur de ces événements dans cette V1.

Les nouveaux événements sont `practice_start`, `practice_complete`, `play_again`, `account_prompt_view`, `account_prompt_dismiss`, `account_prompt_never_show`, `signup_start`, `signup_complete`, `login`, `local_data_migrated`, `stats_view` et `leaderboard_view`. `mode` et un ID anonyme de session dans sessionStorage permettent de regrouper les parties et transitions. Les durées de résultat serveur et les durées actives d'interface sont deux mesures différentes. `ranked_queue`, `ranked_match_start` et `ranked_match_complete` sont réservés, sans émission actuelle. Voir le rapport pour les limites de mesure de rétention.

Un outil WebMCP facultatif `read_daily_progress` expose les statistiques locales sans les modifier, seulement si le navigateur prend en charge `document.modelContext`. Son contrat a été vérifié avec un contexte de test injecté ; la disponibilité native n’a pas été vérifiée sur un navigateur compatible. Son absence n’affecte aucun jeu.

## Vérifications

```powershell
npm run lint
npm run typecheck
npm test
npm run content:validate
npx playwright install chromium webkit
npm run test:e2e
npm run build
```

228 tests unitaires couvrent les dix jeux, comptes, récupération, stockage, confidentialité et SEO. Les contrôles vérifient la variété des pools, les journées historiques inchangées, le calcul des positions moyennes et la clôture facultative d’un bilan Illimité après des votes réels. Les contrôles du duel vérifient les signes pour les 10 000 couples secret/proposition, les bornes et propositions invalides, les stratégies du bot, le choix manuel du secret, les anciens coups immuables et les cohortes de comparaison séparées. Le résumé personnel inclut immédiatement le premier résultat vérifié, sans double comptage, et sépare langues, modes, niveaux et versions des règles du duel.

180 parcours E2E : 45 scénarios sur desktop Chromium, iPhone Chromium, Android et iPhone WebKit. Ils couvrent les anciens jeux et comptes, les quatre langues, sauvegardes, partages, SEO et communautés réelles dans une base de test isolée. Le parcours des modes contrôle cinq quotidiens et cinq pages principales illimitées, les objectifs traduits et les refus API. Le parcours continu passe douze dilemmes sans fin imposée, restaure le compteur, demande un bilan et continue. Les contrôles d’interface vérifient aussi une défaite Illimité, les actions avant les métriques, les deux joueurs côte à côte, la confidentialité des nombres et le duel à 320 px. Ces simulations ne remplacent pas Safari iOS sur appareil physique.

ESLint 10 utilise directement les plugins Next, React Hooks et TypeScript compatibles, sans dépendances de lint héritées. `lint` passe sans avertissement. Le fichier de verrouillage garantit les versions utilisées.

Validation du 4 octobre 2026 après le passage du duel au « plus ou moins » : lint, typecheck, build et 213 tests unitaires réussis ; 60 défis programmés, six listes historiques, six pools de vingt éléments et soixante dilemmes validés. La suite complète donne 158 parcours réussis et deux échecs WebKit liés à des actions pendant le chargement : défilement avant la grille interactive et navigation avant la réservation d’une nouvelle partie. Après correction des attentes des tests, les deux parcours passent deux fois chacun sur WebKit. Les trois parcours ciblés du duel passent aussi sur desktop, avec captures à 320 px. Les 27 traces de production ne contiennent aucun fichier privé de base de données ou de test. Le contrôle seo:check attend toujours le domaine HTTPS public.

Les ajustements Wordle et thème du classement sont ensuite vérifiés sur les quatre profils : 16 parcours Wordle/Calcul réussissent (partage texte réel via l'adaptateur natif simulé, invitation, résultat dans les quatre langues à 320 px, partage PNG du Calcul et replay après défaite). Les tests révèlent un choix de catégorie écrasé par la préférence sauvegardée avant la fin de l'initialisation ; le sélecteur reste désormais désactivé jusqu'à sa restauration. Après correction, les huit parcours de classement et dilemmes réussissent sur desktop, iPhone Chromium, Android et iPhone WebKit. Lint, 213 tests unitaires et validation des 60 défis passent également.

La reprise du duel et les écrans de résultat sont ensuite vérifiés par 40 parcours ciblés réussis sur les quatre profils. Ils couvrent les six jeux classiques, les invitations, le partage Wordle dans les quatre langues, les duels entre appareils, une proposition après avancement du run par un second client et une comparaison communautaire indisponible après un coup accepté. Les actions Rejouer / autre jeu / Défier un ami sont regroupées avant les statistiques des jeux compatibles ; le défi quotidien est explicite et les statistiques personnelles sont disponibles dès le premier résultat. Aucune statistique communautaire inventée n’est ajoutée. Après séparation des versions de règles dans l’historique personnel du duel, les quatre parcours bot passent de nouveau ; lint, typecheck, build, 217 tests unitaires et validation des 60 défis réussissent. Les 27 traces de production restent sans fichiers privés.

Exécuter le build après la fin de Playwright : TypeScript inclut aussi les types générés du serveur de test, qui peuvent être réécrits pendant une compilation simultanée. Un fichier généré en conflit a été régénéré avec `next typegen`, puis le build a réussi seul.

Dernier contrôle du 4 octobre : les 16 parcours ciblés Wordle/duels passent sur les quatre profils, dont un nouveau parcours qui reprend une partie héritée avec secret déjà choisi et envoie une proposition depuis l'interface réelle. Lint, typecheck, 217 tests unitaires et validation des 60 défis réussissent. Le build normal `.next`, encore daté du 3 octobre et dépourvu des actions `try`, a été reconstruit ; les règles `higher-lower` et ces actions y sont désormais présentes. Les 27 traces restent sans fichiers privés. Le numéro chronologique « Défi #… » est retiré de l'accueil et du titre des jeux. Le refus signalé sur la session de l'utilisateur n'a pas été directement reproduit : aucun serveur 3000 ni onglet de jeu accessible n'était actif pendant ce diagnostic.

Puis « Mot du jour » et la date sont placés juste au-dessus de la grille ; son encart UTC est retiré. Après une réussite sans comparaison disponible, un aperçu marqué « Données fictives » montre des exemples, sans les enregistrer, partager ou intégrer aux classements. Les vraies données remplacent l’aperçu dès qu’une comparaison admissible est disponible. Un parcours vérifie ce remplacement avec une réponse API contrôlée ; les votes communautaires réels dans la base E2E isolée restent également vérifiés. Les 32 parcours ciblés couvrent ces changements sur les quatre profils : 31 réussissent au premier passage, le parcours Wordle desktop expire pendant la navigation puis réussit seul sans modification. Les tests unitaires donnent d’abord 216 réussites et une expiration sur l’inscription, puis les 217 réussissent à la relance. Lint, validation des 60 défis, build normal et typecheck réussissent ; les 27 traces restent sans fichiers privés. L’idée Daily / Illimité / Mot insolite et la proposition d’accueil sont ajoutées à la feuille de route, sans créer un nouveau jeu ni réintroduire de compteur quotidien.

## Limitations et fonctions reportées

- Les quatre dictionnaires sont étendus. Des formes rares peuvent manquer ; les réponses communes sont sélectionnées automatiquement puis filtrées, et méritent une relecture éditoriale native dans chaque langue.
- Les nouveaux Sudokus illimités et quotidiens à partir du 4 octobre intègrent une sélection par techniques simples de résolution, en plus du nombre de cases et de l'unicité. Une sélection bornée à huit essais conserve parfois une grille dont le profil technique ne correspond pas exactement au niveau ; l'analyse de fin de partie décrit la grille réellement jouée. Ce n'est pas une classification exhaustive des techniques Sudoku.
- Références mathématiques variées, atteignables mais pas nécessairement optimales. Une recherche bornée propose après la fin une autre méthode validée, ou explique son absence. Wordle ne consulte plus le dictionnaire depuis l'écran de résultat. Le Mot insolite propose désormais un mot original, des essais adaptés et une fiche explicative du site après la fin. Son catalogue initial de 8 mots par langue reste à enrichir.
- La copie locale reste modifiable ; les classements utilisent exclusivement la base serveur. Les derniers brouillons synchronisés toutes les trois secondes peuvent manquer après une fermeture immédiate. Le résultat terminé est enregistré avant la réponse serveur. Le stockage bloqué utilise un secours en mémoire ; les limites de snapshots/migration sont détaillées dans le rapport.
- Validation des mots et fins de partie nécessitant le serveur ; pas de mode hors ligne/PWA.
- SQLite sur un volume persistant et une seule instance Node ; pas de stockage distribué, CDN ou tests de charge. Les limites de requêtes, propriétaires, validations et timestamps constituent une protection de base, pas une preuve contre les bots ou l'aide externe. Aucun service de production n'a été déployé.
- La récupération exige le code de secours conservé par le joueur ; perdre à la fois code et mot de passe empêche de récupérer le compte. Export et suppression du compte sont disponibles après vérification du mot de passe. Pas de récupération par email, MFA, publicité réelle, vidéo récompensée ou fournisseur analytics. Les duels privés Devine le nombre sont disponibles ; Ranked, matchmaking, MMR, saisons, défaite par déconnexion et récompenses restent reportés.

## Les cinq prochaines actions produit

1. Publier une première version HTTPS sur un hébergement Node avec stockage persistant et sauvegarde de la base.
2. Envoyer le lien à quelques personnes et recueillir leurs retours ; essayer aussi sur de vrais téléphones avec le [protocole mobile](docs/MOBILE-QA.md).
3. Mettre en place l’édition et la validation d’un calendrier de défis, ainsi qu’un classement de difficulté Sudoku et calcul plus précis.
4. Affiner la sélection des réponses dans les quatre langues à partir de retours ciblés de locuteurs, tout en conservant un dictionnaire de propositions large.
5. Exploiter le tableau interne de mesure pour observer les replays, conversions et retours, puis évaluer les emplacements publicitaires selon la rétention observée.

## Mot insolite et résultats visibles

Le [Mot insolite](/fr/mot-insolite) est une variante accessible dans Wordle, avec le Mot du jour et l’Illimité, dans les quatre langues. Le catalogue présente neuf jeux : Wordle regroupe les deux variantes. Le Mot insolite conserve son URL et ses résultats/séries distincts : mot identique pour tous dans chaque langue, 7–10 lettres, 8/10 essais. Sens, origine et exemple apparaissent après victoire ou défaite. Catalogue initial : 32 fiches (8 par langue), avec 68 999 / 44 235 / 93 752 / 93 226 propositions FR/EN/ES/DE. Les premières huit journées sont figées, et aucune ancienne réponse Wordle ne change. [Sources et règles de publication](content/rare-words/SOURCES.md).

Le résultat défile automatiquement à l’écran ; Rejouer, autre jeu et invitation restent en haut. Temps, essais et réponse occupent une même ligne. Les comparaisons précèdent la progression sur mobile ; sur grand écran, les deux cartes ont la même largeur et la même hauteur. L’historique et les succès détaillés se déplient à la demande. Les barres de réussites/échecs et réactions aux percentiles réels gardent les seuils serveur de 20 autres joueurs admissibles (20 victoires pour temps/essais). À défaut, l'aperçu affiche des tirets et un message court : la mention Exemple et les chiffres simulés sont supprimés. Les emplacements publicitaires sont retirés de l'accueil et des jeux dans les quatre langues ; les publicités restent reportées.

Validation des derniers ajustements : lint, typecheck, 232 tests unitaires, 92 fichiers de défis et compilation de production réussis. Les 72 parcours navigateur ciblés passent sur desktop Chromium, iPhone Chromium, Android Chromium et iPhone WebKit : une première sélection de 64, puis les huit vérifications de résultats/comparaisons Wordle, avec répétition des parcours concernés après correction du défilement. Ils couvrent les quatre langues, les canoniques et redirections Sudoku, la saisie sans contour superposé, les sauvegardes, les résultats, le retour à une nouvelle grille après Rejouer, ainsi que l'aperçu local sans résultat ou vote enregistré. La compilation utilise `.next-validation` pour préserver le serveur de prévisualisation sur 3000. Les anciennes réponses Wordle et Sudoku et les URL du Mot insolite restent conservées.

La compilation de production réussit. Les 28 traces d'application de production ne contiennent aucun fichier privé de base ou de test. Les fiches éditoriales restent dans les modules serveur ; le typecheck final est également réussi.

Les fiches approfondies du Mot insolite couvrent désormais les 32 mots des quatre langues, avec les sources affichées. « Découvrir toute son histoire » ouvre la fiche après la définition courte. Les articles deviennent publics au lendemain de la première journée de leur mot ; une partie serveur terminée autorise leur lecture avant cette date. Les articles futurs restent protégés et absents du sitemap. Voir [la publication et les sources](content/rare-words/SOURCES.md).

Le défilement des résultats et du retour à la grille partage une animation progressive de 500–950 ms, annulable par molette, toucher ou clavier, et immédiate avec la préférence de réduction des animations. Le partage ouvre le menu natif, puis essaie le presse-papiers si le navigateur refuse ce menu, puis affiche le texte sélectionnable si la copie est bloquée. Une annulation volontaire reste silencieuse et le bouton se désactive pendant une demande en cours. Le partage des aperçus locaux est désormais disponible avec une mention de test dans le texte partagé.

Validation de ces changements : lint, typecheck, 247 tests unitaires, 92 défis et 32 articles validés, compilation de production et 36 parcours navigateur ciblés réussis sur les quatre profils. Les parcours couvrent la copie après refus du partage natif, le texte sélectionné après refus du presse-papiers, l'annulation, le retour animé à une nouvelle grille et son interruption, les quatre langues, les fiches sans JavaScript avec le propriétaire autorisé, le refus de lecture sans partie terminée et les aperçus locaux. Une réservation temporaire de hauteur et la suspension de l'ancrage automatique empêchent le navigateur de sauter à la grille avant l'animation de Rejouer. Les 31 traces d'application de production ne contiennent aucun fichier privé de base ou de test. Le serveur temporaire de production confirme que l'outil de fin local et les aperçus des futurs articles restent désactivés. Le serveur utilisateur sur 3000 reste actif.

## Sudoku quotidien et aperçu de fin local

Le Sudoku quotidien présente une seule grille et un seul classement à son URL principale. Les trois difficultés restent disponibles en Illimité ; les anciennes grilles jusqu'au 4 octobre restent accessibles dans les archives. À compter du 5 octobre, les nouvelles publications et parties officielles utilisent uniquement l'ID interne `easy`. Les anciennes URLs principales moyen/difficile redirigent en 308 vers le quotidien unique.

Rejouer ramène la grille à l'écran après son chargement, en désactivant le défilement concurrent du lien Next.js. Le passage du quotidien à l'Illimité crée une nouvelle partie, même si une ancienne partie Illimité est sauvegardée.

En développement sur localhost/loopback, « Terminer en un clic (test local) » affiche la résolution du puzzle réellement ouvert et son écran de fin, avec des chiffres aléatoires. Il utilise les mêmes composants que la fin normale, conserve la grille et arrête son chrono local pendant l'aperçu. Les données restent en mémoire, sans modifier run, résultat, vote ou progression. « Retour à la grille » restitue la vraie partie ; Rejouer crée une nouvelle partie illimitée. Le partage fonctionne et identifie le texte comme aperçu local, sans événement de partage ou de replay simulé. En production, `GET /api/dev-preview` retourne 404 et aucun contrôle de test n'est livré. Les comparaisons publiques restent calculées sur les vrais résultats, avec 20 autres joueurs admissibles.

## Résultats cohérents — 5 octobre 2026

Les dix jeux et les duels entre amis utilisent le même panneau de fin : Rejouer/autre jeu/invitation en haut, Partager le résultat à côté de Statistiques, puis comparaisons et progression. Les deux boutons restent côte à côte sur petit écran. Les grilles, choix et nombres restent visibles ; la fin défile vers le résultat. Les anciens écrans sociaux séparés et leur second partage texte sont supprimés. Les cartes PNG sociales restent disponibles.

Chaque Rejouer d'un quotidien ou d'une archive ouvre une nouvelle partie illimitée, y compris lorsqu'une ancienne grille illimitée existe. Le Mot insolite propose un seul mot par jour : ses alias Illimité redirigent vers le quotidien et le serveur refuse toute nouvelle partie illimitée de cette variante depuis le 5 octobre. Les anciens runs restent lisibles. Son résultat propose le Wordle classique illimité, avec une nouvelle graine.

Les mots mêlés demandent de cliquer sur Commencer : grille masquée/grisée, cellules désactivées et chrono à zéro jusque-là, puis départ serveur vérifié et reprise après rechargement. Les statistiques suivent le jeu : temps moyen/meilleur temps pour Sudoku et mots mêlés, score pour 2048, essais pour Wordle, objectifs exacts pour Calcul, victoires/défaites pour Démineur et duel, choix communautaires pour classement et dilemmes. Aucun taux de réussite n'est affiché sur un jeu sans échec, ni record de vitesse sur un jeu d'opinion.

La confirmation de copie et le texte sélectionnable apparaissent près du partage, avant les métriques. Les deux joueurs restent visibles à la fin des duels, avec les nombres révélés uniquement après la fin vérifiée. Les jeux sociaux ne demandent plus l'encart de découverte des grilles ni une deuxième image d'invitation.

Validation : lint, typecheck, 250 tests unitaires, 92 défis et 32 articles validés, compilation de production réussis. Les 140 parcours navigateur ciblés distincts sont validés avec les relances des cas concernés : Chromium desktop/iPhone/Android et iPhone WebKit, quatre langues, vraies résolutions, actions communes, partage natif/copie/texte sélectionné, chrono des mots mêlés, duels entre deux contextes, Mot insolite quotidien, brouillon réel conservé dans l'aperçu et nouvelle graine après Rejouer même avec une ancienne partie illimitée. Les captures des résultats sociaux et du démineur ont été inspectées. Les 34 traces de production ne contiennent aucun fichier de base ou de test. Un serveur temporaire de production confirme les refus de l'outil de test, des futurs articles et de nouveaux runs illimités du Mot insolite, ainsi que sa redirection vers le quotidien. La compilation utilise `.next-validation` ; le serveur utilisateur sur 3000 reste actif et retourne 200. Rien n'a été déployé.

## Marque et mesure interne

[Puzzoria et ses logos SVG](docs/BRAND.fr.md) remplacent la marque publique dans les quatre langues. Les noms de stockage/cookies/volumes existants sont conservés. [Le tableau privé](docs/ANALYTICS.fr.md) mesure les parties vérifiées et, après accord, acquisition, visites, temps actif, replays, transitions, sessions multi-jeux, fréquence et retours J+1/J+7/J+30. Configurer `ANALYTICS_ADMIN_USERNAMES` avec un compte déjà créé pour y accéder ; aucun fournisseur publicitaire n’est installé.

Validation de la marque et de la mesure : 270 tests unitaires réussis ; 236 parcours navigateur distincts validés avec relances ciblées sur Chromium desktop/iPhone/Android et iPhone WebKit. La suite complète initiale avait 222 réussites sur 232 : les assertions de marque/présentation ont été mises à jour, les cas affectés par le rechargement de développement ont été rejoués, puis les huit parcours de mesure ont été validés. Ils vérifient notamment le consentement/refus, la collecte réelle après Commencer, son arrêt dans l’aperçu local et les quatre langues. Ces profils automatisés ne remplacent pas les essais sur de vrais appareils.

Compilation de production, lint et typecheck réussis. Le test Docker vérifie les quatre langues, les protections de production, une vraie fin de partie, la mesure privée, une sauvegarde SQLite valide et leur persistance après recréation du conteneur. Ses ressources isolées sont supprimées après le test ; la base utilisateur et le serveur sur 3000 restent intacts. Aucun déploiement public n’est effectué.

## Sécurité des comptes et préférences de cookies — 6 octobre 2026

Le profil permet de changer son mot de passe et de déconnecter tous ses appareils après vérification du mot de passe actuel. La migration 6 révoque aussi les connexions en cours lors d’une récupération ou révocation ; les sessions anciennes ne peuvent pas être recréées. Une liste locale bloque quelques mots de passe courants pour les nouveaux mots de passe, sans email ou MFA obligatoire pour les joueurs. Les limites par adresse précèdent les identités renouvelables des API et les compteurs expirés sont purgés.

Les pages utilisent une CSP avec nonce, des protections anti-framing et une configuration publique vérifiée. Le [guide de sécurité](docs/SECURITY.fr.md) et le [modèle Caddy](deploy/Caddyfile) décrivent la publication et les limites actuelles. Les paiements restent une fonctionnalité future, avec validation serveur des événements du prestataire et protections financières à ajouter lors de son intégration.

Les préférences de cookies se personnalisent depuis la bannière et restent accessibles dans le pied de page, dans les quatre langues. La mesure reste facultative ; aucune publicité n’est intégrée. Pour le Calcul, les résultats indiquent la distance et les opérations utilisées ; les taux personnels de cible exacte se distinguent explicitement des comparaisons avec les autres joueurs.

Validation : 281 tests unitaires réussis, 92 défis et 32 articles validés, compilation de production et test Docker réussis. Les 248 parcours navigateur distincts sont validés avec relance ciblée : la suite complète initiale donne 243 réussites, quatre récupérations bloquées par le quota consommé par le nouveau test d’inscription et une expiration pendant un changement de catégorie. Les tests isolent maintenant l’adresse de cette inscription et attendent la réservation serveur de la catégorie ; les 28 parcours regroupant sécurité, inscriptions, récupération, déconnexion, classement, dashboard et dilemmes passent ensuite sur les quatre profils. Les limites de l’application restent inchangées.

Le test Docker vérifie également le refus d’un script injecté dans le HTML par la CSP, le fonctionnement réel des scripts Next et du jeu, une sauvegarde valide et la persistance après recréation. Les 73 traces de production ne contiennent aucun fichier privé de base ou de test. Le modèle Caddy est validé dans un conteneur isolé, sans installation de service ni déploiement public. Les vérifications utilisent des bases temporaires ; aucune donnée utilisateur n’est remplacée. Les profils mobiles automatisés ne constituent pas un test sur appareils physiques.

## Statistiques par jeu — 6 octobre 2026

Les [statistiques de fin de partie](docs/GAME-STATS.fr.md) mettent en avant le résultat pertinent et un record personnel, avec détails dépliables. Le Calcul affiche cible/nombre/écart/temps et compare séparément vitesse des cibles exactes ou précision des approximations. Wordle propose un percentile d’essais et leur distribution, les grilles leur vitesse/médiane, 2048 score/tuile/déplacements, et le duel les propositions des deux côtés. Les jeux d’opinion conservent leurs agrégats de votes/classements, avec couverture explicite des questions et texte du dilemme le plus divisé.

Les nouveaux détails sont calculés par le serveur et conservés dans les métadonnées existantes ; les valeurs historiques manquantes restent inconnues. Le consentement de mesure facultative, les défis publiés, les sauvegardes, les actions communes et les règles de comparaison sont conservés.

Validation : lint, typecheck, 287 tests unitaires, 92 défis et 32 articles validés, build de production réussi. Les 44 parcours navigateur ciblés distincts passent avec relances sur desktop, iPhone Chromium, Android et iPhone WebKit : la première suite donne 36 réussites sur 40 et quatre assertions héritées sur l’espace du pourcentage ; la relance actualisée donne 16 réussites, dont quatre nouveaux parcours de Calcul approché avec rechargement. Les résultats, grilles, actions et replays des dix variantes sont vérifiés, ainsi que les quatre langues et les agrégats de vrais votes dans la base E2E isolée. Les captures desktop/mobile du Calcul ont été inspectées. Les 73 traces de production restent sans fichier privé de base ou de test. Aucun déploiement public n’est effectué.

## Préparation de la production — 6 octobre 2026

Le profil propose un export JSON et la suppression du compte après vérification du mot de passe ; la suppression exige aussi le pseudo. Les données associées et sessions sont retirées, les onglets ouverts abandonnent le compte, et la progression invitée reste séparée. Un journal privé permet de réappliquer les suppressions après restauration d'une ancienne sauvegarde. Les pseudonymes d'administrateurs configurés ne peuvent pas être repris par une nouvelle inscription.

Compose ajoute un service d'exploitation non-root : sauvegarde SQLite quotidienne, rotation à 14 jours, purge de la mesure expirée et surveillance de disponibilité, disque, sauvegardes et erreurs serveur. Le vérificateur de restauration travaille sur une copie jetable. Les modèles de copie chiffrée hors machine et de surveillance depuis un autre hôte restent à configurer avec les services réels. La confidentialité est complétée dans les quatre langues avec coordonnées serveur, export et suppression. `release:check` vérifie la configuration et `release:public` contrôle le site HTTPS après déploiement. Voir [le guide de publication](docs/PREPRODUCTION.fr.md).

Validation : lint, typecheck, 302 tests unitaires, 92 défis et 32 articles réussis. Les 264 parcours navigateur distincts sont validés avec relance : 258 réussites dans la suite complète, puis les six cas restants réussissent après correction du sélecteur de récupération et relance des parcours affectés par une ouverture trop rapide des préférences ou un rechargement du serveur de développement. Le parcours de préférences conserve désormais une demande d'ouverture arrivée avant le montage de son écouteur. Desktop, iPhone/Android Chromium et iPhone WebKit sont couverts ; les appareils physiques restent à vérifier.

La compilation et le smoke test Docker passent : scripts CSP opérationnels, quatre langues, sauvegarde intègre, redémarrage, export/suppression et restauration réappliquant l'effacement. La rafale locale isolée de 50 joueurs, dont 20 comptes, produit 25 requêtes d'authentification et 860 de jeu sans erreur ; le p95 des requêtes de jeu est de 351 ms. Ce résultat ne garantit pas la capacité du futur VPS. Les ressources de test sont supprimées et la base utilisateur reste inchangée. `release:check` refuse volontairement la configuration actuelle sans domaine, coordonnées, destination d'alerte et sauvegarde distante. Aucun déploiement ni service externe n'est activé.

## Rapport téléchargeable pour analyse — 7 octobre 2026

Le dashboard propose « Télécharger le rapport complet (JSON) », dans les quatre langues. Ce fichier versionné rassemble les agrégats officiels et de mesure facultative : acquisition, activation, temps par jeu, rétention, fréquence, transitions et qualité. Il précise période UTC, filtres, unités, dénominateurs et limites de collecte. Les valeurs inconnues restent `null`. Les deux CSV journaliers et le contrat JSON initial de l'API sont conservés. L'export est une pièce jointe privée, réservée aux comptes administrateurs, sans identités de joueurs ni secrets. Voir [comment envoyer un rapport pour analyse](docs/ANALYTICS.fr.md#envoyer-un-rapport-pour-analyse).

Validation : lint, typecheck, 304 tests unitaires, 92 défis et 32 articles validés ; compilation de production et smoke Docker réussis. Les quatre parcours de dashboard/export passent sur desktop, iPhone Chromium, Android et iPhone WebKit : bouton localisé, filtres conservés, téléchargement JSON et CSV. La base utilisateur reste inchangée ; aucun service externe n'est ajouté.

La vérification des traces a trouvé que l'instrumentation pouvait inclure le fichier SQLite local lors d'une compilation Windows. Le comptage d'erreurs utilise maintenant uniquement le chemin privé explicitement configuré en production (déjà fourni par Compose). `npm run build` refuse les traces contenant une base, un fichier d'environnement ou des données de test/runtime privées ; les 39 traces des compilations Windows et Linux corrigées passent. Les copies locales générées par les builds concernés ont été retirées, sans modifier la base source. Le test de surveillance vérifie aussi que les timestamps restent enregistrés avec la configuration de production.

## Profil simplifié — 7 octobre 2026

Le bouton de téléchargement des données personnelles et son formulaire ont été retirés du profil dans les quatre langues. La section restante permet de supprimer son compte après confirmation ; les textes de confidentialité décrivent cette interface. Les exports privés du tableau de bord administrateur restent disponibles.

Validation : lint, typecheck, 304 tests unitaires, 92 défis et 32 articles, compilation de production avec l'origine `https://puzzoria.com` et 39 traces privées vérifiées. Les huit parcours ciblés de compte/confidentialité passent sur desktop, iPhone Chromium, Android et iPhone WebKit, notamment refus d'un mauvais mot de passe, suppression, préservation de la progression invitée et déconnexion des autres onglets.

## Comparaisons de démarrage — 7 octobre 2026

Sur instruction explicite de l'éditeur, `COMMUNITY_STARTER_STATS=true` active des populations synthétiques de présentation sans mention supplémentaire dans les jeux, tant qu'une cohorte ne compte pas 20 autres comptes/appareils admissibles. Les distributions d'essais, temps, précision, scores, classements et votes sont stables au rechargement et adaptés au jeu. Les votes des dilemmes restent cachés avant le choix. Les données observées remplacent automatiquement la présentation au seuil ; aucune population n'est insérée dans SQLite, les classements ou les exports de gestion. Le bouton de fin local reste désactivé en production.

Validation : 309 tests unitaires, lint, typecheck, 92 défis et 32 articles. Les cinq nouveaux tests vérifient notamment le passage de 19 à 20 autres joueurs, la priorité des votes observés, les distributions cohérentes et l'absence d'écritures par les comparaisons. Les huit parcours navigateur de démarrage passent sur desktop, iPhone Chromium, Android et iPhone WebKit avec le réglage activé dans la base isolée : premier résultat, grille conservée, rechargement stable et résultats des dilemmes verrouillés avant le vote.

## Jouer avec un ami en direct — 7 octobre 2026

Le bouton d'invitation ouvre maintenant un salon privé avec deux joueurs, un départ commun, une nouvelle énigme identique, l'avancée en direct et une revanche acceptée par les deux personnes. Wordle, Sudoku, Calcul, 2048, Démineur, Mots mêlés et Devine le nombre ont chacun leur règle de victoire. Classement à l'aveugle et Tu préfères révèlent les deux choix à la fin, sans gagnant de vitesse. Le Mot insolite conserve son unique rendez-vous quotidien et propose un duel Wordle classique.

Les moteurs et validations serveur existants sont conservés. Les salons restent privés, noindex, hors classements et séries Daily ; les anciennes invitations restent lisibles. Les nombres sont choisis et proposés manuellement. Le résultat commun conserve le plateau, place la revanche en premier et le partage près des statistiques. Le dashboard ajoute les créations, arrivées, départs, fins et revanches avec les mêmes préférences de mesure. Voir [règles, sécurité et exploitation des salons](docs/DUELS.fr.md).

La migration 7 est additive. Une nouvelle image Docker doit passer les vérifications isolées des neuf jeux avant activation, avec sauvegarde préalable de la base et conservation de l'image précédente. Les tests unitaires et navigateur couvrent notamment les deux propriétaires, secrets, départ commun, preuves, critères de victoire, reprise, revanche, effacement et affichage mobile. Les profils automatisés restent distincts d'essais sur appareils physiques.
