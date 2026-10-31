#!/usr/bin/env sh
set -eu

# Production deploy helper for a single-host Docker Compose deployment.
# Prerequisites: Docker, filled .env.production, DNS pointing to this host.

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file $ENV_FILE"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — copy from .env.production.example and fill secrets."
  exit 1
fi

echo "==> Building and starting production stack"
$COMPOSE up -d --build --remove-orphans

echo "==> Waiting for API readiness"
i=0
until $COMPOSE exec -T api curl -fsS http://localhost:8000/api/v1/ready >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "API did not become ready in time"
    $COMPOSE logs --tail 100 api
    exit 1
  fi
  sleep 2
done

echo "==> Stack status"
$COMPOSE ps
echo "Deploy finished. Configure TLS certs under deploy/certs/ for HTTPS."
