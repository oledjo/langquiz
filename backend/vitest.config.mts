import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['dist/**', 'node_modules/**'],
    // Some machines run the transform/import step slowly enough that the default 5s trips
    // timers-heavy suites (e.g. questionImages). Give them headroom; CI is unaffected.
    testTimeout: 20000,
    // Dummy values so importing route files doesn't throw at module-load time (db/database.ts
    // and auth/jwt.ts both require these). Mirrors the env block in .github/workflows/ci.yml —
    // no test connects to Postgres or verifies a real JWT.
    env: {
      DATABASE_URL: 'postgres://ci:ci@localhost:5432/ci',
      JWT_SECRET: 'ci-test-secret-not-for-production',
      PGSSLMODE: 'disable',
    },
  },
})
