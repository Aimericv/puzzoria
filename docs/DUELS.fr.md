# Salons entre amis — 7 octobre 2026

Le bouton **Défier un ami** crée désormais un salon privé `/[locale]/live/[code]`. Il fonctionne avant une partie et depuis son résultat. Les anciennes invitations `/friend` et salles `/number-room` restent compatibles, mais les nouveaux boutons utilisent le mode simultané.

## Parcours commun

Compte facultatif ; pseudo invité modifiable, lien à envoyer, deuxième joueur, boutons Prêt, décompte de trois secondes. Le serveur génère une énigme neuve après les deux confirmations. Aucun joueur ne voit le puzzle avant l'instant commun de départ. La langue du puzzle est commune, l'interface du destinataire peut être différente. L'hôte choisit la difficulté du Sudoku/Démineur ou la catégorie des jeux d'opinion avant le départ ; un changement annule les confirmations.

Deux panneaux côte à côte montrent les présences et les progrès, sans réponses adverses. La grille reste montée après la fin. Un seul CompletionPanel affiche les actions, partage près des statistiques, comparaison avec l'ami et progression personnelle disponible. La revanche requiert les deux joueurs, remet les confirmations à zéro et crée un nouveau défi. Les anciens résultats ne sont pas réécrits.

| Jeu | Décision | Limite |
| --- | --- | --- |
| Wordle | Réussite, moins d'essais, puis instant de fin. Attendre les deux résultats. | 10 min / 6 essais |
| Sudoku | Première solution valide sur la même grille. Les cases remplies ne sont pas une preuve de justesse. | 30 min |
| Calcul | Une expression chacun ; plus petit écart à la cible, puis instant de fin. | 10 min |
| 2048 | Même départ et même graine de génération ; plus grand score. Un joueur peut encaisser plus tôt. | 3 min |
| Démineur | Même grille et même première case sûre ; premier à terminer sans mine. Une explosion laisse l'autre finir. | 10 min |
| Mots mêlés | Même grille/langue ; premier à trouver tous les mots. Le départ commun déclenche les deux chronos. | 10 min |
| Devine le nombre | Deux secrets manuels, propositions simultanées ; réussite, moins d'essais, puis instant de fin. Aucun nombre/range proposé par le site. | 5 min / 30 essais chacun |
| Classement à l'aveugle | Même catégorie et cinq items ; révélation des deux tableaux après les deux fins. Aucun gagnant de vitesse. | 10 min |
| Tu préfères | Dix questions communes ; révélation des votes et nombre de choix en commun après les deux fins. | 10 min |

Le Mot insolite reste exclusivement quotidien ; son bouton propose un duel Wordle classique neuf. Aucun second mot insolite n'est généré.

## Autorité et confidentialité

Migration additive 7 : `live_rooms(code,state_json,expires_at)`. La clé opaque contient 256 bits aléatoires. Deux places maximum, cookies/session existants, limites de requêtes et protections d'origine habituelles. Les secrets, propriétaires, graines et solutions restent privés. Les parties conservent les preuves des moteurs existants (`submitRun`/`validateProof`) ; la course aux nombres a ses propositions vérifiées contre le secret serveur.

Les routes solo refusent de lire, commencer ou soumettre un run de salon. Les actions de salon vérifient la place, la manche, le run propriétaire et l'horloge. Wordle ne peut pas récupérer un lot d'essais en duel. Les réponses perdues se relisent sans dupliquer les actions ; un résultat terminé est immuable. Les temps départagés utilisent les instants serveur, pas le chronomètre navigateur. Pour 2048, le score sauvegardé à l'expiration correspond exactement à la limite de trois minutes.

Une connexion SSE transmet l'état environ chaque seconde, avec réauthentification à chaque émission et renouvellement après 25 secondes. Si le flux manque, une lecture HTTP toutes les deux secondes prend le relais ; les propositions restent jouables par POST. Une coupure laisse 60 secondes pour reprendre, sans arrêter l'horloge ; une reconnexion tardive ne gomme pas un forfait acquis. Les délais sont également réglés à la lecture suivante si aucun navigateur ne reste connecté. Une salle expire après 24 heures et les opérations purgent ses secrets. Les résultats déjà enregistrés restent personnels. Une partie interrompue n'est jamais inventée comme puzzle résolu.

Les résultats validés sont Practice et portent `friendId`/`roomId` : pas de série Daily, classement officiel, population communautaire, Ranked ou récompense. En fin de duel, les comptes/appareils voient uniquement les performances réelles de leur ami. Le panneau de match peut afficher un forfait/temps écoulé sans créer une fausse résolution.

La migration d'un invité vers son compte conserve sa place lorsque cela ne fusionne pas deux places. La suppression d'un compte efface les salons privés correspondants et conserve les runs des autres invités. Le journal d'effacement reste compatible avec les sauvegardes antérieures à la migration 7.

## Mesure et SEO

Les visites, temps actifs et événements sociaux gardent le choix explicite, DNT/GPC et l'exclusion des admins/bots. La source d'entrée `live` est une invitation. Le tableau de bord et son JSON recensent `duel_created`, `duel_joined`, `duel_started`, `duel_finished`, `duel_rematch`, dédupliqués par propriétaire/manche. Les codes privés sont hachés dans les événements, jamais conservés comme chemins de page. Les résultats réellement validés restent comptés séparément des fins de match par forfait.

Toutes les pages de salon/création sont noindex ; aucun code ou seed n'entre dans le sitemap. Les quatre langues disposent des mêmes contrôles et règles. Les Daily, leurs réponses, canonical/hreflang et archives restent identiques.

## Validation

Tests isolés des neuf moteurs, départ avant/après décompte, protections des runs, tiers, secrets, doublons, critères de victoire, limite 2048, grâce, revanche et effacement. Playwright utilise deux contextes séparés et sa propre SQLite sur 3100 ; captures de bureaux/mobiles, absence de débordement, grilles conservées, partage et reprise. Les profils WebKit/iPhone sont des simulations ; les vérifications physiques de `MOBILE-QA.md` restent distinctes.
