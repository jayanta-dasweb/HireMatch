# HireMatch AI — Product Requirements Document (PRD)

**Version:** 0.1.0 (Phase 1 foundation)  
**Working name:** HireMatch AI  
**Status:** Phase 1 in progress — candidate & agency validation first

## 1. Vision

An intelligent career and recruitment SaaS that helps candidates find suitable jobs and helps recruiters discover the best candidates using AI-powered semantic search, explainable matching, and skill-gap analysis.

AI outputs are **decision-support only**. The system must never automatically reject, hire, or make final employment decisions.

## 2. Initial market focus

| Priority | Segment | Why first |
|----------|---------|-----------|
| P0 | Individual job seekers | Fast feedback loop; clear value (resume intelligence) |
| P0 | Recruitment agencies | Recurring seats + volume processing |
| Later | SMB / Enterprise HR | After matching quality is proven |
| Later | Colleges / institutes | Institutional licensing after core product |

## 3. Problems solved

1. Candidates cannot tell which jobs genuinely match their experience.
2. ATS / resume weaknesses are opaque.
3. Recruiters waste time on large resume volumes.
4. Jobs and resumes use different terminology for equivalent skills.
5. Ranking needs explainable, job-related evidence.
6. Candidates need actionable skill-gap recommendations.
7. Agencies need tenant-isolated pipelines for clients, jobs, and candidates.
8. SaaS operators need entitlements, quotas, and isolation.

## 4. Functional requirements (full product)

### FR-AUTH
- Register, login, logout, refresh tokens
- Email verification and password reset token flows
- Role-based access control (RBAC)

### FR-TENANT
- Organizations / workspaces
- Memberships and invitations
- Tenant-scoped queries, files, jobs, audit events

### FR-CANDIDATE (Phase 2+)
- Resume upload, versioning, structured extraction review
- Job search, recommendations, match reports, skill gaps
- ATS / quality feedback, saved jobs, applications
- Privacy: export and deletion requests

### FR-RECRUITER (Phase 5)
- Job requisitions, bulk import, semantic candidate search
- Pipeline stages, notes, interviews, analytics

### FR-BILLING (Phase 6)
- Plans, entitlements, quotas, Razorpay/Cashfree webhooks
- Backend-enforced limits

### FR-AI (Phases 2–4)
- Resume / JD parsing, skill taxonomy, embeddings (pgvector)
- Hybrid retrieval, reranking, explainable scores
- Evaluation metrics (Recall@K, nDCG, etc.)

## 5. Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-SEC | Passwords hashed (bcrypt/argon2); no secrets in git; HTTPS in prod |
| NFR-ISO | Strict tenant isolation; automated cross-tenant tests |
| NFR-PRIV | Minimize PII; no protected-characteristic ranking signals |
| NFR-OBS | Structured logs, correlation IDs, health checks |
| NFR-PERF | Async for parsing/embeddings/bulk; idempotent workers |
| NFR-REL | Migrations via Alembic; Docker Compose for local parity |
| NFR-AI | No fake AI; no invented qualifications; evidence-grounded explanations |

## 6. Roles (Phase 1 subset)

| Role | Phase 1 scope |
|------|----------------|
| `candidate` | Register, org membership as personal workspace, dashboard |
| `recruiter` | Org member with recruiter role |
| `agency_manager` | Manage org members (basic) |
| `org_admin` | Create org, manage members |
| `platform_admin` | System health / orgs list (no default resume access) |

## 7. Explicit non-goals for Phase 1

- Resume parsing, embeddings, matching, payments, recruitment pipelines
- Email delivery (interfaces + tokens only until SMTP configured)
- SSO, salary intelligence, ATS integrations

## 8. Assumptions (Phase 1)

1. Auth uses JWT access + refresh tokens (HttpOnly cookie optional later).
2. One PostgreSQL database with `organization_id` scoping; RLS added where practical.
3. Personal candidates get an auto-created personal organization on registration.
4. Email is logged in development when `EMAIL_BACKEND=console`; production requires SMTP/provider.
5. India launch pricing documented later; billing deferred to Phase 6.
6. Design direction: clean professional SaaS (not purple-gradient demo UI).

## 9. Success metrics (later)

- Resume processing success rate
- Match-report usefulness (user feedback)
- Paid conversion & retention
- Cost per analysis
- Cross-tenant isolation test pass rate = 100%
