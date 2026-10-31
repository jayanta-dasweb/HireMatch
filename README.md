# HireMatch

AI-powered resume intelligence, semantic job matching, and recruitment SaaS.

**Product name:** HireMatch (UI may show “HireMatch AI”)  
**Repo:** https://github.com/jayanta-dasweb/HireMatch.git  
**Note:** Your local folder can be named anything (e.g. `jdasproject`). Docker Compose project name is always `hirematch`.

**Status:** Phase 1 foundation + production-ready Docker/ops baseline

> Resume parsing, AI matching, and payments are intentionally deferred.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (standalone prod build) |
| Backend | FastAPI + Gunicorn/Uvicorn workers |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Edge | Nginx reverse proxy (prod) |
| CI | GitHub Actions |

## Quick start — development

```bash
git clone https://github.com/jayanta-dasweb/HireMatch.git
cd HireMatch
cp .env.example .env
docker compose up --build
```

- Web: http://localhost:3000  
- API docs: http://localhost:8000/docs  
- Ready: http://localhost:8000/api/v1/ready  

```bash
make test
# or:
docker compose exec -e DATABASE_URL=postgresql+psycopg2://hirematch:hirematch@db:5432/hirematch_test -e RATE_LIMIT_ENABLED=false api pytest -q
```

### Login

Register at http://localhost:3000/register, or use the fast demo mode below.

## Fast investor / pitch demo

Dev mode can feel slow on Windows. For pitches use production web + seeded demo user:

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

Then open http://localhost:3000/sign-in

**Platform admin (full access)**
- Email: `admin@hirematch.ai`
- Password: `Admin@123`

See `docs/INVESTOR_DEMO.md`.


## Production deploy (single host)

```bash
cp .env.production.example .env.production
# fill SECRET_KEY, passwords, domain, SMTP — never commit this file
chmod +x scripts/*.sh
./scripts/deploy-prod.sh
```

Then configure TLS under `deploy/certs/` (see `docs/DEPLOYMENT.md`).

| Concern | How it’s handled |
|---------|------------------|
| Secrets | `.env.production` gitignored |
| Process model | Gunicorn + UvicornWorker |
| Images | Multi-stage, non-root users |
| Edge | Nginx rate limits + reverse proxy |
| Health | `/health` liveness, `/ready` DB check |
| Backups | `scripts/backup-db.sh` / `restore-db.sh` |
| CI | `.github/workflows/ci.yml` |

## Repository layout

```
backend/                 FastAPI, Alembic, pytest
frontend/                Next.js App Router
deploy/nginx/            Production reverse proxy
deploy/certs/            TLS mount (empty in git)
docs/                    Product + ops docs
scripts/                 Deploy / backup helpers
docker-compose.yml       Development
docker-compose.prod.yml  Production
.github/workflows/ci.yml Continuous integration
```

## Documentation

| Doc | Path |
|-----|------|
| **Code map (start here)** | `docs/CODEBASE.md` |
| Progress | `docs/PROGRESS.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| Security | `docs/SECURITY_THREAT_MODEL.md` |
| API | `docs/API_SPEC.md` |
| Architecture | `docs/ARCHITECTURE.md` |

## Cursor collaboration

Open the cloned repo in Cursor, copy `.env.example` → `.env`, run `docker compose up --build`. Shared agent guidance is in `AGENTS.md` and `.cursor/rules/`.

## Phase gate

Product Phase 2 (resume intelligence) still waits for review approval.  
Ops/production hardening for Phase 1 is included in this repository.

## License

Proprietary — all rights reserved unless otherwise stated by the repository owner.
