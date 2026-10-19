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

## Données et compatibilité

Les nouveaux détails de résultat sont calculés après validation de la preuve par le serveur et conservés dans les métadonnées existantes, sans migration ni modification des défis publiés. La réponse propriétaire et l’historique du compte les reprennent. Le navigateur ne fournit pas de preuve de score, d’écart, de tuile ou de nombre de propositions. Les anciens résultats sans ces détails restent inconnus pour la métrique concernée ; aucune distance n’est déduite d’un ancien score. Le résultat d’une ancienne partie peut encore afficher les données de sa grille propriétaire conservée.

Les cohortes existantes restent séparées par mode, langue et paramètres compatibles. Le classement utilise les mêmes cinq éléments ; les votes utilisent la même question ; les duels séparent les niveaux et versions de règles. Chaque autre compte/appareil ne contribue qu’une fois. Le seuil est de 20 autres résultats admissibles et 20 réussites pour les temps, essais et leur distribution. La précision exige 20 distances connues ; les distances inconnues ne comptent pas pour ce seuil. Les égalités ne comptent jamais comme une performance dépassée. Le temps médian utilise les résolutions réussies, pauses incluses.

La mesure facultative de navigation conserve son consentement. Ces changements exploitent les résultats nécessaires aux jeux ; ils n’ajoutent aucun suivi navigateur ni fournisseur publicitaire. Les chiffres de l’outil local restent uniquement des fixtures de présentation, jamais persistées ni actives en production.
