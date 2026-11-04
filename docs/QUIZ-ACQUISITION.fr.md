# Acquisition par les quiz — première sélection, 3 novembre 2026

Suite visuelle préparée après intégration de la PR #43 : [carte interactive des
44 pays d’Europe](MAP-QUIZ.fr.md). Elle ajoute quatre pages de sujet au catalogue
(25 sujets / 100 pages au total). Les chiffres ci-dessous décrivent la sélection
textuelle initiale et ne sont pas réécrits comme résultats du pilote. Le rapport
inclut les quatre nouvelles routes automatiquement ; mesurer leur acquisition à
partir de leur publication effective, sans attribuer de croissance avant observation.

Suite autorisée après l’analyse concurrentielle : [pages thématiques, maillage éditorial et premiers enrichissements](QUIZ-THEMES.fr.md). Le rapport ajoute les URL thématiques sans changer les 96 lignes de sujets ni les définitions de nouveaux joueurs.

## Décision et limites des données

Livrer **16 nouveaux quiz jouables**, soit **64 pages localisées** EN/FR/ES/DE, plutôt qu'une série de pages sans jeu. Le catalogue passe de huit à vingt-quatre sujets. Les 635 nouvelles réponses sont vérifiées séparément de leurs variantes linguistiques et restent privées côté serveur.

Cette sélection est une expérience éditoriale fondée sur des signaux observés, **pas un classement par volumes mensuels Google**. Aucun volume mensuel, score de difficulté SEO ou résultat de croissance n'a été inventé.

