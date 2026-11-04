# Couverture Daily et sitemap — 1er novembre 2026

Audit du code exporté d2ac94395c69fab70202bc7f33dfdf4cbe960a07, sans accès réseau ni inspection Google en direct. Objectif : vérifier un frein technique à la découverte avant de multiplier les ajouts éditoriaux.

## Preuves disponibles

Contexte superviseur collecté à 20:01:20.132Z, observation `df22ae27a57dac297f91251ced795b85e4e6408d1c2846ad9ac51e365fd21726` : aucun lastFailure ni unverifiedWork. Les guides Sudoku et Démineur sont fusionnés mais leur déploiement n'est pas établi ; Word et vocabulaire partagent un déploiement confirmé le 27 octobre. Leurs fenêtres de trente jours restent incomplètes.

Search Console disponible, collecte 20:01:18.023Z : trente jours demandés du 2 au 31 octobre, 180 impressions et six clics, dernière date rapportée 30 octobre, fuseau America/Los_Angeles. Sept jours demandés du 25 au 31 octobre : trois impressions, zéro clic. Les lignes par page sont partielles : une URL absente n'est pas une URL non indexée. Aucune inspection d'URL, statistique de couverture d'indexation ou journal de crawl n'est fourni. Ne pas attribuer le faible trafic au sitemap sur cette seule base.

Analytics disponible, collecte 20:01:16.154Z : la série du contexte sur les journées UTC complètes du 2 au 31 octobre contient vingt départs et trois sessions mesurées avec consentement. Ces unités ne sont ni des clics Google ni des personnes uniques et ne forment pas un parcours séquentiel. Les rapports incluant le 1er novembre gardent leur jour courant partiel. D+7 : six identités matures, zéro retour ; D+30 : aucun dénominateur mature, taux inconnu. Pas de mesure d'effet des guides.

Google Trends RSS FR/US/DE/ES disponible à 20:01:19.672Z : événements et sport principalement ; pas de demande de correction du sitemap établie. TikTok indisponible. L'inbox avertit de deux développements séparés (quiz inspiré de JetPunk et parcours de footballeur) : ne pas les dupliquer.

## Chemins vérifiés

- `src/app/sitemap.ts` publie les pages principales disponibles dans quatre langues, dont les cinq Daily actuels, avec niveaux Démineur ; les pages de jeux Illimité restent présentes.
- `archiveDates()` conserve les 31 jours précédents, sans aujourd'hui ni futur. Ce choix est explicite et documenté dans SEO.fr.md. La sortie d'une archive du sitemap ne supprime pas sa route et ne prouve pas sa désindexation.
- Les archives des cinq jeux devenus Illimité s'arrêtent au 4 octobre ; les niveaux moyen/difficile Sudoku restent historiques. Le Mot insolite commence le 4 octobre. À partir du 5 novembre, toute la fenêtre d'archives se trouve après ces changements.
- Les canoniques faciles n'ajoutent pas `/easy`. Les alternatives citent les mêmes dates/niveaux ; les fiches de mots ne citent que les traductions publiées. Le sitemap est dynamique. Le guide Next installé `sitemap.md` rappelle que cette route serait normalement mise en cache sans configuration dynamique.
- L'index d'archives relie les cinq Daily disponibles de sa fenêtre. Les archives plus anciennes ne sont pas listées dans cet index ; il s'agit d'une limite de découverte connue, sans perte de trafic démontrée. Étendre massivement le sitemap n'est pas justifié par les rapports actuels.

## Validation et décision

37 tests passent dans `tests/seo.test.ts` et `tests/word-articles.test.ts`, via `npm test -- --configLoader=runner`. Deux nouveaux cas couvrent la fenêtre après retrait complet des anciennes archives, la présence des Daily, l'absence des routes privées/alias, les alternatives réciproques (fiches incluses) et le basculement à minuit UTC. Typecheck et lint réussis. Ni E2E ni build exécuté dans cette session. Ce sont des appels locaux au générateur, pas une preuve du XML servi en production ni du crawl Google.

Aucun correctif produit requis par les éléments consultés. Recherche arrêtée après cet audit ; aucun gain direct attendu. Suivi exploratoire enregistré : google.impressions, trente jours complets finalisés par fenêtre, cent impressions minimum dans chacune, +20 %. Baseline et dates appartiennent au superviseur ; ce suivi n'attribuerait pas une variation à un audit sans modification produit. Protocoles antérieurs inchangés.

Suite choisie : examiner le chemin fin de partie Word → découverte d'un autre jeu via CompletionPanel, avec les rapports agrégés disponibles. Établir un manque concret avant toute intervention ; ne pas modifier collecte, preuves ou persistance. Respecter les deux nouveaux jeux déjà confiés séparément. Les fenêtres SEO doivent continuer à mûrir, sans nouvelle série automatique de guides.
