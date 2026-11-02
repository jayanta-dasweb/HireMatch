# HireMatch AI — Project Progress

**Last updated:** 2026-11-02  
**Active phase:** Phase 2 Slice B — Celery parse + malware hook  
**Remote:** https://github.com/jayanta-dasweb/HireMatch.git

## Completed

### Product Phase 2 — Slice B (Celery parse + malware hook)
- [x] Celery worker (`app.workers`) processes resume versions via Redis
- [x] Upload returns `processing`; worker runs malware hook then text extract
- [x] Pluggable `RESUME_MALWARE_SCANNER` (`noop` default, `reject_all` for tests)
- [x] Resumes UI polls while status is `processing`
- [x] Compose `worker` service (dev + prod)

### Product Phase 2 — Slice A (Resume upload & text extract)
- [x] `resume_documents` + `resume_versions` (org-scoped), migration `0007_resumes`
- [x] Private local storage (`RESUME_STORAGE_PATH`, Docker volume `resume_data`)
- [x] PDF/DOCX text extract via `pypdf` / `python-docx` (no fake AI fields)
- [x] Org API gated by `resumes.view|create|edit|delete` + download stream
- [x] Dashboard Resumes page: upload / list / detail / soft-delete; Sidebar “soon” removed
- [x] Isolation + permission tests

### Product Phase 1
- [x] Planning docs (PRD, architecture, API, DB, security, AI eval, deploy, cost, backlog)
- [x] Auth, orgs, RBAC, tenant isolation tests
- [x] Next.js auth pages + dashboard
- [x] Docker Compose development stack
- [x] Master-driven Platform Admin console (create/edit users, grant admin, verify, reset password, org active, audit) — no raw DB for day-to-day ops
- [x] Advanced Spatie-style RBAC (permissions, system + org roles, matrix UI, Team invites/assign, `require_permission`)
- [x] RBAC masters scale UI: search/filter/pagination, active/inactive, who/when audit trail
- [x] Users master: assign org role + special/direct permissions per membership (union into effective access)
- [x] Multi-tenant UX: active org switcher, create organization, accept-invite page (one user ↔ many orgs)
- [x] Granular CRUD permissions (`resource.action`) for org/members/roles/settings/jobs/resumes + `can` / `useCan` UI gates

### Production-ready setup
- [x] Multi-stage Dockerfiles (dev + prod targets), non-root users
- [x] Gunicorn + Uvicorn workers for API
- [x] Next.js `standalone` production image
- [x] `docker-compose.prod.yml` with internal network, Redis auth, nginx proxy
- [x] Liveness `/health` + readiness `/ready`
- [x] Security headers, Trusted Host (prod), CORS allowlist hardening
- [x] Auth rate limiting (SlowAPI)
- [x] OpenAPI disabled in production
- [x] Production env validation guards (`DEBUG`, weak `SECRET_KEY`, `TRUSTED_HOSTS`)
- [x] Backup / restore / deploy scripts
- [x] GitHub Actions CI (pytest, Next build, Docker image builds)
- [x] Makefile + deployment documentation

### Readability / DRY cleanup
- [x] Shared `workspace.py`, `tokens.py`, `errors.py`, `timeutil.py`
- [x] Thinner auth/org routes and services
- [x] Shared frontend `components/ui.tsx` + simpler `lib/api.ts`
- [x] `docs/CODEBASE.md` map for new contributors

## Test results (after production hardening)

```text
19 passed in 16.27s
```

Production images built successfully: `hirematch-api:prod`, `hirematch-web:prod`.

## Known limitations (honest)

- Not a full commercial product yet (no resume AI / billing)
- TLS certs must be supplied by the operator
- SMTP must be configured for real email delivery
- Single-host Compose is early-production; large scale needs managed DB/Redis + replicas
- JWT still in browser `localStorage` (harden to HttpOnly cookies before high-risk launch)
- No Sentry/APM wired yet (integration points documented)

## Next product step (after approval)

**Phase 2 Slice C** — structured extraction + review UI (real model only; still no invented fields). Optional: ClamAV behind the malware hook.

## Manual verification checklist

1. `docker compose up --build` (dev) — health + register/login
2. `pytest` green in CI / locally
3. `docker build --target production ./backend` succeeds
4. `docker build --target production ./frontend` succeeds
5. `.env.production` never committed
6. Backup script dry-run on a non-prod volume when available
