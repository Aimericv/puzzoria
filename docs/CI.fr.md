# CI : développement ciblé et validation finale

Cette politique s'applique après intégration de la PR d'optimisation. Aucun
résultat ancien n'est réutilisé et le plafond Actions reste à 1 900 minutes.
Le bot et le déploiement automatique restent désactivés par leurs réglages.

## Deux étapes applicatives

| État de la PR | Vérifications |
| --- | --- |
| Brouillon | Budget, financement/source, tests contrôleur/sécurité, lint, types, unitaires liés aux fichiers modifiés, contenu, SEO, build |
| Prête pour revue | Même socle, tous les unitaires et les quatre suites Playwright complètes : desktop, mobile, android, iphone-webkit |

La sélection utilise `vitest related --run`. Les fichiers serveur, partagés,
de configuration ou inconnus conservent tous les tests unitaires. Une sélection
vide relance tous les unitaires ; un échec ciblé n'est jamais masqué par un repli.
Les dépendances dynamiques et les composants serveur asynchrones ne sont pas
entièrement couverts par cette sélection : les navigateurs restent obligatoires
avant fusion. Aucun résultat ciblé ne vaut validation finale.

En brouillon, **le job `Final validation` refuse de délivrer une preuve finale** après
les contrôles de développement. Son état rouge indique « validation finale
requise », pas une autorisation de supprimer des tests. Passer la PR prête pour
revue déclenche une nouvelle validation complète. Les pushes suivants en revue
relancent le complet. Repasser en brouillon annule le run devenu obsolète via la
concurrence existante. Les modifications du texte de PR ne relancent pas la CI.

Les périmètres documentation et contrôleur gardent leurs vérifications réduites
existantes ; ils ne revendiquent aucune validation applicative/navigateur.

## Preuve finale et sécurité

Le budget est calculé depuis la politique de `main`, avec la tête, la base et
l'état brouillon vérifiés dans l'API GitHub. Le job final utilise le code de la
base de confiance, avec des permissions en lecture seulement. Il refuse :

- une PR en brouillon, fermée, issue d'un autre dépôt, ou une tête/base modifiée ;
- un autre workflow, une autre tentative ou un faux parent de merge ;
- un job requis absent, dupliqué, ignoré, annulé ou en échec ;
- une preuve incomplète ou une modification de la PR pendant sa collecte.

Le reçu lie tête, base, merge testé, run et tentative. Il doit être comparé aux
révisions courantes au moment de la revue/fusion : avancer `main` le périme.
Il n'existe aucun cache de succès ni réutilisation entre révisions dans ce lot.
Les caches de téléchargements npm/Playwright sont conservés ; les bases, sessions
et résultats ne sont pas mis en cache.

Le dépôt est public et `main` n'a pas de protection de branche active au
18 novembre 2026. Le workflow seul ne bloque donc pas une fusion dans l'interface.
Pour faire appliquer la politique par GitHub, le propriétaire doit autoriser
une règle sur `main`, sans exception administrateur, qui exige `budget`, `checks`
et `Final validation` de GitHub Actions et une branche à jour. Exiger aussi une
revue des changements de workflow et de politique selon les accès disponibles.
Les branches documentation/contrôleur conservent le statut ignoré du job final.
GitHub considère les jobs ignorés comme réussis pour une règle de branche.
Une PR externe ou une admission désactivée peut donc produire des statuts
ignorés. Avant toute fusion applicative, lancer depuis la base de confiance
`node scripts/autonomy-agent/ci-validation.mjs verify NUMERO_PR ID_RUN`. Cette
commande en lecture seule exige le succès effectif du job final et de tous les
jobs de la même tentative. Elle télécharge par identifiant le reçu immuable
`ci-final-evidence-RUN-TENTATIVE`, vérifie son SHA-256 et compare la tête, la
base, le commit de fusion testé et son arbre Git à la combinaison actuelle.
GitHub peut réécrire la base dans les métadonnées de l'exécution après un
changement de branche cible. La commande prend donc les commits testés dans le
reçu d'origine. Un reçu manquant, expiré ou périmé bloque la fusion opérateur.
Le validateur isolé du superviseur conserve ses exigences indépendantes.

Les timeouts, contrôles de financement, écritures comptables atomiques, gardes
par job et marges d'annulation restent en place. Le nouveau job final de deux
minutes est réservé lui aussi. Le maximum est de 34 minutes par CI de
développement et 193 par CI applicative finale, marges techniques comprises.
L'admission garde en plus 8 minutes libres, hors réserve de récupération.
Les refus de budget
restent des échecs ; aucun recours payant et aucun relèvement du plafond.

