# Audit SEO et lancement international

Audit initial du dépôt le 3 octobre 2026. Le site est désormais publié sur `https://puzzoria.com`, en français, anglais, espagnol et allemand. Le diagnostic d'accès après publication est consigné ci-dessous ; il ne constitue pas une mesure du classement ou de l'indexation Google.

## Blocage Search Console corrigé après publication

Le contrôle du déploiement après le signalement du 7 octobre 2026 a confirmé deux protections de préparation encore actives dans `/etc/caddy/Caddyfile` :

- `@outside not remote_ip 77.204.181.147/32` avec une réponse HTTP 503 bloquait tous les visiteurs autres que le propriétaire, y compris les robots. Depuis le VPS, `/`, `/robots.txt` et `/sitemap.xml` retournaient effectivement 503 avec « Puzzoria est en preparation. ». Le propriétaire pouvait ouvrir les fichiers depuis son navigateur, ce qui ne validait pas leur accessibilité publique.
- `header >X-Robots-Tag "noindex"` interdisait aussi l'indexation des réponses accessibles. Cette directive globale devait être supprimée indépendamment du filtre IP.

Les deux règles ont été retirées en production après sauvegarde et validation de la configuration Caddy. Le proxy continue d'écraser l'adresse transmise à l'application ; les protections de compte, les canoniques et les directives noindex des pages privées restent dans l'application. Aucune modification de DNS, de base de données ou de l'image Docker n'a été nécessaire.

Vérifications après correction :

- Résolveurs publics Cloudflare et Google : A `37.27.24.173`, aucun AAAA publié ; `www` est un CNAME vers `puzzoria.com`.
- Certificats HTTPS validés par les clients, HTTP redirigé vers HTTPS et `www` vers le domaine sans `www`. `/` redirige vers `/en` pour une requête sans préférence linguistique, puis retourne 200.
- Les quatre accueils, robots et sitemap retournent 200 depuis le VPS. Les mêmes routes restent accessibles avec un User-Agent Googlebot ; ce test ne remplace pas une requête réelle de Google.
- `robots.txt` autorise l'exploration et indique le sitemap HTTPS. Sitemap XML valide, namespace standard, 800 URLs uniques au moment du contrôle, 200 par langue, sans URLs Practice/compte/statistiques/duels privés ni paramètres.
- `npm run release:public -- https://puzzoria.com` réussit : 44 pages publiques, canonical/hreflang, indexation publique, noindex privé/Practice, CSP, cache et disponibilité.

Le service Caddy était actif ; le problème provenait de ses règles de préparation, et non d'un échec DNS ou TLS constaté. Aucun journal d'accès détaillé ne permet d'attribuer une requête historique précise à Google. L'outil web externe a encore retourné une erreur d'accès non qualifiée après correction ; les réponses HTTP contrôlées directement depuis le PC et le VPS constituent les preuves de disponibilité, et la confirmation par Google reste à faire dans Search Console.

À refaire dans Search Console : soumettre `https://puzzoria.com/sitemap.xml`, lancer un nouveau test en direct sur `/fr`, `/en`, `/es`, `/de`, puis demander l'indexation si la récupération réussit et que l'indexation est autorisée. L'ancien résultat conserve la trace du blocage passé. Si un nouveau test échoue, relever l'heure et la valeur exacte de « Disponibilité de la page → Exploration → Récupération de page ».

