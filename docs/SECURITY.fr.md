# Sécurité des comptes Puzzoria

## Correctifs du 6 octobre 2026

La migration 6 ajoute `credential_versions`, indépendante de la table des comptes. Une récupération, un changement de mot de passe ou « Déconnecter tous les appareils » augmente cette génération et révoque les sessions dans une transaction. La connexion vérifie à nouveau l’empreinte et la génération après scrypt ; la création de session les revérifie également. Une vérification déjà en cours ou déjà réussie ne peut plus recréer une session après révocation. Les preuves restent dans une WeakMap serveur, jamais dans les réponses JSON.

Le profil propose deux actions sous « Sécurité du compte ». Changer le mot de passe exige le mot de passe actuel, le nouveau et sa confirmation ; les autres appareils sont déconnectés et ce navigateur reçoit un nouveau jeton. Le code de secours existant reste valable. Déconnecter tous les appareils exige le mot de passe actuel et ferme aussi le navigateur utilisé. Les parties, résultats et brouillons ne sont pas supprimés. Les actions concurrentes recontrôlent aussi la session, l’empreinte et la génération avant l’écriture.

Les nouveaux mots de passe restent limités à 12–128 caractères, sans règle de composition ni changement périodique. Une petite liste locale rejette quelques mots de passe courants et répétitions évidentes, à l’inscription, au changement et à la récupération. Ce n’est pas une détection exhaustive des mots de passe divulgués. Les anciens mots de passe continuent de fonctionner à la connexion. Aucun email ou MFA obligatoire n’est ajouté pour jouer.

Les lectures de salons et autres API propriétaires sont limitées par adresse avant leurs éventuels compteurs d’appareil. Effacer/renouveler le cookie ne renouvelle donc pas la limite d’adresse. Les compteurs et sessions expirés sont purgés à l’utilisation du limiteur, avec des index d’expiration ; cette purge ne touche pas l’historique de jeu. Une IP changée ou plusieurs machines peuvent encore contourner des quotas individuels : ce n’est pas une protection exhaustive contre le DDoS.

`TRUST_PROXY=true` accepte uniquement une adresse IP valide et unique dans `X-Forwarded-For`. Une chaîne ajoutée, un port ou du texte arbitraire rejoint le compartiment partagé `unknown` ; sans proxy déclaré, `direct` reste partagé. Cette validation ne prouve pas la provenance du header : le serveur Node doit rester inaccessible publiquement et le proxy doit le remplacer. Pour une origine publique HTTPS en production, le contrôle de santé et les écritures/limites par adresse refusent une configuration sans `AUTH_ORIGIN` identique à l’origine publique et `TRUST_PROXY=true`.

Les pages dynamiques reçoivent une CSP avec nonce aléatoire à chaque requête, écrasé côté proxy ; Next.js et JSON-LD utilisent ce nonce. Pas de `unsafe-inline` pour les scripts ni de `unsafe-eval` en production. Les styles en ligne restent autorisés pour les grilles et animations React. Les iframes, objets, scripts externes et connexions externes ne sont pas autorisés. Le développement conserve `unsafe-eval` et WebSockets pour Next.js. Les réponses HTML avec nonce sont privées/no-store ; elles ne doivent pas être mises en cache par un CDN. Les assets Next conservent leur cache normal.

Les en-têtes ajoutent anti-framing, nosniff, politique de référent et désactivation caméra/micro/géolocalisation. HSTS est actif seulement avec une origine publique HTTPS configurée ; aucune préinscription HSTS ou obligation de sous-domaines n’est supposée.

## Publication

Voir [Docker](DOCKER.fr.md). Le [Caddyfile](../deploy/Caddyfile) est un modèle pour Caddy sur l’hôte VPS, directement face aux clients. Définir `SITE_DOMAIN` avec le domaine réellement acquis et vérifier la configuration avant chargement. Le modèle remplace `X-Forwarded-For` avec l’adresse distante et reverse-proxy vers le port loopback 3030. Il faut adapter explicitement la chaîne de confiance si un CDN/proxy est ajouté devant Caddy ; ne pas transmettre aveuglément les headers du client. [Documentation Caddy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

Aucun domaine, certificat public, proxy ou serveur de production n’est installé par ces correctifs. Il reste à vérifier sur le vrai domaine les attributs Secure, HTTPS, l’origine, les en-têtes et les limites par IP distincte.

## Export et suppression

Le profil propose maintenant export privé et suppression après vérification récente du mot de passe. La suppression exige aussi le pseudo de connexion, efface les lignes associées en transaction et révoque les sessions ; les preuves de connexion déjà vérifiées restent invalides après suppression. Le journal privé de suppressions est réappliqué avant de démarrer un conteneur restauré. Les inscriptions publiques ne peuvent pas prendre un pseudo présent dans la liste des administrateurs, y compris après suppression de ce compte. Les administrateurs doivent donc être créés avant de configurer la liste. Voir [le guide de publication](PREPRODUCTION.fr.md).

## Paiements futurs

Aucun paiement, SDK, secret de prestataire, droit Premium ou table monétaire n’est ajouté. Préférer une page de paiement hébergée par le prestataire. Le serveur fixe produit, montant, devise et compte destinataire ; aucun montant ou statut navigateur ne fait foi. Confirmer les droits uniquement à partir d’événements prestataire signés, vérifiés sur corps brut et traités de manière idempotente ; gérer aussi événements retardés, remboursements et litiges. Un retour sur la page « succès » ne confirme pas un paiement.

Une confirmation récente de l’identité et une protection renforcée des comptes administrateurs sont nécessaires avant des actions financières. Les achats, remboursements, versements de gains et conservation de soldes nécessitent des analyses distinctes. MFA administrateur, passkeys facultatives et règles pour les retraits restent des travaux à intégrer avec cette fonctionnalité ; rien ne prétend sécuriser une fonctionnalité monétaire encore absente. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Stripe Checkout](https://docs.stripe.com/payments/checkout), [webhooks Stripe](https://docs.stripe.com/webhooks).
