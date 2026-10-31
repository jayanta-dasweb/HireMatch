# HireMatch AI — Security & Privacy Threat Model (Phase 1+)

## Assets

- User credentials and session tokens
- Organization membership and roles
- Future: resumes, contact PII, recruiter notes, salary data

## Key threats & controls

| Threat | Control (Phase 1) |
|--------|-------------------|
| Credential stuffing | bcrypt hashing; rate-limit ready; lockout later |
| Token theft | Short access TTL; refresh rotation; hashed storage |
| IDOR / cross-tenant | Membership checks on every org-scoped route + tests |
| Privilege escalation | Role enum enforced server-side |
| Secret leakage | Env-only secrets; `.gitignore`; no password/token logs |
| Fake email verify | Tokens hashed + expiry; delivery requires real SMTP |
| Prompt injection (later) | Treat uploads as data, never instructions |

## Privacy principles

- Data minimization
- Candidates not visible to recruiters without consent/authorization (later)
- Platform admins do not get default resume access
- Document retention & deletion workflows (Phase 4+)
- Legal review required before commercial launch in each market

## Incident response (outline)

1. Contain (revoke tokens / suspend org)
2. Assess scope via `audit_events`
3. Notify affected tenants per policy
4. Remediate and add regression tests
