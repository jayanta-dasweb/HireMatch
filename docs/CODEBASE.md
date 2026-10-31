# HireMatch — Simple codebase map

**Product:** HireMatch. Local disk folder name does not matter.

Read this first. Keep new code small and reuse helpers.

## Folders

```
backend/app/
  api/v1/        HTTP routes (thin) — call services
  core/          settings, security, errors, time helpers
  db/            database session
  models/        SQLAlchemy tables
  schemas/       request/response shapes (Pydantic)
  services/      business logic (the important part)

frontend/
  app/                 Next.js pages
  components/          public UI (SiteHeader, ui.tsx)
  components/admin/    free TailAdmin-style shell (sidebar, topbar, cards)
  lib/api.ts           one place for API calls
```

Admin UI inspiration: free TailAdmin / Tabler patterns rebuilt in Tailwind (no paid license).
Brand colors: teal `brand-*` + slate `ink-*` on `surface-muted`.


## DRY rules

1. **Routes stay thin** — validate input, call a service, return a schema.
2. **Shared logic lives in `services/`** — e.g. `workspace.py` creates orgs for both register + org create.
3. **Token helpers** — use `services/tokens.py` instead of copying hash/expiry code.
4. **HTTP errors** — use `core/errors.py` (`bad_request`, `unauthorized`, …).
5. **Frontend forms** — reuse `components/ui.tsx` (`Field`, `AuthCard`, `PrimaryButton`).
6. **Frontend API** — only talk to the backend through `lib/api.ts`.

## Where to change what

| Task | Edit |
|------|------|
| New API endpoint | `api/v1/*.py` + maybe `schemas/` + `services/` |
| Auth / password | `services/auth.py` |
| Org / invites | `services/organizations.py` |
| Env settings | `core/config.py` + `.env.example` |
| UI page | `frontend/app/.../page.tsx` |
| Shared look | `frontend/components/ui.tsx` |

## Multi-tenant SaaS (organizations)

- One **organization** has many **users** via `organization_members`.
- One **user** can belong to many organizations.
- Register creates a personal workspace; **Create organization** makes a team org (`org_admin`).
- Invites: Team → invite → `/accept-invite?token=…&org=…`.
- Active org is stored in `localStorage` (`hirematch_active_org`) and switched from the top bar (`lib/orgContext.tsx`).
- Org-scoped data/APIs always take `organization_id` and use `require_membership` / `require_permission`.

| Task | Edit |
|------|------|
| Create / list orgs | `services/organizations.py` + `api/v1/organizations.py` + Overview “Create organization” |
| Active org switcher | `lib/orgContext.tsx` + `components/admin/Topbar.tsx` |
| Accept invite | `app/accept-invite/page.tsx` |

## Master-driven ops

Platform Admin (`/dashboard/admin` + `/api/v1/admin/*`) is the control plane for users, orgs, admin flags, verify, password reset, and audit. Operators should not need raw SQL for day-to-day work. Do **not** put secrets/SMTP/Docker/migrations into the UI.

| Task | Edit |
|------|------|
| Platform admin ops | `services/admin.py` + `api/v1/admin.py` + `app/dashboard/admin/page.tsx` |
| Advanced RBAC | `services/rbac.py` + `api/v1/rbac.py` + `app/dashboard/admin/rbac` + `app/dashboard/team` |

Auth checks use `require_permission(..., code)` — not hardcoded role lists. `users.is_platform_admin` bypasses org permission checks.

### Granular permissions (UI + API)

Codes are `resource.action`: **view / create / edit / delete** (plus org.edit, settings.edit).

Examples: `org.members.create`, `org.members.edit`, `jobs.delete`, `resumes.view`.

| Layer | Use |
|-------|-----|
| Seed / matrix | `services/rbac_seed.py` + Access Control UI |
| API gate | `require_permission(..., code="org.members.create")` |
| UI render | `can(membership, code)` or `useCan("jobs.create")` from `lib/permissions.ts` |

Legacy aliases (`org.members.invite`, `*.manage`) still expand into the granular codes.

## Don’t

- Don’t paste the same token/org create code in two files
- Don’t put business rules only in the frontend
- Don’t add new frameworks unless needed
- Don’t tell operators to edit the DB by hand for user/org admin tasks
