# Classement à l’aveugle, Devine le nombre et Tu préfères

Les trois jeux complètent les six existants, avec interface, contenu et SEO en français, anglais, espagnol et allemand. Les boutons Jouer ont aussi un contraste propre à chaque jeu, une zone tactile d’au moins 44 px et un alignement stable en bas des cartes.

## Jeux et résultats

**Classement à l’aveugle** : cinq éléments révélés un à un, cinq places irréversibles, n° 1 préféré. Un bandeau visible affiche « Thème du classement » et le thème réel de la partie, y compris après résolution. Pendant le jeu, le critère est explicite : classer selon ses préférences, n° 1 préféré et n° 5 le moins aimé. La catégorie aléatoire indique « Petits plaisirs du quotidien ». Rejouer figure juste sous le titre du résultat. Cuisine, pays, jeux vidéo, films, animaux et plaisirs quotidiens disposent chacun de vingt éléments, soit 120 possibilités. Chaque partie tire cinq éléments distincts, disponibles immédiatement en Illimité. Le jeu propose uniquement l’Illimité. Les défis publiés les 3 et 4 octobre restent accessibles par leurs URL historiques sans création de nouveau quotidien. Les prochains éléments restent privés jusqu’au placement accepté.

Le résultat montre les choix personnels, fréquences par placement, classement complet le plus fréquent, accords sur cinq éléments, ordre observé entre n° 1 et n° 4, atypicité et placement le plus débattu. La réaction gratuite « Tu assumes » est retirée. Une réaction sur le n° 1 utilise uniquement la part réelle des participants l’ayant placé ailleurs. Un tableau ouvert par défaut affiche les positions moyennes : somme des positions / nombre de réponses, triée par moyenne croissante. Les réactions et tableaux communautaires exigent le seuil ci-dessous ; sans population suffisante, aucun pourcentage n’est affiché.

**Tu préfères** : uniquement en Illimité, avec soixante questions au catalogue, dix par catégorie. Les anciennes séries des 3 et 4 octobre sont conservées par leurs URL historiques. L’Illimité affiche « Dilemme 1 », « Dilemme 2 », etc., sans total ni fin imposée : Suivant continue au-delà de dix. Le compteur et les votes reprennent après rechargement. Les catégories sont drôle, choix difficiles, vie, argent, jeux vidéo et aléatoire. Un vote A/B est accepté et verrouillé avant toute consultation des résultats. Les barres animées et pourcentages exigent suffisamment de votes réels.

Le serveur conserve des lots de dix pour limiter la taille des preuves et sauvegardes ; ce découpage ne bloque pas l’enchaînement. « Voir mon bilan » clôture les choix récents du lot courant à la demande, même après un seul vote. Le bilan précise le nombre de derniers choix concernés et ne prétend pas agréger toute une session illimitée. La prochaine question reprend le compteur. Les anciennes séries archivées conservent leurs dix questions et refusent une clôture prématurée.

Le bilan présente les réponses majoritaires, le choix le plus rare, la question la plus partagée **dans la série jouée**, l’atypicité si la cohorte complète existe, et les thèmes les plus fréquents parmi les réponses du joueur. Ce résumé ludique ne prétend pas évaluer sa personnalité. Les questions peuvent revenir en Illimité : la bibliothèque est éditoriale et finie, sans génération de dilemmes par une API externe.

**Devine le nombre — bot** : chaque côté possède un entier secret de 1 à 100. Le joueur choisit et verrouille le sien dans un champ vide, puis propose lui-même un nombre à chaque tour. Le serveur répond « + Plus grand », « − Plus petit » ou « Trouvé ». Les réponses sont automatiques et vérifiées. Aucun nombre n’est suggéré, prérempli ou corrigé selon les déductions. Un essai entier entre 1 et 100 reste accepté même s’il a déjà été exclu par un indice : le joueur fait ses propres déductions. Le champ de proposition redevient vide après chaque envoi. Pair/impair, multiples et questions à seuil ne sont plus proposés.

- Facile : proposition aléatoire parmi les nombres encore possibles.
- Moyen : proposition aléatoire dans la moitié centrale des possibilités restantes.
- Difficile : proposition médiane qui partage la recherche en deux ; au plus sept tentatives pour un nombre entre 1 et 100.

