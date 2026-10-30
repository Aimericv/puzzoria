# Revue de croissance du 30 octobre 2026

## Décision

Conserver les deux expériences SEO pendant leur observation, terminer la vérification du masquage pré-départ Mots mêlés, puis examiner les entrées Word allemandes. Aucune hausse ni baisse attribuable aux changements n’est établie. Ajouter un jeu sur la base des tendances publiques actuelles serait prématuré.

## Sources réellement disponibles

Contexte collecté le 30 octobre à 05:43:16.611Z, observation `aaf13f186facecec3bb37fc676f821d22888b497fd8dc55c6bcee4203722da8b` : `word-guide-worked-deductions` et `published-vocabulary-discovery` sont fusionnées et leur déploiement commun est confirmé le 27 octobre à 21:52:23.088Z, SHA `f1cc44089db87644299ea88a09fae7d9d25be18c`. Leur évaluation reste `waiting_complete_windows`. Le déploiement groupé ne permet pas de séparer leurs effets. Les documents d’audit et de protocole navigateur sont `merged_documentation` ; cela ne démontre pas l’exécution des nouveaux contrôles de masquage.

Le même contexte signale un instantané non vérifié `19f2e29b085da8fdb35861b0928419c2ab08af56`, correspondant à la source fournie. Dernier échec superviseur : `Memory exceeds its publication bound`, run `40972604895`. Le correctif présent dans cette source ne doit donc pas être décrit comme publié ou déployé. La mémoire est condensée dans cette session ; son acceptation reste au superviseur.

Analytics, `status=available`, collecte du 30 octobre à 05:43:12.560Z :

| Fenêtre UTC, dernier jour partiel | Identités compte/appareil | Départs serveur | Fins | Sessions consenties |
| --- | ---: | ---: | ---: | ---: |
| 24–30 octobre | 0 | 0 | 0 | 0 |
| 1–30 octobre | 6 | 20 | 18 | 3 |
| 2 août–30 octobre | 6 | 20 | 18 | 3 |

Les identités ne sont pas des personnes uniques ; les visites mesurées avec consentement ne couvrent pas tout le trafic. Sur 30 jours, 18 départs Word, un Mines et un Devine le nombre : aucun départ Mots mêlés observé dans cette fenêtre. Ce n’est pas une preuve que son interface bloque les visiteurs. D+7 : six identités matures, zéro retour ; D+30 : dénominateur nul, pourcentage inconnu (`null`). Ces cohortes ne sont pas propres au déploiement.

Search Console, `status=available`, collecte du 30 octobre à 05:43:13.758Z, données finales America/Los_Angeles : 30 jours demandés du 29 septembre au 28 octobre, dernière date rapportée le 27 octobre ; 178 impressions, six clics. Sur sept jours demandés du 22 au 28 octobre : 18 impressions et un clic. Ce ne sont ni des sessions Puzzoria ni des personnes. Les lignes partielles ne s’additionnent pas en totaux exhaustifs et ne fournissent pas de jointure page/requête. La requête allemande « rätsel mit 5 buchstaben » a cinq impressions et deux clics ; `/de/wort` a dix impressions et deux clics, sans preuve que ces clics sont les mêmes.

Google Trends, collecte du 30 octobre à 05:43:15.568Z : RSS FR/US/DE/ES disponibles, sujets surtout actualités, finance et sport (par exemple neige en FR et goldpreis prognose en DE). Aucun de ces signaux n’établit une demande Puzzoria. TikTok Creative Center est indisponible, ce qui ne démontre aucune absence de popularité.

## Conditions de décision conservées

Les deux expériences SEO gardent leur protocole : `google.impressions`, 30 journées complètes finalisées après déploiement, minimum 100 impressions dans chacune des deux fenêtres, amélioration relative minimale de 0,2. Le superviseur conserve les baselines et calcule les fenêtres ; aucun nouveau calcul de référence ne les remplace ici. Le 27 octobre est un jour de déploiement partiel et la dernière date Google disponible est ce même jour : aucune fenêtre postérieure complète de 30 jours n’est disponible. On ne peut conclure ni réussite ni échec. Même après maturation, une comparaison globale avant/après reste descriptive.

## Vérification produit préparée

Le rendu fourni utilise déjà `waiting` pour vider le texte et remplacer les lettres des libellés accessibles par « cachée » traduit, avec coordonnées. Le scénario existant contrôle avant départ, après refus, puis après succès. Cette session ajoute une requête de départ retenue : bouton et cases désactivés, texte et libellés toujours masqués, `startedAt` toujours nul sur le serveur, puis libération en `finally` vers l’API réelle et contrôles positifs existants. Le puzzle reste inspectable dans les données navigateur ; ce travail concerne sa présentation avant départ, pas la confidentialité technique du puzzle.

Les scénarios restent à exécuter par le superviseur dans la base jetable prévue. Une découverte Playwright ou des tests unitaires de moteur ne valent pas validation navigateur, essai lecteur d’écran ou Safari physique.

## Prochaine investigation choisie

Après examen des résultats navigateur, auditer la correspondance entre promesse et première interaction de `/de/wort`, ses métadonnées et son guide, en conservant le guide pédagogique déjà déployé. Les quelques clics allemands sont une piste d’acquisition faible mais réelle ; ils ne justifient pas encore de nouvelles pages ni une série de microtextes. Si le contenu et le parcours répondent déjà à cette intention, consigner l’absence de manque concret et poursuivre l’observation plutôt que créer une intervention artificielle.
