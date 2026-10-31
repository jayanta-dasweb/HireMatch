# HireMatch AI — Architecture

## High-level components

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Next.js    │────▶│  FastAPI     │────▶│ PostgreSQL  │
│  Frontend   │     │  /api/v1     │     │ + pgvector  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴───────┐
                    │ Redis+Celery │  (workers from Phase 2)
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ S3-compatible│  (uploads from Phase 2)
                    │ object store │
                    └──────────────┘
```

## Why this stack

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Frontend | Next.js + TypeScript + Tailwind | Fast SaaS UI, App Router, type safety |
| Backend | FastAPI + Pydantic | Typed APIs, OpenAPI, async-friendly |
| ORM | SQLAlchemy 2 + Alembic | Maintainable schema + migrations |
| DB | PostgreSQL | Relational + future pgvector |
| Cache/queue | Redis + Celery | Async resume/bulk jobs (Phase 2+) |
| Vectors | pgvector (later) | One ops surface initially; no separate vector DB |
| Auth | JWT + refresh | Stateless API, mobile/CLI friendly |
| Deploy | Docker Compose | Clone-and-run for Cursor collaborators |

## Multi-tenant model

- Every business record carries `organization_id` (UUID).
- Membership verified on every request via current user + org context.
- Client-supplied `organization_id` is never trusted without membership check.
- Platform admins see aggregate org metadata, not resume contents by default.

## Module boundaries (backend)

```
backend/app/
  api/v1/          # HTTP routes
  core/            # settings, security, deps
  db/              # session, base
  models/          # SQLAlchemy models
  schemas/         # Pydantic DTOs
  services/        # business logic
```

AI modules (Phase 2+) will live under `backend/app/ai/` as independently testable packages.

## Security boundaries

1. Password hashing with bcrypt
2. Short-lived access tokens; rotatable refresh tokens stored hashed
3. Authorization in services, not only UI
4. Rate limiting hooks (Phase 1 basic; expand later)
5. Uploaded content treated as untrusted (Phase 2)

## Local development topology (Docker Compose)

| Service | Port | Purpose |
|---------|------|---------|
| `db` | 5432 | PostgreSQL 16 |
| `redis` | 6379 | Cache / broker |
| `api` | 8000 | FastAPI |
| `web` | 3000 | Next.js |
| `mailhog` | 8025 | Dev SMTP UI (optional email capture) |
