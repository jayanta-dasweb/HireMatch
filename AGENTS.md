# Agent notes — HireMatch

Product name is **HireMatch**. The local folder (e.g. `jdasproject`) is only a path — not the product name.

1. Read `docs/CODEBASE.md` (simple map + DRY rules).
2. Read `docs/PROGRESS.md` for current phase.
3. Keep code easy to read. Prefer small helpers over clever abstractions.
4. Routes thin → services hold logic → models are data.
5. Phase 2+ only after Phase 1 review approval.
6. Never fake AI, payments, or email delivery.
7. Never commit secrets.
8. Commit and push every change with a simple developer message (no Cursor credits).
9. **Master-driven ops:** day-to-day user/org/admin work happens from Platform Admin UI — never require raw SQL/DB for that. Secrets, SMTP, Docker, migrations stay ops-side (not in UI).
10. **Advanced RBAC:** permissions + roles + matrix are managed from Access Control / Team UIs. Use `services/rbac.py` (`require_permission`) for org gates — do not reintroduce hardcoded role lists.
