# Quiz chrono et Devine le footballeur

Les identifiants `quiz` et `football` étendent le catalogue existant. Les deux jeux sont illimités, sans Daily ni archives artificielles. Leurs alias `/practice` gardent le noindex habituel. Ils réutilisent les identités invité/compte, les runs, la synchronisation, les résultats, les événements de mesure existants, le partage texte et `CompletionPanel`. Aucun nouveau schéma de base, consentement, paiement ou service externe n'est ajouté.

## Contenus et acquisition

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
