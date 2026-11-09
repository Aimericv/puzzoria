# Quiz Ligue 1 : joueurs et clubs

Contribution du 9 novembre 2026, requête visée : « quiz Ligue 1 ». L'estimation de 500 recherches mensuelles/KD 0 vient du propriétaire, pas d'une mesure indépendante. Le repli suit sa directive : les actifs locaux ne suffisent pas à établir un corpus de drapeaux difficile avec provenance individuelle vérifiée.

## Jeu

`/fr/quiz/quiz-ligue-1`, `/en/quiz/ligue-1-quiz`, `/es/quiz/quiz-ligue-1`, `/de/quiz/ligue-1-quiz`. Dix indices joueur/période, dix clubs distincts, 120 secondes, saisie libre avec sigles usuels. Il s'agit de passages historiques en première division française (Monaco compris), pas des participants actuels. Le prêt de Bodmer à Saint-Étienne en 2013 est inclus. Les réponses sont gelées dans le nouveau sujet `ligue-1-clubs`, cohorte `quiz:ligue-1-clubs:v1:langue`. Les sujets précédents sont préservés.

Le moteur Quiz existant gère démarrage, délai, preuves serveur, correction et CompletionPanel. Le catalogue fournit routes, métadonnées, hreflang et sitemap ; le groupe Football assure le maillage vers le sujet, avec quatre sujets voisins en retour. Aucun nouvel actif graphique ni droit d'image ajouté.

## Sources réellement utilisées

Lecture locale des carrières déjà sourcées dans `src/lib/server/knowledge-content.ts`, `src/lib/server/football-daily-content.ts` et de `content/KNOWLEDGE-SOURCES.md`. Pas de consultation web pendant cette session. Les faits sont reformulés en indices courts ; aucun texte d'article reproduit.

- Zidane/Bordeaux : fiche FFF indiquée dans son entrée locale.
- Henry/Monaco : profil FC Barcelona indiqué dans son entrée locale.
- Beckham/PSG : annonce LA Galaxy de son arrivée au PSG, indiquée dans son entrée locale.
- Källström/Rennes et Lyon : carrière référencée dans la collection Daily.
- Bodmer/Lille, Nice et Saint-Étienne : carrière référencée dans la collection Daily.
- Diarra/Marseille et Lens : carrière et profil Sky Sports référencés dans la collection Daily. Lens 2005–2006 correspond au passage définitif après le prêt.

## Validation et mesure

Tests dédiés : quatre langues, résolution parfaite/partielle/nulle, sigles, doublon, rejet du nom du joueur, réponses privées et cohorte distincte. Les tests génériques parcourent aussi chaque sujet. Statistiques et SEO reposent sur les composants existants et leurs tests. Les contrôles navigateur/build indépendants restent à exécuter ; aucune compatibilité physique mobile revendiquée.

Hypothèse : répondre par un jeu précis à cette intention peut augmenter les départs. Suivi exploratoire `playing.starts`, 28 jours complets, minimum 20 départs dans chacune des fenêtres, +20 %. Baseline/dates confiées au superviseur. Suivre séparément impressions/clics de ces pages sans transformer une ligne absente en zéro ; comparaison globale non causale. Aucun gain observé. Contribution sandbox, PR/fusion/production non confirmées.
