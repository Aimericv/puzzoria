# Agent autonome Puzzoria — préparation et exploitation

Le superviseur réutilise le pilote Codex Plus, son sandbox, ses canaris, son
chiffrement et son éditeur de confiance. L'agent choisit librement ses missions
de développement et conserve ses décisions ; aucune roadmap n'est imposée.
Il ne fusionne pas de PR et ne déploie rien en production.

## Activation volontairement désactivée

Deux conditions distinctes doivent être autorisées **après présentation des
résultats au propriétaire** :

- `agent/autonomy/control.json`: `permanentActivationApproved=true` ;
- variable de dépôt `PUZZORIA_AGENT_ENABLED=true`.

Elles restent désactivées pendant cette livraison. Le workflow n'est pas
opérationnel par cron tant qu'il n'est pas sur la branche par défaut. La
validation ponctuelle se lance uniquement par un commit explicite portant
`[validate-agent]` sur `codex/autonomy-agent`. Elle effectue deux sessions sur
deux runners indépendants ; un échec ou une admission refusée ne compte pas
comme réussite. Aucun achat ni saturation réelle de quota n'est nécessaire
pour tester les arrêts.

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
unitaires avec comptage réel et build sont exécutés dans le même confinement.
Les commandes et résultats expurgés sont conservés ; aucune base ni trace
brute de navigateur n'est publiée. Les parcours E2E restent une validation
distincte : ne pas les déclarer exécutés à partir des seuls tests unitaires.

## Résultats de livraison

Les résultats locaux et les liens des exécutions réelles seront consignés ici
après validation. Le raccordement aux métriques réelles et le déploiement sécurisé
constituent une étape ultérieure, explicitement hors de cette activation.
