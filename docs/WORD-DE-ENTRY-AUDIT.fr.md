# Entrée Word allemande — audit du 30 octobre 2026

Source exportée : `debb36f663cf027e91425d98420dd62467e54175`.
Décision : arrêter cette piste de retouche éditoriale sans modification produit.
L'audit de code ne révèle pas de promesse manquante ; il ne démontre pas
l'absence de friction navigateur. Ne pas créer de page proche pour une requête
isolée, ni dupliquer le guide déjà déployé.

## Données consultées

Contexte du 30 octobre à 12:50:05.341Z, observation
`708cd66a5192b52e487e4ec4e5108ae802e8dc9e3a66219444e3fc5cc1dc6b3c` :
`lastFailure` et `unverifiedWork` nuls. Le masquage Mots mêlés est en
`manual_review` (PR 29), pas déployé selon ce contexte. La source fournie ne
contient ni ce masquage textuel ni son scénario de départ retenu. Ne pas les
reconstituer depuis la mémoire : leur travail reste dans une PR distincte.
Les deux expériences SEO sont déployées ensemble le 27 octobre à
21:52:23.088Z et attendent leurs fenêtres complètes.

Search Console disponible, collecte à 12:50:02.628Z : 30 jours demandés
30 septembre–29 octobre, dernière date rapportée 28 octobre, données finales
America/Los_Angeles. Totaux séparés : 179 impressions, six clics. Ligne
`/de/wort` : dix impressions, deux clics, position moyenne 53,1. Requête
« rätsel mit 5 buchstaben » : cinq impressions, deux clics. Aucune jointure
page/requête ne permet d'affirmer que ces clics sont les mêmes. Les lignes
sont incomplètes ; les clics ne sont ni des personnes ni des visites Puzzoria.
Ce signal motive l'audit, pas une demande démontrée de contenu supplémentaire.

Analytics disponible, collecte à 12:50:01.269Z : 30 jours UTC du 1er au
30 octobre, jour courant partiel, six identités compte/appareil, 20 départs,
18 fins. Trois sessions consenties ne couvrent pas tout le trafic. Aucun
funnel séquentiel Google → première partie allemande n'est fourni. D+7 :
six dénominateurs matures, aucun retour ; D+30 : zéro mature, taux inconnu.
Ne pas estimer une conversion ou un effet de rétention par page.

Trends, collecte à 12:50:04.975Z : RSS Google FR/US/DE/ES disponibles,
TikTok Creative Center indisponible. Les actualités et événements consultés
n'établissent aucune demande de nouveau jeu pour Puzzoria.

## Correspondance de la promesse au parcours

| Étape | Constat par lecture | Limite |
| --- | --- | --- |
| Métadonnées | `seo-content.ts` promet un mot allemand de cinq lettres, six essais, gratuit sans inscription ; `seo.ts` réutilise ce titre et cette description | Pas de rendu Google observé |
| Introduction | La route rend l'introduction localisée avant la surface de jeu ; elle propose de saisir dans les cases ou avec le clavier à l'écran | Visibilité dans le viewport non mesurée |
| Guide | Couleurs, répétitions, méthode initiale, exemple KABEL/BALLE, umlauts, ß, correction de saisie, Daily/illimité/archives et compte facultatif déjà couverts | Utilité pour les visiteurs non mesurée |
| Normalisation | `word-normalization.ts` retire les diacritiques, conserve ß sous forme ẞ ; le guide décrit Ä/A, Ö/O, Ü/U et ß comme une lettre | Pas de preuve clavier physique allemand |
| Première lettre | `WordGame.key` appelle `session.start()` puis écrit la lettre normalisée après ses gardes de préparation | Lecture de code, pas de mesure réseau ou d'hydratation |
| Couverture navigateur | Le scénario Word de `e2e/first-play-entry.spec.ts` parcourt les quatre langues et vérifie A, absence d'erreur et URL stable | Aucun résultat navigateur fourni dans le contexte de cette session |

Sources : `src/lib/{seo-content,seo,word-normalization}.ts`,
`src/app/[locale]/[...segments]/page.tsx`,
`src/components/{game-guide,game-preview,word-game}.tsx`,
`e2e/first-play-entry.spec.ts`.

## Vérification et suite

Commande exécutée : `npm test -- --configLoader=runner tests/seo.test.ts tests/game-guide.test.ts tests/word.test.ts`.
Résultat : deux fichiers trouvés et réussis, 36 tests réussis, code 0.
`tests/word.test.ts` n'existe pas : aucune couverture moteur Word supplémentaire
ne doit être attribuée à cette commande. Aucun test ajouté pour cet audit
sans changement applicatif. Aucun serveur, E2E, build ou déploiement exécuté.

La prochaine mission choisie est d'examiner l'écart entre fin Word et retour
au prochain Daily : auditer le message de fin, le lien de retour et le
repère de renouvellement existants dans les quatre langues. Chercher un manque
concret avant intervention ; les six identités matures sans retour motivent
la question mais n'en démontrent pas la cause. Lire RETENTION.md avant toute
proposition touchant stockage, mesure ou compétition. Conserver les protocoles
SEO publiés et attendre leurs fenêtres matures sans changer leurs seuils.
