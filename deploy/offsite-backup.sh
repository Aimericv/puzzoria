#!/bin/sh
set -eu
# Host-side export; use an encrypted rclone remote on a different machine/provider.
# Must run as an operator allowed to use Docker; never exposes its socket to containers.
: "${APP_DIRECTORY:?Set the absolute application checkout directory}"
: "${OFFSITE_REMOTE:?Set an rclone crypt remote name with trailing colon}"
case "$OFFSITE_REMOTE" in *:*) ;; *) echo 'OFFSITE_REMOTE must be a remote' >&2; exit 1 ;; esac
umask 077
cd "$APP_DIRECTORY"
staging=$(mktemp -d)
trap 'rm -rf -- "$staging"' EXIT HUP INT TERM
# Check the configured destination type without printing credentials.
remote_name=${OFFSITE_REMOTE%%:*}
if ! rclone listremotes --long | awk -v remote="$remote_name:" '$1 == remote && $2 == "crypt" {found=1} END {exit !found}'; then
  echo 'The offsite destination must use rclone crypt' >&2; exit 1
fi
docker compose --env-file .env.docker exec -T app node scripts/backup-sqlite.mjs
docker compose --env-file .env.docker cp app:/backups/. "$staging/"
rclone copy "$staging" "$OFFSITE_REMOTE" --include 'dailygrid-*.sqlite' --include 'account-deletions.jsonl'
# Hard retention; the deletion journal is never removed by the backup rotation.
rclone delete "$OFFSITE_REMOTE" --min-age 14d --include 'dailygrid-*.sqlite'
printf '%s\n' 'Puzzoria encrypted offsite backup completed.'
