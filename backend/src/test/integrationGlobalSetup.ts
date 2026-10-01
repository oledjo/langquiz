export default async function setup(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('Integration tests need DATABASE_URL pointing at a disposable Postgres database.')
  }
  // Global setup runs outside the test workers, so the config's `test.env` doesn't apply here.
  process.env.PGSSLMODE ??= 'disable'
  process.env.JWT_SECRET ??= 'ci-test-secret-not-for-production'
  const { db, runMigrations } = await import('../db/database')
  await runMigrations()
  await db.end()
}
