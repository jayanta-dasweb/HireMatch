# HireMatch AI — Deployment Plan

## Local (Docker Compose) — default for contributors

```bash
cp .env.example .env
docker compose up --build
```

Services: `db`, `redis`, `api`, `web`, `mailhog`.

Migrations run on API container start.

## Staging / production (outline)

1. Managed PostgreSQL (backups, PITR)
2. Managed Redis
3. Container host or Kubernetes
4. Reverse proxy (TLS)
5. Private object storage for resumes (Phase 2)
6. Secrets via vault / platform secrets — never in git
7. Structured logs + error monitoring (Sentry or equivalent)
8. Celery workers scaled independently

## Environments

| Env | Purpose |
|-----|---------|
| `development` | Docker Compose, console/Mailhog email |
| `staging` | Prod-like credentials, synthetic data |
| `production` | Real SMTP/payment, restricted admin access |

## Backup strategy (production)

- Daily DB backups + restore drills (Phase 7)
- Object storage versioning + retention policies
- Document RTO/RPO after first enterprise customer
