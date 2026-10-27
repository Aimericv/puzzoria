# Vérifier l’entrée dans une première partie

## Pourquoi cette investigation

Sur la source exportée 24de100089f917e7067c49866c0f073dd98c0686, les entrées Word et Mots mêlés sont déjà accessibles sans inscription. Les agrégats disponibles ne localisent pas d’abandon entre une entrée Google et le démarrage. Cette contribution prépare des preuves navigateur avant de modifier le parcours.

Search Console, collecte du 27 octobre 2026 à 12:23:24.955Z, status=available : 177 impressions et six clics sur les 30 jours demandés du 27 septembre au 26 octobre ; dernière date rapportée le 25 octobre, données finales America/Los_Angeles. Les lignes partielles /es/palabra (29 impressions) et /fr/mots-meles (13) n’ont pas de clic. Elles ne constituent pas une jointure requête/page ni un funnel.

Analytics Puzzoria, collecte à 12:23:23.397Z, status=available : 30 jours UTC du 28 septembre au 27 octobre, jour courant partiel ; six identités compte/appareil, 20 départs et 18 fins. Ces identités ne sont pas des personnes uniques et les visites consenties ne couvrent pas tout le trafic. Aucun effet des propositions antérieures n’est attribuable sans déploiement vérifié. Observation du contexte : 48b38c582bb32b27c687ee6c248828e60aacffeb9d8e62d77e6d2233b12fcc78, collectée à 12:23:28.570Z.

## Scénarios préparés

Le fichier e2e/first-play-entry.spec.ts contient trois scénarios par langue EN/FR/ES/DE, repris dans les quatre projets Playwright existants (48 cas découverts).

- Word : ouvrir la page de base, attendre un clavier utilisable, saisir A via le clavier affiché et vérifier la première case, sans navigation vers un compte.
- Mots mêlés : retenir la création du run pour observer le preview, puis laisser le vrai serveur fournir le puzzle. Vérifier plateau verrouillé, cases désactivées, masquage visuel et startedAt null. Refuser uniquement le premier démarrage avec une réponse 503 simulée ; vérifier erreur traduite et maintien du verrouillage. Réessayer contre le vrai serveur : startedAt renseigné, plateau utilisable et sélection d’une case.
- Mots mêlés : refuser uniquement la première création ; vérifier le message et le bouton Réessayer existants, puis préparer le vrai puzzle sans quitter la page de base.

Les réponses réussies utilisent les API réelles dans la base jetable Playwright. Les refus sont injectés côté navigateur ; ils ne prouvent pas une panne réelle. Aucune nouvelle télémétrie, règle serveur ou configuration n’est ajoutée.

## Ce que les pièces jointes doivent permettre de conclure

Le scénario de départ collecte deux instantanés ARIA : preview et plateau du vrai run avant départ. Le preview de page est distinct du puzzle Practice créé sur le serveur ; il ne faut pas interpréter ses lettres comme celles de ce run. Le code du plateau prépare cependant des aria-label contenant les lettres et les masque visuellement avec color: transparent. Les instantanés doivent préciser cette exposition accessible. Leur collecte ne constitue pas une assertion de conformité ni un essai avec lecteur d’écran physique.

La réactivité sous réseau réel, une durée de chargement habituelle, la conversion et le comportement natif Safari restent inconnus. Les clics automatisés des profils mobiles ne remplacent pas un essai tactile physique.

## Validation locale et suite

Playwright --list découvre 48 cas ; aucun de ces cas n’a été exécuté dans cette session. Les serveurs locaux et le build sont réservés au superviseur par le mandat. Typecheck et lint sont consignés dans la mémoire de session ; aucune réussite navigateur n’est déduite de la découverte.

Prochaine décision : examiner les résultats et pièces jointes produits par le superviseur. Si l’exposition des lettres du vrai run avant départ est confirmée, préparer une correction limitée de son rendu accessible et une assertion de non-exposition, avec contrôle positif après Démarrer. Sinon, choisir une autre hypothèse sur preuve. Aucun gain d’acquisition n’est revendiqué.