Le bot reste déterministe pour une graine et un historique donnés, sans coût d’API ni accès à la réponse pour choisir sa proposition. L’écran explique le niveau sélectionné et présente les deux joueurs côte à côte, y compris sur mobile : ton nombre à protéger à gauche, son nombre à trouver à droite. Chaque côté montre la dernière tentative et son signe +/− ; le nombre adverse reste caché. Aucune plage calculée ni grille de possibilités n’aide le joueur. Les possibilités sont toujours calculées sur le serveur pour le bot et la validation. Le tour actif est surligné, un seul champ et un bouton servent à jouer, et historique/records sont repliés. « Nouvelle partie · choisir mon nombre » permet de recommencer avec un nouveau choix manuel. Le premier qui trouve gagne ; après trente tours du joueur, une partie non résolue est nulle. Seul l’Illimité est proposé, par niveau.

Les nouveaux runs portent `rules: higher-lower` et acceptent uniquement les actions `try` après le choix du secret. Les anciens défis et coups `question`/`guess` gardent leur interprétation et leur bot historique pendant le rejeu de preuve. Une ancienne partie peut continuer avec les nouvelles propositions, sans réécrire les coups précédents. Les résultats sont marqués `legacy`, `higher-lower` ou `mixed` ; les records du duel séparent les règles et les résultats mixtes ne participent pas aux comparaisons communautaires. Aucun ID publié, réponse, résultat ou schéma SQL existant n’est remplacé.

Avant chaque proposition au bot, le client relit le run possédé et utilise son curseur serveur : une autre fenêtre peut avoir avancé la partie depuis le dernier affichage. Une fin déjà enregistrée est restaurée, sans rejouer le coup. Les défaillances des comparaisons sont affichées séparément et ne produisent plus le message de validation indisponible après un coup accepté. Le parcours automatisé avance réellement le run depuis un second client sans recharger la page et simule une comparaison indisponible tout en vérifiant que la proposition reste enregistrée.

**Devine le nombre — amis** : un code de huit caractères et un lien privé permettent à deux comptes/appareils distincts de jouer sur deux navigateurs. Chacun choisit son secret dans un champ vide ; Rejouer vide aussi le champ du créateur. Le créateur commence après le verrouillage des deux nombres. Les mêmes propositions +/− sont utilisées, avec un tour actif visible et des commandes désactivées hors tour ; le serveur refuse également ces coups. L’interface consulte l’état toutes les deux secondes lorsqu’elle est visible ; il s’agit d’un duel sauvegardé, sans WebSocket ni matchmaking. Une réponse perdue est suivie d’une restauration avant de continuer. Rouvrir le lien permet de reprendre avec la même identité. Le code expire après sept jours. Une partie non résolue après soixante actions est nulle ; quitter la page ne donne pas une victoire automatique à l’adversaire.

## Communauté réelle

Depuis le 7 octobre, le réglage `COMMUNITY_STARTER_STATS=true`, autorisé explicitement par l'éditeur, fournit des populations synthétiques de présentation pour les cohortes sous 20 autres comptes/appareils. Elles sont stables pour un même ensemble d'items ou une même question et ne sont jamais écrites en base. Les statistiques observées ont priorité dès le seuil atteint. Les votes restent masqués avant le choix du joueur, et le réglage ne crée aucun résultat, vote ou visite dans les données de gestion.

Les pourcentages demandent **20 autres comptes ou appareils** dans la cohorte compatible. Le propriétaire courant est exclu. En dessous, une phrase neutre annonce le démarrage du débat. Les limites de requêtes et cookies constituent une protection de base ; effacer ses cookies ou multiplier les comptes reste possible.

Les votes sont persistés dans `community_votes`, un enregistrement par propriétaire et liste/question versionnée. Un nouveau run, un changement de langue ou un replay ne créent pas une deuxième contribution. La première contribution communautaire reste inchangée ; un replay peut afficher un nouveau choix personnel sans modifier cette contribution. La migration invité → compte déduplique les contributions. Les résultats importés et les invitations asynchrones de l’ancienne plateforme ne créent pas de votes communautaires.

