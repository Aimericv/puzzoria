# Pilote visuel : placer les pays d’Europe

Préparé après validation des six contrôles et intégration de la PR #43 dans
`main` (`0ea05965b93e86257e080842281711e2b78f666c`). Cette livraison ne déploie
pas le site en production.

## Expérience et règles

Le nouveau sujet `europe-map` étend le jeu `quiz` existant : 44 pays, 10 minutes,
ordre mélangé par partie, uniquement en illimité. Le téléchargement local de la
géométrie doit réussir avant de pouvoir démarrer le chrono serveur. Le joueur
sélectionne une zone puis confirme : une seule tentative par pays. Une erreur ou
un passage ne rapporte aucun point et révèle l’emplacement correct avant de
continuer. Chaque pays est demandé une fois. Terminer ou atteindre le délai
révèle la carte complète ; la carte reste à l’écran après le résultat.

Zoom ×1…×6, déplacement natif au toucher et à la souris, repères agrandis pour sept
petits États. Les flèches parcourent les zones au clavier, Entrée/Espace sélectionne,
puis Tab permet de confirmer. Aucun nom d’un pays non résolu n’est attaché aux
zones. Les corrections sont consultables par nom après la partie. Le périmètre
géographique et les zones grises sont explicités, sans pénaliser un clic sur le
contexte. [Sources et choix géographiques](../content/maps/SOURCES.md).

## Architecture conservée

- Catalogue : `map-quiz-catalog.ts`, sous-type `format: "map"` de `quiz` ; pas de
  nouvelle famille de jeu, route aléatoire, base de données ou dépendance.
- `createRun`, `beginRun`, `submitRun`, `validateProof` et le délai existants
  conservent propriété, démarrage, séquences, retransmission idempotente et rejet
  des réponses tardives. Le rejeu du nouveau format accepte `place`, `map-skip`
  et `finish`, jamais les réponses textuelles. Les anciens quiz sont inchangés.
- Le manifeste privé traduit l’item demandé vers une région opaque. La réponse
  correcte n’est révélée au propriétaire qu’après sa tentative ; toutes les
  solutions seulement à la fin. Aucun placement ni mapping du pair dans le DTO
  du duel. Le duel Quiz existant garde son départ commun et départage score puis
  temps, sans alimenter les cohortes solo.
- `CompletionPanel`, partage, reprise, défilement, aperçu local, export personnel
  et Replay réutilisés. Replay génère un nouveau run Practice et un nouvel ordre.
  L’aperçu local ne sauvegarde pas de résultat.

## Statistiques adaptées

Pays correctement placés sur 44 ; erreurs de placement confirmées ; pays à revoir
(erreurs, passages et pays non tentés) ; temps serveur. Score = placements corrects
/44, sans-faute seulement à 44/44. Comparaison du nombre de placements pour une
partie incomplète ; sans-faute et vitesse parmi les autres sans-faute pour 44/44.
Moyenne des placements et répartition cartes parfaites/autres résultats.

La cohorte `quiz:europe-map:v1:LANGUE` sépare carte et réponses textuelles. Les
seuils de 20 autres comptes/appareils et 20 autres sans-faute, les égalités strictes
et les exclusions habituelles restent applicables. Le record de vitesse personnel
exige un sans-faute compatible. Les comparaisons de présentation existantes restent
en mémoire ; aucune population ni score inventé n’est persisté. Consentement,
authentification et suivi restent inchangés.

## Pages et mesure

| Langue | URL stable |
| --- | --- |
| FR | `/fr/quiz/carte-pays-europe` |
| EN | `/en/quiz/europe-countries-map` |
| ES | `/es/quiz/mapa-paises-europa` |
| DE | `/de/quiz/europa-laender-karte` |

Chaque page a son titre, description, H1, aperçu SVG accessible sans JavaScript,
règles, contenu pédagogique et sources, canonique, hreflang réciproque, x-default
anglais et sitemap. Le catalogue et le thème Géographie pointent vers le jeu ;
les quiz Europe, capitales et UE forment des parcours complémentaires. Aucune URL
existante ne change. Le catalogue comporte désormais 25 sujets / 100 pages.

Le tableau privé et `report-quiz-acquisition.ts` incluent automatiquement ces
quatre routes reconnues : départs, premiers joueurs observés, fins, impressions et
clics Google lorsqu’ils sont disponibles, entrées Google consenties. Conserver le
commit et la date de publication effective, puis observer 7 et 28 jours complets.
Un ajout au sitemap ne prouve ni indexation, ni classement, ni trafic supplémentaire.
L’absence d’une ligne Google reste inconnue, jamais zéro.

## Validation

Tests des 44 pays/noms/géométries, ancres intérieures, sept repères, empreintes,
projections publiques sans mapping ; parties parfaites, erreurs, passages,
abandon et expiration ; propriété, séquences, idempotence et résultat dérivé ;
cohortes/records ; confidentialité du duel et aperçu local. Parcours navigateur
dans les quatre langues : souris/clavier/toucher, correction, reprise, Replay,
partage, statistiques, zoom Vatican, panne de téléchargement avant départ,
absence de débordement mobile et SEO sans JavaScript. Les profils simulés ne
remplacent pas une vérification sur un téléphone physique.

## Déclinaisons préparées, non développées

Réutiliser `quiz` + `format`, le manifeste privé versionné et les contrôles serveur.
Chaque déclinaison doit avoir un vrai jeu, une intention distincte et des données
vérifiées avant d’ajouter sa page au sitemap. Aucune page vide n’est créée.

| Déclinaison | Réutilisation et travail requis | Ordre proposé |
| --- | --- | --- |
| Continents | Même sélection de zones ; périmètres déjà documentés dans les quiz textuels. Valider îles, repères et territoires contestés ; prévoir des cartes adaptées à chaque continent. | Après retour sur le pilote Europe |
| Monde | 195 pays du quiz textuel, projection mondiale et gestion de l’antiméridien, agrandissements des îles/petits États. Valider navigation mobile et durée avant publication. | Ensuite, potentiel large mais UX plus exigeante |
| Régions | France, Länder allemands, États américains : contenus textuels existants, mais nouvelles données Admin 1, licences/périmètres et encarts outre-mer à vérifier. | Selon acquisition observée par langue |
| Drapeaux | Images et alias du quiz existant comme point de départ. Vérifier provenance, variantes, accessibilité et droits pour étendre le jeu ; choix visuel plutôt que carte. | Premier autre format visuel possible |
| Blasons de clubs | Réutiliser les assets locaux du football lorsque leur provenance/droits le permettent ; nom de club après réponse, fallback accessible, score et cohortes propres. Ne pas supposer la licence des logos à partir de celle des cartes. | Selon signaux Football et vérification des assets |

Ne pas préparer un moteur universel spéculatif : stabiliser les interactions et
mesurer ce premier pilote avant d’extraire les points communs réellement utiles.
