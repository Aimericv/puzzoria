# Vérification mobile

## Couverture automatisée

La suite Playwright utilise quatre projets : ordinateur Chromium, viewport iPhone 13 sous Chromium, Pixel 5 sous Chromium, iPhone 13 sous WebKit. Le dernier utilise le moteur WebKit livré par Playwright, pas une installation de Safari iOS. [Playwright décrit cette distinction](https://playwright.dev/docs/browsers#webkit) et [les paramètres de simulation des appareils](https://playwright.dev/docs/emulation).

Les parcours couvrent les dix jeux, sauvegarde/rechargement, clavier, notes et pause Sudoku, partage texte/copier/PNG, comptes/synchronisation, récupération, quatre langues, replay, absence d'indices et absence du compteur de trois jeux. Les jeux sociaux ajoutent les votes verrouillés, réactions fondées sur des votes de test isolés et duels entre deux contextes navigateur distincts. Le partage de secours est testé quand les API de partage/presse-papiers sont indisponibles. Le dialogue natif de partage iOS n'est pas simulé comme un succès.

Un parcours supplémentaire vérifie les pages à 320×568 et 568×320, l'absence de débordement horizontal et la saisie tactile du Mot, conservée après rechargement. Les champs de compte ont une police de 16 px et le code de secours se replie dans sa carte au lieu de déborder.

```powershell
npx playwright install chromium webkit
npm run test:e2e
```

Les captures sont enregistrées sous `test-results/`, la base est isolée et les secrets de secours ne sont pas capturés dans les screenshots. Les comptes de test ne sont pas ajoutés à la base normale.

Le serveur de test simule un proxy fiable avec une adresse différente par projet : les navigateurs ne partagent pas artificiellement le plafond de récupération par IP. Cette configuration reste limitée au serveur Playwright. La saisie rapide est vérifiée une fois le clavier activé, et le Wordle conserve le curseur courant entre deux rendus pour ne pas écraser une lettre précédente.

WebKit signale aussi certaines requêtes de profil/comparaison interrompues par une navigation comme `pageerror`, même lorsque leur rejet est traité par l'application. Seuls ces diagnostics précis sur les API locales (profil, comparaison et découverte à ID de run valide) sont distingués des erreurs JavaScript ; les rejets réellement non traités sont enregistrés séparément et font échouer les tests, ainsi que les autres erreurs et avertissements d'hydratation. Les sauvegardes finales des petits brouillons utilisent `keepalive`.

## Essai sur un téléphone physique

Aucun téléphone physique ni Safari iOS réel n'est connecté à cet environnement. Pour compléter la vérification :

1. Connecter le téléphone et l'ordinateur au même réseau local.
2. Lancer `npm run dev:lan` depuis `C:\GameAD` (arrêter l'autre serveur si son port 3000 est occupé).
3. Trouver l'IPv4 locale de l'ordinateur avec `ipconfig`, puis ouvrir `http://ADRESSE-LOCALE:3000/fr` dans le navigateur du téléphone. Si Windows bloque l'accès, autoriser le serveur Node sur ce réseau privé.
4. En développement local, ne pas fixer `AUTH_ORIGIN` sur `127.0.0.1` : par défaut, l'origine est vérifiée contre le Host utilisé par le téléphone. Une adresse HTTPS définitive sera configurée lors de la publication.
5. Essayer chaque jeu en portrait et paysage, les boutons proches du bord, le clavier physique/virtuel, le défilement avec clavier ouvert, la pause et le retour depuis un autre onglet.
6. Créer un compte de test, télécharger le code de secours, se déconnecter, récupérer le compte puis reprendre une partie. Conserver le code hors du téléphone si l'objectif est de récupérer après sa perte.
7. Vérifier le partage. Sur HTTP local, les API natives peuvent être indisponibles ; le texte de secours doit rester lisible. Le partage natif sera également vérifié sur le domaine HTTPS.

Consigner appareil, OS, navigateur et problème observé. La simulation ne vérifie pas le vrai clavier logiciel, le dialogue natif de partage ni les particularités du matériel.

Pour les nouveaux jeux, vérifier aussi les quatre directions de glissement de 2048, le mode Drapeau du démineur, le défilement horizontal de sa grille difficile et les mots mêlés par glissement ou deux touches. Les tests automatisés utilisent des événements de pointeur natifs pour les glissements et des commandes tactiles simulées pour les extrémités ; ils ne remplacent pas ce contrôle physique.

Pour les jeux sociaux, vérifier les cinq placements du classement, les barres après vote, les textes longs allemands, les PNG téléchargés, le clavier numérique et les contrôles de déduction. Les deux joueurs du duel doivent rester côte à côte en portrait comme en paysage, sans débordement ; vérifier les libellés, la saisie du nombre à gauche et les commandes sous les joueurs. Ouvrir un lien de duel sur deux téléphones : verrouiller les deux nombres, vérifier le tour actif et les commandes désactivées hors tour, mettre l'un en arrière-plan puis revenir et recharger après une fin de partie. Les prochains éléments du classement et le nombre adverse doivent rester cachés avant leur révélation autorisée. Après une victoire ou une défaite en Illimité, vérifier les boutons Rejouer et Essayer un autre jeu avant les statistiques.

Les ajustements du 4 octobre couvrent aussi l’accès principal au classique 2048, la catégorie visible et Rejouer en haut du classement, le tableau de positions moyennes, et douze dilemmes Illimité avec reprise du compteur et bilan à la demande. Le duel utilise maintenant un seul champ de proposition et des réponses +/−. Vérifier le champ secret vide à chaque nouvelle partie, y compris Rejouer entre amis, la proposition vide après chaque envoi/rechargement, les signes dans les deux colonnes et l’absence de suggestion ou de plage calculée.

Pour le Mot insolite, contrôler sur appareil réel la saisie de 7–10 lettres, les touches accentuées normalisées et les 8/10 essais. Après une fin, vérifier le défilement vers les actions, la ligne temps/essais/réponse et la fiche découverte ; activer aussi la préférence de mouvement réduit du téléphone.
