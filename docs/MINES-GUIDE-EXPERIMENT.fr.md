# Démineur : exemples de déduction

Expérience `mines-guide-certain-neighbours`, préparée le 1er novembre 2026 sur la base exportée `773f6c4959ed9670d9a46053e23117c247a829ff`. Aucun déploiement ni effet de croissance établi.

Le guide existant explique les chiffres et la résolution logique, sans montrer comment identifier une mine ou une case sûre. Deux exemples complètent les paragraphes existants dans les quatre langues, sans changer leurs titres, leur ordre, le rendu, les URL ou les règles :

- Un 1 dont une seule voisine reste fermée et toutes les autres sont révélées impose une mine dans cette case.
- Un 2 voisin de deux mines déjà déduites impose que ses autres voisines soient sûres. Une simple paire de drapeaux ne suffit pas : un marquage erroné invalide ce raisonnement.

Les exemples sont génériques et ne révèlent aucune grille publiée. Ils correspondent aux règles `count === cells.length` et `count === 0` du solveur dans `src/lib/mines.ts`. Une énumération locale des affectations binaires confirme les deux déductions (respectivement une voisine inconnue, puis six inconnues et deux mines certaines). Aucun mécanisme d’indice n’est activé.

## Fondement et limites

Observation `963823d5071f3e0d1503659ffd65b8785c0abcb2454997762fcb9bec8f2e2c7b`, collectée le 1er novembre à 13:22:52.696Z : aucun échec ni travail non vérifié signalé. Le prototype capitales est en revue humaine, sans corpus factuel sourcé fourni. Les ressources locales `content/social/` contiennent des destinations, sans capitales ; les notices repérées concernent les dictionnaires et les mots rares. L’intégration géographique est suspendue : aucune source externe n’a été consultée et aucune licence factuelle n’est affirmée.

Search Console `available`, collecte 13:22:50.488Z : 180 impressions et six clics sur la période demandée du 2 au 31 octobre, dernière date rapportée le 30 octobre, données finales America/Los_Angeles. La ligne `/es/buscaminas/archive/2026-10-07` compte trois impressions et un clic. La requête `buscaminas7` compte aussi trois impressions/un clic, sans jointure page-requête : aucune attribution entre ces lignes n’est possible. C’est un signal faible d’exposition au jeu, pas une demande de tutoriel démontrée ; les lignes sont incomplètes.

Analytics `available`, collecte 13:22:48.704Z : vingt départs, dix-huit fins et six identités compte/appareil sur le 3 octobre–1er novembre UTC, jour courant partiel ; trois sessions consenties. Aucun départ sur la fenêtre 26 octobre–1er novembre partielle. Ces unités ne sont pas des personnes uniques et ne permettent pas de diagnostiquer une friction Démineur.

Trends, collecte 13:22:52.330Z : RSS Google FR/US/DE/ES disponibles, surtout actualités/sport ; aucun signal établi de demande pour ce guide. TikTok indisponible. Les faibles données ne justifient ni nouveau jeu opportuniste ni promesse de croissance.

## Protocole fixé avant publication

Objectif SEO, type product. Hypothèse : des exemples concrets rendent le guide plus utile et peuvent améliorer la visibilité des pages Démineur existantes. Mesure exploratoire `google.impressions`, deux fenêtres de trente jours complets finalisés, au moins cent impressions dans chacune, amélioration relative visée 0,2. Baseline et dates calculées par le superviseur. Échantillon insuffisant : résultat inconclusif, sans baisse rétrospective du seuil.

Les impressions globales et les autres changements SEO empêchent une attribution exclusive ou causale. Aucun gain direct garanti. Les protocoles Word, vocabulaire et Sudoku restent inchangés. Ne pas prolonger cette expérience par des paragraphes supplémentaires avant observation.

Validation locale : 95 tests réussis dans `seo.test.ts`, `game-guide.test.ts` et `engines.test.ts` ; typecheck et lint réussis. Les contrôles indépendants du superviseur restent distincts. Aucun navigateur ni build exécuté par l’agent.
