# Agent autonome Puzzoria — exploitation

Le superviseur réutilise le pilote Codex Plus, son sandbox, ses canaris, son
chiffrement et son éditeur de confiance. L'agent choisit librement ses missions
de développement et conserve ses décisions ; aucune roadmap n'est imposée.
Il ne fusionne pas de PR et ne déploie rien en production.

## Activation autorisée et interrupteurs

Le propriétaire a autorisé le 22 octobre 2026 la fusion de la PR #4 et les
réveils toutes les six heures, après la CI complète. Il a inspecté la liste
GitHub des webhooks, qui est vide, et confirme des déploiements manuels sur
Hetzner, sans service externe connu surveillant main. Cette confirmation est
enregistrée comme déclaration du propriétaire, sans accès au VPS.

Deux verrous indépendants restent nécessaires :

- `agent/autonomy/control.json`: `permanentActivationApproved=true`, avec la
  référence aux validations et l'interdiction de déployer/fusionner automatiquement ;
- variable de dépôt `PUZZORIA_AGENT_ENABLED=true`, interrupteur opérationnel.

Les deux verrous sont confirmés actifs depuis le 22 octobre 2026 : le
propriétaire a créé la variable et son commentaire sur le ticket a déclenché
[le premier réveil autonome réussi](https://github.com/Aimericv/puzzoria/actions/runs/39841409099).
Mettre la variable à `false` empêche les admissions suivantes. `/pause` sur
le ticket arrête les admissions du modèle tout en permettant de lire les consignes.

Le cron `17 */6 * * *` utilise UTC : 00:17, 06:17, 12:17 et 18:17 UTC. GitHub
peut retarder ou omettre un horaire ; une session ne dépend pas du PC du
propriétaire. Une seule session est admise à la fois. Aucun déploiement de
production ou merge automatique des PR de développement n'est autorisé.

La validation ponctuelle historique utilise un commit explicite portant
`[validate-agent]` sur `codex/autonomy-agent` et deux runners indépendants.
Le premier réveil de mise en service doit utiliser le mode `autonomous`,
sur `main`, sans réutiliser ce mode de validation.

Validation de la mise en service sur `5ece3ee` : 21 tests du superviseur,
345 tests unitaires, lint, types, contenus, SEO et build réussis dans
[la CI complète](https://github.com/Aimericv/puzzoria/actions/runs/39632711143).
Les quatre projets Playwright ont chacun passé 82 parcours standard ; les deux
parcours conditionnels supplémentaires ont aussi passé sur chaque projet,
avec [reprise ciblée de l'installation WebKit](https://github.com/Aimericv/puzzoria/actions/runs/39831867798).
Aucune assertion n'a été désactivée. Les tests d'arrêt et reprise sur quota
utilisent des réponses contrôlées, sans épuisement volontaire des quotas réels.

## Premier réveil permanent vérifié — 22 octobre 2026

Le [workflow réel](https://github.com/Aimericv/puzzoria/actions/runs/39841409099)
a terminé avec succès, en mode `autonomous`, sur la configuration `94d4d40` de
main. Il a été déclenché par [le commentaire du propriétaire](https://github.com/Aimericv/puzzoria/issues/3#issuecomment-6349565126),
avec [accusé de réception](https://github.com/Aimericv/puzzoria/issues/3#issuecomment-6349574544)
puis [bilan automatique](https://github.com/Aimericv/puzzoria/issues/3#issuecomment-6349729447).
La consigne a été acquittée après validation : la file des messages est vide.

L'agent a repris le code `25bfbab`, la mémoire des deux sessions de validation
et le dernier checkpoint confirmé, dans un nouveau thread. Il a choisi de
protéger la restauration d'une partie contre une réponse tardive après un
changement de compte, avec trois scénarios de régression. Les contrôles
indépendants ont passé : **348 tests unitaires, aucun échec ni test ignoré**,
isolation, lint, types, contenus et build standard. Les parcours Playwright
restent la validation distincte de la CI d'infrastructure décrite plus haut.

Le code `8bb90bd` est proposé dans la [PR #5](https://github.com/Aimericv/puzzoria/pull/5),
toujours en brouillon, non fusionnée et sans fusion automatique. La mémoire et
le checkpoint chiffré ont été renouvelés ; l'état final est `ready`, avec trois
sessions vérifiées au total, dont ce premier réveil permanent. Les contrôles
d'usage inclus Plus étaient admissibles avant et après cette session. Aucun
accès au VPS, déploiement de production ou achat n'a été effectué.

Le workflow est actif et le cron est configuré. Le premier déclenchement observé
provient du ticket ; aucun horaire futur n'est présenté comme déjà exécuté.

## Finances : correction importante

Le budget Actions à 0 $ évoqué précédemment **n'a pas été créé**. L'ancien
`PUZZORIA_FREE_ACTIONS_VERIFIED` ne sert plus d'autorisation dans les workflows
livrés. Le propriétaire a confirmé qu'**aucun moyen de paiement n'est enregistré**
sur son compte GitHub. Cette déclaration est enregistrée comme telle dans
`control.json`, pas comme une vérification technique de facturation.

Sans moyen de paiement, GitHub bloque normalement l'usage dépassant l'enveloppe
incluse. Aucun moyen de paiement ou service payant n'est ajouté. Si cette
situation change, désactiver l'agent et réexaminer la protection avant reprise.
Le superviseur ne peut pas inspecter ni garantir à lui seul les moyens de
paiement du compte. Les autres workflows livrés demandent désormais le verrou
distinct `PUZZORIA_ACTIONS_NO_PAYMENT_METHOD`; son absence les garde désactivés.

Codex doit déclarer un compte Plus, l'usage inclus autorisé et des crédits
payants observables à zéro. Une donnée inconnue, un mode API ou une limite
financière ne déclenche aucune inférence. Aucun repli payant n'est prévu.

## Réveils et dialogue

Après activation autorisée : horaire toutes les six heures, lancement manuel
ou commentaire du propriétaire sur le ticket dédié. Un contrôle sans modèle
lit l'état avant de préparer le sandbox. Il consomme quand même des minutes
Actions ; aucune promesse de fonctionnement illimité ou 24 h/24 n'est faite.

Le ticket créé contient les rapports, liens des PR, résultats de tests et
raisons de pause. Écrire normalement une consigne suffit. Seul l'ID immuable
du propriétaire, sur ce ticket et ce dépôt exacts, est accepté. Les bots,
autres auteurs et commentaires sur des PR sont ignorés. Les messages sont
paginés, stockés en attente et acquittés après une session validée.

- `/pause` : bloque les prochaines admissions ;
- `/resume` ou `/reprendre` : lève la pause volontaire, sans contourner un quota ;
- `/status` : publie l'état sans lancer de modèle.

Un commentaire n'interrompt pas instantanément une session déjà en cours.
Les points de contrôle et la limite de session en bornent la durée. Annuler
brutalement un job peut conserver un travail non publié ou nécessiter une
reconnexion si l'interruption précède un checkpoint.

Codex Cloud reste un espace de travail interactif indépendant. Ce chat peut
consulter la mémoire par Git. Ses messages ne sont pas automatiquement transmis
au runner ; la boîte de directives opérationnelle de cette étape est le ticket.

## État, code et reprise

- `codex/agent-state` : état machine, mémoire, prochaine mission, compte rendu,
  identifiants des messages et pointeur du checkpoint chiffré ;
- `codex/agent-work` : contributions validées, dans une PR brouillon vers main ;
- `codex/agent-wip` : instantané non validé lors d'une interruption ; il ne
  déclenche ni fusion ni déploiement et n'est pas présenté comme testé.

Le superviseur contrôle le parent Git et ne force aucune mise à jour. Le modèle
ne reçoit pas de dépôt Git avec les objets privés, ni de jeton de publication.
Il travaille sur un export du SHA candidat, avec les dépendances approuvées.

Les fenêtres Plus réellement saturées déterminent `nextEligibleAt`, à partir
de leurs `resetsAt`. Le runner s'arrête pendant l'attente ; un réveil ultérieur
revérifie les quotas. Les erreurs transitoires conservent le travail et sont
recontrôlées, avec un arrêt après des échecs répétés. Les pauses et connexions
manquantes ne sont jamais levées par une autorisation implicite.

Si l'enveloppe Actions empêche d'allouer une VM, l'agent ne peut pas lui-même
envoyer d'alerte. Le prochain horaire après renouvellement dépend de GitHub.
Les durées des jobs et de la CI s'additionnent ; elles sont partagées avec
les autres dépôts du compte.

## Checkpoints et sécurité

La source initiale est le dernier checkpoint du test de transmission, artifact
`12352132606`, avec son contexte AES-GCM exact. Ne pas restaurer le seed retiré
ou un ancien checkpoint pour réessayer.

Le SDK officiel d'artifacts est verrouillé dans le runtime existant. Le
superviseur chiffre et publie le cache natif dès son changement, puis met à
jour le pointeur seulement après un upload confirmé. Une génération uploadée
avant une panne du pointeur peut être retrouvée, déchiffrée et authentifiée.
Une génération expirée, ambiguë ou invalide ne provoque jamais de retour
silencieux à l'ancien login. Les checksums disponibles sont vérifiés.

La rétention demandée est de 90 jours, plafonnée par le réglage effectif du
dépôt. L'expiration observée est conservée. Cela ne garantit pas une validité
indéfinie : révocation, longue absence ou coupure au moment du renouvellement
peuvent nécessiter une nouvelle connexion sécurisée.

Les outils du modèle gardent l'UID, les namespaces et les restrictions natives
du pilote. Ils ne reçoivent ni secrets Plus, ni clé du coffre, ni jeton GitHub
ou artifact, ni accès de production. Les canaris sont obligatoires avant
l'inférence. Les dépendances approuvées sont préparées avant les secrets.

Le superviseur refuse les changements d'infrastructure, instructions,
manifests/verrous, liens symboliques ou physiques et fichiers privés. Il
arrête les outils avant de collecter, tester et publier. Lint, types, tests
unitaires avec comptage réel, contenus et build sont exécutés dans des
conteneurs éphémères avec l'image Node déjà épinglée par le Dockerfile.
Ces vérificateurs n'ont aucun secret ni accès Internet (`--network=none`),
un utilisateur non privilégié, des capacités retirées, une racine en lecture
seule et des dépendances montées en lecture seule. Leur réseau local permet
les serveurs de test. Le sandbox natif du modèle reste intégralement inchangé.
Les commandes et résultats expurgés sont conservés ; aucune base ni trace
brute de navigateur n'est publiée. Les parcours E2E restent une validation
distincte : ne pas les déclarer exécutés à partir des seuls tests unitaires.

## Résultats de livraison

Le ticket de communication est [#3](https://github.com/Aimericv/puzzoria/issues/3).
La [PR d'infrastructure #4](https://github.com/Aimericv/puzzoria/pull/4)
a été fusionnée le 22 octobre 2026, après validation et autorisation du propriétaire.

Validation locale du 21 octobre 2026 : 18 tests du superviseur, 345 tests
applicatifs dans 26 fichiers sur la branche d'infrastructure (incluant les
tests historiques du pilote), lint, types et build réussis. Les validations de
contenu couvrent 92 challenges programmés, 32 articles multilingues, les jeux
sociaux et leurs quatre langues. Cette validation locale du 21 octobre
n'incluait pas Playwright ; la CI complète et les parcours exécutés le 22 sont
référencés dans la section d'activation ci-dessus.

Le premier [essai réel](https://github.com/Aimericv/puzzoria/actions/runs/39620986831)
s'est arrêté avant l'inférence : le format du checksum transmis au SDK
officiel était incorrect. Le correctif conserve le préfixe `sha256:` attendu
par la version verrouillée et possède un test de régression. Aucun retour
vers un ancien login ni désactivation de la vérification n'a été effectué.
Le [nouvel essai](https://github.com/Aimericv/puzzoria/actions/runs/39623126545)
a franchi la restauration native de connexion Plus, la sauvegarde chiffrée,
les canaris et l'admission financière avant le démarrage du modèle.

Ce nouvel essai a réellement développé une correction des brouillons locaux,
mais les tests indépendants ont révélé des incompatibilités entre le sandbox
natif et les outils applicatifs (caches en lecture seule, serveurs locaux et
racine Turbopack). Le code et la mémoire ont été sauvegardés sur
`codex/agent-wip`, sans publication présentée comme validée. Le vérificateur
sans réseau décrit ci-dessus a ensuite passé localement les 341 tests de ce
travail, lint, types, contenus et build standard.

La [validation finale réelle](https://github.com/Aimericv/puzzoria/actions/runs/39625255374),
sur le superviseur `20ae3e330a9b4bacd251e195a93e8d9401278305`, a ensuite
réussi sur **deux runners indépendants** :

| Session | Tests unitaires | Autres contrôles indépendants | Résultat |
| --- | --- | --- | --- |
| Première, reprenant l'instantané interrompu | 343 réussis, 0 échec, 0 ignoré | Isolation, lint, types, contenus, build standard | `verified`, étape `success` |
| Seconde, reprenant le code et la mémoire de la première | 345 réussis, 0 échec, 0 ignoré | Isolation, lint, types, contenus, build standard | `verified`, étape `success` |

Les 18 tests de contrôle ont également passé avant chaque admission. La
seconde session utilise un thread différent, annonce une session précédente
validée et part exactement du commit publié par la première. Le nonce de
mémoire est conservé et les commits se suivent sans mise à jour forcée.
Le résultat final est `25bfbab98f4bacf40bd73b0bcb1fe094be5dc00a`, dans la
[PR de travail #5](https://github.com/Aimericv/puzzoria/pull/5), en brouillon.

L'agent a choisi de corriger les brouillons après refus de stockage local,
puis les caches de démarrage et de résultat lors d'un changement de
propriétaire invité/compte. Trois fichiers de tests ajoutent sept régressions
au produit de départ ; aucune roadmap n'a fixé ces missions. La prochaine
mission conservée concerne une réponse tardive de préparation de résultat.
Aucun effet sur le trafic ou la rétention n'est présenté comme mesuré.

Les observations natives Plus sont restées admissibles avant/après chaque
session : fenêtre courte 69 → 72 %, puis 73 → 77 % utilisés ; fenêtre
hebdomadaire 30 → 30 %, puis 31 → 31 %. Ces instantanés peuvent inclure des
usages concurrents et ne constituent pas une mesure exclusive de coût. Le
dernier checkpoint confirmé est l'artifact `12357686383`, génération 3,
avec expiration observée au 19 janvier 2027. Son pointeur est dans
[l'état persistant](https://github.com/Aimericv/puzzoria/blob/codex/agent-state/agent/autonomy/state.json).

Les pauses/reprises de quotas et le filtrage des messages ont été testés
automatiquement, sans épuiser volontairement les quotas ni usurper l'auteur
du propriétaire. Le dialogue réel par commentaire du propriétaire reste à
essayer. Le cron permanent n'a volontairement pas été activé. Le compteur
mensuel de facturation Actions du compte n'a pas été lu ; l'absence de moyen
de paiement reste la déclaration du propriétaire. Aucun achat, ajout de
moyen de paiement, merge ou déploiement n'a été effectué.

Le raccordement aux métriques réelles et le déploiement sécurisé constituent
une étape ultérieure, explicitement hors de cette activation.
