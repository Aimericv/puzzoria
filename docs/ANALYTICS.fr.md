# Statistiques internes Puzzoria

Le tableau privé `/fr/admin/analytics` existe aussi en EN/ES/DE. SQLite héberge les données : aucun compte/service externe à brancher. La migration 5 ajoute les sessions, événements facultatifs, intervalles dédupliqués et compteurs de qualité. Aucune population fictive n'est stockée ni incluse dans ce tableau ou ses exports. Le réglage `COMMUNITY_STARTER_STATS` concerne uniquement la présentation des comparaisons communautaires dans les jeux, sans créer de visiteurs, comptes, parties ou votes.

## Accès

Créer normalement son compte, conserver le code de secours hors ligne, puis définir `ANALYTICS_ADMIN_USERNAMES` avec son **identifiant de connexion déjà enregistré**, en minuscules. Redémarrer l’application, se connecter et ouvrir la page. Ne jamais autoriser un pseudo qui n’est pas encore enregistré. Le nom public ne donne aucun droit. Sans configuration, la page/API sont fermées ; aucune autorisation n’est déduite du premier compte créé.

La page est noindex, l’API et les exports sont privés/no-store, protégés par la session HttpOnly habituelle. Seuls des agrégats sont exposés ; aucune liste de joueurs, identité hachée, code, mot de passe, réponse ou jeton n’est renvoyée. Les comptes administrateurs sont exclus.

## Ce qui est mesuré

Depuis le 3 novembre 2026, la section **Acquisition et jeu par quiz** et `report.product.quizTopics` dans l'export JSON ventilent les départs/fins serveur, comptes/appareils, premiers joueurs observés sur le site, scores, temps et entrées Google mesurées par sujet/langue. Un nouveau joueur Google mesuré exige son premier départ serveur et une session consentie entrée depuis Google sur ce sujet, reliée par l'événement serveur. Ce n'est ni le nombre de clics Search Console ni une mesure exhaustive des personnes. Duels exclus ; filtres, refus, DNT/GPC, exclusions administrateur et protection du tableau restent identiques. Les anciennes visites regroupées sous `/quiz` ne sont pas réattribuées. [Protocole et jointure des exports Google/Puzzoria](QUIZ-ACQUISITION.fr.md).

- Activité officielle : débuts réels, fins serveur, parties reprenables sous/au-delà de 48 heures, créations de comptes. Les réservations et imports ne sont pas des débuts ou fins vérifiés.
- Visites facultatives : sessions, appareils/comptes, pages vues, pages d’entrée, source de session et première source observée. Référent limité à son domaine ; UTM source/medium/campaign limités à 64 caractères autorisés. Sans référent : direct/inconnu. Les liens d’invitation sont classés « ami », sans stocker leur code dans la page d’entrée.
- Activation : sessions avec visite, jeu consulté, début vérifié, fin vérifiée et clic Rejouer. Chaque étape est un compteur distinct, pas une preuve que toutes les étapes ont été accomplies dans cet ordre.
- Temps actif estimé total, médiane/session, distribution, par jeu/langue/niveau/mode. Temps officiel écoulé et essais restent issus des résultats serveur. Les grilles sans défaite et les jeux d’opinion n’affichent pas de victoires/défaites artificielles.
- Sessions jouant à plusieurs jeux, transitions entre consultations de jeux, fins/session, reprises et départs observés de parties inachevées. Une sortie observée n’est pas un abandon définitif.
- Rétention exacte J+1/J+7/J+30 à n’importe quel jeu et au même jeu ; fréquence DAU/WAU/MAU, DAU/MAU, jours joués/semaine et proportion multi-jeux sur la semaine.
- Partage réussi, invitation créée, replay, autre jeu, encart de compte, inscription/connexion/migration ; segments interface/appareil/mode/invité ou compte.
- Couverture des débuts vérifiés, erreurs de requête, latence des requêtes échouées, événements acceptés/invalides/doublons. Les compteurs de qualité sont globaux à la période, sans attribution à un jeu lorsqu’un événement ne peut pas être validé.
- Les duels privés sont mesurables après autorisation, avec code de salle remplacé par une empreinte en télémétrie. Leur temps/issue officiels sont séparés sous le segment `friends`.

## Choix et définitions

Un gestionnaire de cookies regroupe l’information sur les cookies nécessaires et le choix de statistiques facultatives. Le pied de page le rouvre à tout moment, dans les quatre langues. Les anciens choix de mesure restent compatibles ; aucun choix publicitaire n’est activé en l’absence de fournisseur. La page de confidentialité conserve les mêmes préférences. Le retrait est répercuté aux autres onglets via l’événement de stockage.

