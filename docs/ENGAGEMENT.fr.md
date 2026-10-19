# Améliorations des jeux existants — 3 octobre 2026

## Défis entre amis

Après une partie vérifiée, « Défier un ami » crée un lien utilisable sans compte. Le destinataire reçoit une copie exacte du puzzle joué, y compris en illimité. Le créateur voit les résultats de ses amis anonymisés ; le destinataire voit son résultat face à celui du créateur. Le créateur peut actualiser, et la page visible se rafraîchit toutes les 15 secondes. Au maximum 20 résultats d'amis sont affichés.

Wordle, Sudoku, Calcul, 2048, Démineur et Mots mêlés regroupent « Rejouer », « Essayer un autre jeu » et « Défier un ami » dans la première rangée d'actions du résultat, avec retour à la ligne sur les petits écrans. Wordle conserve partage et statistiques côte à côte dans la rangée suivante. Le défi du jour est nommé explicitement pendant le jeu et après résolution, avec sa date et le renouvellement à 00 h UTC ; le résultat précise que Rejouer lance l'Illimité. Archives, Illimité et invitations gardent leurs propres libellés.

Le numéro chronologique « Défi #… » est retiré de l'accueil et du titre des jeux : la date et « Défi du jour » ou « Archives » identifient la partie. Les numéros discrets dans la liste des archives restent des repères chronologiques ; ils ne sont pas des niveaux de difficulté.

Sur Wordle, « Mot du jour » et la date sont affichés immédiatement au-dessus de la grille, y compris pendant son chargement. Le grand encart sur le renouvellement UTC est retiré pour ce jeu. L’Illimité et les archives ont un libellé distinct au même endroit.

Les liens ont un jeton aléatoire de 256 bits et expirent après 30 jours. Toute personne qui possède le lien peut jouer et consulter le résultat du créateur. Ni compte, nom, propriétaire de run, essais saisis ni solution ne figurent dans la réponse publique. Le Wordle conserve la langue du mot même si l'invitation est ouverte dans une autre langue. Un lien reste jouable après minuit.

Les copies utilisent des IDs distincts `friend:jeu:jeton` et le mode personnel `practice`. Elles ne prennent pas la place du défi quotidien, ne comptent pas pour les séries quotidiennes, ni pour les classements ou les cohortes de comparaison. Les scores sont recalculés par le serveur à partir de la preuve de résolution. Les temps de comparaison incluent pauses et absences. On compare d'abord réussite, puis essais Wordle ou score Calcul, puis durée. « Revanche demain » ouvre, à partir du lendemain du puzzle, le nouveau défi quotidien du même jeu et niveau. À sa fin, le joueur peut partager une nouvelle invitation ; aucun matchmaking n'est ajouté.

## Partage visuel

« Partager une image » crée un PNG de 1 200 × 630 avec résultat, durée, date, nom du jeu et invitation. Le Sudoku affiche la grille initiale ; le Calcul affiche nombres et cible. Aucune solution n'apparaît. L'image accompagne le lien dans le partage natif lorsque le navigateur accepte les fichiers. Sinon elle est prévisualisée et téléchargeable. Wordle propose seulement « Partager le résultat », à côté des statistiques, avec le texte et les cases de couleur. Son bouton de partage d'image est retiré ; les aperçus PNG des invitations restent disponibles pour les messageries.

Partager le résultat est à côté de Statistiques sur tous les jeux, y compris les jeux sociaux et les duels, avec le même repli natif → copie → texte sélectionnable. Les aperçus locaux partagent un texte explicitement marqué test, sans événement analytique. Rejouer un quotidien/archive crée une nouvelle partie illimitée ; Rejouer dans un aperçu fait de même au lieu de restituer le brouillon précédent. Le Mot insolite reste un seul mot par jour et propose le Wordle classique illimité après la fin. Les statistiques de fin utilisent des métriques adaptées à chaque jeu, sans taux de victoire pour les grilles sans échec ni vitesse pour les jeux d'opinion.

Les liens utilisent une image Open Graph/Twitter correspondant au résultat. Pages d'invitation et images sont `noindex`, et les invitations sont exclues du sitemap. L'image publique ne contient aucun identifiant de compte. Le domaine configuré dans `NEXT_PUBLIC_SITE_URL` apparaît sur l'image lorsqu'il est public. La route PNG est publique par possession du jeton, avec un cache d'au plus une heure.

## Progression et personnalisation

L'écran de fin montre les nouveaux records personnels, les écarts à sa moyenne précédente à partir de trois victoires comparables, les dix dernières parties comparables et les succès existants nouvellement acquis. Les comparaisons portent sur le même jeu et mode, la même langue pour les mots et le même niveau Sudoku. Les anciens résultats importés restent dans les statistiques personnelles, mais sont exclus de ces records et graphiques comparables. Les temps trop courts ou dépassant 24 heures sont exclus des records/moyennes de temps. Aucun percentile de population n'est inventé.

