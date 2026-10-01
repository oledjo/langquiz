import { defineConfig } from 'vitest/config'

/**
 * Integration tests: real HTTP requests (supertest against the Express app) on a real Postgres.
 * Point DATABASE_URL at a disposable database — the global setup migrates it, and each test
 * creates and deletes its own users and decks. CI runs this in the `migrations` job, against the
 * same throwaway database it converges.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['src/test/integrationGlobalSetup.ts'],
    // One database, shared fixtures: run files one after another.
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      JWT_SECRET: process.env.JWT_SECRET ?? 'ci-test-secret-not-for-production',
      PGSSLMODE: process.env.PGSSLMODE ?? 'disable',
    },
  },
})