- **Search Console** : la dernière observation du superviseur, collectée le 3 novembre à 14:13 UTC, confirme une source Google disponible. Sa synthèse privée montre une audience trop faible pour choisir des sujets de quiz. L'observation et les agrégats privés restent hors Git. Le relevé des requêtes/pages de cette collecte n'est pas accessible depuis cette session ; ne pas le présenter comme analysé. Les jeux Quiz/Football sont récents, donc l'absence de signal ne démontre ni panne ni absence de demande.
- **Google Trends** : comparaison tentée en France sur douze mois pour « quiz pays », « quiz football », « quiz culture générale » et « quiz drapeaux ». L'interface est inaccessible par l'outil web ; l'endpoint public a répondu **429** le 3 novembre à 15:23 UTC. Aucun indice relatif ni tendance chiffrée n'est déduit de cet échec.
- **Keyword Planner** : accès arrêté à la connexion Google Ads. Pas d'ouverture de compte, d'achat ou de campagne. Même disponible, sa colonne « concurrence » mesure les annonceurs, pas la difficulté organique ([documentation Google](https://support.google.com/google-ads/answer/3022575)).
- **Recherche web** : requêtes françaises, anglaises, espagnoles et allemandes sur les pays, capitales, États américains, Länder, football et culture générale. Les résultats accessibles font apparaître JetPunk, Sporcle/Seterra, GeoTrivia, GeoMemory, des sites éducatifs et des spécialistes du football. Les pages directes de résultats Google et Chrome n'ont pas pu être consultées : **aucune position Google précise n'est revendiquée**. Les appréciations de concurrence ci-dessous sont qualitatives.
- **Concurrents** : leurs compteurs de parties sont des indices d'intérêt pour un jeu, **pas des recherches Google, des utilisateurs uniques ou une prévision pour Puzzoria**. Les listes anglaise, française, espagnole et allemande ont été examinées, ainsi que des formats de quiz football.

## Signaux publics utilisés

Le [catalogue anglais JetPunk](https://www.jetpunk.com/tags/all) met notamment en avant les pays du monde, les États américains, les capitales et les drapeaux. Ses compteurs cumulés observés atteignent plusieurs millions de parties pour ces familles. La [liste française](https://www.jetpunk.com/fr/all) confirme l'intérêt pour les pays par continent, les États américains et les régions françaises ; elle comporte aussi les clubs vainqueurs de la C1. La [liste espagnole](https://www.jetpunk.com/es/all) retrouve les mêmes familles, tandis que la [liste allemande](https://www.jetpunk.com/de/all) donne une place aux Länder et à l'Allgemeinwissen. Cela soutient un catalogue traduit et réellement adapté aux quatre marchés, sans supposer une demande égale entre eux.

Les [quiz de football de FourFourTwo](https://www.fourfourtwo.com/quiz/quickfire-quiz-233) réutilisent notamment clubs, identités visuelles et nationalités. Le [quiz de clubs de DoQuiz](https://www.doquiz.fr/sport/football/football-club-quiz/) couvre stades et surnoms. Ces formats correspondent au moteur Puzzoria existant : réponses libres, chrono, progression, résultat partageable et duel.

## Sélection et priorité d'observation

« P1 » désigne une première piste de longue traîne à observer, pas une garantie de classement rapide. « P2 » désigne les sujets de catalogue plus larges. La concurrence porte sur la force et la variété des sites observés, sans mesure payante de difficulté.

| Sujet / ID | Requête FR visée | Variantes EN · ES · DE | Concurrence estimée / intérêt du format | Priorité |
| --- | --- | --- | --- | --- |
| `eu-members` | quiz pays Union européenne | EU countries quiz · países Unión Europea quiz · EU Mitgliedstaaten Quiz | Moyenne à forte ; exercice précis sur les 27 membres | P1 |
| `german-states` | quiz Länder allemands | German states quiz · estados Alemania quiz · Bundesländer Quiz | Forte en DE ; intention locale claire, noms et translittérations acceptés | P1 |
| `french-regions` | quiz régions de France | regions of France quiz · regiones Francia quiz · Regionen Frankreichs Quiz | Forte en FR ; liste complète avec outre-mer | P1 |
| `us-state-capitals` | quiz capitales États américains | US state capitals quiz · capitales estados Unidos quiz · US Hauptstädte Quiz | Forte ; complément naturel des États, pas de carte annoncée | P1 |
| `football-stadiums` | quiz stades football clubs | football stadium quiz · estadios fútbol quiz · Fußballstadien Quiz | Moyenne à forte ; indices précis, associations historiques explicites | P1 |
| `football-national-teams` | quiz sélections légendes football | football legends national teams quiz · selecciones leyendas fútbol · Fußballlegenden Nationalteams Quiz | Moyenne à forte ; distingue sélection, naissance et clubs | P1 |
| `countries-south-america` | quiz pays Amérique du Sud | South America countries quiz · países Sudamérica quiz · Länder Südamerikas Quiz | Forte ; partie courte et liste complète de douze pays | P1 |
| `countries-oceania` | quiz pays Océanie | Oceania countries quiz · países Oceanía quiz · Länder Ozeaniens Quiz | Forte ; quatorze réponses, objectif court clairement défini | P1 |
| `countries-north-america` | quiz pays Amérique du Nord | North America countries quiz · países Norteamérica quiz · Länder Nordamerikas Quiz | Forte ; inclut explicitement Amérique centrale et Caraïbes | P1 |
| `countries-africa` | quiz 54 pays Afrique | Africa countries quiz · países África quiz · Länder Afrikas Quiz | Forte ; demande de famille observée dans plusieurs langues | P2 |
| `countries-asia` | quiz pays Asie | Asia countries quiz · países Asia quiz · Länder Asiens Quiz | Forte ; convention continentale explicitée | P2 |
| `countries-europe` | quiz pays Europe | Europe countries quiz · países Europa quiz · Länder Europas Quiz | Très forte ; complète les capitales existantes, relie le groupe Europe | P2 |
| `us-states` | quiz 50 États américains | 50 US states quiz · 50 estados EE. UU. quiz · 50 US Bundesstaaten Quiz | Très forte ; signal international solide, objectif sans carte honnête | P2 |
| `countries-world` | quiz 195 pays du monde | countries of the world quiz · países del mundo quiz · Länder der Welt Quiz | Très forte ; page phare à construire à terme, pas un pari de rang immédiat | P2 |
| `champions-league-winners` | quiz clubs vainqueurs Ligue champions | Champions League winners quiz · campeones Champions quiz · Champions League Sieger Quiz | Forte ; 24 clubs, borne 1956–2026 explicite | P2 |
| `general-knowledge` | quiz culture générale 20 questions | general knowledge 20 questions · cultura general 20 preguntas · Allgemeinwissen 20 Fragen | Très forte ; premier format transversal à tester, sans franchise protégée | P2 |

Les capitales mondiales exhaustives, questions d'actualité, transferts et statistiques courantes sont différés : il faut vérifier leurs cas particuliers et dater les réponses. Les requêtes « carte », « logos » ou « QCM » ne sont pas ciblées lorsque le quiz n'offre pas ce format. Pas de copie de questions concurrentes, de pages par mot-clé artificiellement déclinées ou de nouvelles URL aléatoires indexables.

## Intégration et qualité

- Pages stables `/{locale}/quiz/{slug-traduit}`, jeu accessible sur chaque page, titre/description propres, H1, règle de périmètre, canonique, hreflang réciproque et x-default anglais. Les 64 pages rejoignent le sitemap existant ; Practice et identifiants aléatoires gardent leur politique de non-indexation.
- Catalogue groupé par catégorie, liens vers des sujets associés et retour vers tous les quiz. Les liens existent sans JavaScript. Les anciens sujets, URL, réponses et cohortes restent intacts.
- Réponses dans `src/lib/server/data/quiz-expansion.v1.json`, importées par le module privé existant. Sources et conventions dans [QUIZ-EXPANSION-SOURCES.md](../content/QUIZ-EXPANSION-SOURCES.md). Le snapshot v1 est gelé par empreinte ; une future révision doit utiliser une version/cohorte distincte.
- Chrono, propriété du run, séquences, validation intégrale des preuves, partage, sauvegarde, Replay et duels réutilisent les mécanismes existants. La taille maximale d'un quiz passe de 100 à **200**, sans changer la limite de 600 secondes ni les 500 réponses tentées. Le dictionnaire de correspondances est construit une fois par rejeu ; l'ordre du premier alias et le traitement des doublons sont conservés, y compris pour les anciennes sauvegardes.
- Pas de migration, de nouveau service, de publicité, de changement de consentement, d'authentification ou de paiement.

## Mesurer après la publication

Le tableau administrateur et l'export JSON comportent `report.product.quizTopics`, par sujet et langue : départs, comptes/appareils observés, premiers joueurs observés sur le site, fins des départs de la période, taux de fin, score moyen, temps médian, sessions d'entrée et entrées Google mesurées. `measuredGoogleNewPlayers` exige en plus un événement **serveur** `run_started` rattaché à la session consentie entrée depuis Google sur ce même quiz. Ce n'est pas une déduction à partir d'un clic navigateur. Les duels sont exclus de ces cohortes solo. Administrateurs, identifiants et réponses privées ne sont pas exportés.

Les routes de sujets reconnues sont conservées par la mesure facultative. Les paramètres, routes inconnues et liens privés restent éliminés. L'historique auparavant regroupé sous `/quiz` ne permet pas de réattribuer les anciennes visites. Refus, DNT et GPC restent respectés. Les comptes/appareils ne sont pas des personnes uniques.

Pour joindre les relevés privés déjà collectés par le superviseur, sans nouvelle permission Google :

```bash
node --import tsx scripts/report-quiz-acquisition.ts --google /opt/puzzoria-pilot/readonly/search-console.json --analytics /opt/puzzoria-pilot/readonly/puzzoria-analytics.json
```

Le rapport `puzzoria.quiz-acquisition` ne contient que les pages de quiz et leurs agrégats. Il distingue le fuseau Pacific de Search Console et UTC de Puzzoria, et ne calcule pas un faux taux clics → joueurs entre ces deux sources. Une page absente du top 100 Search Console reste **null**, pas zéro et pas « non indexée ». Utiliser un export de pages plus complet si cette limite masque des sujets ; ne pas modifier les accès ou le superviseur pour contourner sa politique.

1. **À la livraison** : conserver la date, les 64 URL, le commit et les relevés privés disponibles. Les nouveaux sujets n'ont pas encore de résultat de croissance mesuré.
2. **Après 7 jours complets** : observer découverte des URL, premières impressions/clics par page/langue et nouveaux départs. Vérifier les erreurs d'accès ; ne pas réécrire tout le catalogue à partir de quelques impressions.
3. **Après 28 jours complets** : comparer deux fenêtres finalisées de même durée, par page/langue, puis les groupes de sujets. Suivre impressions, clics, position, premiers joueurs, fins, reprises et temps. Les métriques de visites restent un échantillon consenti.
4. **Décisions** : une page avec au moins 100 impressions et peu de clics mérite une vérification de l'intention et du titre ; une page avec au moins 20 départs permet un premier examen du taux de fin et de la difficulté. Ces seuils sont des règles de tri, pas des tests de significativité ni des preuves causales. Faible échantillon = prolonger l'observation. Enrichir d'abord les familles qui acquièrent et activent réellement ; arrêter les séries sans signal utile avant d'en publier des centaines.

Le suivi futur exploite l'agent et les exports existants. Cette livraison ne prétend pas avoir déjà généré des nouveaux utilisateurs ni obtenu des positions Google, et ne crée pas une nouvelle automatisation payante ou un nouveau droit de déploiement.
