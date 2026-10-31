# HireMatch AI — Database Design (Phase 1)

## Phase 1 entities

| Table | Purpose |
|-------|---------|
| `users` | Account identity, credentials, verification flags |
| `user_profiles` | Display name, headline, locale |
| `organizations` | Tenant / workspace |
| `organization_members` | User↔org membership + role |
| `organization_invitations` | Pending invites |
| `refresh_tokens` | Hashed refresh tokens with expiry/revocation |
| `email_verification_tokens` | One-time verify tokens |
| `password_reset_tokens` | One-time reset tokens |
| `audit_events` | Security / admin audit trail |
| `subscription_plans` | Seed plans (entitlements enforced Phase 6) |
| `subscriptions` | Org plan linkage (status stub for Phase 1) |

## Identifier strategy

- UUID primary keys (`uuid4`) for all public entities
- `created_at` / `updated_at` timestamps (UTC)
- Soft-delete only where required later; Phase 1 uses hard delete for invites/tokens

## Tenant relationship

```
organizations 1──* organization_members *──1 users
organizations 1──* subscriptions *──1 subscription_plans
users 1──1 user_profiles
users 1──* refresh_tokens
```

## Future tables (not in Phase 1 migrations)

resume_documents, resume_versions, parsed_resume_profiles, jobs, embeddings_metadata,
candidate_job_matches, recruitment_stages, salary_observations, processing_jobs, etc.
See master specification §14.

## Indexes (Phase 1)

- `users.email` UNIQUE
- `organization_members (organization_id, user_id)` UNIQUE
- `organization_members (user_id)`
- `refresh_tokens.token_hash` UNIQUE
- Token tables indexed by `token_hash` and `expires_at`
