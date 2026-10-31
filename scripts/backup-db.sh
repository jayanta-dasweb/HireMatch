#!/usr/bin/env sh
set -eu

# Usage (prod compose):
#   ./scripts/backup-db.sh
# Writes timestamped dump under ./backups/

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

# shellcheck disable=SC1090
if [ -f "$ENV_FILE" ]; then
  set -a
  . "./$ENV_FILE"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

OUT="${BACKUP_DIR}/hirematch_${POSTGRES_DB}_${STAMP}.sql.gz"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip -c > "$OUT"

echo "Backup written: $OUT"
