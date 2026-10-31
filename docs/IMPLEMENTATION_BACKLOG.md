# HireMatch AI — Phased Implementation Backlog

## Phase 1 — Product Foundation (CURRENT)

- [x] Docs: PRD, architecture, API, DB, security, AI eval, deploy, cost
- [ ] Docker Compose + env validation
- [ ] Auth (register/login/refresh/logout)
- [ ] Email verify + password reset **interfaces** (delivery when SMTP set)
- [ ] Organizations + memberships + RBAC
- [ ] Tenant-aware access + isolation tests
- [ ] Frontend: landing, sign-in, register, protected dashboard
- [ ] Health check, OpenAPI, README, PROGRESS.md

## Phase 2 — Resume Intelligence

- Upload validation, private storage, malware scan hook
- PDF/DOCX parse, structured extraction, review UI
- Versioning + processing jobs (Celery)

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
