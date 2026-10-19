# Préparer la publication de Puzzoria

Les outils ci-dessous sont livrés. Aucun domaine n'est réservé, aucune copie distante/alerte externe n'est configurée et aucun déploiement public n'est effectué dans cet environnement.

## Comptes et confidentialité

Le profil propose la suppression après confirmation du mot de passe et recopie du pseudo. Le téléchargement personnel n'est plus affiché dans l'interface ; l'export JSON privé reste disponible via l'API après vérification du mot de passe. Il contient profil, résultats, brouillons, votes et mesure du propriétaire, sans empreinte de mot de passe, code de secours ou jeton. La transaction de suppression retire compte, sessions, récupération, résultats, brouillons, runs, invitations, votes, salles privées et mesure associée. Les résultats personnels du partenaire d'un duel restent conservés ; sa salle devient indisponible. La progression invitée séparée du navigateur reste disponible. Les autres onglets abandonnent le compte et tous les appareils perdent leur session.

Le journal privé `account-deletions.jsonl` enregistre un ID interne et une date avant la suppression, sans pseudo ni secret. Il prévient la réapparition d'un compte après restauration d'une ancienne base. **Ne jamais le supprimer ou le publier.** Sa conservation est distincte des copies quotidiennes. La page de confidentialité est complétée dans les quatre langues ; les coordonnées viennent de la configuration serveur et ne sont jamais inventées. Faire confirmer les mentions applicables au statut/pays de l'éditeur et les conditions des prestataires, notamment les éventuels transferts internationaux. [Informations recommandées par la CNIL](https://www.cnil.fr/fr/informer-les-personnes).

## Configuration réelle

Compléter `.env.docker` sans écraser un fichier existant :

| Variable | Information à fournir |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Domaine HTTPS acheté, puis reconstruction de l'image |
| `TRUST_PROXY` | `true` seulement après configuration du proxy qui remplace l'IP |
| `ANALYTICS_ADMIN_USERNAMES` | Pseudos de comptes déjà créés et contrôlés |
| `LEGAL_PUBLISHER_NAME`, `LEGAL_PUBLISHER_ADDRESS`, `LEGAL_PUBLISHER_COUNTRY` | Identité et coordonnées publiques de l'éditeur |
| `LEGAL_CONTACT_EMAIL` | Contact réel et surveillé pour les demandes |
| `LEGAL_HOST_NAME`, `LEGAL_HOST_ADDRESS`, `LEGAL_STORAGE_REGION` | Hébergeur et localisation des données, sauvegardes comprises |
| `OPERATIONS_WEBHOOK_URL` | Destination HTTPS privée acceptant `{"text":"…"}` |
| `OFFSITE_REMOTE` | Destination rclone crypt dédiée, hors du VPS |

Créer le compte administrateur sur une origine contrôlée **avant** de renseigner sa liste. Les nouvelles inscriptions ne peuvent pas prendre un pseudo actuellement réservé par cette configuration, même après suppression de l'ancien compte. Liste vide : dashboard fermé. Ne jamais utiliser les comptes/mots de passe de test en production.

`npm run release:check` refuse configuration locale, champs manquants ou destination d'alerte invalide. Ce contrôle ne prouve pas que le compte existe, que le proxy est correctement configuré ou que le contact fonctionne. Il s'appuie sur `.env.docker` lorsqu'il existe et n'affiche aucun secret.

## Sauvegardes, purge et alertes

Compose lance `operations`, non-root, sans port public ni socket Docker : sauvegarde SQLite immédiate puis toutes les 24 h, purge quotidienne de la mesure expirée, rotation locale à **14 jours**, contrôle toutes les minutes. Il surveille disponibilité interne, sauvegarde datant de plus de 26 h, échec de rotation, disque sous 1 Gio ou 10 % libres, et dix erreurs serveur sur cinq minutes. Les alertes sont envoyées au webhook, avec rappel horaire et notification de rétablissement. Sans webhook, elles restent dans les logs.

Les traces d'erreur opérationnelles sont des timestamps seulement, sans message, chemin, cookie ni ID joueur ; maximum 1 Mio/jour et conservation sept jours. Une défaillance de ce comptage ne bloque pas le jeu. Le service n'annonce aucun chiffre d'audience.

Le comptage serveur demande `DAILYGRID_DB_PATH` explicite en production, déjà fourni par Compose. Aucun chemin statique vers la base locale n'entre dans l'instrumentation de production. `npm run build` vérifie toutes les traces après compilation et refuse tout fichier privé de base, de test ou d'environnement.

