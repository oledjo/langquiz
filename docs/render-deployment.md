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
