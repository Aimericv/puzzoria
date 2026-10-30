# Quiz de capitales : décision de faisabilité

Évaluation locale du 30 octobre 2026, source exportée `debb36f663cf027e91425d98420dd62467e54175`. Contribution de recherche ; aucun jeu ajouté ni déployé. Décision : poursuivre par un prototype isolé des réponses multilingues, avant toute intégration au catalogue. La référence JetPunk vient de la mémoire héritée ; l’inbox actuelle est vide et aucun site concurrent n’a été consulté pendant cette session.

## Pourquoi explorer ce format

Le catalogue couvre logique, vocabulaire et opinions ; la connaissance géographique serait une proposition distincte. Cette complémentarité est une hypothèse produit, pas une demande observée. Le format proposé est « cinq pays, cinq capitales à saisir », court, sans compte à rebours, avec possibilité de passer et correction à la fin. Les noms proposés dans les quatre langues sont : Five capitals / Cinq capitales / Cinco capitales / Fünf Hauptstädte. Ce sont des noms de travail.

La liste mondiale chronométrée est écartée à ce stade : elle demande un périmètre géopolitique, de nombreux alias, une saisie mobile longue et un traitement serveur de l’expiration. Un quiz de cinq questions permet d’évaluer la qualité des réponses sans introduire ces exigences. La carte, les drapeaux et les ressources externes ne sont pas nécessaires au premier prototype. Aucun avantage concurrentiel sur JetPunk n’est établi ; le pari spécifique est une courte session multilingue dans Puzzoria.

## Observations consultées et limites

- `growth-context.json`, collecte 2026-10-30T22:17:35.527Z, observation `34c4d14de9674960020c41efbcf1327529ca4d924411964ab2b335d544f9af76` : `lastFailure` et `unverifiedWork` null. Word et vocabulaire déployés ensemble le 27 octobre, évaluations `waiting_complete_windows`. Sudoku `proposed`, masquage Mots mêlés `manual_review`. Ne pas confondre ces états avec un déploiement du quiz.
- `puzzoria-analytics.json`, `available`, collecte 2026-10-30T22:17:30.570Z : période 1–30 octobre UTC, jour courant partiel, six identités compte/appareil, vingt départs et dix-huit fins ; trois sessions et deux visiteurs mesurés avec consentement. D+7 : six matures, zéro retour ; D+30 : zéro mature, taux null. Ces agrégats ne localisent pas une demande de géographie et ne décrivent pas des personnes uniques.
- `search-console.json`, `available`, collecte 2026-10-30T22:17:32.259Z : période demandée 30 septembre–29 octobre, dernière date rapportée 28 octobre, données finales America/Los_Angeles ; 179 impressions et six clics. Aucune ligne des requêtes fournies ne mentionne explicitement un quiz de pays ou capitales. Ces premières lignes sont incomplètes : ce constat ne prouve pas une absence de recherche. Aucune jointure page/requête disponible.
- `trends.json`, collecte 2026-10-30T22:17:34.857Z : dix entrées RSS Google dans chacun des quatre pays FR/US/DE/ES, principalement actualités et sport. Des noms de lieux dans l’actualité ne constituent pas un signal de demande de quiz. TikTok Creative Center `unavailable` : aucune conclusion sur sa popularité.

## Ce que le code permet réellement de réutiliser

| Source locale lue | Réutilisation possible | Travail supplémentaire |
| --- | --- | --- |
| `src/lib/social-data.ts`, `content/social/catalog.v1.json`, `content/social/ranking-pools.v2.json` | Cinq noms de pays historiques et vingt dans le pool courant, labels EN/FR/ES/DE | Ce sont des destinations pour un classement d’opinion ; aucune capitale ni alias. Les emojis sont décoratifs, pas un référentiel de drapeaux. Préserver ces données publiées. |
| `src/lib/types.ts`, `src/lib/registry.ts` | Conventions de défi privé/public, catalogue et localisation | Nouveau type explicite ; ne pas détourner `ranking`, `guess` ou `word`. Les catégories de classement ne sont pas un mécanisme générique de quiz. |
| `src/lib/challenges.ts` | Génération déterministe, validation, projection publique | Générateur et validateur propres ; conserver les réponses et alias hors de `PublicChallenge`. Aucun ajout aux défis Daily existants. |
| `src/lib/server/play.ts` | `createRun`, `beginRun`, `ownedRun`, `submitRun`, `validateProof` : propriétaire, début serveur, résultat final et retransmission | Nouveau rejeu de preuve et progression monotone ; les branches actuelles énumèrent leurs jeux et ne prennent pas automatiquement un nouveau moteur. Revue propriétaire requise avant modification des preuves. |
| `src/lib/server/database.ts` | Runs et résultats stockent déjà le défi/progrès JSON et le jeu sous forme de texte | Pas de migration rendue nécessaire par ces seules colonnes, mais ce n’est pas une preuve de compatibilité de tous les lecteurs de résultats, exports et statistiques. |
| `src/lib/game-modes.ts` | Séparation Daily / Practice / archives | Rester Practice uniquement ; aucune nouvelle date d’archive ni série Daily. |
| `docs/RETENTION.md` | Résultat vérifié, isolation propriétaire, progression et fin communes | Réutiliser `CompletionPanel` lors d’une intégration ; aucune collecte supplémentaire pour ce prototype. |

