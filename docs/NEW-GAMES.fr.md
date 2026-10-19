# 2048, démineur et mots mêlés

Les trois jeux rejoignent la plateforme existante en français, anglais, espagnol et allemand. Ils réutilisent comptes facultatifs, favoris, reprise, sessions, statistiques, partage et invitations privées. Mot, Sudoku et Calcul et leurs défis publiés sont conservés.

## Règles

- **2048** : grille 4 × 4, fusion unique par tuile et déplacement, score calculé à partir des fusions, flèches, boutons et glissement. Seul le classique Illimité est proposé. Les anciens défis datés des 3 et 4 octobre partagent départ et suite de tuiles entre langues et s'arrêtent à 100 déplacements qui modifient réellement la grille. L'objectif est le score, sans exiger une tuile 2048. Atteindre la limite valide le défi ; un blocage antérieur termine la partie. En Illimité, l'objectif classique est 2048 ; on peut continuer après cette tuile ou terminer pour enregistrer le score. Records et comparaisons portent sur les points.
- **Démineur** : facile 9 × 9 / 10 mines, moyen 12 × 12 / 24 mines, difficile 16 × 16 / 50 mines. La première case est imposée et ses huit voisins sont sûrs. Le générateur ne conserve que les grilles qu'un solveur termine à partir des chiffres visibles, du comptage des voisins et des différences entre contraintes incluses, sans deviner. Révéler toutes les cases sûres valide une victoire ; les drapeaux seuls ne suffisent pas. Clic droit, mode Drapeau tactile et clavier sont disponibles. Les grandes grilles défilent dans le cadre.
- **Mots mêlés** : grille 12 × 12 et huit mots, sélection par glissement, deux extrémités ou clavier, huit directions et lecture inversée. Quatre thèmes sont disponibles en Illimité : animaux, nature, cuisine, espace. Chaque langue possède 32 mots sélectionnés, avec placements et remplissage variables. L'Illimité choisit thème et grille avec une nouvelle graine serveur. Accents retirés, trémas allemands écrits AE/OE/UE. Une occurrence valide du mot est acceptée même si le remplissage en crée une deuxième.

Après la partie, la découverte présente des observations calculées sur le puzzle joué : plus grande tuile/score, nombre de cases sûres/zéros, ou mot le plus long/placements diagonaux. Elle est traduite et accompagnée d'un conseil. Aucun article automatique ni publicité n'est ajouté.

Les mots mêlés démarrent désormais avec un bouton Commencer : la grille est masquée et grisée, les cellules sont désactivées et le chrono reste à zéro avant le clic. Le serveur confirme le départ ; recharger reprend la partie déjà démarrée. Son résultat conserve la grille et compare les temps, sans taux de réussite ni score artificiel de 1 000 points. Démineur conserve ses victoires/défaites et 2048 compare ses scores, sans percentile de vitesse. Les trois jeux réutilisent le panneau de fin commun et placent Partager le résultat à côté de Statistiques.

## Validation et sauvegarde

Chaque coup porte un numéro de séquence. Le serveur rejoue le préfixe accepté avec le moteur correspondant ; une retransmission du dernier coup est idempotente. Réécrire un ancien coup, sauter des séquences, continuer après la fin ou proposer un faux score ne change pas le résultat. Une réponse perdue est suivie d'une restauration du run avant de continuer.

La projection publique omet la graine des prochaines tuiles, les mines et les placements. Les mines ne deviennent visibles pour le propriétaire qu'après la fin. Les invitations recopient le puzzle privé, y compris le budget quotidien de 2048 et le départ du démineur, et restent hors classement officiel. Changer la langue d'une invitation ne traduit pas sa liste de mots.

État actif et résultat terminé sont restaurés depuis le run, même sans brouillon local. La trace des coups reste côté serveur ; les snapshots ne la dupliquent pas. Ces mouvements nécessitent une connexion. La V1 reste un serveur Node/SQLite unique, sans test de charge ; les traces acceptent au maximum 10 000 actions pour borner le coût de validation. Cela ne prouve pas l'absence d'aide externe ou de bots.

Le démineur sépare ses niveaux dans les résultats et classements ; les mots mêlés séparent les langues. Les comparaisons de 2048 mesurent les scores strictement inférieurs avec au moins 20 autres comptes/appareils admissibles. Explorateur reste acquis après trois jeux différents, même après une quatrième victoire dans un autre jeu.

## SEO

| Jeu        | FR               | EN                | ES                   | DE                |
| ---------- | ---------------- | ----------------- | -------------------- | ----------------- |
| 2048       | `/fr/2048`       | `/en/2048`        | `/es/2048`           | `/de/2048`        |
| Démineur   | `/fr/demineur`   | `/en/minesweeper` | `/es/buscaminas`     | `/de/minesweeper` |
| Mots mêlés | `/fr/mots-meles` | `/en/word-search` | `/es/sopa-de-letras` | `/de/wortsuche`   |

Titres et descriptions propres, aperçu HTML du quotidien ou exemple de grille pendant le chargement de l’Illimité, trois sections de règles/conseils traduites, canoniques, hreflang réciproques, x-default anglais, données structurées et cartes sociales. Le démineur facile utilise la page sans suffixe comme canonique ; moyen et difficile sont distincts.

Les archives des nouveaux jeux commencent le **3 octobre 2026**. Les dates antérieures sont absentes du sitemap et de l'archive ; routes et API renvoient 404. Le sitemap compte **672 adresses uniques** à cette date. Les pages principales 2048 et Mots mêlés sont des pages de jeu indexables avec Illimité ; les alias `/practice` et invitations restent en noindex. Le domaine définitif n'étant pas choisi, les origines locales restent en noindex et `seo:check` exige encore le domaine HTTPS avant publication.

## Vérification

Les tests dédiés couvrent fusions, conservation de masse avant apparition d'une tuile, blocage, déterminisme, départs sûrs et résolution logique sur plusieurs graines/niveaux, mots présents, sélection inversée et bornes, séquences/retransmissions, faux scores, restauration, propriété et copie entre amis. Les parcours navigateur couvrent les six jeux et les quatre langues sur les profils existants, les contrôles clavier/tactiles, les glissements, la reprise et le HTML SEO sans JavaScript. Les totaux de la dernière exécution figurent dans le README.

Le 4 octobre 2026, 2048 et Mots mêlés passent à l’Illimité uniquement depuis leur page principale. Le quotidien est retiré de l’accueil, des pages et des sélecteurs. Aucun nouveau run quotidien ni archive datée après le 4 octobre n’est accepté pour ces jeux ; les URL et résultats déjà publiés restent conservés. Démineur conserve Quotidien et Illimité, avec un objectif clair de temps.
