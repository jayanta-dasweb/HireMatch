# HireMatch AI — Phased Implementation Backlog

## Phase 1 — Product Foundation

- [x] Docs: PRD, architecture, API, DB, security, AI eval, deploy, cost
- [x] Docker Compose + env validation
- [x] Auth (register/login/refresh/logout)
- [x] Email verify + password reset **interfaces** (delivery when SMTP set)
- [x] Organizations + memberships + RBAC
- [x] Tenant-aware access + isolation tests
- [x] Frontend: landing, sign-in, register, protected dashboard
- [x] Health check, OpenAPI, README, PROGRESS.md

## Phase 2 — Resume Intelligence (CURRENT)

### Slice A — Upload & plain-text extract
- [x] Upload validation (PDF/DOCX, size), private storage volume
- [x] Document + version tables, org-scoped API (`resumes.*`)
- [x] Sync PDF/DOCX text extract (`pypdf` / `python-docx`) — no fake AI
- [x] Resumes UI (list / upload / detail / soft-delete)

### Slice B — Celery + malware hook
- [x] Malware scan hook (`noop` / `reject_all`)
- [x] Celery processing jobs (async text extract)
- [ ] Versioning workflow (re-upload new versions) — later

### Slice C — Free local structured extract + review
- [x] Local deterministic structure + in-house deep analysis (`hirematch_local_v2`) + review UI
- [ ] Optional: embed open-weight model inside Docker later (still no external API)
- [ ] Real malware engine (e.g. ClamAV) behind the hook

## Phase 3 — Job Intelligence

- JD parse, skill taxonomy, embeddings, hybrid search, rerank, evidence reports

## Phase 4 — Candidate Product

- Job search, skill gaps, ATS checks, suggestions, applications

## Phase 5 — Recruiter Product

- Workspaces, bulk import, pipeline, team permissions

## Phase 6 — Commercialization

- Plans, quotas, Razorpay/Cashfree, invoices, org admin

## Phase 7 — Production Hardening

- Security review, AI eval, load tests, backups, monitoring, IR
