# Entrée Google → première partie — audit du 27 octobre 2026

Source examinée : `24de100089f917e7067c49866c0f073dd98c0686`.
Décision : ne pas ajouter de CTA ni changer le chargement sans preuve de friction.
Cet audit de code ne mesure ni le rendu navigateur, ni le temps de chargement,
ni la conversion. Aucune modification produit ou mise en production.

## Observations disponibles

Search Console `status=available`, collecte du 27 octobre à 05:15:11.648Z :
fenêtre demandée du 26 septembre au 25 octobre, dernière date rapportée le
24 octobre, données finales en America/Los_Angeles. Totaux collectés séparément :
177 impressions et 6 clics. Les lignes de pages montrent `/es/palabra` à
29 impressions sans clic et `/fr/mots-meles` à 13 sans clic. Les lignes de
requêtes incluent « palabra del dia » et « mots mêlés en ligne », mais aucune
jointure page/requête n'est fournie. Ces lignes incomplètes ne constituent
pas des totaux exhaustifs. Les clics ne sont pas des personnes ou des visites.

Analytics `available`, collecte à 05:15:10.133Z : 30 jours UTC du 28 septembre
au 27 octobre, dernier jour partiel, six identités compte/appareil, 20 départs,
18 fins et trois sessions de visite consenties. Sept jours : une identité,
un départ et une fin, aucune session mesurée. Le funnel n'est pas une séquence
individuelle et les visites facultatives ne représentent pas tout le trafic.
Ces agrégats ne permettent pas de calculer une conversion Google → partie.
D+7 : cinq dénominateurs matures, aucun retour ; D+30 : aucun dénominateur,
pourcentage inconnu (`null`). Aucun diagnostic de rétention par page possible.

Contexte observation `228dc69c307fcf4c5d61a7cbea34dfef20b3c7327f96c63f336f8ec43908522c`,
collecté à 05:15:15.259Z : `word-guide-worked-deductions` proposé,
`published-vocabulary-discovery` en revue humaine ; les deux attendent un
déploiement vérifié. `lastFailure` et `unverifiedWork` sont nuls. Leurs ajouts
ne figurent pas dans le guide de cette source ; ne pas les réimplémenter ici.

Trends, collecte à 05:15:14.320Z : RSS Google FR/US/DE/ES accessibles,
principalement actualités et sport ; aucun signal consulté ne justifie un
nouveau jeu. TikTok indisponible, sans conclusion sur sa popularité.

## Parcours établi par lecture

| Étape | Word | Mots mêlés |
| --- | --- | --- |
| Page de base | Daily, introduction et règles rendues par la route | Practice sur la page indexable, sans nouveau Daily |
| Attente initiale | GamePlayer affiche GamePreview pendant la préparation du compte et du résultat | PracticePlayer affiche le preview, puis demande ou restaure un run avant GamePlayer |
| Interaction | WordGame accepte clavier et touches à l'écran après préparation | ClassicGame expose Démarrer et attend beginPlay avant session.start |
| Avant le départ | Grille de lettres vide dans le preview | Preview affiche des lettres ; le plateau interactif en attente masque les lettres par CSS data-locked |
| Compte | Aucun écran d'inscription imposé dans ce parcours | Aucun écran d'inscription imposé dans ce parcours |
| Incident | Chemins réseau à vérifier dans le navigateur | PracticePlayer propose Réessayer si sa préparation échoue ; startSearch affiche networkError si beginPlay échoue |

Sources : `src/app/[locale]/[...segments]/page.tsx`,
`src/components/{game-player,practice-player,game-preview,word-game,classic-games}.tsx`,
`src/app/globals.css`, `src/lib/seo-content.ts`.

L'absence de bouton interactif dans le preview est une attente d'hydratation,
pas une preuve de blocage. Aucun délai n'a été mesuré. Ajouter un autre CTA
risquerait seulement de dupliquer l'entrée existante. Le preview Mots mêlés
mérite en revanche une vérification distincte : distinguer l'aperçu généré
avec `page-preview-v1` du véritable run puis de sa restauration. Le masquage
CSS ne démontre pas un masquage pour les technologies d'assistance. Aucun
changement de protection ou d'autorité serveur n'est proposé sur cette base.

## Vérifications et prochaine investigation

`npm test -- --configLoader=runner tests/seo.test.ts tests/content.test.ts` :
33 tests réussis, deux fichiers, code 0. Ils couvrent les contrats SEO et de
contenu existants, pas une conversion ni une hydratation navigateur.
Le scénario Mots mêlés de `e2e/classic-games.spec.ts` parcourt les quatre
langues sur une archive du 3 octobre ; ce n'est pas la page de base Practice.
Aucun serveur, build ou test navigateur exécuté pendant cet audit.

Prochaine mission : préparer une vérification navigateur des pages de base
Word et Mots mêlés dans les quatre langues, sans compte, avec contexte et
base E2E jetables. Observer le preview, la préparation puis la première
interaction ; ralentir uniquement les réponses API dans le test pour
identifier les phases. Pour Mots mêlés, vérifier l'absence de départ avant
Démarrer, un départ après clic, et le comportement après échec puis reprise.
Vérifier séparément texte visible et arbre accessible avant le départ,
sans prendre un simple masquage CSS pour une garantie. L'exécution avec
serveur reste à la charge du superviseur. Décider d'un changement seulement
sur reproduction ; ne pas ajouter de télémétrie ou modifier le consentement.

Si une intervention produit est ensuite justifiée, lui donner un nouvel
identifiant et son propre protocole avant publication. Pour le présent audit,
`playing.starts` est un indicateur de suivi seulement : 14 journées UTC
complètes, minimum 20 départs dans chacune des deux fenêtres, seuil exploratoire
+20 %. Avec le faible volume actuel, une évaluation peut rester insuffisante.
Le superviseur calcule les fenêtres ; aucun effet ni causalité attribuable à
ce document. Les critères des deux expériences précédentes restent inchangés.