Références Google : [erreurs d'exploration](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors), [directive noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [rapport Sitemaps](https://support.google.com/webmasters/answer/7451001?hl=fr).

## Diagnostic et corrections livrées

La base existante avait déjà des pages localisées, des métadonnées et un sitemap. Plusieurs incohérences empêchaient de la considérer comme prête.

| Point constaté                                           | Correction                                                                                                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pages noindex bloquées dans robots.txt                   | Crawl autorisé pour lire la directive ; comptes, statistiques, classements et Illimité conservent noindex. Les endpoints utiles au rendu ne sont plus bloqués. |
| Deux canoniques pour le même Sudoku facile               | Une canonique sans `/easy`, y compris en archive. Le quotidien n'a qu'une grille ; seuls les niveaux des anciennes archives gardent des URLs distinctes.       |
| x-default trop générique, perdant parfois le niveau      | Version anglaise de la même page, même date et même niveau.                                                                                                    |
| Archives Sudoku incomplètes dans le sitemap              | Trois niveaux jusqu'au 4 octobre, une grille ensuite, alternatives identiques aux pages, aucun alias en doublon.                                               |
| Titres de jeux trop vagues                               | Titres et descriptions correspondant au jeu et à la langue, date et niveau ajoutés quand nécessaires.                                                          |
| Jeu affichant seulement un chargement avant JavaScript   | Grille Wordle vide, chiffres donnés Sudoku et nombres/cible du calcul présents dans le HTML. Réponses privées ; JavaScript reste nécessaire pour jouer.        |
| Peu de contenu explicatif                                | Règles, méthodes et limites réelles des trois jeux, traduites dans les quatre langues et visibles sous le jeu.                                                 |
| Changement de langue uniquement via une liste déroulante | Liens HTML conservant jeu, mode, archive et niveau.                                                                                                            |
| Pas d'image de partage ni de données structurées         | Quatre PNG 1200 × 630 ; WebSite, CollectionPage/ItemList et WebPage/BreadcrumbList décrivant le contenu réel.                                                  |
| Origine de développement utilisée par défaut             | Origines locales, privées et d'exemple en noindex ; `npm run seo:check` signale le domaine manquant.                                                           |
| Contrastes et libellés relevés par Lighthouse            | Contrastes des numéros de cartes et emplacements partenaires renforcés ; nom accessible de la marque et rôles des cases corrigés.                              |

Google doit récupérer une page pour lire son noindex. Les alternatives linguistiques doivent pointer vers les versions correspondantes et se citer réciproquement. Références officielles : [noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing), [versions localisées](https://developers.google.com/search/docs/specialty/international/localized-versions).

## Pages et intentions de recherche

Ces pistes décrivent les besoins auxquels les pages répondent. Ce ne sont pas des volumes de recherche mesurés ni des promesses de positions.

| Langue | Lettres                                              | Sudoku                                          | Calcul                                         |
| ------ | ---------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------- |
| FR     | Wordle français, mot du jour 5 lettres               | sudoku gratuit en ligne, facile/moyen/difficile | jeu de calcul mental, six nombres et une cible |
| EN     | daily five-letter word game, Wordle-style puzzle     | free online Sudoku, easy/medium/hard            | numbers game, six numbers and a target         |
| ES     | Wordle español, palabra del día de cinco letras      | sudoku online gratis, fácil/medio/difícil       | juego de cálculo, seis números y un objetivo   |
| DE     | deutsches Wordle, Wort des Tages mit fünf Buchstaben | Sudoku kostenlos online, leicht/mittel/schwer   | Rechenrätsel, sechs Zahlen und eine Zielzahl   |

L'accueil présente la collection ; chaque jeu répond à une intention précise. Le Sudoku quotidien dispose d'une seule URL ; `/medium` et `/hard` redirigent en 308 vers celle-ci. Les trois niveaux Illimité restent noindex. Les niveaux des archives publiées jusqu'au 4 octobre restent distincts ; les archives à compter du 5 octobre ne publient qu'une grille. Les archives restent des défis jouables, avec date et contenu réel. Le sitemap référence les 31 jours précédents publiés, sans jour futur : 684 URLs uniques pour la date de référence du 3 octobre, réparties équitablement entre langues. Les archives plus anciennes restent accessibles.

Comptes, statistiques, classements et Illimité conservent la stratégie noindex existante. Les graines aléatoires ne deviennent pas des URLs indexables. Une stratégie spécifique pour les recherches « Wordle illimité » pourra être décidée ensuite ; le quotidien explique et propose déjà ce mode.

Les données structurées ne contiennent ni avis inventés, ni notes, ni récompenses promises. Elles ne garantissent pas un résultat enrichi. Références : [fil d'Ariane](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb), [nom du site](https://developers.google.com/search/docs/appearance/site-names).

## 2048, démineur et mots mêlés

Les neuf jeux sont présents dans les liens HTML et les données structurées de la collection. 2048, Minesweeper/démineur/buscaminas et Word search/mots mêlés/sopa de letras/Wortsuche ont chacun leurs titres, descriptions, aperçus et trois sections de règles et conseils dans les quatre langues. Les niveaux du démineur suivent les canoniques du Sudoku : facile sans suffixe, moyen et difficile distincts. Les nouvelles archives commencent le 3 octobre, sans fabriquer des jours antérieurs. Voir [les nouvelles routes et leurs règles](NEW-GAMES.fr.md).

## Jeux sociaux

Classement à l'aveugle, Devine le nombre et Tu préfères ont des routes traduites, contenus explicatifs visibles sans JavaScript, canoniques et cinq alternatives linguistiques réciproques. Les niveaux du bot suivent les mêmes règles de canoniques ; les pages Illimité et liens privés de duel restent en noindex. Les données structurées et métadonnées ne comportent aucune population ou statistique inventée. Les PNG personnels exigent le propriétaire et restent privés, sans indexation. Voir [le catalogue, les routes et les calculs communautaires](SOCIAL-GAMES.fr.md).

## Avant et après la publication

1. Choisir le domaine et configurer `NEXT_PUBLIC_SITE_URL` avec son origine HTTPS, sans chemin, paramètres ni identifiants. Configurer `AUTH_ORIGIN`, stockage persistant et proxy selon README/RETENTION. Ne pas utiliser un domaine d'exemple.
2. Exécuter `npm run seo:check`, puis `npm run build`. Le contrôle vérifie la configuration, pas le DNS ou le déploiement. Sans domaine public, il échoue volontairement et les pages restent en noindex.
3. Après déploiement, vérifier les quatre accueils, jeux, niveaux et archives : HTTP 200, canoniques HTTPS du domaine choisi, cinq alternatives réciproques dont x-default, absence de noindex sur les pages publiques. Routes inexistantes et dates futures : HTTP 404. Les pages privées gardent noindex.
4. Conserver une origine publique unique ; rediriger de façon permanente HTTP et l'éventuelle variante www. Les accès directs `/fr`, `/en`, `/es`, `/de` doivent rester stables, quelle que soit la langue du navigateur.
5. Vérifier robots, sitemap et les quatre images sur le domaine public. Protéger les prévisualisations au niveau de l'hébergement : le détecteur d'origine ne reconnaît pas tous les domaines de staging possibles.
6. Vérifier le domaine dans Google Search Console, soumettre le sitemap et inspecter des URLs des quatre langues. Suivre pages découvertes/indexées, requêtes, impressions, clics et CTR par page/langue. La soumission ne garantit pas l'indexation.
7. Mesurer les performances sur l'hébergement et sur téléphones, puis surveiller les Core Web Vitals lorsque des données existent. LCP, INP et CLS des utilisateurs réels restent inconnus. [Référence officielle](https://developers.google.com/search/docs/appearance/core-web-vitals).

## Acquisition après la technique

La technique permet aux moteurs de comprendre le site ; elle ne crée pas seule sa notoriété. Aucun mécanisme ne garantit la première place. [Guide Google](https://developers.google.com/search/docs/fundamentals/seo-starter-guide).

Améliorer ensuite les pages et les jeux à partir des requêtes réelles et des retours dans chaque langue. Une relecture native affinera les textes et la sélection des mots. Éviter de multiplier les variantes automatiques d'un même article.

Pour les futurs articles envisagés, répondre à un besoin concret : technique Sudoku avec grille annotée, stratégie de calcul avec plusieurs solutions, ou informations vérifiées et sourcées complétant un futur quiz. Relier naturellement article et jeu. Ces articles et les nouveaux jeux restent des idées, sans publication dans cet audit.

Le partage des résultats et des présentations ciblées à des communautés sont des pistes pour faire découvrir le site et obtenir des mentions éditoriales. Aucun message externe n'a été envoyé, aucun lien acheté et aucun contenu automatique publié.

## Vérification locale

Les réponses API restent récupérables pour le rendu mais portent `X-Robots-Tag: noindex` pour ne pas indexer du JSON comme une page de jeu.

Mesures Lighthouse mobiles de l’audit initial, avant l’ajout des trois nouveaux jeux :

| Page       | Performance | Accessibilité | Bonnes pratiques | LCP   | TBT   | CLS |
| ---------- | ----------- | ------------- | ---------------- | ----- | ----- | --- |
| Accueil FR | 100         | 100           | 100              | 1,8 s | 50 ms | 0   |
| Wordle FR  | 100         | 100           | 100              | 1,8 s | 50 ms | 0   |

Le TBT est une mesure de laboratoire et ne remplace pas l'INP réel. Les scores d'accessibilité automatiques ne remplacent pas une vérification humaine.

Les tests unitaires couvrent canoniques, dates, alternatives, sitemap, origines et JSON-LD. Les tests navigateur contrôlent les quatre langues sans JavaScript, noindex, HTTP 404, PNG et les parcours des jeux sur quatre profils.

Lighthouse 13.5.0 utilise un serveur Next de production séparé, en localhost, Chrome headless et le profil mobile simulé. Rapports : `.sites-runtime/lighthouse-*.report.html` et `.report.json`, ignorés et exclus des traces de production. Ce ne sont ni des mesures de classement ni des données d'utilisateurs réels. Le score SEO Lighthouse n'est pas publié : localhost est volontairement en noindex. Chiffres et commandes finales dans README.


Depuis le 4 octobre 2026, seuls Mot, Sudoku, Calcul et Démineur publient des quotidiens. Les pages principales 2048, Mots mêlés et jeux sociaux conservent leurs URL, guides HTML, canoniques et hreflang, mais ouvrent l’Illimité. Leurs alias `/practice` restent noindex. Le sitemap conserve leurs journées historiques jusqu’au 4 octobre, sans générer de nouvelle archive après cette date. Le domaine public configuré est `https://puzzoria.com`.

Le Mot insolite reste une variante du Mot, avec son quotidien indépendant et un seul mot par jour/langue. Depuis le 5 octobre, ses alias `/practice` redirigent définitivement vers ses pages quotidiennes dans les quatre langues ; aucun nouveau run illimité de cette variante n'est créé. Ses URL quotidiennes et historiques, leurs réponses publiées, les canoniques et les fiches de découverte restent conservées.

Les 32 mots du catalogue Mot insolite ont maintenant une fiche approfondie rendue côté serveur, avec définition, prononciation, étymologie, exemples, mots proches, anecdote et sources. La définition courte après la partie est conservée. Les URLs des fiches sont stables et localisées (`mots`, `words`, `palabras`, `woerter`). Pour préserver la découverte du quotidien, une fiche n'est publique qu'au lendemain de la première journée de son mot ; auparavant, seul le propriétaire d'une partie terminée sur ce mot peut l'ouvrir, en noindex. Les futurs mots n'entrent ni dans le sitemap ni dans les recommandations. Les fiches publiques ont une canonique sans paramètres, du JSON-LD Article et des alternatives réciproques uniquement pour les concepts réellement équivalents ; x-default utilise la fiche anglaise si elle existe et est publiée. Le changement global de langue depuis une fiche rejoint le Mot insolite de la langue choisie. Les origines locales restent noindex.
## Contrôle du vrai domaine

Le contrôle du 8 octobre couvre les 812 URLs publiques du sitemap : toutes avaient titre, description, canonique correcte, langue et hreflang réciproque ; aucun titre en double. Il a identifié 148 groupes de descriptions identiques entre niveaux, soit 444 pages concernées. Les descriptions différencient désormais la difficulté des pages concernées et conservent la date de l'archive ; les données structurées et aperçus sociaux utilisent cette même description. Les URLs, réponses et identifiants publiés ne changent pas. Le Sudoku distingue une grille quotidienne des trois niveaux Illimité, et le Mot insolite explique son unique rendez-vous quotidien puis le retour au Wordle classique Illimité. La confidentialité a une description localisée explicite et ne qualifie plus la production de version de développement.

L'éditeur a confirmé Hetzner et la région Helsinki (Finlande) et demandé de ne pas publier de coordonnées personnelles. Les champs d'identité/adresse/pays/contact de l'éditeur restent donc vides ; les contrôles de configuration légale ne sont pas assouplis. Seules les données vérifiées de l'hébergeur et sa région sont configurées. Références hébergement : [coordonnées Hetzner](https://www.hetzner.com/legal/legal-notice/vserver/), [régions Cloud](https://docs.hetzner.com/cloud/general/locations/). Ce renseignement partiel ne constitue pas une validation complète des informations de publication.

Le favicon déclaré utilise désormais `/favicon.ico` (16, 32 et 48 px) et `/favicon-96.png` (96 × 96 px), dérivés du symbole SVG existant sans changer la marque. La documentation Google du 28 août 2026 liste BMP, GIF, ICO, PNG, JPEG, PPM et TIFF pour les résultats de recherche ; le SVG seul n'est pas un format listé. Les deux fichiers sont publics et leurs URLs sont stables. Leur présence dans le HTML des quatre langues et leur réponse HTTP sont contrôlées après reconstruction/publication. Google doit réexplorer la page d'accueil et le favicon pour actualiser son affichage ; ce contrôle ne garantit ni son apparition ni le comportement du pictogramme de Search Console. [Règles officielles favicon](https://developers.google.com/search/docs/appearance/favicon-in-search).

`npm run release:check` refuse une configuration de publication incomplète. Après configuration du domaine HTTPS et reconstruction de l'image, `npm run release:public -- https://DOMAINE-REEL` vérifie les pages des quatre langues, canonical/hreflang, indexation publique, noindex privé/Practice, CSP/cache, robots, sitemap et disponibilité. Cela ne remplace ni la vérification Search Console ni des mesures de performance sur le VPS réel. Le domaine n'est pas réservé par cette commande. Voir [PREPRODUCTION.fr.md](PREPRODUCTION.fr.md).
