# Backend Decks & Content Storage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `decks` table and `deck_id` foreign keys to the existing `exercises`/`user_exercises`
tables, plus a read-only deck API, so content can be grouped into decks server-side. This is Plan 2
of the Reps platform rewrite (see `docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`
and Plan 1 at `docs/superpowers/plans/2026-08-02-domain-model-and-brand-foundation.md`).

**Correction to the design spec:** the spec's "Content storage" section said content needed to move
"from the bundle into Postgres." That's already half true and half not: `backend/src/routes/exercises.ts`
already has a `GET /api/exercises` (merges the `exercises` and `user_exercises` tables, JSONB-backed)
and a `POST /api/exercises/bootstrap` that upserts arbitrary exercise JSON. `frontend/src/hooks/useExercises.ts`
already calls this for **authenticated** users, lazily bootstrapping any bundle exercise missing from
the DB. Only **guests** read the bundle directly via `exerciseRegistry.ts` (`import.meta.glob`).

So the real gap is not storage — it's that stored exercises have no concept of a deck. This plan adds
exactly that: a `decks` table, a foreign key on the two existing content tables, and read endpoints.
It does **not** rewrite the JSONB `data` blobs into the new `DeckExercise` shape from Plan 1 Task 5 —
nothing consumes that shape at runtime yet, so reshaping the stored data now would be speculative.
That reshaping is Plan 3's job, when the frontend actually starts requesting deck-scoped content.

