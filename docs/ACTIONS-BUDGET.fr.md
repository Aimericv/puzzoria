# Budget mensuel GitHub Actions de Puzzoria

Politique du propriétaire mise à jour le 15 novembre 2026 : au plus **1 900 minutes
Linux standard par mois UTC** pour Puzzoria (ancien plafond : 1 700).
Le propriétaire a vérifié manuellement Billing, GitHub Actions, mois de novembre :
environ 9 $ bruts consommés au 15 novembre sur 12 $ inclus. Ce relevé du compte
sert de référence, sans exiger un accès API Billing supplémentaire.
Au tarif Linux standard de 0,006 $/minute, le plafond Puzzoria représente 11,40 $ ;
il ne remplace pas la vérification de la consommation des autres dépôts.
Le bot autonome reste désactivé et aucun déploiement n'est autorisé par cette mise à jour.
DashSort est désactivé séparément par le propriétaire. Aucun achat de minutes,
crédits Codex, nouveau serveur ou augmentation de forfait n'est autorisé.

## Audit d'octobre

Reconstitution depuis 273 exécutions GitHub et leurs jobs, toutes tentatives
comprises, échecs et annulations allouées compris. Chaque job est arrondi à la
minute supérieure ; les jobs ignorés et les entrées annulées avant allocation
ne sont pas facturés dans cette estimation.

| Périmètre | Minutes reconstituées |
| --- | ---: |
| Puzzoria en octobre | 1 800 |
| 26 octobre, jour Europe/Warsaw de création du workflow | 810 |
| 27 octobre, même convention | 369 |
| Repository checks, tout le mois | 1 107 |
| Sessions autonomes, tout le mois | 329 |

Les deux journées représentent 65,5 % du total. Les principaux déclencheurs
étaient les quatre suites navigateur répétées pour des modifications du
contrôleur, les validations complètes concurrentes de la même infrastructure,
les nouvelles tentatives après échec et les petits workflows d'observation.
Les totaux par jour utilisent le jour de création du workflow, pas un relevé
de facturation ventilé à minuit.

