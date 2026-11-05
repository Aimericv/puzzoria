# Statistiques adaptées aux jeux

Les fins de partie conservent le panneau commun : actions de jeu, partage près des statistiques, résultat principal, puis comparaison et record personnel côte à côte. Les statistiques détaillées s’ouvrent à la demande. Les grilles et les choix restent visibles ; le défilement et les replays sont conservés.

| Jeu | Résultat principal et comparaison | Progression personnelle |
| --- | --- | --- |
| Wordle et Mot insolite | Essais, temps et mot révélé ; percentile du nombre d’essais parmi les réussites, distribution des essais et réussites/échecs | Meilleur nombre d’essais ; série du quotidien ; moyennes et historique en détail |
| Sudoku | Temps, percentile de vitesse et médiane des résolutions | Meilleur temps dans le même mode/niveau |
| Le Compte | Cible, nombre obtenu, écart et temps ; vitesse parmi les cibles exactes si réussite, précision si résultat approché | Meilleur temps pour une cible exacte ; plus petit écart et écart moyen en détail |
| Démineur | Issue et temps ; vitesse des réussites et répartition des issues | Meilleur temps au même niveau, taux personnel en détail |
| 2048 | Score, plus grande tuile et déplacements ; percentile du score | Record de score et plus grande tuile ; pas de comparaison de vitesse |
| Mots mêlés | Temps et mots trouvés ; percentile et médiane des grilles terminées | Meilleur temps ; pas de taux de victoire |
| Devine le nombre | Issue, propositions du joueur et du bot ; comparaison du nombre de propositions pour gagner | Meilleur nombre de propositions au même niveau/règles, victoires/défaites et série ; pas de record de vitesse |
| Classement à l’aveugle | Classement, fréquences des positions et positions communes ; classement moyen et classement complet le plus fréquent accessibles | Parties terminées et historique ; pas de victoire ou vitesse |
| Tu préfères | Votes, répartition A/B et choix majoritaires/rares ; couverture explicite des questions disposant d’agrégats | Parties et choix enregistrés ; pas de victoire ou vitesse |
| Quiz chrono | Réponses/total, moyenne du même sujet et proportion de sans-faute. Un sans-faute met en avant le temps et son percentile parmi les autres sans-faute, pas « plus de réponses ». Un résultat incomplet peut comparer son score, sans percentile de vitesse. | Meilleur score et meilleur temps pour un sans-faute du même sujet/version/langue ; moyenne et nombre de sans-faute en détail. Aucun record de temps mélangeant les sujets. |
| Devine le footballeur | Essais, temps, joueur trouvé/non trouvé et distribution des essais. Vitesse parmi les réussites avec le **même nombre d’essais**, séparée du percentile des essais. | Meilleur nombre d’essais, historique, victoires et temps personnel ; Daily et Practice gardent leurs cohortes distinctes. |
| Carte d’Europe | Pays bien placés/44, erreurs confirmées, pays à revoir et temps. Un passage ne compte pas comme erreur de placement, mais reste à revoir. Moyenne des placements et part de cartes sans faute ; vitesse seulement entre sans-faute compatibles. | Meilleur score et temps sans faute de `europe-map` v1 dans la même langue, séparés des quiz textuels et autres sujets. |

## Données et compatibilité

Pour le Quiz, « 87 % avec moins de réponses » peut être mathématiquement correct après un sans-faute : les 13 % restants sont ex æquo. Cette formulation est désormais réservée aux résultats incomplets. Les temps utilisent au moins 20 autres sans-faute admissibles. Pour le Football, les 20 réussites doivent également avoir le même nombre d’essais pour un percentile ou temps médian de vitesse. Les égalités de score/temps/essais ne sont jamais comptées comme dépassées. Une valeur absente d’un ancien résultat reste inconnue. La moyenne de réponses exige 20 résultats avec compte et total connus et compatibles.

Les comparaisons de présentation de démarrage et l’aperçu local utilisent ces mêmes calculs, sans population persistée. L’aperçu de fin Quiz/Football réutilise le générateur de comparaison au lieu d’inventer des métriques indépendantes de son résultat. Le chrono d’un sans-faute et son record personnel ne mélangent jamais quiz partiels et parfaits, thèmes, versions, langues ni modes.

Tout futur jeu/format doit prévoir avant livraison sa métrique principale, une éventuelle métrique de vitesse, les dénominateurs, les cas d’égalité, d’échec ou résultat incomplet, les seuils et les records compatibles. Vérifier ces états dans les quatre langues et sur mobile ; le seul affichage d’un percentile générique ne constitue pas une validation des statistiques.

Les nouveaux détails de résultat sont calculés après validation de la preuve par le serveur et conservés dans les métadonnées existantes, sans migration ni modification des défis publiés. La réponse propriétaire et l’historique du compte les reprennent. Le navigateur ne fournit pas de preuve de score, d’écart, de tuile ou de nombre de propositions. Les anciens résultats sans ces détails restent inconnus pour la métrique concernée ; aucune distance n’est déduite d’un ancien score. Le résultat d’une ancienne partie peut encore afficher les données de sa grille propriétaire conservée.

Les cohortes existantes restent séparées par mode, langue et paramètres compatibles. Le classement utilise les mêmes cinq éléments ; les votes utilisent la même question ; les duels séparent les niveaux et versions de règles. Chaque autre compte/appareil ne contribue qu’une fois. Le seuil est de 20 autres résultats admissibles et 20 réussites pour les temps, essais et leur distribution. La précision exige 20 distances connues ; les distances inconnues ne comptent pas pour ce seuil. Les égalités ne comptent jamais comme une performance dépassée. Le temps médian utilise les résolutions réussies, pauses incluses.

La mesure facultative de navigation conserve son consentement. Ces changements exploitent les résultats nécessaires aux jeux ; ils n’ajoutent aucun suivi navigateur ni fournisseur publicitaire. Les chiffres de l’outil local restent uniquement des fixtures de présentation, jamais persistées ni actives en production.