**Architecture:** One additive SQL migration (`012_decks.sql`) creates `decks` and adds nullable
`deck_id BIGINT REFERENCES decks(id)` columns to `exercises` and `user_exercises`, then seeds one
official deck and backfills existing `exercises` rows to point at it (`user_exercises` stays
unscoped — user-authored content isn't deck-scoped yet, out of scope here). A pure row-to-DTO mapper
module makes the numeric-vs-string ID mismatch explicit and testable without a database. A new
`decks` route exposes `GET /api/decks` and `GET /api/decks/:slug`. `GET /api/exercises` gains an
optional `?deckId=` filter, additive and backward compatible.

**Tech Stack:** Express 5, TypeScript 5.9 (CommonJS output), `pg` (raw SQL, no ORM), Postgres
(Supabase-hosted). No backend test runner exists yet — this plan adds Vitest, mirroring Plan 1 Task 1.
There is no CI database, so tests in this plan are limited to pure functions (the mapper); route
behavior against a real Postgres instance is verified manually against a local database, consistent
with the gap already flagged in the design spec's Testing section.

**ID convention:** every other table in this schema (`users`, `exercises`, `user_exercises`) uses
`BIGSERIAL` numeric primary keys. `decks` follows that convention internally. But Plan 1's
already-merged frontend `Deck` type declares `id: string` (see `frontend/src/types/deck.ts`). Rather
than reopen that merged, reviewed code, the backend serializes `id` and `ownerId` as strings in JSON
responses (`String(row.id)`) while keeping the column `BIGINT` — a common, low-risk pattern for
exactly this mismatch.

**Plan sequence (updated):**
1. Domain model foundation & brand rebrand — **done** (`b88ccc1..3822a48` on `master`).
2. **This plan** — `decks` table, `deck_id` columns, deck read API, backend test infra.
3. Frontend IA rewrite: Library / My decks / Progress / Admin navigation, deck detail screen,
   `TopicFilter` driven by `facetDefinitions`, frontend switches to requesting deck-scoped content
   (this is where reshaping stored JSONB into `DeckExercise` becomes justified, if needed).
4. Exam mode: exam screen, `examConfig`-driven question selection, scoring, SM-2 exclusion.
5. Deck-scoped progress dashboard.
6. Einbürgerungstest import (separate spec — sourcing image assets and English translations is
   content work, not covered by any code plan).

---

### Task 1: Add Vitest to the backend

**Files:**
- Modify: `backend/package.json`
- Create: `backend/vitest.config.ts`

- [ ] **Step 1: Install Vitest**

Run: `cd backend && npm install --save-dev vitest`

Expected: `vitest` added to `devDependencies` in `backend/package.json`.

- [ ] **Step 2: Add a Vitest config**

Create `backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test scripts**

In `backend/package.json`, inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works with a throwaway test**

Create `backend/src/__smoke.test.ts` temporarily:

```ts
import { expect, test } from 'vitest'

test('vitest is wired up', () => {
  expect(1 + 1).toBe(2)
})
```

Run: `cd backend && npm test`
Expected: `1 passed`

Delete `backend/src/__smoke.test.ts` after confirming.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/langquiz
git add backend/package.json backend/package-lock.json backend/vitest.config.ts
git commit -m "chore: add Vitest test runner to backend"
```

---

### Task 2: `decks` table migration

**Files:**
- Create: `backend/src/db/migrations/012_decks.sql`

The migration runner (`backend/src/db/database.ts`) applies `.sql` files in a `backend/src/db/migrations/`
directory in filename-sort order, tracked in a `schema_migrations` table, each in its own transaction.
The last migration is `011_review_scheduler_observability.sql`, so this one is `012_decks.sql`.

- [ ] **Step 1: Write the migration**

Create `backend/src/db/migrations/012_decks.sql`:

```sql
CREATE TABLE IF NOT EXISTS decks (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  origin            TEXT NOT NULL CHECK (origin IN ('official', 'community')),
  owner_id          BIGINT REFERENCES users(id),
  study_modes       TEXT[] NOT NULL DEFAULT ARRAY['practice']::TEXT[],
  facet_definitions JSONB NOT NULL DEFAULT '[]'::JSONB,
  locales           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  exam_config       JSONB,
  answer_rule_id    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decks_origin ON decks(origin);

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS deck_id BIGINT REFERENCES decks(id);
CREATE INDEX IF NOT EXISTS idx_exercises_deck_id ON exercises(deck_id);

ALTER TABLE user_exercises ADD COLUMN IF NOT EXISTS deck_id BIGINT REFERENCES decks(id);
CREATE INDEX IF NOT EXISTS idx_user_exercises_deck_id ON user_exercises(deck_id);

-- Seed the one deck that exists today: the bundled German grammar/vocabulary content.
-- facet_definitions mirrors the level/group/language fields already present on every
-- exercise in frontend/src/exercises/ (see frontend/src/types/exercise.ts's ExerciseLevel/ExerciseGroup).
INSERT INTO decks (slug, title, description, origin, study_modes, facet_definitions, locales)
VALUES (
  'german-grammar-vocabulary',
  'German Grammar & Vocabulary',
  'Practice German grammar and vocabulary across CEFR levels A1 through C2.',
  'official',
  ARRAY['practice']::TEXT[],
  '[
    {"key": "level", "label": "CEFR level", "values": ["A1", "A2", "B1", "B2", "C1", "C2"]},
    {"key": "group", "label": "Category", "values": ["grammar", "vocabulary"]}
  ]'::JSONB,
  ARRAY['en']::TEXT[]
)
ON CONFLICT (slug) DO NOTHING;

-- Backfill: every exercises row stored so far is this bundle content (nothing else has been
-- imported yet). user_exercises is intentionally NOT backfilled — user-authored content isn't
-- deck-scoped in this plan.
UPDATE exercises
SET deck_id = (SELECT id FROM decks WHERE slug = 'german-grammar-vocabulary')
WHERE deck_id IS NULL;
```

- [ ] **Step 2: Verify the migration is syntactically valid**

This step requires a local Postgres connection. If you have `DATABASE_URL` set to a local or
disposable Postgres instance, run:

```bash
cd backend && npm run dev
```

Watch the startup log for `Ran migration: 012_decks.sql` and confirm no error. Stop the server
(Ctrl+C) once confirmed.

If no local database is available, skip this step and note it in your report — the migration will
be verified when Task 4 (routes) is exercised, or on next deploy. Do not fabricate a "verified"
claim if you didn't actually run it against a database.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/012_decks.sql
git commit -m "feat: add decks table and deck_id columns on exercises/user_exercises"
```

---

### Task 3: Deck row-to-DTO mapper

**Files:**
- Create: `backend/src/decks/deckMapper.ts`
- Test: `backend/src/decks/deckMapper.test.ts`

This is the one piece of Task 2/4's logic that's a pure function and can be tested without a
database: converting a raw Postgres row (snake_case columns, numeric `id`) into the camelCase JSON
shape the frontend's `Deck` type (`frontend/src/types/deck.ts`) expects, with `id`/`ownerId`
serialized as strings.

- [ ] **Step 1: Write the failing test**

Create `backend/src/decks/deckMapper.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { mapDeckRow, type DeckRow } from './deckMapper'

const baseRow: DeckRow = {
  id: 1,
  slug: 'german-grammar-vocabulary',
  title: 'German Grammar & Vocabulary',
  description: 'Practice German grammar and vocabulary.',
  origin: 'official',
  owner_id: null,
  study_modes: ['practice'],
  facet_definitions: [{ key: 'level', label: 'CEFR level', values: ['A1', 'A2'] }],
  locales: ['en'],
  exam_config: null,
  answer_rule_id: null,
}

describe('mapDeckRow', () => {
  test('serializes numeric id as a string', () => {
    const result = mapDeckRow(baseRow)
    expect(result.id).toBe('1')
  })

  test('maps snake_case columns to camelCase fields', () => {
    const result = mapDeckRow(baseRow)
    expect(result.studyModes).toEqual(['practice'])
    expect(result.facetDefinitions).toEqual(baseRow.facet_definitions)
  })

  test('omits ownerId when owner_id is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.ownerId).toBeUndefined()
  })

  test('serializes a non-null owner_id as a string', () => {
    const result = mapDeckRow({ ...baseRow, owner_id: 42 })
    expect(result.ownerId).toBe('42')
  })

  test('omits examConfig when exam_config is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.examConfig).toBeUndefined()
  })

  test('maps a non-null exam_config through unchanged', () => {
    const examConfig = { questionCount: 33, passingScore: 17, quotas: [] }
    const result = mapDeckRow({ ...baseRow, exam_config: examConfig })
    expect(result.examConfig).toEqual(examConfig)
  })

  test('omits answerRuleId when answer_rule_id is null', () => {
    const result = mapDeckRow(baseRow)
    expect(result.answerRuleId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- deckMapper`
Expected: FAIL — `deckMapper.ts` does not exist yet.

- [ ] **Step 3: Implement the mapper**

Create `backend/src/decks/deckMapper.ts`:

```ts
/**
 * Shape of a row from the `decks` table (see migration 012_decks.sql). Matches
 * what `pg` returns for a `SELECT * FROM decks` query.
 */
export interface DeckRow {
  id: number
  slug: string
  title: string
  description: string
  origin: 'official' | 'community'
  owner_id: number | null
  study_modes: string[]
  facet_definitions: unknown
  locales: string[]
  exam_config: unknown
  answer_rule_id: string | null
}

/**
 * JSON shape returned by the deck API. Field-for-field match with the frontend's
 * `Deck` type in frontend/src/types/deck.ts, except `id`/`ownerId` are strings
 * here (see this plan's "ID convention" note) where the DB stores them as
 * BIGINT to match every other table's primary key convention.
 */
export interface DeckDto {
  id: string
  slug: string
  title: string
  description: string
  origin: 'official' | 'community'
  ownerId?: string
  studyModes: string[]
  facetDefinitions: unknown
  locales: string[]
  examConfig?: unknown
  answerRuleId?: string
}

export function mapDeckRow(row: DeckRow): DeckDto {
  return {
    id: String(row.id),
    slug: row.slug,
    title: row.title,
    description: row.description,
    origin: row.origin,
    ownerId: row.owner_id === null ? undefined : String(row.owner_id),
    studyModes: row.study_modes,
    facetDefinitions: row.facet_definitions,
    locales: row.locales,
    examConfig: row.exam_config === null ? undefined : row.exam_config,
    answerRuleId: row.answer_rule_id === null ? undefined : row.answer_rule_id,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- deckMapper`
Expected: `7 passed`

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/decks/deckMapper.ts backend/src/decks/deckMapper.test.ts
git commit -m "feat: add deck row-to-DTO mapper"
```

---

### Task 4: Deck read routes

**Files:**
- Create: `backend/src/routes/decks.ts`
- Modify: `backend/src/index.ts`

**Files:**
- [ ] **Step 1: Create the routes file**

Create `backend/src/routes/decks.ts`:

```ts
import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { mapDeckRow, type DeckRow } from '../decks/deckMapper'

export const decksRouter = Router()

decksRouter.use(requireAuth)

decksRouter.get('/', async (_req, res) => {
  try {
    const result = await db.query<DeckRow>('SELECT * FROM decks ORDER BY title ASC')
    res.json(result.rows.map(mapDeckRow))
  } catch (error) {
    console.error('Failed to load decks:', error)
    res.status(500).json({ error: 'Failed to load decks.' })
  }
})

decksRouter.get('/:slug', async (req, res) => {
  try {
    const result = await db.query<DeckRow>('SELECT * FROM decks WHERE slug = $1', [req.params.slug])
    const row = result.rows[0]
    if (!row) {
      res.status(404).json({ error: 'Deck not found.' })
      return
    }
    res.json(mapDeckRow(row))
  } catch (error) {
    console.error('Failed to load deck:', error)
    res.status(500).json({ error: 'Failed to load deck.' })
  }
})
```

This follows the existing route file pattern exactly (compare `backend/src/routes/exercises.ts`):
`requireAuth` applied to the whole router via `.use()`, try/catch around every handler, 500 with a
generic message on unexpected errors, `console.error` for server-side visibility.

- [ ] **Step 2: Wire the router into the app**

In `backend/src/index.ts`, add the import alongside the other route imports:

```ts
import { decksRouter } from './routes/decks'
```

And add the mount alongside the other `app.use('/api/...', ...)` lines:

```ts
app.use('/api/decks', decksRouter)
```

Also add `'/api/decks'` to the `endpoints` array in the `app.get('/', ...)` handler, matching the
existing list style.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify against a real database (if available)**

If you have `DATABASE_URL` pointing at a database with Task 2's migration applied:

```bash
cd backend && npm run dev
```

In another terminal:

```bash
curl -s http://localhost:3001/api/decks -H "Authorization: Bearer <a-valid-token>"
```

A valid token requires a logged-in user — if you don't have one handy, register one first via
`POST /api/auth/register` with a JSON body of `{"email": "...", "password": "..."}`, then use the
returned token. Confirm the response is a JSON array containing the seeded
`german-grammar-vocabulary` deck with `studyModes: ["practice"]` and two `facetDefinitions` entries.

Then:

```bash
curl -s http://localhost:3001/api/decks/german-grammar-vocabulary -H "Authorization: Bearer <token>"
curl -s http://localhost:3001/api/decks/does-not-exist -H "Authorization: Bearer <token>"
```

Confirm the first returns the deck object and the second returns `404` with
`{"error": "Deck not found."}`.

If no database is available, skip this step and say so plainly in your report rather than claiming
it was verified.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/decks.ts backend/src/index.ts
git commit -m "feat: add GET /api/decks and GET /api/decks/:slug"
```

---

### Task 5: Deck-scoped filtering on `GET /api/exercises`

**Files:**
- Modify: `backend/src/routes/exercises.ts`

Add an optional `?deckId=` query parameter to the existing `GET /` handler in
`backend/src/routes/exercises.ts`. When absent, behavior is unchanged (returns everything, as
today). When present, both the global-exercises query and the user-exercises query filter by
`deck_id`.

- [ ] **Step 1: Read the current handler**

Read `backend/src/routes/exercises.ts`'s `exercisesRouter.get('/', ...)` handler in full (it has two
branches depending on whether an `exercise_votes` table exists — both branches need the same filter
added).

- [ ] **Step 2: Add the filter**

At the top of the `GET /` handler, after the existing `hasVotesTable` check, add:

```ts
const deckId = typeof req.query.deckId === 'string' ? Number(req.query.deckId) : null
const hasDeckFilter = deckId !== null && Number.isFinite(deckId)
```

Then replace the four queries (`globalResult`'s two branches, `userResult`'s two branches) exactly
as follows. The `($N::BIGINT IS NULL OR column = $N)` pattern means "no filter when the parameter is
null, otherwise filter" — it lets one prepared query handle both the filtered and unfiltered case
without string-concatenating SQL.

Replace the entire `globalResult` assignment with:

```ts
    const globalResult = hasVotesTable
      ? await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             COALESCE(v.vote_count, 0)::INT AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM exercises e
           LEFT JOIN (
             SELECT exercise_id, COUNT(*)::INT AS vote_count
             FROM exercise_votes
             GROUP BY exercise_id
           ) v ON v.exercise_id = e.exercise_id
           LEFT JOIN exercise_votes uv
             ON uv.exercise_id = e.exercise_id AND uv.user_id = $1
           WHERE ($2::BIGINT IS NULL OR e.deck_id = $2)
           ORDER BY e.exercise_id ASC`,
          [req.userId, hasDeckFilter ? deckId : null]
        )
      : await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM exercises e
           WHERE ($1::BIGINT IS NULL OR e.deck_id = $1)
           ORDER BY e.exercise_id ASC`,
          [hasDeckFilter ? deckId : null]
        )
```

Replace the entire `userResult` assignment with:

```ts
    const userResult = hasVotesTable
      ? await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             COALESCE(v.vote_count, 0) AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM user_exercises ue
           LEFT JOIN (
             SELECT exercise_id, COUNT(*)::INT AS vote_count
             FROM exercise_votes
             GROUP BY exercise_id
           ) v ON v.exercise_id = ue.exercise_id
           LEFT JOIN exercise_votes uv
             ON uv.exercise_id = ue.exercise_id AND uv.user_id = $2
           WHERE ue.user_id = $1 AND ($3::BIGINT IS NULL OR ue.deck_id = $3)
           ORDER BY ue.created_at ASC`,
          [req.userId, req.userId, hasDeckFilter ? deckId : null]
        )
      : await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM user_exercises ue
           WHERE ue.user_id = $1 AND ($2::BIGINT IS NULL OR ue.deck_id = $2)
           ORDER BY ue.created_at ASC`,
          [req.userId, hasDeckFilter ? deckId : null]
        )
```

Do not change anything below this point in the handler (the `combined` array construction that maps
`globalResult.rows`/`userResult.rows` into the response body stays exactly as it is).

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Verify against a real database (if available)**

```bash
curl -s "http://localhost:3001/api/exercises" -H "Authorization: Bearer <token>" | head -c 200
curl -s "http://localhost:3001/api/exercises?deckId=1" -H "Authorization: Bearer <token>" | head -c 200
curl -s "http://localhost:3001/api/exercises?deckId=999999" -H "Authorization: Bearer <token>"
```

Confirm the unfiltered call returns the same result as before this change, the `deckId=1` call
returns the same set (since all seeded exercises were backfilled to deck 1 in Task 2), and the
`deckId=999999` call returns `[]`. If no database is available, skip and say so in your report.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/exercises.ts
git commit -m "feat: support optional deckId filter on GET /api/exercises"
```

---

### Task 6: Wire backend tests into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current backend CI job**

The `backend` job currently runs only `npm ci` and `npm run build` (no test step — there was nothing
to test before this plan).

- [ ] **Step 2: Add a test step**

In `.github/workflows/ci.yml`, in the `backend` job, change:

```yaml
      - run: npm ci
      - run: npm run build
```

to:

```yaml
      - run: npm ci
      - run: npm test
      - run: npm run build
```

Do not add a Postgres service container in this change — the tests added in this plan (Task 3's
mapper test) don't need one. Route-level integration testing against a real database is an explicit,
already-documented gap (see this plan's Architecture section and the design spec's Testing section),
not something to silently paper over here.

- [ ] **Step 3: Verify locally**

```bash
cd backend && npm test && npx tsc --noEmit
```

Expected: tests pass, typecheck clean.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run backend tests"
```

---

## Self-Review Notes

- **Spec coverage:** This plan implements the `decks` table and read API portion of the spec's
  "Content storage" and "Domain model" sections, corrected against the actual existing backend
  (which already stores exercise content in Postgres — see the Architecture section's correction).
  It does not implement deck CRUD beyond read (no create/update/delete for community decks — that's
  Plan 3's job, once the frontend has a "My decks" screen to drive it), and does not reshape stored
  JSONB into the `DeckExercise` shape (also deferred, since nothing consumes it yet).
- **No placeholders:** every step has complete, runnable code, including the full modified SQL
  queries in Task 5 rather than a description of the change.
- **Type consistency:** `DeckRow`, `DeckDto`, `mapDeckRow` are named identically everywhere they
  appear across Tasks 3–4. The `Deck` type in `frontend/src/types/deck.ts` and this plan's `DeckDto`
  are intentionally field-identical except for `id`/`ownerId` being strings on the wire — documented
  explicitly in the "ID convention" section so this isn't mistaken for a bug later.
- **Testing gap, stated plainly:** this plan cannot add real integration tests for the route handlers
  (Tasks 4–5) without a database in CI, which is out of scope for this plan (it's infrastructure, not
  a coding task, and the existing `api-smoke` CI job already covers a live-environment smoke check).
  Task 4 and Task 5 both include a manual verification step against a real database as a substitute,
  with explicit instructions not to claim verification that didn't happen.
