# Idées produit et ordre de travail

Cette feuille de route reprend les idées du propriétaire. Les items futurs ne sont pas des fonctionnalités activées.

## Direction actuelle

- Les cinq améliorations des jeux existants sont implémentées : invitations au même puzzle, résultat PNG partageable, progression personnelle en fin de partie, favori/reprise/calendrier et découverte après résolution. Voir [le bilan détaillé](ENGAGEMENT.fr.md).

- L'onglet principal s'appelle « Jeux » (Games/Juegos/Spiele) : il donne accès au quotidien et à l'illimité. Le libellé « Aujourd'hui » reste réservé aux défis quotidiens.

- Chaque joueur choisit ses jeux. L'accueil n'affiche plus de compteur « 1/3 terminés » ni de cases à remplir pour finir toute la sélection. Les séries et statistiques personnelles restent utiles sans cet objectif collectif.
- Les résultats peuvent montrer la vitesse relative et les essais économisés par rapport à la moyenne. Il faut 20 autres comptes/appareils admissibles et distincts dans une cohorte compatible ; les temps/essais exigent 20 réussites. Avant disponibilité, la partie réelle affiche un aperçu compact sans pourcentages. Un bouton local de développement permet de vérifier le rendu avec des chiffres aléatoires, sans alimenter résultats, partage ou classements.
- Les comptes restent facultatifs, sans email. Un code de secours permet de récupérer le compte ; Android et iPhone/WebKit entrent dans les tests automatisés. Les essais sur téléphones physiques restent un contrôle séparé, décrit dans `MOBILE-QA.md`.

## Indices débloqués par publicité

Le bouton reste absent jusqu'à l'intégration d'une publicité récompensée. Une demande d'indice ne doit jamais débloquer une aide simplement parce que le navigateur prétend avoir regardé une vidéo. Le futur serveur devra valider la récompense du fournisseur, lier le droit à un joueur/run, refuser les doublons et consommer ce droit une fois. Les aides restent identifiées dans les résultats et exclues des comparaisons compétitives pertinentes. Aucun fournisseur ni publicité n'est actuellement installé.

## Nouveaux jeux et contenus complémentaires

2048, démineur et mots mêlés sont intégrés dans les quatre langues, avec illimité, sauvegarde et SEO ; seul le démineur conserve un défi quotidien actif parmi ces trois jeux. Voir [les règles et décisions techniques](NEW-GAMES.fr.md). Les jeux ci-dessous restent des idées futures.

Idées retenues : deviner un footballeur ; classer des animaux selon leur poids ; autres devinettes et classements.

Chaque nouveau jeu devra avoir des données fiables, des règles explicites, des ressources utilisables et une version dans les langues prises en charge. Après résolution, `relatedContentId` / `learnMoreUrl` pourra relier la réponse à un article original et utile : faits, contexte et sources, dans la bonne langue. Les articles seront édités et reliés au jeu ; aucune génération de milliers de pages vides n'est prévue. La monétisation publicitaire et la candidature AdSense sont des étapes futures, pas des fonctionnalités ni une garantie d'acceptation.

## Ranked et récompenses

Le Ranked sera réservé aux comptes. Deux joueurs de niveau proche recevront le même défi ; les règles de victoire combineront réussite, durée serveur, essais et erreurs selon le jeu. Matchmaking, MMR, divisions, saisons, historique, revanche et gestion des déconnexions nécessitent une implémentation dédiée, décrite dans `RETENTION.md`.

Les récompenses pourront venir de partenaires ou être financières. Elles seront une étape ultérieure, avec résultats audités et défenses contre bots, comptes multiples et aide externe. La validation simple de cette V1 ne suffit pas à attribuer des prix. Aucun paiement, récompense, partenaire, tournoi ou Ranked n'est activé.

## Qualité des mots

Le Wordle actuel garde ses cinq lettres et six essais, sans redirection vers un dictionnaire externe ni bouton de partage d’image ; le partage du résultat en texte reste à côté des statistiques. Le Mot insolite ci-dessous permet désormais de découvrir des mots originaux sans changer les réponses du Wordle déjà publiées.

