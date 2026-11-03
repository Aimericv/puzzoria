# Quiz chrono et Devine le footballeur

Les identifiants `quiz` et `football` étendent le catalogue existant. Le quiz est uniquement illimité. Sur demande de l'éditeur du 3 novembre 2026, le football propose aussi un **Footballeur du jour**, plus difficile, depuis ses URL principales. L'illimité reste sur `/practice`, avec les vingt joueurs initiaux et les sauvegardes existantes. Ces URL `/practice` gardent le noindex habituel. Les jeux réutilisent les identités invité/compte, les runs, la synchronisation, les résultats, les événements de mesure existants, le partage texte et `CompletionPanel`. Aucun nouveau schéma de base, consentement, paiement ou service externe n'est ajouté.

## Footballeur du jour — 3 novembre 2026

Une sélection privée distincte de seize joueurs retraités moins évidents fournit une carrière commune aux quatre langues. Six essais, début explicite, un seul run/résultat officiel par propriétaire et date UTC : changer de langue ou recharger reprend la même partie. Le joueur et les clubs changent à 00:00 UTC ; l'interface affiche le mode, la difficulté éditoriale et le prochain renouvellement au-dessus du jeu. Une partie terminée reste consultable ; Rejouer ouvre une nouvelle partie illimitée. Les duels restent des parties Practice de la banque initiale.

`src/lib/server/football-daily-content.ts` garde la sélection initiale gelée et une liste de collections avec date d'effet. Pour enrichir le quotidien, ajouter une nouvelle collection datée dans le futur ; ne pas modifier l'ordre, les réponses ou les clubs d'une collection déjà publiée. Chaque cycle est mélangé de façon déterministe, sans répétition avant épuisement des seize joueurs et sans doublon entre deux cycles. L'identifiant `football:DATE:universal` déduplique les langues. Les archives commencent le 3 novembre 2026 ; les anciennes dates restent indisponibles. Les séries, comparaisons et classements quotidiens utilisent le circuit serveur existant et excluent l'illimité, les duels et les fins tardives. Le classement de performance tient compte du nombre d'essais. La cohorte Daily difficile est distincte de `football:retired-v1`.

Les pages principales restent canoniques, indexables et réciproques dans les quatre langues ; leur présentation SEO décrit les deux modes. Le partage du quotidien contient la date et ouvre sa carrière d'archive stable, sans dévoiler le nom. Le partage illimité ouvre `/practice`. Aucun identifiant aléatoire ne crée d'URL indexable.

## Contenus et acquisition

Depuis le 3 novembre 2026, seize sujets supplémentaires portent le catalogue à **24 quiz**, avec **64 nouvelles pages traduites** et 635 nouvelles réponses. Ils couvrent pays et continents, UE, États américains et capitales, Länder, régions françaises, culture générale et trois formats football. L'étude, les limites d'accès aux outils de mots-clés et le protocole de mesure sont dans [QUIZ-ACQUISITION.fr.md](QUIZ-ACQUISITION.fr.md). Les huit sujets initiaux ci-dessous restent inchangés. La limite de contenu est désormais 200 réponses, avec un délai maximal conservé de 600 secondes.

Huit quiz (107 réponses) : capitales européennes, drapeaux, planètes, éléments chimiques, vainqueurs du Mondial masculin 1930–2022, pays des monuments, auteurs et mythologie grecque. Le catalogue public contient seulement les titres, descriptions, délais et nombres de réponses. Les réponses, variantes et vingt parcours de joueurs retraités restent dans le module serveur privé. Voir [les sources et conventions éditoriales](../content/KNOWLEDGE-SOURCES.md).

Chaque quiz a quatre URL stables, une description spécifique, une canonique, des liens hreflang réciproques et une entrée dans le sitemap. Les graines et identifiants des runs ne créent pas d'URL indexables. Les pages de base et les cartes du catalogue donnent un accès direct au jeu. Les changements de langue conservent le thème du quiz.

## Validation et temps

Le joueur appuie explicitement sur Commencer. Le serveur enregistre l'heure de départ. Un quiz dure de 60 à 120 secondes selon le thème ; l'interface se recale sur l'heure serveur, et un rechargement ne réinitialise pas le délai. Les réponses arrivent une à une avec leur numéro de séquence. `submitRun` conserve le préfixe accepté, refuse les réécritures et clôture une partie expirée sans accepter la réponse tardive. Les réponses se révèlent seulement au propriétaire à la fin. Une retransmission identique est idempotente.

Le quiz accepte les réponses dans n'importe quel ordre, avec validation sur Entrée ou reconnaissance automatique après une courte pause. Les doublons ne rapportent rien. Le score serveur est la proportion trouvée sur 1 000 ; un succès signifie un sans-faute. On affiche principalement réponses trouvées/total et pourcentage, sans taux de victoire trompeur. Au football, les clubs apparaissent par leur blason local avec leurs années et prêts. Un bouton permet d’afficher les noms ; ils restent accessibles et remplacent une image absente ou en erreur. Les sources du parcours restent repliées après la révélation. Six essais, pas de limite de temps en solo, doublon refusé et abandon possible sans faux essai ajouté.

## Statistiques

Les résultats conservent les réponses trouvées/total, le score, les essais football, la durée et une clé de cohorte dans les métadonnées existantes. Les statistiques personnelles séparent thème/version/langue des quiz. Les comparaisons de quiz portent sur le score, celles du football sur la résolution et les essais. Les comparaisons observées exigent 20 autres comptes/appareils compatibles ; les jeux trop rapides et les duels restent exclus. Le réglage de présentation existant `COMMUNITY_STARTER_STATS=true` fournit des comparaisons stables tant que le seuil n’est pas atteint, adaptées au score du quiz ou aux essais du football. Elles ne sont jamais insérées dans les résultats, votes, classements ou mesures et sont remplacées par les cohortes observées. Les métriques de visite, temps actif, acquisition et retour réutilisent la mesure facultative existante.

## Duels

Le bouton Défier un ami crée une salle simultanée privée : même quiz ou même carrière, deux joueurs, décompte commun et aucun indice sur les réponses adverses. Le quiz départage au score, puis au temps ; le football au nombre d'essais, puis au temps. Le délai du quiz est celui du thème ; le duel football est limité à dix minutes. Les résultats restent Practice et ne touchent aucun classement Daily. Revanche et délai de reconnexion réutilisent les salles existantes.

## Validation

`tests/knowledge.test.ts` couvre traductions, résolution intégrale des quiz, variantes, protection des réponses, autorisation du propriétaire, séquences, rejeu idempotent, refus des réponses tardives, reprise, statistiques et duels. `e2e/knowledge.spec.ts` joue les deux jeux dans les quatre langues, recharge une partie, vérifie la révélation, le partage sans spoiler, la reprise et les dimensions de page ; il capture les écrans de résultat.