La mesure navigateur démarre après **Autoriser les statistiques**. Le refus ne bloque aucun jeu. Les préférences de `/fr/privacy` permettent de changer le choix ; DNT/GPC désactivent la collecte facultative. Les enregistrements nécessaires aux parties/comptes restent distincts. Les statistiques facultatives décrivent uniquement cette fraction du trafic, jamais toutes les visites. Aucun dispositif d’empreinte navigateur ou IP conservée comme identité analytique.

Session : 30 minutes d’inactivité côté serveur, distincte de la connexion. Le cookie de mesure est opaque, HttpOnly, SameSite=Lax, Secure en production. Le compte ou l’appareil invité existant fournit une identité hachée. Lors d’une connexion, l’historique de mesure encore invité de cet appareil rejoint le compte authentifié ; l’historique d’un autre compte ne fusionne pas. Effacer les cookies ou utiliser plusieurs appareils invités peut créer plusieurs identités. La première source est la première observée dans l’historique de mesure conservé, pas une attribution universelle.

Temps actif : heartbeat de 15 secondes au maximum, jeu visible/au premier plan, commencé, sans pause/fin, interaction dans les 120 dernières secondes. Les intervalles sont bornés et horodatés à réception ; leur union sur un appareil évite de doubler deux onglets. La réflexion sans toucher l’écran et la fermeture brutale limitent la précision : c’est une estimation, jamais le chronomètre officiel. Deux appareils utilisés simultanément par un compte peuvent chacun avoir une activité réelle.

Rétention : départ/finalisation serveur au jour UTC précis après la première activité observée dans le périmètre. Seuls les jours de retour entièrement écoulés entrent au dénominateur. Le même jeu utilise des couples compte/appareil–jeu ; les totaux ne s’additionnent pas. Les imports et tests locaux restent exclus. Le jour actuel de DAU est partiel. Les fréquences 1/7/30 jours restent leurs propres fenêtres, indépendamment de la période 7/30/90 du rapport.

Langues : les événements facultatifs filtrent la langue de l’interface, les résultats officiels la langue du puzzle ; elles peuvent différer pour un jeu universel. Les tableaux de temps indiquent explicitement la langue du puzzle. Les transitions mesurent la navigation ; la part multi-jeux exige une vraie activité de jeu.

## Conservation, fiabilité et exports

Événements bruts : 90 jours. Résumés de sessions/source et qualité : 390 jours. Intervalles de déduplication : un jour. La purge est appliquée à réception d’une collecte et quotidiennement par Docker `operations`, y compris sans visite. Sans ce service, elle reste liée à une nouvelle collecte. Cela ne supprime jamais les résultats de jeu. La suppression d'un compte retire immédiatement sa mesure associée. Les visites antérieures à cette fonctionnalité ne sont pas reconstituées. Les données de rétention officielles utilisent l’historique existant.

Lots de 30 événements/24 Ko, déduplication par ID, liste fermée, limitation de débit, contrôle d’origine et validation du propriétaire d’une partie. Aucun score/succès/temps officiel envoyé par le client n’est pris comme preuve. La file navigateur est bornée ; réseau coupé, fermeture ou protection du navigateur peuvent perdre des événements. La couverture signale cette limite, sans prétendre connaître les pertes totales. La mesure optionnelle ne doit jamais faire échouer un coup. Les bots reconnus et aperçus locaux sont exclus de la collecte.

`/api/admin/analytics` renvoie le rapport opérationnel et `product` complet en JSON agrégé. `format=csv` exporte les compteurs officiels journaliers ; `format=csv&dataset=visits` exporte sessions, visiteurs, pages vues et secondes actives par jour. Filtres : `days=7|30|90`, `game`, `locale`, `interface_locale`, `mode`. Le tableau fonctionne avec une seule instance SQLite ; une forte audience justifiera des agrégats pré-calculés et un test de charge.

### Envoyer un rapport pour analyse

Dans le tableau privé, choisir la période (7, 30 ou 90 jours), appliquer les filtres, puis **Télécharger le rapport complet (JSON)**. Pour un bilan global, laisser tous les jeux/langues/modes sélectionnés. Le fichier `puzzoria-analytics-DÉBUT-FIN.json` peut être envoyé directement pour analyser acquisition, activation, rétention, temps par jeu, transitions et qualité de mesure. Le CSV reste utile pour les séries journalières et les tableurs ; il ne contient pas tous les tableaux du rapport.

L'export `format=json` est une pièce jointe privée, sans modifier le JSON de l'API existante. Son contrat est `schema: "puzzoria.analytics"`, `schemaVersion: 1`, avec `generatedAt`, période UTC, filtres explicites, définitions et `report.official`/`report.product`. Il conserve `null` pour les valeurs inconnues, précise le jour actuel partiel, les fenêtres propres à DAU/WAU/MAU, les dénominateurs de rétention et la distinction entre cohortes de débuts et de fins. Il contient uniquement les agrégats déjà autorisés au dashboard, aucune base SQLite ni identité/empreinte de joueur. Une évolution incompatible doit changer `schemaVersion`.

