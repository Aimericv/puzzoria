# Drapeaux difficiles : décision de faisabilité

Revue locale du 8 novembre 2026, sur la base exportée ab06fe8278192404da9a065c22f53419de6bb39e. Aucun téléchargement ni vérification de source distante pendant cette revue.

## Décision

Ne pas publier un sujet « difficile » en réutilisant simplement les quinze drapeaux du pilote. Le jeu existant reste inchangé. La difficulté ci-dessous est une hypothèse pédagogique, pas une difficulté mesurée auprès des joueurs. La reprise demande un corpus distinct et une provenance vérifiable ; elle ne justifie pas de renommer le pilote ni de changer sa cohorte v1.

## Inventaire réellement disponible

Les quinze SVG dans `public/flags` correspondent à la sélection privée `flags` de `src/lib/server/knowledge-content.ts` : Argentine, Australie, Brésil, Canada, Chine, France, Allemagne, Inde, Italie, Japon, Mexique, Afrique du Sud, Corée du Sud, Suisse et États-Unis. Le catalogue annonce quinze réponses en 90 secondes, dans les quatre langues. Le composant `knowledge-game.tsx` affiche les SVG locaux avec `next/image`, à 44 × 30 ; les emoji présents dans les données servent à identifier le fichier, pas de preuve de rendu navigateur.

| Comparaison disponible | Détail à observer | Limite pour un sujet expert |
| --- | --- | --- |
| Italie / Mexique | Bandes verticales vert-blanc-rouge ; emblème au centre du Mexique | Une seule paire directement voisine ; vérifier la lisibilité de l'emblème à la taille réelle |
| France / Italie | Bandes verticales ; bleu ou vert à gauche | Exercice d'observation initial, difficulté experte non établie |
| Australie / États-Unis | Étoiles sur fond bleu, avec compositions différentes | Motif commun trop général pour justifier seul un niveau expert |

Ce tableau est une lecture des SVG, pas une classification universelle. L'absence, dans cet inventaire, de paires comme Australie/Nouvelle-Zélande, Indonésie/Monaco ou Roumanie/Tchad limite la construction d'un ensemble centré sur les confusions. Ces exemples sont des pistes à documenter, pas des données prêtes à importer. Ne pas fabriquer les fichiers manquants en recolorant les SVG existants : proportions, teintes et détails doivent être vérifiés.

## Provenance disponible et inconnues

`content/KNOWLEDGE-SOURCES.md` attribue collectivement les drapeaux à Flagpedia/FlagCDN, avec origine Wikimedia Commons. Cette notice constitue une provenance locale déclarée. Aucun manifeste individuel de drapeaux ni notice de licence propre aux drapeaux n'a été trouvé dans les fichiers de contenu inventoriés ; le manifeste et la licence des blasons de football concernent une autre collection. Cette absence locale ne démontre ni interdiction d'usage ni absence de licence à la source.

Avant une extension, établir pour chaque nouvel actif son URL source exacte, la révision ou date de collecte, la notice applicable et son empreinte. Vérifier les dimensions, les détails nationaux et l'absence de ressources externes ou contenu actif. La revue locale XML des quinze fichiers a permis de lire leurs éléments et couleurs ; elle ne remplace pas une vérification juridique, visuelle ou de sécurité complète.

## Conditions d'une reprise

Choisir d'abord une sélection cohérente de confusions vérifiées, avec une raison précise par paire. Conserver les noms et alias privés et traduire EN/FR/ES/DE ; définir un nouveau sujet et sa version sans modifier les réponses historiques. Réutiliser le moteur Practice existant, son démarrage explicite, son délai et ses preuves serveur. Prévoir les statistiques de fin compatibles et les cas parfait/partiel/échec, égalités et faibles échantillons, conformément à `GAME-STATS.fr.md`.

Tester la reconnaissance des détails sur mobile, au clavier et avec les technologies d'assistance, sans annoncer une compatibilité réelle Safari à partir des seuls tests simulés. Ne pas réduire le délai du pilote pour produire artificiellement un niveau difficile. La création du sujet reste différée jusqu'à la disponibilité des données vérifiables ; aucune page, route ou promesse publique supplémentaire n'est créée par cette note.
