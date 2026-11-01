# Quiz et parcours de footballeurs

Sélection éditoriale initiale : 1er novembre 2026. Les indices, traductions et mises en page sont originaux. Aucun quiz, logo de club ou portrait d'un autre site n'est reproduit. JetPunk est une référence de mécanique de jeu, sans affiliation.

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
