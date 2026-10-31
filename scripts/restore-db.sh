#!/usr/bin/env sh
set -eu

# Usage:
#   ./scripts/restore-db.sh ./backups/hirematch_hirematch_YYYYMMDD.sql.gz

DUMP_PATH="${1:?Usage: $0 path/to/backup.sql.gz}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-.env.production}"

# shellcheck disable=SC1090
if [ -f "$ENV_FILE" ]; then
  set -a
  . "./$ENV_FILE"
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER required}"
: "${POSTGRES_DB:?POSTGRES_DB required}"

echo "WARNING: This replaces data in database '${POSTGRES_DB}'."
printf "Type YES to continue: "
read -r CONFIRM
[ "$CONFIRM" = "YES" ] || exit 1

gunzip -c "$DUMP_PATH" | docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T db \
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "Restore complete."
