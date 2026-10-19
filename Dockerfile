# syntax=docker/dockerfile:1
# Update this pinned runtime deliberately, then repeat the container smoke test.
ARG NODE_IMAGE=node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d
FROM ${NODE_IMAGE} AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM ${NODE_IMAGE} AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
RUN node scripts/check-docker-origin.mjs && npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DAILYGRID_DB_PATH=/data/dailygrid.sqlite \
    BACKUP_DIR=/backups \
    ACCOUNT_DELETION_LOG=/backups/account-deletions.jsonl
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --chown=node:node scripts/backup-sqlite.mjs scripts/container-health.mjs scripts/operations.mjs scripts/operational-errors.mjs scripts/verify-restore.mjs scripts/account-erasure.mjs scripts/start-container.mjs ./scripts/
RUN mkdir -p /data /backups /app/.next/cache && chown -R node:node /data /backups /app/.next/cache && chmod 700 /data /backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "scripts/container-health.mjs"]
CMD ["node", "scripts/start-container.mjs"]
