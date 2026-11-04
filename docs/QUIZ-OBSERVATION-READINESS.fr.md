# Quiz : décider après des journées réellement observées

Cette note complète [le protocole d’acquisition](QUIZ-ACQUISITION.fr.md) et [le lot thématique](QUIZ-THEMES.fr.md). Elle ne change aucun seuil existant, aucune collecte ni aucune permission de publication.

## Première lecture, 4 novembre 2026

Le rapport hors ligne existant a été exécuté sur les deux exports du superviseur, sans accès réseau ni identifiants Google. Il produit les 96 lignes sujet/langue et huit lignes thème/langue attendues. Les agrégats privés et le rapport généré restent hors de cette documentation publique.

La collecte Google consultée est datée du 4 novembre ; sa dernière journée retournée est le **1er novembre**, alors que le catalogue a été livré le **3 novembre** selon la mémoire propriétaire. Ce relevé ne permet donc pas d’évaluer cette livraison. La période demandée et la date de collecte ne remplacent jamais la dernière journée effectivement rapportée. Une ligne de page absente reste inconnue, même si d’autres lignes de la propriété sont disponibles.

L’export Puzzoria comprend le 4 novembre UTC partiel. La présence des lignes par sujet confirme la disponibilité du rapport, pas une acquisition réussie. Un départ nul est une observation dans sa période ; un taux de fin sans départ reste indéfini. Ni ces valeurs ni une absence de ligne Google ne justifient de supprimer un sujet ou de réécrire son titre dès le lendemain de sa livraison.

## Reprise reproductible

1. Vérifier `status=available` pour chaque source, puis leurs dates et périodes. Conserver la date de livraison confirmée du catalogue et celle du lot thématique séparément. Sans reçu du second, ne pas lui attribuer de fenêtre après livraison.
2. Exécuter la commande documentée dans QUIZ-ACQUISITION. Contrôler 96 lignes de sujets distinctes et huit lignes thématiques, puis examiner les pages dont `google.rowReturned=true`. Garder les autres valeurs Google à `null` ; ne pas les remplacer par zéro.
3. Pour la première lecture à sept jours complets du catalogue, utiliser au plus tôt les journées **4–10 novembre** : attendre que les données Google finales couvrent réellement le 10 novembre et disposer d’un export Puzzoria excluant le jour courant. Le 11 novembre est une borne calendaire théorique, pas une garantie de collecte Google. Les rapports glissants incluant le jour courant ne forment pas automatiquement cette fenêtre.
4. Réserver la comparaison suivante à deux fenêtres de même durée et de couverture connue. Ne pas compléter les dates Google absentes. Les lignes quotidiennes disponibles peuvent décrire une évolution globale ; elles ne reconstituent pas un historique quotidien par sujet à partir d’un top de pages sur trente jours.
5. Appliquer les seuils existants par page : au moins 100 impressions pour examiner intention/titre, au moins 20 départs pour examiner la fin et la difficulté. Ce sont des seuils de tri, pas des preuves causales. Si la couverture ou les effectifs manquent, prolonger l’observation et nommer précisément la donnée manquante.

Ne pas additionner les joueurs de sujets pour annoncer des personnes distinctes. Ne pas calculer de conversion entre clics Pacific et départs UTC. Les sessions Google consenties rattachées au même quiz restent une mesure différente des clics Search Console. Les changements de catalogue, de maillage et de guides concomitants empêchent d’attribuer un mouvement global à un seul ajout.

## Vérification locale

Le 4 novembre, la commande existante de rapport s’exécute et les sept tests de `tests/quiz-acquisition.test.ts` passent avec `npm test -- --configLoader=runner tests/quiz-acquisition.test.ts`. Ces tests couvrent notamment le catalogue traduit, le snapshot gelé, un run de 195 réponses et la distinction entre ligne Google absente et zéro. Aucun test navigateur, build ou effet de production n’est établi par cette note.