- Classement : cohorte définie par ID de liste et IDs des cinq éléments. Les positions sont comparées indépendamment de l’ordre de révélation. Le classement collectif est un classement complet réellement soumis, le plus fréquent ; une égalité est tranchée de façon stable. La réaction n° 1/n° 4 compte l’ordre observé des deux éléments et ne prétend pas connaître l’intention de les échanger. L’atypicité utilise la somme des probabilités logarithmiques des positions, avec lissage ; son percentile compte seulement les classements strictement moins atypiques. La controverse est l’entropie des placements d’un élément.
- Dilemmes : cohorte par ID de question, sans mélange de contenus réécrits. Les pourcentages A/B totalisent 100 ; une égalité n’a pas de majorité. La proportion d’accords ignore les questions sans données suffisantes ou sans majorité. L’atypicité exige également 20 autres propriétaires ayant répondu à **l’ensemble exact** des questions ; elle utilise les comptes bruts et exclut les égalités.
- Bot : résultats serveur admissibles, mêmes règles, niveau et mode, même défi pour les anciens Quotidiens. Une contribution récente par autre propriétaire. Les comparaisons de tours gagnants demandent 20 autres victoires ; les comparaisons du nombre de tours joués par le bot demandent 20 autres résultats. Les parties mixtes, trop rapides, importées, aidées ou entre amis sont exclues.

Les scores proposés par le navigateur sont ignorés. Classement et dilemmes n’entrent pas au classement compétitif : il n’existe pas de bonne préférence ni de record de vitesse à battre. Leurs statistiques affichent les parties jouées. Les duels entre amis sont sauvegardés comme résultats personnels, hors population et classement officiel.

## Partage et sauvegarde

Les résultats placent Rejouer et Essayer un autre jeu juste sous le titre, avant les statistiques, records, progression et partage. Les parties Illimité perdues affichent « Partie terminée » au lieu du message réservé au défi du jour. Les durées estimées ne sont plus affichées sur les cartes ni dans les pages de jeu ; les temps réellement mesurés restent disponibles.

Les résultats ont un aperçu de carte, un partage texte natif/copie et une carte PNG 1200 × 630 à télécharger. Les cartes affichent les choix réels et ajoutent les comparaisons uniquement si disponibles. Le texte renvoie vers la page du jeu ; le duel dispose de son propre lien d’invitation. Aucun message n’est envoyé automatiquement.

Les trois jeux et les duels entre amis utilisent désormais le même `CompletionPanel` que Wordle : actions principales en haut, partage texte à côté de Statistiques, puis communauté et progression. Les choix/nombres restent visibles au-dessus ; le classement moyen se déplie à la demande. Les cartes PNG restent disponibles sans deuxième bouton de partage texte. Classement et dilemmes affichent des choix et des comparaisons d'opinions, sans taux de victoire ou record de vitesse. Les chiffres aléatoires sont réservés à l'outil de fin de développement sur loopback, qui n'enregistre aucun vote ni résultat ; les comparaisons publiques restent réelles et soumises à leur seuil.

Le rendu PNG lit le résultat serveur terminé et vérifie le propriétaire du run ou du duel. Il refuse les parties non terminées et les tiers. Les images personnelles sont `private, no-store` et `noindex`. Les nombres secrets d’un duel ne sont révélés aux participants qu’à la fin ; aucun état privé, cookie ou identifiant utilisateur n’est placé dans une URL publique.

Les moteurs rejouent les actions acceptées avec séquence et préfixe immuable. Les doublons du dernier coup sont idempotents et une fin de partie ne peut être réécrite. Les prochaines cartes du classement, le nombre du bot et sa graine restent privés. La projection de run conserve l’état fin mais pas la trace complète des actions. La base SQLite existante reçoit la migration additive 4 (`community_votes`, `number_rooms` et leurs index). Les comptes et anciens résultats restent conservés.

## Enrichir les contenus

Les fichiers sont dans `content/social/` :

