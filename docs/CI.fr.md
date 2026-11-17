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

En brouillon, **le job `Final validation` refuse explicitement la fusion** après
les contrôles de développement : son état rouge indique « validation finale
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

Le forfait GitHub Free du dépôt privé ne propose pas la protection de branche
observée lors de l'audit. Ce lot ne prétend pas ajouter une interdiction de fusion
à l'interface GitHub. L'accord du propriétaire et les preuves imposées par les
outils de publication restent requis. Le validateur indépendant isolé du
superviseur n'est ni modifié ni remplacé par une CI ordinaire, même verte.

Les timeouts, contrôles de financement, écritures comptables atomiques, gardes
par job et marges d'annulation restent en place. Le nouveau job final de deux
minutes est réservé lui aussi : 34 minutes maximum par CI de développement,
178 par CI applicative finale, marges techniques comprises. Les refus de budget
restent des échecs ; aucun recours payant et aucun relèvement du plafond.

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
minutes pour la synchronisation. Les événements brouillon → revue et le nouveau
reçu final devront ensuite être confirmés sur la prochaine vraie PR applicative,
dans sa validation finale normale ; aucun run complet de démonstration n'est lancé.

Ordre conseillé : fusion/publication autorisée de #49 d'abord, puis synchronisation
et revue de cette PR, afin de conserver la CI actuelle de #49. L'empreinte de
politique inclut les nouveaux modules de validation/diagnostic ; toute activation
du contrôleur de publication reste soumise à sa maintenance revue et à l'accord
du propriétaire. Le bot n'est pas réactivé par cette modification.

Références : [Vitest related](https://vitest.dev/guide/cli.html#vitest-related),
[événements de PR](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request),
[jobs d'une tentative](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt).
