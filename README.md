# HireMatch AI

AI-powered resume intelligence, semantic job matching, and recruitment SaaS.

**Current status:** Phase 1 — Product Foundation (auth, tenants, RBAC, Docker).

> AI matching, resume parsing, payments, and recruiter pipelines are intentionally **not** in Phase 1. See `docs/PROGRESS.md`.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 + TypeScript + Tailwind |
| Backend | Python FastAPI + SQLAlchemy + Alembic |
| Database | PostgreSQL 16 |
| Cache / future workers | Redis 7 |
| Local email capture | Mailhog |
| Orchestration | Docker Compose |

## Quick start (recommended)

Requirements: Docker Desktop, Git.

```bash
git clone https://github.com/jayanta-dasweb/HireMatch.git
cd HireMatch
cp .env.example .env
docker compose up --build
```

Then open:

- Web: http://localhost:3000
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/api/v1/health
- Mailhog UI: http://localhost:8025

The API container runs `alembic upgrade head` on startup.

### First account

1. Open http://localhost:3000/register
2. Create an account (a personal workspace is created automatically)
3. With `EMAIL_BACKEND=console`, the API response includes a `verification_token` for local verification (email is **not** claimed as delivered)
4. Sign in and open the dashboard

## Local development without rebuilding images

```bash
# terminals after compose is up
docker compose exec api pytest -q
docker compose logs -f api
```

### Backend tests

Tests use database `hirematch_test` (created by `scripts/init-test-db.sql` on first Postgres init).

If the volume already existed without the test DB:

```bash
docker compose exec db psql -U hirematch -d hirematch -c "CREATE DATABASE hirematch_test;"
docker compose exec -e DATABASE_URL=postgresql+psycopg2://hirematch:hirematch@db:5432/hirematch_test api pytest -q
```

(`PYTHONPATH=/app` is set on the API service in Compose.)


## Repository layout

```
backend/          FastAPI application, Alembic, pytest
frontend/         Next.js App Router UI
docs/             PRD, architecture, API, security, backlog, progress
scripts/          DB bootstrap helpers
docker-compose.yml
.env.example
```

## Documentation

| Doc | Path |
|-----|------|
| Product requirements | `docs/PRODUCT_REQUIREMENTS.md` |
| Architecture | `docs/ARCHITECTURE.md` |
| Database | `docs/DATABASE.md` |
| API (Phase 1) | `docs/API_SPEC.md` |
| Security threat model | `docs/SECURITY_THREAT_MODEL.md` |
| AI evaluation plan | `docs/AI_EVALUATION_PLAN.md` |
| Deployment | `docs/DEPLOYMENT.md` |
| Operating cost model | `docs/OPERATING_COST_MODEL.md` |
| Backlog | `docs/IMPLEMENTATION_BACKLOG.md` |
| Progress | `docs/PROGRESS.md` |

## Cursor / remote collaboration

Anyone can clone this repo and open it in Cursor. Use Docker Compose so the environment matches across machines. Do not commit `.env` or secrets.

Suggested workflow:

1. Pull `main`
2. `cp .env.example .env` (generate a strong `SECRET_KEY`)
3. `docker compose up --build`
4. Work on the next phase from `docs/PROGRESS.md`

## Phase gate

**Do not start Phase 2 (resume intelligence) until Phase 1 is reviewed and approved.**

## License

Proprietary — all rights reserved unless otherwise stated by the repository owner.