Seul le profil iPhone WebKit passe de 30 à 45 minutes. Lors du premier essai
GitHub, l'installation système a pris près de 28 minutes. Le job utilise
désormais l'image Playwright Noble épinglée du vérificateur de publication,
avec le navigateur et ses bibliothèques préinstallés. Le téléchargement est
limité à 8 minutes et la suite complète à 32 minutes. Les trois profils
Chromium conservent leur limite de 30 minutes.

## Diagnostics

Le résumé des unitaires conserve les compteurs et ajoute le fichier, le nom et
les erreurs de chaque test défaillant : au plus 20 cas, trois messages de
2 000 caractères chacun. Les chemins sont relatifs au dépôt ; tokens connus de
l'environnement, Bearer/JWT, paramètres d'URL, affectations sensibles et codes
de contrôle sont masqués. Le résumé du job est borné à 12 000 caractères.
Les rapports JSON et les échecs de suites sans assertion sont conservés. Aucun
secret, base, état de navigateur ou donnée de joueur n'est ajouté aux artefacts.

## Coût attendu et mise en service

La CI complète de #49 a consommé 86 minutes arrondies : garde 1, contrôles 2,
mobile 17, desktop 18, android 22, iphone-webkit 26. Le nouveau contrôle final
ajoute environ une minute réelle : prévoir **environ 87 minutes** pour une finale.
Un brouillon est estimé à **3–5 minutes**, à mesurer après activation : économie
d'environ 81–83 minutes par push de développement, soit 94–96 % sur cet exemple.
Quatre brouillons et une finale passeraient d'environ 430 à 99–107 minutes
(75–77 % d'économie). Ce ne sont pas encore des économies observées.

La PR d'optimisation ne change que le contrôleur et la documentation : sa CI
conserve ce périmètre, environ 2–5 minutes réelles, réservation maximale de 26.
Si sa base change après fusion de #49, prévoir un autre contrôle ciblé de 2–5
minutes pour la synchronisation. Le premier essai sur #52 a confirmé les
contrôles ciblés en brouillon et trois profils sur quatre en revue. Il reste
à confirmer le WebKit corrigé et le reçu final sur la branche de test protégée.

Ordre conseillé : fusion/publication autorisée de #49 d'abord, puis synchronisation
et revue de cette PR, afin de conserver la CI actuelle de #49. L'empreinte de
politique inclut les nouveaux modules de validation/diagnostic ; toute activation
du contrôleur de publication reste soumise à sa maintenance revue et à l'accord
du propriétaire. Le bot n'est pas réactivé par cette modification.

## Test GitHub de bout en bout

Le job budget lit `main` et le job final lit la base de la PR. Basculer #51 en
revue sur le `main` actuel n'exercerait que sa CI contrôleur. Pour valider avant
intégration, utiliser une branche de test protégée dans le même dépôt avec la
politique de #51 comme base et adapter uniquement les références à `main` dans
la copie de test. Conserver le même registre et le même garde de financement,
sans secrets de production ou déploiement. La copie est réservée aux tests et
nécessite l'accord du propriétaire pour la règle GitHub et les exécutions.

1. Exiger `budget`, `checks` et `Final validation` sur la branche de test,
   source GitHub Actions, branche à jour et aucun contournement.
2. Ouvrir une PR applicative brouillon contenant un changement réversible.
   Vérifier la réservation de 34 minutes, les contrôles ciblés, les navigateurs
   ignorés et le refus de `Final validation` après les contrôles.
3. Passer prête pour revue. Vérifier une nouvelle exécution pour la même tête,
   la réservation de 193 minutes et le refus de fusion dans GitHub tant que le
   job final manque. Attendre les quatre profils et le reçu de cette tentative.
   Exécuter aussi le vérificateur opérateur sur le run de brouillon puis sur le
   run final. Il doit refuser le premier et accepter uniquement le second.
4. Après succès, changer la base en conservant la PR en revue. Vérifier que le
   vérificateur refuse l'ancien reçu même si GitHub a réécrit les métadonnées
   du run. Remettre la base d'origine puis repasser en brouillon et vérifier
   séparément le retour aux tests ciblés et le refus de l'ancien reçu. Aucun de
   ces contrôles ne nécessite une seconde finale.
5. Fermer la PR de test sans la fusionner. Si les résultats concordent, appliquer
   après accord la même règle à `main` lors de l'intégration de la politique.

Références : [Vitest related](https://vitest.dev/guide/cli.html#vitest-related),
[événements de PR](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request),
[jobs d'une tentative](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt).