Les données de visite sont limitées à la mesure consentie. Un fichier vide ou une rétention encore immature n'autorise pas à inventer des performances. Avant le branchement publicitaire, les recettes/récompenses restent inconnues. Pour comparer deux périodes, conserver leurs exports et joindre une courte note sur les changements du site entre les deux.

## Lecture autonome par le bot

`GET /api/agent/analytics` utilise le même export `puzzoria.analytics` v1 que
le tableau privé, avec les filtres `days=7|30|90`, `game`, `locale`,
`interface_locale` et `mode`. Les autres paramètres et les doublons sont refusés.
Il ne délivre aucune session et ne donne accès ni aux comptes, ni à la base,
ni aux autres API. Le tableau administrateur garde son contrôle habituel.

L'accès est fermé (404) tant que `ANALYTICS_READER_TOKEN_SHA256` n'est pas une
empreinte SHA-256 valide. Un jeton Bearer distinct, aléatoire de 256 bits,
autorise la lecture. Le serveur ne conserve que son empreinte ; la comparaison
est à temps constant. Une empreinte remplacée révoque immédiatement l'ancien
jeton ; une valeur vide désactive l'accès. Ne jamais mettre le jeton dans une
URL, une variable `NEXT_PUBLIC_*`, un fichier commité ou un message.
Toutes les réponses sont privées/no-store et noindex. Six lectures autorisées
par minute protègent les agrégations SQLite sur le VPS ; les requêtes sans
autorisation ne consomment pas cette enveloppe.

À chaque session admise, le superviseur récupère les trois fenêtres 7/30/90
depuis l'URL HTTPS fixe de Puzzoria. Il refuse les redirections, borne la taille
et la durée des réponses et valide le contrat et la fraîcheur. Le modèle lit
`/opt/puzzoria-pilot/readonly/puzzoria-analytics.json` sans accès réseau ni
secret supplémentaire. La date, l'état de collecte et l'empreinte du rapport
sont dans les preuves machine ; un échec fournit `reports:null`, jamais des
statistiques inventées. Le rapport n'est pas publié comme artifact ni dans
Git ; le bot peut conserver ses conclusions dans sa mémoire privée habituelle.
Les libellés et sources mesurés restent des données, jamais des instructions.

Installation opérateur :

1. Depuis un checkout de confiance avec GitHub déjà connecté et le runtime
   verrouillé installé, exécuter
   `node scripts/autonomy-agent/setup-analytics-reader.mjs`.
   Il crée `PUZZORIA_ANALYTICS_READ_TOKEN` dans GitHub Secrets et affiche
   uniquement `ANALYTICS_READER_TOKEN_SHA256=...`, jamais le jeton brut.
2. Ajouter cette ligne dans le `.env.docker` privé du déploiement. Déployer
   l'image contenant l'endpoint et la configuration Compose, puis recréer
   uniquement le service applicatif avec la procédure de déploiement habituelle.
   Cela exige un déploiement explicite ; la PR ne modifie pas le serveur.
3. Après fusion du superviseur dans `main`, le prochain réveil admis collecte
   automatiquement. Vérifier `analytics.status=available` et la date dans les
   preuves de session. Une erreur 404 peut aussi indiquer une version de
   production trop ancienne ou un accès désactivé ; 401 indique un secret et
   une empreinte différents. Ne pas les interpréter comme une absence de trafic.

La commande refuse d'écraser un secret existant. Pour une rotation volontaire,
utiliser `--rotate` et appliquer ensemble la nouvelle empreinte au serveur.
Aucun accès SSH, déploiement automatique, achat ou nouveau service n'est ajouté.

Après configuration, lancer **Check Puzzoria read-only analytics** dans GitHub
Actions sur `main` pour vérifier la production sans consommer le quota Codex.
Ce contrôle manuel réutilise la déclaration financière existante et ne publie
que la disponibilité, la date et l'empreinte des rapports, jamais leur contenu.

## Publicité future

Aucun SDK, emplacement, indice ou publicité n’est ajouté. Les compteurs sont distincts : opportunité, demande, rendu non vide, impression visible ; offre/acceptation/début/fin vidéo. Les événements publicitaires sont refusés tant que `ANALYTICS_ADS_ENABLED` n’est pas activé côté serveur lors d’une intégration autorisée. Un UUID d’impression déduplique chaque étape. Il faut brancher les vrais callbacks du fournisseur, pas compter un chargement comme une vue.

Revenus et récompenses restent `null` tant qu’aucune confirmation fournisseur n’existe. Le navigateur ne peut pas déclarer un revenu ou délivrer une récompense. Les seuils de visibilité et rapprochements dépendront du fournisseur choisi ; aucun chiffre publicitaire n’est inventé.
