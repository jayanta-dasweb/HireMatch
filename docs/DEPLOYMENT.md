# HireMatch AI — Deployment Plan

## Local development (Docker Compose)

```bash
cp .env.example .env
docker compose up --build
```

| URL | Service |
|-----|---------|
| http://localhost:3000 | Next.js (dev) |
| http://localhost:8000/docs | FastAPI OpenAPI |
| http://localhost:8000/api/v1/health | Liveness |
| http://localhost:8000/api/v1/ready | Readiness + DB |
| http://localhost:8025 | Mailhog |

## Production (recommended single-host Compose)

1. Copy and fill secrets:

```bash
cp .env.production.example .env.production
# set SECRET_KEY, DB/Redis passwords, domain, SMTP
```

Generate a secret:

```bash
openssl rand -hex 48
```

2. Deploy:

```bash
chmod +x scripts/*.sh
./scripts/deploy-prod.sh
# or: make prod-up
```

3. TLS: place `fullchain.pem` / `privkey.pem` in `deploy/certs/`, uncomment HTTPS server in `deploy/nginx/conf.d/hirematch.conf`, reload proxy.

4. Backups:

```bash
./scripts/backup-db.sh
# restore: ./scripts/restore-db.sh ./backups/<file>.sql.gz
```

### Production architecture

```
Internet → nginx (proxy) → web (Next standalone)
                        → api (gunicorn + uvicorn workers)
                              → PostgreSQL
                              → Redis
```

### Hardening already in place

- Multi-stage images, non-root containers
- Gunicorn workers (no `--reload` in prod)
- OpenAPI disabled when `APP_ENV=production`
- Security headers + Trusted Host + CORS allowlists
- Auth endpoint rate limits
- DB readiness probe
- Redis password in prod compose
- CI: pytest + Next build + Docker image builds

### Still required before real commercial traffic

- Real SMTP (or transactional email provider)
- Valid TLS certificates
- Managed backups + restore drills
- Error monitoring (Sentry or equivalent)
- Object storage for resumes (Phase 2)
- Payment provider (Phase 6)
- Legal/privacy review for target markets

## Environments

| Env | Purpose |
|-----|---------|
| `development` | Compose + hot reload + console email |
| `test` | CI / pytest |
| `production` | Compose prod / future K8s |

## Scaling note

This Compose layout is production-capable for early customers on one VM. For larger load, move Postgres/Redis to managed services and run API/web as replicated containers behind a cloud load balancer.