Exemples vérifiables : [CI OIDC, 115 minutes et deux tentatives](https://github.com/Aimericv/puzzoria/actions/runs/40326531991),
[CI croissance, 80 minutes](https://github.com/Aimericv/puzzoria/actions/runs/40374772558)
avec une [validation parallèle de 62 minutes](https://github.com/Aimericv/puzzoria/actions/runs/40374752799),
[CI de première publication, 86 minutes](https://github.com/Aimericv/puzzoria/actions/runs/40539295999).

Les endpoints de facturation du compte ont répondu 404 avec l'accès disponible.
**Ce compteur est une estimation conservatrice des jobs, pas une facture
GitHub certifiée.** La protection financière du compte reste la déclaration du
propriétaire qu'aucun moyen de paiement n'est enregistré. Un ancien indicateur
de budget à 0 $ ne constitue pas une preuve API de facturation.

## Admission et arrêt automatiques

- Le code protégé `scripts/autonomy-agent/actions-budget*.mjs` impose 1 900.
  Sa modification exige une autorisation explicite du propriétaire, comme celle
  du 15 novembre pour ce seul relèvement. Les autres protections restent intactes.
- Le registre historique à 1 700 reste lisible ; la prochaine écriture comptable
  normale inscrit 1 900 sans effacer les jobs, réservations ou CI différées.
- La branche `codex/actions-usage` conserve
  `agent/operations/actions-YYYY-MM.json` : jobs observés, tentatives, réservations
  actives, cadence et CI différées. Aucun secret ni identifiant de joueur.
- Avant chaque travail, le garde de deux minutes rapproche l'historique GitHub,
  puis enregistre atomiquement la réservation par run, tentative et job.
  Un conflit d'écriture refuse l'admission ; aucune mise à jour forcée.
- La réservation couvre les timeouts des jobs plus six minutes par job pour
  annulation et arrondi. Le garde et chaque récupération quotidienne disposent
  chacun de huit minutes de marge technique, libérées après observation de leur
  fin. Les récupérations restantes du mois restent réservées avant tout travail.
- Une réservation terminée ne libère sa marge que lorsque GitHub confirme la
  fin. Les minutes observées ne diminuent jamais, même après suppression de logs.
  Un chevauchement de mois est compté dans les deux mois par prudence.
- Tout travail coûteux vérifie sa réservation exacte avant installation ou
  accès à ses secrets. Une relance isolée d'un job coûteux sans nouveau garde
  échoue. Un runner inconnu, une durée invalide ou une erreur API refuse le travail.
- Près du plafond, les workflows ordinaires sont désactivés. Le petit workflow
  indépendant `actions-budget.yml` reste actif : rapprochement quotidien à
  **00:07 UTC**, puis réactivation seulement si l'enveloppe le permet.
  Il ne remet jamais à zéro un mois existant et ne lève ni pause du propriétaire,
  ni limite Plus, ni autorisation de production.

Les gardes partagent une file de concurrence sans remplacement des admissions
en attente (`queue: max`). Lors d'un arrêt budgétaire, les exécutions déjà en file
sans réservation sont annulées ; les travaux admis, notamment un déploiement et
son rollback éventuel, conservent leur réservation et peuvent terminer.

Les quatre occasions de réveil restent à `17 */6 * * *` UTC. Les sessions
productives passent automatiquement à une cadence de 6, 12 ou 24 heures selon
les minutes et jours restants. Une session dispose de 8 à 20 minutes de runner,
préparation et contrôles inclus ; le temps réellement disponible est calculé
avant l'inférence. Le tour modèle est borné pour préserver mémoire, checkpoint
et vérification. Une interruption de cette fenêtre conserve le travail pour la
suite. **Aucun budget par expérience et aucun nombre d'expériences imposé.**

La cadence et la reprise sont soumises à la disponibilité des runners et du
planificateur GitHub ; une heure cron n'est pas une garantie de démarrage exact.
Les checkpoints Plus chiffrés conservent leur rétention existante de 90 jours.

## Validations conservées et travail redondant supprimé

| Diff de PR | Contrôles |
| --- | --- |
| README ou documentation Markdown seule | Source/financement et ancêtre main ; aucune réussite applicative revendiquée |
| Contrôleur, workflows, exploitation, tests d'infrastructure | Dépendances verrouillées, tests du contrôleur/sécurité, lint |
| Application, contenu, assets, dépendances, tests navigateur ou fichier inconnu | Contrôles précédents, types, tests unitaires, contenu/SEO/build, quatre profils E2E complets |

Un renommage est classé avec son ancien et son nouveau chemin. Une PR ayant
changé de tête pendant la classification est refusée. Le preflight navigateur
redondant de la CI est supprimé : ses assertions sont déjà dans la suite complète.
Les téléchargements npm et binaires Playwright sont mis en cache ; jamais les
tokens, bases, `node_modules`, builds, traces ou résultats de tests.

Le lot d'optimisation décrit dans [CI.fr.md](CI.fr.md) distingue les contrôles de
développement des finales applicatives : unitaires ciblés en brouillon, quatre
profils complets avant fusion, et un reçu final lié à la tête/base/run/tentative.
Il ne change ni les 1 900 minutes, ni le validateur isolé de publication, ni les
autorisations. Les réservations applicatives deviennent 34 minutes en développement
et 178 en finale, contrôle final et marges inclus. Les périmètres contrôleur et
documentation conservent leurs réservations et leurs obligations existantes.

Les réveils lisent la pause et les quotas **avant** les installations lourdes.
Les tests du contrôleur ne sont plus répétés à chaque session inchangée.
Les anciens pilotes et workflows manuels de diagnostic restent désactivés.

La publication autonome conserve sa validation indépendante isolée, liée aux
révisions exactes et exécutée sans identités/réseau du candidat : quatre profils
et contrôles conditionnels pour l'application, puis fusion, sauvegarde vérifiée,
health checks et rollback existants. Une CI ordinaire ne remplace pas cette
preuve de sécurité. Son coût réel est admis après classification ; l'ancien
sous-plafond arbitraire de 180 minutes sur sept jours est supprimé.

Une CI privée de budget est marquée en échec au garde, jamais verte avec tests
ignorés. Elle est mise en file et reprise automatiquement après disponibilité,
uniquement si sa PR est encore ouverte avec la même tête. Seul le garde de budget
est relancé, avec ses dépendants et une nouvelle admission. Les échecs de tests
fonctionnels ne sont pas relancés automatiquement par ce mécanisme.

## Consulter et maintenir

Le résumé de chaque exécution donne minutes observées, réservées et décision.
Le [registre mensuel](https://github.com/Aimericv/puzzoria/tree/codex/actions-usage/agent/operations)
permet de vérifier le détail ; le [ticket de l'agent](https://github.com/Aimericv/puzzoria/issues/3)
conserve ses contributions. Le modèle reçoit aussi un instantané en lecture
seule du budget global pour adapter librement sa stratégie.

Le contrôle ne couvre pas les nouvelles dépenses d'autres dépôts après le relevé
manuel du compte, ni le trafic produit Hetzner, traité séparément. Il n'ajoute aucun
moyen de paiement et n'active aucun recours payant. Le plafond technique concerne
les workflows gérés de Puzzoria ; un administrateur peut évidemment modifier
les réglages du compte ou lancer une infrastructure différente.

Les workflows et le limiteur entrent dans l'empreinte de politique de publication.
La nouvelle empreinte nécessite une **maintenance administrative unique** du
contrôleur VPS existant, par le mécanisme revu de sauvegarde/health check/rollback.
`deploy/update-reviewed-maintenance.ps1` accepte désormais un paquet local dont
les empreintes approuvées sont enregistrées dans l'état protégé : aucun runner
supplémentaire n'est nécessaire pour le préparer. La clé de déploiement restreinte
ne peut pas modifier elle-même cette politique. Aucune gestion manuelle régulière
des quotas n'est prévue.

## Mise en service du 31 octobre 2026

Le registre d'octobre est initialisé à 1 800 minutes (273 runs, 312 jobs alloués)
et les workflows ordinaires sont suspendus jusqu'au renouvellement. La première
récupération prévue est le **1er novembre à 00:07 UTC** (01:07 à Varsovie), sous
réserve du planificateur GitHub. Les anciennes exécutions et leurs dépenses ne
peuvent évidemment pas être effacées rétroactivement.

Vérifications locales : suite du contrôleur/sécurité sous Linux Node 24.15,
lint et structure YAML. Aucun job GitHub supplémentaire n'est lancé en octobre
pour tester le nouveau garde. Aucun code applicatif n'a changé ; les navigateurs
ne sont donc pas relancés pour cette maintenance d'infrastructure.

Le contrôle restreint TCP 2222 a confirmé une production saine au commit
`debb36f663cf027e91425d98420dd62467e54175`. Le port administratif TCP 22 expire
depuis la session et depuis le PC du propriétaire. Tant que la maintenance
revue n'a pas confirmé sa sauvegarde et sa nouvelle politique, les prochaines
publications sont refusées par le verrou du serveur. Les sessions de travail,
la mémoire et le budget GitHub peuvent reprendre indépendamment.

L'option `-Activate -NoWake` du script de maintenance réactive les publications
déjà autorisées après confirmation saine, sans déclencher immédiatement un
runner. Elle permet de respecter la suspension budgétaire d'octobre.
