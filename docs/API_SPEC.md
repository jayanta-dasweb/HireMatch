# HireMatch AI — API Specification (Phase 1)

Base path: `/api/v1`  
Auth: `Authorization: Bearer <access_token>` unless noted  
Errors: `{ "detail": string | object }` with standard HTTP codes

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Liveness + DB ping |

## Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Create user + personal org |
| POST | `/auth/login` | No | Access + refresh tokens |
| POST | `/auth/logout` | Yes | Revoke refresh token |
| POST | `/auth/refresh` | No | Rotate refresh → new pair |
| POST | `/auth/verify-email` | No | Consume verification token |
| POST | `/auth/forgot-password` | No | Issue reset token (always 202) |
| POST | `/auth/reset-password` | No | Consume reset token |

## Current user

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | Yes | Profile + memberships |
| PATCH | `/users/me` | Yes | Update profile |

## Organizations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/organizations` | Yes | Create org (caller becomes org_admin) |
| GET | `/organizations` | Yes | List orgs for current user |
| GET | `/organizations/{org_id}` | Member | Org details |
| GET | `/organizations/{org_id}/members` | Member | List members |
| POST | `/organizations/{org_id}/invitations` | org_admin / agency_manager | Invite by email + role |
| POST | `/organizations/{org_id}/invitations/{token}/accept` | Yes | Accept invite |

## Admin (platform)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/organizations` | platform_admin | List all orgs (metadata only) |
| GET | `/admin/system-health` | platform_admin | Queue/DB stubs |

OpenAPI is generated at runtime: `GET /docs` and `GET /openapi.json`.
