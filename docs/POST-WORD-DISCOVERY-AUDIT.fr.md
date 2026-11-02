# Découverte d’un autre jeu après Word — audit du 2 novembre 2026

## Décision

Ne pas ajouter un deuxième appel à l’action ni remplacer la recommandation sans preuve de friction. Le bouton existe dans les actions principales du résultat. Les agrégats disponibles ne permettent pas de distinguer absence de visibilité, préférence pour Rejouer et départ volontaire. Cette recherche est arrêtée ; elle ne revendique aucun gain produit.

## Observations disponibles

Collecte Puzzoria `available` du 2 novembre à 15:50:26.249Z, rapport de trente jours UTC du 4 octobre au 2 novembre, jour courant partiel : six identités compte/appareil, vingt départs, dix-huit fins. Word représente dix-huit départs et dix-sept fins. Ce ne sont pas des personnes uniques.

La mesure facultative compte trois sessions, deux visiteurs mesurés, zéro transition entre jeux, zéro événement `next_game_click` et un `play_again`. Deux entrées mesurées sont `/fr/mot`, une `/en/`. Trois sessions ne représentent pas tous les joueurs ; les étapes du funnel ne prouvent pas un parcours séquentiel. Aucun taux de conversion Word → autre jeu fiable ne peut être calculé depuis ces agrégats. Zéro événement ne prouve pas un bouton défectueux.

Google `available`, collecte du 2 novembre à 15:50:28.059Z : six clics et 180 impressions pour les trente jours demandés du 3 octobre au 1er novembre, dernière date rapportée le 31 octobre en America/Los_Angeles. Les lignes sont partielles, sans jointure avec les départs Puzzoria. Les flux Google Trends FR/US/DE/ES sont disponibles à 15:50:30.454Z ; leurs sujets d’actualité ne démontrent pas un besoin de recommandation après Word. TikTok est indisponible.

Observation de référence : `c83acb5aebc58c755fc35e7cb35dd734d14059856bf4f362365eaff178522a7f`, collectée à 15:50:31.446Z. Aucun échec ni travail non vérifié signalé. Les expériences Word/vocabulaire attendent toujours leurs fenêtres complètes ; Sudoku/Démineur sont fusionnées sans déploiement confirmé. Leurs critères ne changent pas.

## Chemin établi dans la base exportée

Dans `src/components/game-common.tsx`, `CompletionPanel` place Rejouer, `OtherGameLink` et l’invitation avant les statistiques. Le résultat conserve la grille et utilise `useResultScroll`. Les salons utilisent leur propre lien vers le choix de jeu live.

`OtherGameLink` parcourt `catalogGameIds` : il exclut la famille du jeu terminé et préfère un jeu sans Daily terminé aujourd’hui. Word et Mot insolite partagent la famille `word`. À la sortie de Word, Sudoku est donc la première proposition si son Daily n’est pas terminé. Si tous les autres Daily sont terminés, 2048 peut être proposé avant les jeux suivants du catalogue. Ce choix est déterministe et n’est pas un modèle personnalisé.

Le lien conserve la langue et mène à `practicePath` après Practice, à `gamePath` autrement. Le texte « Essayer un autre jeu » et le nom du jeu existent dans les quatre langues. Le clic appelle la mesure existante `next_game_click` ; aucun nouveau suivi n’est nécessaire pour cet audit.

`finishedToday` exclut Practice et les archives ; il ne décrit donc pas tous les jeux déjà essayés. Ce choix respecte la notion de progrès Daily. Il peut produire la même suggestion après plusieurs Practice Word. Ce comportement est une piste d’expérience, sans preuve actuelle qu’il freine les départs ; ne pas changer les règles du progrès pour le contourner.

## Vérification et limite

Lecture du composant, du catalogue, des chemins Practice, du filtre Daily et du guide Next Link installé. Les tests `tests/daily.test.ts` vérifient les fonctions Daily utilisées par ce parcours ; leur résultat local est consigné dans la mémoire. Ils ne valident ni le rendu du bouton ni une navigation navigateur. Aucun test E2E, appareil physique ou observation du bouton en production n’a été effectué pendant cet audit.

## Suite choisie

Examiner l’entrée organique des nouveaux jeux Quiz et Football déjà présents dans cette base : liens du catalogue, sujets stables traduits, contenu visible et canoniques. Chercher une lacune concrète d’acquisition avant toute intervention ; ne pas recréer les jeux, étendre leurs corpus sans sources ou modifier leurs preuves serveur. Les anciennes idées de capitales restent suspendues.

Suivi exploratoire de cet audit : `playing.starts`, quatorze journées UTC complètes par fenêtre, vingt départs minimum dans chacune et amélioration relative de 20 %. Baseline et dates relèvent du superviseur. Sans intervention, aucun effet direct attendu ; la métrique globale ne permettrait pas une attribution causale et un échantillon insuffisant reste inconclusif.
