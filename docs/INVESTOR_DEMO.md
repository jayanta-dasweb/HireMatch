# HireMatch — Investor demo (fast)

Dev mode (`next dev` + Docker volume mounts on Windows) can feel slow. For pitches, use **demo mode**.

## Start fast demo

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

Wait until API is healthy, then open:

- App: http://localhost:3000  
- Sign in: http://localhost:3000/sign-in  

## Demo login

| Field | Value |
|-------|--------|
| Email | `demo@hirematch.ai` |
| Password | `DemoPass123!` |

Or click **Use demo investor login** on the sign-in page.

## What to show

1. Landing page brand + admin preview  
2. Instant login with demo account  
3. Dashboard overview (workspaces, account, roles)  
4. Team + Settings pages  
5. Say clearly: Phase 1 = secure multi-tenant foundation; AI matching is next  

## Back to normal development

```bash
docker compose up -d --build
```
