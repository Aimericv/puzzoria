# Relier les deux défis de football

## Décision du 3 novembre 2026

Base exportée : `34a006d411cc6696496c51953b84cb9712e27fad`.
L’audit des nouveaux jeux confirme les liens du catalogue, les huit sujets de
quiz traduits, leurs descriptions, canoniques, hreflang et entrées sitemap.
Les cartes QuizTopics relient déjà les huit sujets entre eux. Il n’y a donc
pas de défaut général de couverture établi.

La barre latérale Football propose le quiz général, mais aucun lien direct
vers le sujet des vainqueurs du Mondial. L’expérience ajoute un court passage
contextuel et un lien réciproque entre la page Football et ce sujet précis,
dans les quatre langues. Elle explique les deux formats : carrière à reconnaître
en six essais sans chrono solo, ou huit nations à retrouver en 60 secondes,
avec la borne 1930–2022 explicite. Les intitulés et destinations réutilisent le
catalogue. Le passage précède les autres sujets de quiz et le guide existant.
Il n’apparaît pas sur les autres sujets ou les alias `/practice`.

C’est une expérience de découverte et de maillage interne, pas la correction
d’un lien cassé ni une friction mesurée. Aucun nouveau chemin, corpus,
résultat, événement de mesure ou changement des preuves serveur n’est ajouté.

## Preuves et limites

Observation superviseur `120e9018312fb5ebd653f1783947aba71544a7bbff3bea5967bd0f377fe0ccba`,
collectée le 3 novembre à 14:13:22.594 UTC : aucun échec ou travail non vérifié.
Les guides Sudoku/Démineur sont désormais confirmés déployés ensemble le
2 novembre à 15:58:17.755 UTC. Leurs fenêtres, comme celles des expériences
Word/vocabulaire, restent immatures.

Analytics `available`, collecté à 14:13:17.857 UTC : du 5 octobre au 3 novembre
UTC, jour courant partiel, six identités compte/appareil et vingt départs,
dont dix-huit Word ; trois sessions et deux visiteurs dans la seule fraction
consentie. Aucun départ Quiz/Football observé dans ce rapport. Cela ne démontre
ni leur exposition, ni une demande, ni un abandon attribuable à leur navigation.

Google `available`, collecté à 14:13:19.204 UTC : 180 impressions et six clics
sur la période demandée du 4 octobre au 2 novembre, dernière date rapportée
le 1er novembre Pacific. Les lignes partielles ne permettent pas de prouver
l’indexation ou la non-indexation des nouveaux jeux. Les clics ne sont pas des
personnes ou des sessions Puzzoria.

Google Trends RSS FR/US/DE/ES disponible le 3 novembre à 14:13:21.906 UTC :
des événements sportifs figurent parmi les sujets, mais ne prouvent aucune
demande pour les deux formats Puzzoria. TikTok est indisponible. Aucun corpus
d’actualité n’est créé et aucune tendance n’est assimilée à une mesure produit.

## Protocole fixé avant publication

Identifiant : `football-world-cup-discovery`, SEO/product, décision `propose`.
Hypothèse : un lien explicite entre deux défis de football peut faciliter la
découverte du sujet profond et contribuer à sa visibilité organique.
Métrique : `google.impressions`, trente journées complètes finalisées par
fenêtre, au moins cent impressions dans chacune et amélioration relative de
20 %. Baseline et dates de publication relèvent du superviseur. Un échantillon
insuffisant reste inconclusif. Cette métrique globale n’isole pas les pages
ciblées ; les interventions concomitantes empêchent une attribution causale.
Examiner les lignes de pages à titre descriptif lorsqu’elles sont disponibles.
Aucun effet de production n’est revendiqué avant déploiement confirmé.

## Vérifications locales

- 47 tests réussis dans `football-discovery`, `seo` et `knowledge`, dont huit
  nouveaux cas de rendu, traduction, portée et correspondance sitemap/hreflang.
  Le premier passage a révélé une mauvaise URL allemande dans la fixture du
  test ; elle a été corrigée selon la route existante, sans changer celle-ci.
- Lint et typecheck réussis sur l’état final du code et des scénarios.
- `npm run content:validate` échoue sur l’IPC de tsx interdit par le sandbox.
  Le même script exécuté avec `node --import tsx scripts/validate-content.ts`
  réussit : quiz/carrières, 92 défis et 32 articles validés.
- Le scénario E2E sans JavaScript est découvert sur les quatre projets
  Playwright. Il suit les liens dans les deux sens pour les quatre langues ;
  découverte des tests uniquement, aucune exécution navigateur revendiquée.

Suite complète, navigateur et build restent aux contrôles indépendants du
superviseur. La publication et le déploiement sont des étapes distinctes.

## Prochaine investigation choisie

Examiner le recul récent des impressions Google avec des fenêtres réellement
complètes et identiques, puis dater ce recul par rapport aux publications
confirmées. Le rapport sur sept jours demandés n’affiche que deux impressions
mais son dernier jour demandé n’est pas rapporté : ne pas utiliser ce chiffre
brut comme une comparaison finale. Séparer limites de collecte, saisonnalité
possible et défaut technique reproductible, sans retouche SEO automatique.