L'étoile de chaque carte choisit un favori unique, qui remonte en premier. Une partie inachevée apparaît comme reprise sur l'accueil. Favori et dernière visite sont locaux pour les invités, migrés et synchronisés dans le namespace du compte pour les inscrits. Le calendrier de 28 jours compte les dates UTC de parties terminées dans tous les modes, y compris archives et défis entre amis. Il n'introduit aucun objectif de terminer tous les jeux.

## Qualité des prochains puzzles et découverte après résolution

Les défis quotidiens publiés jusqu'au 3 octobre restent inchangés. Dès le 4 octobre, les mots quotidiens parcourent une sélection mélangée sans répétition avant épuisement ; les propositions larges et la normalisation des accents sont conservées dans les quatre langues. Les fichiers édités dans `content/daily` gardent leur priorité. La fréquence et les filtres existants de sélection des réponses restent en place ; une relecture native ciblée peut encore améliorer leur qualité.

Les nouveaux Sudokus illimités et quotidiens à partir du 4 octobre sont sélectionnés parmi au maximum huit grilles uniques. L'analyse mesure candidats uniques, positions uniques dans une ligne/colonne/carré et cases restant après ces techniques. Le générateur cherche une grille adaptée au niveau, puis conserve la meilleure si les huit essais n'atteignent pas le profil souhaité. Cela améliore la sélection sans prétendre couvrir toutes les techniques de Sudoku ou garantir une échelle universelle de difficulté. L'écran de fin explique une déduction valide dans la grille de départ ; à défaut il montre les candidats et indique la nécessité d'une technique plus avancée.

Le Calcul alterne six constructions avec addition, multiplication, soustraction et division entière. Les références utilisent les nombres proposés et des résultats intermédiaires strictement positifs entiers. Après résolution, une recherche bornée à 40 000 combinaisons cherche une méthode réellement différente, en évitant les seules permutations commutatives. Chaque calcul affiché est validé par le moteur. À défaut, la référence est affichée avec un texte honnête ; aucune méthode n'est annoncée optimale.

Wordle classique révèle le mot après la fin et ne propose plus de redirection vers un dictionnaire externe. Le Mot insolite est désormais sa variante de découverte, accessible dans les mêmes onglets, avec essais adaptés et explication locale après la partie. Il conserve ses URL, résultats et séries propres, sans carte de jeu séparée sur l'accueil. Les comparaisons et la progression utilisent deux cartes de mêmes dimensions sur ordinateur ; l'historique se déplie à la demande. L'aperçu ne montre plus de mention Exemple ni de chiffres simulés ; les tirets attendent une comparaison réelle admissible.

L'abstraction interne de définition et son cache restent conservés, sans activation depuis l'écran Wordle. Elle utilise des hôtes Wiktionary fixes par langue, un délai de 2,5 secondes par requête, trois requêtes maximum, un corps limité à 500 Ko et refuse les redirections HTTP. Le HTML est analysé par parse5 et seul du texte est renvoyé. Tout futur extrait devra conserver son attribution et sa licence.

Exemples de sources vérifiées : [outil](https://fr.wiktionary.org/wiki/outil), [apple](https://en.wiktionary.org/wiki/apple), [perro](https://es.wiktionary.org/wiki/perro), [Apfel](https://de.wiktionary.org/wiki/Apfel). Le navigateur ne charge pas d'images ni de HTML du dictionnaire. La requête serveur transmet le mot, sans compte, adresse du joueur ou essais. La politique de confidentialité décrit cette consultation dans les quatre langues.

## Stockage et limites

Le schéma SQLite v3 ajoute `friend_challenges` et `word_definitions` sans supprimer ni réécrire les données existantes. Les run/result types gardent leurs trois modes. Les explications sont accessibles uniquement au propriétaire d'un run terminé. La création et la participation aux invitations ont des limites par propriétaire et une limite d'écriture par adresse fiable. Le PNG reste public pour permettre son aperçu par les messageries.

Les événements locaux ajoutent `friend_invite` et `share` avec la méthode `image`. Aucun fournisseur distant de mesure d'audience, publicité, Ranked, récompense financière ou nouveau jeu n'est ajouté.

L'audit npm signale quatre entrées de sévérité élevée dans la chaîne de lint `@next/eslint-plugin-next → fast-glob → micromatch → braces`, hors dépendances de production. La version publiée de braces est 3.0.3, concernée par GHSA-vfj7-8cjw-p6xm. npm propose un retour majeur à Next lint 14, incompatible avec la version actuelle : aucune rétrogradation forcée n'a été appliquée. parse5 n'ajoute pas d'alerte de production. À réévaluer lors d'une prochaine version des outils.

Les tests de navigateurs simulent desktop Chromium, iPhone Chromium, Android Chromium et iPhone WebKit ; le partage natif de fichiers et Safari sur téléphone physique restent à essayer sur de vrais appareils. Les tests disposent de leur propre serveur et base, sans population artificielle dans la base utilisateur.
