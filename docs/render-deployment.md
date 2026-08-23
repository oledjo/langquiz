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

## Database convergence

Both schema and content converge on their own when the backend starts. There is no manual step in
a normal deploy.

**Schema** — `runMigrations()` applies every new file in `backend/src/db/migrations/` before the
HTTP server starts listening, holding a Postgres advisory lock so a rolling deploy cannot race
itself. A failure takes the boot down, which on Render means a failed deploy with the previous
instance still serving.

Applied migrations are immutable: their SHA-256 is recorded, and a file that changes afterwards
fails the next boot rather than being silently ignored. Fix forward with a new numbered file.

**Content** — `runContentSeeds()` runs *after* `listen()`, so a content problem shows up as an
out-of-date question rather than an outage. Each seed stores a checksum in `content_seeds` and
re-runs only when that checksum moves; an unchanged deploy costs one query per seed.

| Seed | Re-runs when |
| --- | --- |
| `bundled-exercises` | `backend/data/bundled-exercises.json` changes |
| `einburgertest` | the **mapped output** of the catalog changes — the catalog JSON *or* `mapEinburgertestQuestion.ts` |
| `einburgertest-images` | `backend/data/question-images.json` or any file it names changes |

The einburgertest seed hashes what would be written rather than the file it reads, so editing the
mapper counts as a content change on its own. That closes the trap this runbook used to describe:
a mapper change that nobody re-imported by hand had no effect in production.

Set `SKIP_CONTENT_SEED=true` to opt a service out entirely.

## Converging a database by hand

For a restore, a fresh environment, or a local database — anywhere there is no boot to piggyback
on — run the same two steps from `backend/` with `DATABASE_URL` pointing at the target:

```bash
npm run converge
```

Unlike a boot, this treats a failed content seed as fatal. CI runs it twice against a throwaway
Postgres on every pull request: once to prove an empty database converges, once to prove doing it
again is a no-op.

The older single-purpose scripts still work and remain useful for re-running one thing in
isolation:

```bash
npm run seed:exercises        # German grammar/vocabulary packs only
npm run import:einburgertest  # Einbürgerungstest questions only
```

After editing anything in `frontend/src/exercises/`, regenerate the snapshot and commit it:

```bash
npm run export:exercises      # rewrites backend/data/bundled-exercises.json
```

The frontend test suite fails if the packs and the snapshot disagree.

## Uploaded question images

Artwork uploaded from `/admin` is stored in Postgres (`question_images`, migration 016), not on
disk — the app's filesystem does not survive a redeploy. Nothing to configure: no bucket, no
credentials, no extra env var. It is included in the database backups like any other table, and a
content re-import does not touch it.

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