Sur le VPS, configurer une destination [rclone crypt](https://rclone.org/crypt/) privée au-dessus d'un stockage situé **hors machine**. Conserver configuration et clés ailleurs : les copies sont inutilisables sans elles. `deploy/offsite-backup.sh` vérifie le type crypt, crée une sauvegarde cohérente, exporte les copies/journal dans un dossier temporaire privé, copie vers la destination et supprime seulement les sauvegardes distantes de plus de 14 jours. Le journal n'est pas supprimé. Utiliser une destination dédiée à Puzzoria.

Créer `/etc/puzzoria/operations.env` (droits 600) avec `APP_DIRECTORY`, `OFFSITE_REMOTE` et `OPERATIONS_WEBHOOK_URL`. Les unités fournies supposent `/opt/puzzoria` et Node 24.15+ à `/usr/bin/node` : adapter les chemins avant installation. Installer `puzzoria-offsite.service`, `puzzoria-offsite.timer`, `puzzoria-alert@.service` sous `/etc/systemd/system`, puis :

```sh
systemctl daemon-reload
systemctl enable --now puzzoria-offsite.timer
systemctl start puzzoria-offsite.service
systemctl status puzzoria-offsite.service
```

Vérifier une copie téléchargée depuis la destination, la réception réelle d'une alerte et un échec volontaire du service de préproduction. Configurer aussi les corbeilles/versions du prestataire pour que les copies retirées ne soient pas conservées au-delà de la durée annoncée. Aucun timer externe n'est installé automatiquement.

## Restauration

```sh
docker compose --env-file .env.docker exec -T app node scripts/verify-restore.mjs /backups/NOM_DU_FICHIER.sqlite
```

Le vérificateur exige la sauvegarde et le journal (vide si aucune suppression), travaille sur une copie temporaire, contrôle intégrité et clés étrangères, réapplique les suppressions, puis retire sa copie. Il ne modifie ni la source ni la base active.

Pour restaurer réellement : arrêter **app et operations**, vérifier la copie, restaurer la base et **le journal le plus récent** dans leurs volumes privés, retirer les WAL/SHM de la base arrêtée, conserver UID/GID 1000, puis `up -d --wait`. L'entrée du conteneur réapplique le journal avant Next. Ne jamais restaurer seulement la base en perdant des demandes plus récentes. Une perte du VPS entre deux copies distantes peut aussi perdre des demandes récentes : conserver le journal disponible et traiter les demandes d'effacement connues avant réouverture. Vérifier la compatibilité de migrations avant de revenir à une ancienne image. [Précautions Docker](DOCKER.fr.md).

## Contrôle depuis une autre machine

Le contrôle Compose ne détecte pas la disparition de son propre hôte. Sur **un autre serveur**, installer Node 24.15+, les scripts d'exploitation et les unités `puzzoria-monitor.service`/`.timer`. Renseigner `/etc/puzzoria/monitor.env` (600) avec `PUBLIC_MONITOR_ORIGIN` et `OPERATIONS_WEBHOOK_URL`, puis activer le timer. `scripts/public-monitor.mjs` vérifie HTTPS et `/api/health` chaque minute, avec alertes panne/rétablissement et rappel horaire. Tester en arrêtant temporairement l'application de préproduction. Le moniteur et le webhook eux-mêmes doivent être accessibles ; ils ne sont pas activés ici.

## Contrôles et ouverture

1. Passer lint/types/tests/contenu et les parcours navigateur. `npm run test:load` construit une image, crée un projet Docker et des volumes temporaires, puis teste 50 sessions : inscription/connexion, fins serveur quotidiennes et nouvelles parties illimitées, rechargement, brouillons, mesure et duels à deux appareils. Aucun compte de test dans la base normale. C'est une rafale locale, pas une promesse de capacité du VPS ; répéter dans un environnement comparable.
2. Configurer le vrai proxy HTTPS (`deploy/Caddyfile`), sans cache HTML, avec IP remplacée, puis `release:check` et reconstruire l'image. SQLite reste sur une seule instance.
3. Vérifier sauvegarde distante, restauration et alertes reçues. Conserver l'image/sauvegarde précédente avant chaque mise à jour.
4. Exécuter `npm run release:public -- https://DOMAINE-REEL` : quatre langues, canonical/hreflang, indexation publique, noindex privé/Practice, CSP/cache, robots, sitemap et disponibilité. Il ne garantit ni ranking Google ni conformité juridique. Garder une préproduction non publique sous accès restreint.
5. Faire [les contrôles sur appareils physiques](MOBILE-QA.md), notamment partage natif sur HTTPS, clavier et reprise en arrière-plan. Les navigateurs simulés ne remplacent pas ces essais.
6. Vérifier le domaine dans Search Console, soumettre le sitemap, puis suivre erreurs, rétention et parcours réellement observés. La mesure facultative reste limitée aux utilisateurs consentants.

Publicité, indices récompensés, paiements et récompenses restent désactivés.
