# Exemples de résolution dans le guide Sudoku

## Choix du 30 octobre 2026

L’inbox du propriétaire privilégie l’acquisition. La mission héritée de rétention Word est donc différée. Le guide Sudoku existant explique les candidats sans montrer une déduction complète ni la différence entre candidat unique et position unique. Ajouter ces exemples sur les pages existantes est une expérience éditoriale ; aucune nouvelle URL, fonctionnalité d’aide ou grille du jour n’est créée.

Sources consultées : contexte `89599514453ab342db33974abd28835a811774409690d7f8e7ef1afcd9fab7f2`, collecté le 30 octobre à 19:13:12.254Z ; Google Search Console à 19:13:09.112Z ; analytics à 19:13:07.855Z ; tendances à 19:13:11.260Z.

Google est disponible : 179 impressions et six clics sur les 30 jours demandés du 30 septembre au 29 octobre, dernière date rapportée le 28 octobre (America/Los_Angeles). Les lignes Sudoku EN/ES/FR ont respectivement quatre, deux et une impressions sans clic. Ces lignes partielles ne prouvent ni une demande de tutoriel ni un problème de conversion. Aucun lien requête/page n’est disponible. Les signaux RSS FR/US/DE/ES, surtout actualités et sport, ne justifient pas un nouveau jeu ; TikTok est indisponible.

Analytics disponible : six identités compte/appareil, 20 départs, 18 fins sur le 1–30 octobre UTC, jour courant partiel. Trois sessions consenties ne représentent pas tout le trafic. Aucune personne unique ni abandon dû au manque d’explications n’est établi.

## Contribution

Deux sections `{title, text}` par langue EN/FR/ES/DE dans `src/lib/seo-content.ts`, en conservant les sections précédentes et le code de rendu :

- une ligne fictive à laquelle manquent 5 et 8, avec élimination du 8 par la colonne ;
- quatre listes complètes de candidats, où seul le premier emplacement autorise 7 malgré plusieurs candidats par case.

Les exemples sont indépendants des puzzles publiés. Ils indiquent aussi de vérifier les blocs et d’actualiser les notes. Le moteur ne change pas, les indices restent désactivés.

## Protocole fixé avant publication

Expérience `sudoku-guide-single-deductions`, objectif SEO, type product. Hypothèse : des explications de résolution concrètes rendent les pages Sudoku existantes plus utiles et peuvent améliorer leur visibilité organique. Métrique exploratoire : `google.impressions`, 30 journées complètes finalisées par fenêtre, minimum 100 impressions dans **chaque** fenêtre, amélioration relative minimale 0,2. Baseline et dates effectives déterminées par le superviseur. Si un seuil manque, résultat insuffisant ; ne pas abaisser les critères ensuite.

Les impressions globales ne permettent pas d’isoler ces paragraphes. Examiner aussi les lignes Sudoku comme diagnostic descriptif, sans leur donner une nouvelle règle de réussite. Les expériences Word et vocabulaire déployées ensemble le 27 octobre attendent toujours leurs fenêtres complètes. Un avant/après ne prouvera pas la causalité.

## Vérification

Le premier exemple a été vérifié contre `candidates` et `validSudoku` avec une grille fictive ; les listes du second vérifiées pour l’unicité du 7 et l’absence de candidat unique. Vérification locale des cinq sections par langue. Suites SEO/rendu : 36 tests ; moteurs : 59 tests. Aucun test navigateur ni build exécuté par l’agent. Les autres contrôles et leurs limites sont consignés dans la mémoire de session. Aucun effet produit ni déploiement revendiqué.