Deux listes ont deux rôles : les propositions acceptées doivent être larges, y compris des formes conjuguées ; les réponses à deviner doivent être des mots suffisamment courants et adaptés au jeu. La relecture proposée consiste à retirer de la sélection des réponses les noms propres, abréviations, mots trop rares et erreurs de source, sans réduire arbitrairement les propositions valides. Elle ne signifie pas changer la règle sur les accents, ni demander au propriétaire de relire des milliers de mots manuellement. Des retours ciblés de locuteurs peuvent améliorer les filtres.

## Daily comme événement, Illimité comme entraînement

Idée ajoutée le 4 octobre 2026 : le Daily doit donner la sensation de participer à l’événement d’aujourd’hui, avec un rendez-vous précis pour demain. Il doit avoir une identité plus forte qu’une partie Illimité tirée au hasard.

- **Mot du jour — performance.** Un seul mot de cinq lettres, identique pour tous dans chaque langue, six essais maximum et un seul résultat officiel. Une fois terminé, le joueur retrouve son résultat jusqu’au lendemain. Mettre en valeur le classement du jour, le percentile, la série Daily, le partage, les statistiques communautaires et le compte à rebours du prochain mot.
- **Illimité — entraînement.** Autant de mots aléatoires que souhaité, rejouer immédiatement et suivre ses records personnels. Envisager plus tard un choix de difficulté ou de longueur. Ces parties ne changent ni la série Daily ni le classement quotidien.
- **Mot insolite du jour — découverte.** Un deuxième rendez-vous quotidien, distinct du Wordle courant : mot rare ou surprenant, longueur variable, par exemple sept à dix lettres, et nombre d’essais adapté plutôt qu’une limite systématique de six. Révéler après la partie une définition, des exemples et une étymologie sur une page originale du site, avec sources et traductions EN/FR/ES/DE. Envisager des indices progressifs dans cette future version ; les indices de la plateforme actuelle restent désactivés.

Exemple de présentation Daily : « Trouvé en 4/6 · 🔥 Série : 12 jours · 🏆 Mieux que 68 % des joueurs aujourd’hui · 👥 8 421 joueurs ont joué · Nouveau mot dans 7 h 14 ». En Illimité : « Partie gagnée en 4 essais · Record personnel : 2 essais · Rejouer ». Pour le Mot insolite, mettre en valeur la découverte et une statistique comme « seulement 18 % des joueurs l’ont trouvé ». Ces chiffres illustrent l’idée : les futures affirmations sur les joueurs devront utiliser des résultats réels admissibles, avec seuils compatibles et déduplication.

Idée d’accueil à réévaluer : un bloc personnel « Tes Daily — 2/5 terminés aujourd’hui » montrant Mot du jour, Sudoku, Mot insolite, Calcul et Démineur, avec leurs états terminé / à jouer. Cette proposition revient sur le choix précédent de ne pas inciter à terminer tous les jeux ; elle est consignée ici, sans réintroduire de compteur ni d’objectif obligatoire dans la version actuelle.

Le Mot insolite est désormais intégré : nouveau jeu `rareword` à partir du 4 octobre, grille de 7 à 10 lettres, 8 ou 10 essais, séries et résultats indépendants. Après victoire ou défaite, une fiche du site révèle sens, origine et exemple. Le catalogue initial contient 8 mots par langue (32 fiches), avec un dictionnaire large de propositions ; il devra être enrichi pour espacer davantage les retours de mots. Les premières journées sont figées ; les futurs ajouts devront conserver ces réponses. Les indices progressifs, le compteur d’accueil et les autres renforcements du rendez-vous Daily restent futurs.

## Mise en ligne et premiers retours

Un petit panel signifie quelques personnes qui jouent et donnent un retour concret : ont-elles compris les règles, réussi à saisir sur leur téléphone, rejoué, et retrouvé leurs parties ? Mettre le site en ligne et leur envoyer le lien suffit pour organiser ces premiers essais. Attendre uniquement le trafic fournit peu d'explications quand quelqu'un part à cause d'un problème. Le lancement public, les retours directs et une mesure d'usage peuvent fonctionner ensemble ; aucun recrutement, service d'analytics ni publication n'est effectué ici.