1. `categories.json` : ID de catégorie, jeux concernés et libellés EN/FR/ES/DE. Les sélecteurs et la validation serveur utilisent ce fichier. Ajouter une catégorie exige aussi au moins une liste ou cinq dilemmes correspondants.
2. `catalog.v1.json`, `rankings` : une liste possède un ID versionné, une catégorie, une date `from` et exactement cinq éléments. Chaque élément suit `[id, emoji, anglais, français, espagnol, allemand]`. Pour un nouveau sujet tendance, ajouter une liste suffit ; aucun composant n’est à modifier.
3. `catalog.v1.json`, `dilemmas` : chaque ligne suit `[idVersionné, catégorie, thèmeA, thèmeB, [A_EN,A_FR,A_ES,A_DE], [B_EN,B_FR,B_ES,B_DE], dateFrom]`. Thèmes pris en charge pour le résumé : `freedom`, `security`, `adventure`, `social`.
4. `daily.json` : ancien calendrier quotidien, conservé pour restituer les journées historiques ; aucun nouveau quotidien social n’est publié. `ranking-pools.v2.json` contient les pools élargis, avec ID, catégorie, date `from` et éléments traduits ; cinq sont tirés par partie. `dilemmas.v2.json` complète les questions historiques. Les ajouts sont accessibles en Illimité ; les dates de version restent conservées pour ne pas modifier les anciennes journées. Ne pas modifier un pool ou une question déjà publié : ajouter une nouvelle version et date. Les cohortes du classement restent liées à la version et aux cinq IDs tirés ; les sous-ensembles différents ne mélangent pas leurs statistiques.

Exemple historique de programmation, conservé pour restituer les anciennes journées :

```json
{
  "2026-10-04": {
    "ranking": "gaming-v1"
  }
}
```

Les contenus initiaux sans `from` sont disponibles depuis le 3 octobre 2026. **Pour les nouveaux contenus, préciser une date future** : ils n’entreront pas dans la sélection d’une ancienne journée. Ne pas modifier les IDs, choix ou dates de publication d’un contenu déjà paru. Une modification de sens nécessite un nouvel ID de version pour éviter de mélanger les votes. Ne pas reprogrammer une date passée. Les traductions doivent conserver les mêmes choix.

Valider avec `npm run content:social`, puis tester le jeu concerné. Les contrôles couvrent les doublons, tailles, traductions, catégories, dates et références du calendrier. Ils ne remplacent pas la relecture éditoriale des traductions et du sens des choix.

## SEO et limites

| Jeu        | Français                 | Anglais                | Espagnol                | Allemand                   |
| ---------- | ------------------------ | ---------------------- | ----------------------- | -------------------------- |
| Classement | `/fr/classement-aveugle` | `/en/blind-ranking`    | `/es/ranking-a-ciegas`  | `/de/blind-ranking`        |
| Nombre     | `/fr/devine-le-nombre`   | `/en/guess-the-number` | `/es/adivina-el-numero` | `/de/errate-die-zahl`      |
| Dilemmes   | `/fr/tu-preferes`        | `/en/would-you-rather` | `/es/que-prefieres`     | `/de/was-waere-dir-lieber` |

Pages traduites avec titres/descriptions uniques, règles et conseils dans le HTML sans JavaScript, canoniques, hreflang réciproques, x-default anglais, données structurées et maillage des neuf jeux. Le niveau Facile du bot utilise la page sans suffixe comme canonique ; Moyen et Difficile sont distincts. Les archives historiques des 3 et 4 octobre sont conservées ; aucune nouvelle date n’est publiée. Le sitemap comptait **692 URLs uniques** au lancement du 3 octobre. Les pages principales des trois jeux sociaux sont indexables et ouvrent l’Illimité ; leurs alias `/practice` et liens de duel restent en noindex. Le domaine HTTPS définitif et `seo:check` restent nécessaires avant l’indexation publique.

La validation automatisée ne constitue ni un test de charge pour des milliers de joueurs simultanés ni une validation Safari sur téléphone physique. La plateforme reste une instance Node/SQLite avec volume persistant. Pas de récompenses, Ranked, publicité, API d’IA, catalogue infini de questions inédites ou publication automatique de tendances. Les résultats et détails de la dernière validation figurent dans le README.
