.PHONY: dev up down logs test demo prod-up prod-down backup help

help:
	@echo "Targets: dev, up, down, logs, test, demo, prod-up, prod-down, backup"

dev up:
	docker compose up --build

demo:
	docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

test:
	docker compose exec -e DATABASE_URL=postgresql+psycopg2://hirematch:hirematch@db:5432/hirematch_test -e RATE_LIMIT_ENABLED=false api pytest -q

prod-up:
	docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

prod-down:
	docker compose -f docker-compose.prod.yml --env-file .env.production down

backup:
	./scripts/backup-db.sh
