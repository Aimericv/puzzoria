# Acquisition quiz : premier lot thématique

Autorisé par l’éditeur le 3 novembre 2026 après la comparaison JetPunk/Puzzoria. Objectif : améliorer la découverte des jeux existants, sans migration d’URL, nouvelle collection de réponses, nouvelle permission de mesure ni promesse de classement.

## Pages et parcours

Deux pages, chacune en quatre langues :

| Thème | FR | EN | ES | DE |
| --- | --- | --- | --- | --- |
| Géographie | `/fr/quiz/geographie` | `/en/quiz/geography` | `/es/quiz/geografia` | `/de/quiz/geografie` |
| Football | `/fr/quiz/football` | `/en/quiz/football` | `/es/quiz/futbol` | `/de/quiz/fussball` |

Chaque page donne accès aux jeux existants : quinze sujets de géographie et quatre de football. Le football relie également le jeu de parcours, avec son Daily et son mode illimité. Pas de compte ni de création de run sur une simple visite du répertoire. Les sujets gardent leurs URL, réponses, versions, cohortes, chronos et duels.

Les pages proposent des groupes de pratique, des conseils et une description honnête des formats actuellement jouables. Le catalogue, les pages de sujets et le jeu de parcours les relient par de vrais liens HTML. Les sujets ont quatre voisins éditoriaux : pays d’Europe/capitales/UE, États/capitales américaines, palmarès/stades/sélections, avec quelques passerelles utiles. Le thème apparaît aussi dans le fil d’Ariane structuré. Le changement de langue conserve le thème.

Les huit nouvelles pages ont titre et description propres, canonique stable, hreflang réciproque, x-default anglais, CollectionPage/ItemList/BreadcrumbList et entrée dans le sitemap. Le nonce et la politique de cache existants s’appliquent. Les origines locales restent noindex. Les Practice et archives ne changent pas de politique.

## Enrichissements utiles

Onze sujets prioritaires : monde, Europe, UE, capitales des États américains, Länder, régions françaises, drapeaux, C1, stades, sélections et Coupe du monde. Chaque traduction fournit une méthode spécifique, un piège de périmètre et des références primaires. Ce contenu remplace le guide générique sur ces sujets ; il se trouve après le jeu, sans repousser son accès. Les réponses privées et futurs contenus Daily ne sont pas publiés dans ces textes.

Vérifications publiques du 3 novembre : [ONU M49](https://unstats.un.org/unsd/methodology/m49/), [Union européenne](https://european-union.europa.eu/principles-countries-history/eu-countries_en) et [UEFA, palmarès](https://www.uefa.com/uefachampionsleague/history/winners/). Les sources de chaque snapshot restent dans [QUIZ-EXPANSION-SOURCES.md](../content/QUIZ-EXPANSION-SOURCES.md) et [KNOWLEDGE-SOURCES.md](../content/KNOWLEDGE-SOURCES.md). Les anciens périmètres datés restent explicitement datés : notamment Mondial jusqu’en 2022, pas un faux palmarès à jour en 2026.

[Google recommande des liens explorables et des ancres contextuelles](https://developers.google.com/search/docs/crawling-indexing/links-crawlable). Cela justifie la méthode ; ce n’est ni une prévision de clics ni une garantie de gain. Les regroupements éditoriaux sont une hypothèse à mesurer, pas la preuve d’une demande Google égale entre langues.

## Mesure et décision

Le rapport hors ligne `scripts/report-quiz-acquisition.ts` conserve les 96 lignes par sujet/langue et ajoute `themes`, huit lignes d’impressions/clics/position sur les URL thématiques. Il n’exporte pas les requêtes brutes. Une ligne absente du top 100 Google reste inconnue (`null`). Les visiteurs d’un thème ne sont pas la somme des comptes/appareils de ses sujets ; aucun nouveau taux de conversion Google → joueur n’est déduit de sources incompatibles.

La mesure facultative existante conserve les huit routes reconnues sans paramètres. Elles n’ont ni `game` ni `mode` : visiter un répertoire ne doit pas être considéré comme jouer. Routes inconnues, entrées privées, DNT/GPC, refus et exclusions administrateurs/robots gardent leurs protections. Le tableau de bord existant des pages d’entrée peut ainsi distinguer ces pages pour les sessions consenties ; l’historique auparavant regroupé sous `/quiz` n’est pas réattribuable.

À la publication, noter commit/date puis reprendre les observations à 7 et 28 jours **complets**, en respectant le décalage de Search Console. Comparer pages et langues ; garder les métriques de parties vérifiées séparées des sessions consenties. Aucun résultat de croissance de ce lot n’est encore observé. Le suivi et les seuils de tri restent ceux de [QUIZ-ACQUISITION.fr.md](QUIZ-ACQUISITION.fr.md). Le premier catalogue a été déployé le 3 novembre : ne pas attribuer sans preuve son éventuelle progression au seul nouveau maillage publié plus tard.

## Prochain lot visuel : ordre de développement proposé

Recherche publique complémentaire du 3 novembre : formats par continent chez [JetPunk](https://www.jetpunk.com/tags/geography), drapeaux exhaustifs et régionaux chez [EasyToolbox](https://www.easytoolbox.org/fr/quiz-drapeaux), [FlagsDB](https://fr.flagsdb.com/quiz), [Mapicos](https://mapicos.com/fr/jeux/quiz-drapeaux), blasons chez [Doquiz](https://www.doquiz.fr/sport/football/reconnais-le-logo-du-club/). Ce sont des offres concurrentes observées, pas des volumes de recherches ni des rangs Google mesurés. Trends/Keyword Planner n’ont pas fourni de nouvelle série exploitable dans cette session.

1. **Drapeaux** : premier pilote, images locales cohérentes sur Windows/mobile, puis listes exhaustives ou continentales. Conserver les quinze réponses v1 ; un nouveau périmètre implique un nouveau sujet/version, pas une réécriture silencieuse. Les SVG [Twemoji](https://github.com/twitter/twemoji/blob/master/LICENSE-GRAPHICS) constituent une piste CC BY 4.0 avec attribution, à vérifier fichier par fichier. Ne pas dépendre du rendu variable des émojis.
2. **Carte interactive d’Europe** : premier périmètre de carte, puis extension si impressions et parties suivent. Géométries [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) dans le domaine public ; conserver la convention M49 de la liste, expliquer les frontières, traiter les petits États, navigation clavier et interaction tactile. Les polygones de carte ne doivent pas servir implicitement de définition différente des 44 pays. Ne pas annoncer « carte » sur un quiz textuel avant qu’elle soit jouable.
3. **Blasons de clubs** : réutiliser d’abord les actifs locaux et le manifeste déjà vérifiés du jeu de parcours (140 blasons), sans téléchargement tiers au runtime. Définir une sélection et une version stables, supprimer les éventuels indices textuels involontaires dans le rendu et garder l’attribution/licence existante. Ne pas présumer que la licence du dépôt supprime les droits de marque des clubs. Nouveau quiz visuel, pas nouveau mode du Daily football.

Les trois formats réutiliseront autant que possible le moteur, les limites et les preuves serveur. Ce premier lot n’ajoute pas encore ces formats et n’expose aucun futur parcours ni réponse. Pas de création massive de pages variantes avant un pilote jouable et des signaux d’acquisition utiles.
