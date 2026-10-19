# Listing de mesure produit à ajouter

La collecte interne et le tableau enrichi sont désormais implémentés ; voir [les mesures livrées et leurs limites](ANALYTICS.fr.md). Ce listing conserve la vision produit. L’intégration publicitaire, les revenus consolidés et les expérimentations restent des extensions futures.

| Domaine | Mesures utiles | Décision |
| --- | --- | --- |
| Acquisition | Source moteur/réseau/site/campagne UTM, première source et source de session, page d'entrée et premier jeu | Quels canaux produisent des joueurs qui reviennent ? |
| Activation | Visite → jeu vu → début réel → première fin, délais et sorties entre étapes | Améliorer le premier contact |
| Temps | Temps actif estimé par jeu/session/joueur, médiane et distribution ; temps officiel serveur séparé | Distinguer intérêt, attente et blocage |
| Volume | Parties commencées/terminées par session et jour, replay après fin | Repérer les jeux qui font rejouer |
| Plusieurs jeux | Jeux distincts/session/semaine, part jouant à au moins deux jeux, transitions A→B | Optimiser navigation et recommandations |
| Rétention | J+1/J+7/J+30 exacts, retour au même jeu et à n'importe quel jeu, rétention hebdomadaire | Comprendre l'habitude et les jeux qui la créent |
| Fréquence | DAU/WAU/MAU, DAU/MAU, jours joués/semaine, délai entre sessions | Mesurer la régularité |
| Difficulté | Tentatives/temps par niveau, erreurs de validation, succès lorsque la défaite existe | Repérer frustration ou interface ambiguë |
| Comptes | Invitation vue → inscription commencée → réussie, rétention invités/comptes, reprise multi-appareils | Mesurer la valeur de l'inscription facultative |
| Social | Partage réussi, invitation créée/ouverte, nouveaux joueurs et leur rétention | Mesurer les recommandations efficaces |
| Fiabilité | Erreurs serveur, sauvegarde/reprise, latence d'action, partage par navigateur | Ne pas confondre bug et désintérêt |

Pour Word Search/Sudoku, suivre la fin de grille et le temps, sans fabriquer une défaite. Pour les jeux d'opinion, suivre participation/rejeu/transitions, pas un score de performance. Séparer quotidien, illimité et archives.

## Publicité, quand un fournisseur sera installé

- Opportunités autorisées, demandes effectives, créations fournies/non vides, remplissage, rendu et **impressions visibles** : événements distincts, dédupliqués par impression.
- Vidéo récompensée : offre → acceptation → début → fin → récompense confirmée côté serveur si le fournisseur le permet.
- Exposition : impressions visibles par joueur/session/jeu/partie et dix minutes actives.
- Revenu : rapports du fournisseur, eCPM, revenu par mille sessions et par joueur ; séparer estimation et chiffres consolidés.
- Effet produit : sortie, replay et retours J+1/J+7 selon emplacement, exposition et groupe expérimental.

Une pub chargée n'est pas forcément visible, une vidéo commencée n'est pas terminée et un événement client ne prouve pas un revenu. Rapprocher les compteurs internes et les rapports officiels du fournisseur. Séparer absence de demande, absence d'éligibilité et absence de remplissage ; ne pas inventer la cause « bloqueur de pubs ». Référence : https://developers.google.com/publisher-tag/samples/ad-event-listeners.

## Définitions et qualité

- Session de mesure : expiration initiale après 30 minutes d'inactivité, distincte de la connexion ; règle versionnée.
- Temps actif estimé : jeu visible, page au premier plan et activité récente. Heartbeat proposé toutes les 15 secondes, seuil initial d'inactivité 120 secondes, arrêt en arrière-plan ou pause. La réflexion sans interaction existe : c'est une estimation d'attention. Garder le temps officiel serveur séparé et inchangé.
- Dédupliquer les intervalles de plusieurs onglets ; dix minutes ne deviennent pas vingt. Un invité désigne un appareil, pas une personne unique. Les comptes peuvent relier plusieurs appareils.
- Rétention exacte : cohorte de première activité de jeu, jour UTC précis, numérateur/dénominateur et observation complètement écoulée. La distinguer d'un retour au moins une fois dans une semaine. La réactivation après absence est encore une autre mesure.
- Abandon : départ observé ou absence durable de reprise selon une fenêtre indiquée ; un run sans fin peut encore être repris.
- Acquisition : « direct/inconnu » quand le référent manque. Les termes Google seront ceux de Search Console agrégée, pas des requêtes personnelles prétendument identifiées.
- Segments : jeu, mode, langue du puzzle et de l'interface distinctes, difficulté, appareil, nouveau/ancien, invité/compte, canal, cohorte d'arrivée. Ne pas additionner les uniques par catégorie.

## Collecteur interne proposé

Conserver les débuts/fins/résultats autoritaires du serveur. Le futur collecteur first party acceptera une liste fermée d'événements de navigation et des intervalles bornés de temps actif, jamais un score/réussite/identité imposés par le navigateur. Horodater côté serveur et dédupliquer. Exclure admins, fixtures et aperçus locaux. Afficher la couverture, pertes de collecte, données manquantes, invalides et choix de mesure.

Ne pas collecter saisies, mots de passe, codes de secours, nombres secrets ou URLs avec tokens. Limiter référents/UTM à des champs autorisés, prévoir information/choix de mesure, durée de conservation et agrégats. Le stockage et tableau peuvent rester internes ; événements et revenus pub dépendront du fournisseur choisi.

Premier écran conseillé : joueurs actifs, temps actif médian, fins/session, part multi-jeux, J+1/J+7, canaux des joueurs retenus ; ajouter impressions visibles et revenu/session plus tard. Puis funnel par jeu, transitions, cohortes et monétisation. Un temps long peut signifier plaisir ou blocage ; comparer plusieurs mesures. Pour attribuer un effet à un changement, utiliser des groupes expérimentaux stables et un indicateur principal choisi à l'avance : une corrélation seule ne suffit pas.
