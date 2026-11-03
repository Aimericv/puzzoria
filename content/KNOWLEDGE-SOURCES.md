# Quiz et parcours de footballeurs

Sélection éditoriale initiale : 1er novembre 2026. Les indices, traductions et mises en page sont originaux. Les quiz et indices ne reprennent pas ceux d’un autre site ; aucun portrait de joueur n’est utilisé. JetPunk est une référence de mécanique de jeu, sans affiliation.

## Quiz

Les huit sujets ont des identifiants stables et quatre traductions dans `src/lib/knowledge-catalog.ts`. Les réponses et variantes sont privées dans `src/lib/server/knowledge-content.ts`. Ajouter un sujet implique une traduction complète, un nombre exact de réponses, un délai, une URL localisée et un test de résolution intégrale. Modifier les réponses d'un sujet nécessite une nouvelle version de sa cohorte ; les runs existants gardent leur contenu JSON.

- Planètes : [NASA, les huit planètes](https://science.nasa.gov/solar-system/planets/). Pluton n'est pas accepté. L'ordre demandé est celui des distances au Soleil.
- Éléments chimiques : [Royal Society of Chemistry](https://periodic-table.rsc.org/) et [IUPAC](https://iupac.org/what-we-do/periodic-table-of-elements/). Noms dans les quatre langues, variantes aluminium/aluminum, sulfur/sulphur, calcium/kalzium acceptées.
- Coupe du monde masculine : [archives FIFA](https://www.archives.fifa.com/fifa_world_cup). Périmètre explicitement **1930–2022** : huit pays, Allemagne et Allemagne de l'Ouest regroupées. Les éditions suivantes ne modifient pas ce quiz historique.
- Monuments : [UNESCO, liste du patrimoine mondial](https://whc.unesco.org/en/list/), dont [Pétra, Jordanie](https://whc.unesco.org/en/list/326). On demande le pays où se trouve le monument, pas la nationalité de son architecte.
- Mythologie : [British Museum, Grèce classique](https://www.britishmuseum.org/sites/default/files/2019-09/british_museum_classical_greece.pdf). On demande les noms grecs, pas les équivalents romains. Il ne s'agit pas d'une liste exclusive des douze Olympiens : Hadès est inclus comme souverain des Enfers.
- Capitales : vingt pays européens, sans prétendre couvrir toute l'Europe. Berne correspond à la ville fédérale suisse. Les exonymes des quatre langues sont acceptés.
- Auteurs : douze associations classiques œuvre/auteur ; noms complets, pseudonymes indiqués et noms de famille non ambigus acceptés. L'attribution traditionnelle de l'Odyssée à Homère est utilisée.
- Drapeaux : SVG nationaux servis localement depuis `public/flags`, obtenus via [Flagpedia/FlagCDN](https://flagpedia.net/download/api), dont les vecteurs proviennent de Wikimedia Commons. Pas de requête tierce dans le navigateur, pas de dépendance au rendu des emoji drapeaux. Les variantes États-Unis/USA et République de Corée/Corée du Sud sont acceptées.

## Football

La banque de vingt joueurs retraités est privée. Chaque entrée contient ses sources officielles (club, fédération, ligue, UEFA/FIFA) et les affiche seulement au terme du jeu. Les noms de famille et surnoms non ambigus sont listés explicitement ; les sous-chaînes et suggestions automatiques ne valident pas une réponse.

L'ordre est celui des passages joués en équipes premières professionnelles ; équipes de jeunes et réserves sont exclues. Les prêts et retours apparaissent séparément : notamment Beckham à Preston/Milan, Henry à Arsenal, Kaká à São Paulo et Lampard à Swansea. Un contrat signé avant un prêt sans apparition n'ajoute pas une fausse étape (Villa/Melbourne avant ses débuts à New York ; Kaká/São Paulo avant Orlando ; Lampard/Swansea avant ses débuts en équipe première à West Ham). Les années désignent les passages joués, pas tous les contrats administratifs.

Les carrières sont gelées dans les runs déjà créés. Un ajout au deck ne doit jamais changer un run sauvegardé. À l'ajout de joueurs actifs, il faudra dater explicitement les carrières, vérifier chaque transfert et renouveler la cohorte ; le deck initial privilégie les joueurs retraités pour éviter cette ambiguïté.

## Blasons des clubs

Les 140 blasons locaux de `public/club-badges` proviennent du dépôt [JoseArroyave/football-logos](https://github.com/JoseArroyave/football-logos), révision `5ab11fed47427b3003f4b276554491fe683387b1`. Les 86 ajouts du 3 novembre accompagnent les parcours quotidiens. La notice MIT du dépôt est conservée dans `football-badges.LICENSE.txt` ; les marques des clubs restent à leurs propriétaires. Le manifeste `football-badges.sources.json` précise chaque fichier, sa provenance et son SHA-256 après suppression des métadonnées et contenus SVG actifs/externes. Aucun appel tiers dans le navigateur.

Ce sont des blasons contemporains d’identification des clubs, pas une reconstitution du blason porté à chaque année du parcours. Emirates Club conserve son nom faute de blason dans cette sélection ; un logo absent ou en erreur affiche aussi le nom. Les noms restent disponibles aux technologies d’assistance, au survol et via un bouton traduit. Aucune réponse, graine ou liste de joueurs n’entre dans le module public des blasons.

## Sélection quotidienne difficile — 3 novembre 2026

Les seize parcours sont privés dans `src/lib/server/football-daily-content.ts`, séparés des vingt joueurs de l'illimité. Les faits de carrière proviennent des profils ci-dessous, consultés le 3 novembre 2026. Les tableaux d'équipes premières ont été relus pour distinguer contrats administratifs, réserves, prêts, retours et apparitions en coupe ; les textes d'articles ne sont pas reproduits. Les dates représentent les périodes jouées, et non toute la durée d'un contrat.

- Javier Saviola : [profil officiel FC Barcelona](https://players.fcbarcelona.com/en/player/809-saviola-javier-pedro-saviola-fernandez), incluant son retour en 2006–2007.
- Steven Pienaar : [carrière](https://en.wikipedia.org/wiki/Steven_Pienaar), avec les deux prêts à Everton puis les transferts définitifs.
- Niko Kranjčar : [carrière](https://en.wikipedia.org/wiki/Niko_Kranj%C4%8Dar) et [historique FotMob](https://www.fotmob.com/players/38820/niko-kranjcar), incluant l'apparition au retour à Kyiv en 2015–2016.
- Kim Källström : [carrière](https://en.wikipedia.org/wiki/Kim_K%C3%A4llstr%C3%B6m), prêt à Arsenal et retour au Spartak inclus.
- Mathieu Bodmer : [carrière](https://en.wikipedia.org/wiki/Mathieu_Bodmer).
- Alou Diarra : [carrière](https://en.wikipedia.org/wiki/Alou_Diarra) et [profil Sky Sports](https://www.skysports.com/football/news/2375410/player-profile-alou-diarra). Bayern Munich et Liverpool sont exclus : aucune apparition officielle en équipe première, contrairement aux clubs de ses prêts.
- Mohamed Sissoko : [carrière](https://en.wikipedia.org/wiki/Mohamed_Sissoko). Auxerre est exclu faute d'apparition en équipe première.
- Sulley Muntari : [carrière](https://en.wikipedia.org/wiki/Sulley_Muntari), avec retour à l'Inter et distinction du prêt/transfert à Milan.
- Blerim Džemaili : [carrière](https://en.wikipedia.org/wiki/Blerim_D%C5%BEemaili) et [Bolton : son match de FA Cup](https://www.bwfc.co.uk/news/2020/april/one-game-wonders-blerim-dzemaili). Bolton est inclus malgré zéro match de championnat ; Shenzhen, sans apparition, est exclu.
- Gelson Fernandes : [carrière](https://en.wikipedia.org/wiki/Gelson_Fernandes).
- Frédéric Kanouté : [carrière](https://en.wikipedia.org/wiki/Fr%C3%A9d%C3%A9ric_Kanout%C3%A9) et [portrait officiel LALIGA](https://www.laliga.com/en-GB/news/what-became-of-kanoute).
- Marko Marin : [carrière](https://en.wikipedia.org/wiki/Marko_Marin). La Fiorentina est incluse pour ses matchs européens, malgré zéro match de Serie A ; les réserves sont exclues.
- Kevin-Prince Boateng : [carrière](https://en.wikipedia.org/wiki/Kevin-Prince_Boateng). Le contrat au Genoa sans apparition n'ajoute pas une étape avant son prêt à Milan.
- Tomáš Rosický : [carrière](https://en.wikipedia.org/wiki/Tom%C3%A1%C5%A1_Rosick%C3%BD).
- Eiður Guðjohnsen : [carrière](https://en.wikipedia.org/wiki/Ei%C3%B0ur_Gu%C3%B0johnsen). Pune City sans apparition est exclu ; variantes usuelles sans caractères islandais acceptées.
- Florent Sinama-Pongolle : [carrière](https://en.wikipedia.org/wiki/Florent_Sinama_Pongolle) et [fiche officielle FFF](https://www.fff.fr/equipe-nationale/joueur/8644-sinama-pongolle-florent/fiche.html). Les débuts en prêt au Havre précèdent ses premiers matchs à Liverpool. Lausanne sans apparition et la fin amateur à Saint-Pierroise sont exclus du parcours professionnel.

Les clubs sans SVG vérifié (Ajax Cape Town, Bidvest Wits, Chainat Hornbill, Mitra Kukar, Pune City et Shijiazhuang Ever Bright) restent lisibles par leur nom ; aucun blason d'un autre club n'est substitué. La collection quotidienne initiale est gelée. Une nouvelle collection s'ajoute avec une date d'effet future pour préserver les joueurs et identifiants déjà publiés.