Le moteur Word normalise et vérifie un dictionnaire de mots : il ne traite ni les noms composés ni une table d’alias par question. Le réutiliser en changeant le dictionnaire déformerait ses règles et ses cohortes. La possession du run et le rejeu des actions restent les abstractions à reprendre.

## Proposition vérifiable pour le prototype isolé

Aucune route, API, inscription au catalogue ou persistance de résultat dans cette étape. Préparer un petit module pur et ses tests, avec des fixtures explicitement synthétiques pour tester le mécanisme. Constituer séparément un corpus factuel seulement si une source autorisée et sa licence peuvent être établies ; aucun téléchargement dans cette session. Une fixture n’est pas une donnée éditoriale publiable.

Contrat proposé pour une future entrée factuelle : identifiant stable du pays, labels du pays et de la capitale dans les quatre langues, alias explicites par langue, référence de source, licence et date de vérification. Un identifiant stable de version du corpus doit accompagner tout défi. Les cas à plusieurs capitales, siège de gouvernement distinct et territoires contestés restent hors du premier corpus ; leur exclusion doit être annoncée dans sa documentation, sans prétendre couvrir tous les pays.

Règles proposées :

1. Cinq pays distincts par run. Une réponse est validée sur envoi explicite, jamais à chaque touche. Un refus de réponse ne consomme pas la question ; passer la termine sans point. La correction reste cachée jusqu’à la fin.
2. Ignorer casse, espaces externes et espaces consécutifs ; traiter les accents et les variantes de ponctuation selon une politique testée. Ne pas supprimer tous les caractères non ASCII. Les exonymes et variantes comme une translittération sont des alias explicites, sans recherche floue ni distance orthographique implicite.
3. Un point par capitale reconnue, score de zéro à cinq, avec résultat partiel possible. Terminer signifie avoir répondu ou passé les cinq questions ; ne pas fabriquer un taux de victoire ou classer la vitesse d’un quiz sans limite de temps.
4. Une réponse compte une seule fois, même si deux alias sont envoyés. Le client ne fournit jamais l’identifiant de réponse acceptée, le score, la réussite ou la durée faisant autorité.
5. La future graine est générée au serveur et reste privée. Les prompts publics contiennent uniquement les pays sélectionnés et le nombre de questions. Garder les réponses dans un module serveur séparé, absent du graphe d’import client ; une projection publique ne suffit pas à elle seule à protéger un corpus importé par le navigateur.
6. Le futur journal distingue répondre et passer, avec question attendue et séquence. Le serveur refuse saut d’index, réécriture d’une réponse déjà acceptée, actions après fin et branches d’actions divergentes. La reconnexion retrouve le run propriétaire ; une nouvelle partie obtient une nouvelle graine.

Matrice d’acceptation du prochain prototype :

| Cas | Résultat attendu |
| --- | --- |
| Casse, espaces, accents, apostrophe droite/courbe, trait d’union | Cas nommés testés selon la politique choisie, sans suracceptation silencieuse |
| Nom non latin et caractères de contrôle | Préservation du nom ; contrôles refusés |
| Exonyme d’une autre langue | Accepté uniquement si alias de cette langue déclaré |
| Deux alias se normalisant de façon identique dans des entrées distinctes | Collision détectée au chargement du corpus concerné |
| Alias vide, label manquant dans une langue, identifiant dupliqué | Corpus rejeté |
| Entrée trop longue ou non textuelle | Refus borné, sans traitement coûteux |
| Réponse correcte répétée, réponse à un autre pays, passage | Aucun point supplémentaire ; progression définie explicitement |
| Score ou durée arbitraire dans une soumission future | Ignorés ou refusés, recalcul serveur obligatoire |

Les tests de possession, démarrage et retransmission de l’application existante ne prouvent pas ces propriétés pour un jeu qui n’existe pas encore. Ils établissent seulement l’état actuel des abstractions envisagées.

## Mesure et décision suivante

Identifiant de recherche : `five-capitals-feasibility`. Objectif acquisition ; métrique exploratoire `playing.starts`, fenêtres de quatorze journées UTC complètes, au moins vingt départs dans chacune, amélioration relative visée 0,2. Baseline et dates restent calculées par le superviseur. La recherche documentaire n’a aucun effet direct attendu sur cette métrique. Si aucun produit n’est déployé, aucun test de croissance du quiz n’a eu lieu. Un éventuel lancement aura son propre identifiant et ses critères fixés avant publication.

Les vingt départs du rapport courant comprennent un jour partiel : ils ne sont pas une baseline de quatorze jours ni la preuve que le seuil de chaque fenêtre sera atteint. Des départs globaux ne permettent pas une attribution au quiz ; les filtres existants par jeu pourront compléter le diagnostic après intégration, sans nouveau tracking. Avec trop peu d’échantillons, conclure « insuffisant », sans abaisser rétrospectivement le seuil.

Poursuivre maintenant par les règles de normalisation et le contrôle de corpus hors application. Passer à une proposition d’intégration seulement après tests des cas ci-dessus, corpus multilingue sourcé et revu, et revue propriétaire des preuves serveur. Abandonner ce format si un corpus fiable ou une politique d’alias compréhensible ne peut être obtenu ; ne pas élargir automatiquement à d’autres thèmes. Les expériences SEO déjà déployées gardent leurs critères et leurs fenêtres.
