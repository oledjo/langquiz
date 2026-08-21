# Render Deployment Runbook

## Services
- frontend-staging
- backend-staging
- frontend-production
- backend-production
- postgres-staging
- postgres-production

## Required backend env vars
- DATABASE_URL
- JWT_SECRET
- CORS_ORIGINS (comma-separated strict allowlist)
- ALLOW_RENDER_ORIGINS (set true only if needed)
- APP_BASE_URL
- CRON_SECRET
- EMAIL_FROM
- RESEND_API_KEY (optional; if absent, emails are logged only)

## Required frontend env vars
- VITE_API_URL
- VITE_APP_BASE_URL
- VITE_ENV (staging|production)

## Deployment flow
1. Merge to master -> CI passes.
2. Deploy to staging services.
3. Run smoke checks:
   - /api/health
   - /api/ready
   - auth login/register flow
4. Manual promote to production.

## Content seeding

Questions live in Postgres and are loaded by an operator, never by a user's browser. Run these
from `backend/` with `DATABASE_URL` pointing at the target database:

```bash
npm run seed:exercises        # German grammar/vocabulary packs (backend/data/bundled-exercises.json)
npm run import:einburgertest  # Einbürgerungstest deck (backend/data/einburgertest-demo-catalog.json)
```

Both are idempotent and re-runnable: git is the source of truth for this content, so a re-run
overwrites the stored rows from the snapshot.

Run `npm run seed:exercises` once against staging and production as part of the deploy that
removes the client-side bootstrap — before that, the packs reached the database only when a
signed-in user's browser uploaded them.

After editing anything in `frontend/src/exercises/`, regenerate the snapshot and commit it:

```bash
npm run export:exercises      # rewrites backend/data/bundled-exercises.json
```

The frontend test suite fails if the packs and the snapshot disagree.

## Retention cron
- Create a Render cron job that sends `POST /api/retention/run`
- Add header: `x-cron-secret: <CRON_SECRET>`
- Recommended schedule: daily at 09:00 UTC

## Rollback flow (target < 10 minutes)
1. Roll back frontend to previous successful deploy in Render dashboard.
2. Roll back backend to previous successful deploy.
3. If migration caused issues, restore latest DB backup and redeploy previous backend image.
4. Validate /api/health and /api/ready.

## Backup and restore
- Daily automated Postgres backups.
- Weekly restore drill in staging.
