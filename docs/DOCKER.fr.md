# Déploiement Docker

Vérification reproductible : `npm run docker:smoke` construit sa propre image et teste les quatre langues, les protections de production, une vraie fin de partie, une sauvegarde à chaud et la conservation du compte/résultat après remplacement du conteneur. Son projet et ses volumes temporaires sont supprimés à la fin ; la base de développement et les volumes de production ne sont pas utilisés.

Image Next.js standalone, Node 24.15.0 Debian verrouillé par digest, utilisateur non-root `node`, deux volumes privés (SQLite et sauvegardes), contrôle de santé HTTP + ouverture SQLite. Les `.env`, bases, dépendances Windows et artefacts de test sont exclus de l'image.

## Essai local

Docker Desktop doit utiliser les conteneurs Linux. Copier l'exemple seulement si `.env.docker` n'existe pas déjà, puis :

```powershell
Copy-Item -LiteralPath .env.docker.example -Destination .env.docker
docker compose --env-file .env.docker up -d --build --wait
docker compose --env-file .env.docker ps
```

Ouvrir `http://127.0.0.1:3030/fr`, de préférence dans un profil de navigateur de test : les cookies sur un même hôte ne sont pas isolés par port. Le serveur de développement sur 3000 reste indépendant. Docker utilise sa propre base, sans copier les comptes locaux ; le site loopback reste noindex. Le port n'écoute que sur le loopback de l'hôte.

```powershell
docker compose --env-file .env.docker logs --tail 50 app
docker compose --env-file .env.docker stop
docker compose --env-file .env.docker up -d --wait
```

## Publication

Sur un VPS Linux, configurer `.env.docker` avec `NEXT_PUBLIC_SITE_URL=https://domaine-retenu.com`, puis construire avec `up -d --build --wait`. Le build exécute le contrôle SEO existant pour une origine publique et refuse HTTP/configuration invalide. Les origines loopback sont autorisées pour les tests locaux. `AUTH_ORIGIN` utilise automatiquement la même origine. **Reconstruire après un changement de domaine**, car `NEXT_PUBLIC_SITE_URL` est aussi une variable de build.

Mettre un reverse proxy HTTPS sur l'hôte devant `127.0.0.1:3030`. Il doit conserver le Host public et **remplacer** `X-Forwarded-For` par l'adresse du pair fiable, sans reprendre une valeur arbitraire du navigateur. Activer `TRUST_PROXY=true` seulement après cette configuration. Autoriser les statistiques avec `ANALYTICS_ADMIN_USERNAMES` uniquement pour un identifiant déjà enregistré. Vérifier sur le vrai domaine les cookies Secure, canonical/hreflang, sitemap, partage et Search Console. Rien n'est publié par la création de ces fichiers seuls.

Le [modèle Caddy](../deploy/Caddyfile) fournit cette configuration pour un proxy installé sur l’hôte et directement exposé aux clients. Renseigner `SITE_DOMAIN`, valider avec `caddy validate --config deploy/Caddyfile --adapter caddyfile`, puis configurer le service Caddy. Une origine publique exige désormais `TRUST_PROXY=true` et un `AUTH_ORIGIN` identique : le contrôle de santé refuse une configuration incomplète. Une chaîne `X-Forwarded-For` ajoutée au lieu d’une adresse remplacée ne fournit pas une identité fiable. Voir [les protections et limites](SECURITY.fr.md). Les pages HTML avec CSP/nonce doivent rester hors du cache CDN.

Utiliser une seule instance avec le volume SQLite local. Ce volume n'est pas une base partagée entre régions/machines. Avant de transporter des comptes existants, prévoir une sauvegarde/restauration explicite dans le volume privé.

`COMMUNITY_STARTER_STATS=true` active, sur instruction de l'éditeur du 7 octobre, les comparaisons synthétiques de présentation tant qu'une cohorte n'atteint pas 20 autres comptes/appareils admissibles. Le réglage est fourni au runtime via Compose ; aucune population n'est écrite dans SQLite. Les statistiques de gestion et les classements restent observés. Mettre `false` et recréer le service pour désactiver cette présentation.

## Sauvegarde cohérente à chaud

```powershell
docker compose --env-file .env.docker exec -T app node scripts/backup-sqlite.mjs
```

Le script utilise l'API de backup SQLite, y compris le WAL commité, vérifie `PRAGMA quick_check`, ferme ses connexions et publie un fichier unique sous `/backups` seulement après vérification. Il ne remplace pas les sauvegardes précédentes et échoue si la source n'existe pas. Pour exporter, utiliser le nom affiché :

```powershell
docker compose --env-file .env.docker cp app:/backups/NOM_DU_FICHIER.sqlite CHEMIN_PRIVE/NOM_DU_FICHIER.sqlite
```

Ces fichiers contiennent des données privées : destination hors du dépôt et accès restreint. Compose lance maintenant `operations` : sauvegarde immédiate puis quotidienne, rotation à 14 jours, purge de la mesure et surveillance interne. La copie chiffrée hors machine et le contrôle depuis un autre hôte restent à configurer ; un deuxième volume sur le même VPS ne protège pas de sa perte. Voir [la préparation de publication](PREPRODUCTION.fr.md).

## Mise à jour et restauration

Sauvegarder avant `up -d --build`. Cette commande remplace le conteneur en conservant les volumes. Conserver le nom de projet Compose : le modifier crée d'autres volumes. Une ancienne image ne garantit pas la compatibilité avec une migration future ; conserver la sauvegarde associée.

Pour restaurer, arrêter l'application **et operations**, vérifier la sauvegarde et conserver le journal de suppressions le plus récent, puis copier la base dans le volume privé sous `dailygrid.sqlite`, avec les droits UID/GID 1000. Écarter les anciens fichiers WAL/SHM de la base arrêtée avant de redémarrer. L'entrée du conteneur réapplique le journal avant Next. Une restauration remplace l'état courant : vérifier explicitement le volume et tester d'abord dans un projet isolé.

`docker compose down` conserve les volumes. **Ne pas utiliser `down --volumes` ni supprimer les volumes de production pour une mise à jour.** Les vérifications automatisées utilisent uniquement un projet/volumes temporaires distincts, jamais la base du joueur sur 3000.

La marque publique est désormais Puzzoria. Le nom de projet/image/volumes Docker reste `dailygrid` pour conserver les volumes existants lors d’une mise à jour. La migration SQL 5 de mesure interne se fait à l’ouverture, sans modifier les parties.
