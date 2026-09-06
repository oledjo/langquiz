# Sync Endpoints (Backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three additive REST endpoints to the LangQuiz backend so a native offline-first client can (a) detect changed deck content cheaply, (b) replay a batch of queued practice events idempotently, and (c) pull its authoritative FSRS-6 review schedule since a cursor.

**Architecture:** Each endpoint's request-handling logic is extracted into a pure, unit-testable function (matching this repo's existing test style — pure functions + a fake `pg` client, no live Postgres). The Express handlers stay thin. The batch endpoint reuses a single shared `applyProgressEvent` helper that the existing `POST /api/progress` handler is refactored to call, so the idempotency + FSRS scheduling logic exists once.

**Tech Stack:** Node, Express 5, TypeScript, `pg`, vitest (`backend/vitest.config.mts`), migrations auto-run on boot via `runMigrations` in `backend/src/db/database.ts`.

**Spec:** [../../../repzy/Repzy-Mobile/docs/superpowers/specs/2026-09-06-swiftui-offline-first-design.md](../../../repzy/Repzy-Mobile/docs/superpowers/specs/2026-09-06-swiftui-offline-first-design.md) — section "Backend additions (main LangQuiz repo)".

## Global Constraints

- All three endpoints are **additive**. No existing endpoint changes response shape or status codes. The only refactor to existing code is extracting `applyProgressEvent` and having the current `POST /api/progress` call it — its externally observable behavior must stay identical.
- **No new migration is required.** Endpoints read existing columns (`decks.updated_at`, `exercises.updated_at`, `user_review_schedule.updated_at`) and the existing `progress (user_id, idempotency_key)` unique constraint from migration `010_progress_idempotency.sql`. A performance-only migration is Task 4 and is optional.
- Auth middleware: `requireAuth` and `optionalAuth` from `backend/src/auth/middleware.ts`. `optionalAuth` sets `req.userId` when a valid token is present and leaves it `undefined` otherwise.
- Tests live next to the unit under test as `*.test.ts` and run with `npm --prefix backend test` (vitest). Do not add supertest or a Postgres test harness — follow `backend/src/db/database.test.ts`'s `FakeClient` pattern.
- Route files register in `backend/src/index.ts` in the `app.use('/api/...', ...)` block (lines ~51-61).

---

## Task 1: `GET /api/content/version`

A cheap "what changed" probe. Returns a global cursor plus a per-deck content version, computed from `updated_at` timestamps. Anonymous callers see only `origin = 'official'` decks (matching `GET /api/decks`).

**Files:**
- Create: `backend/src/routes/contentVersion.ts`
- Create: `backend/src/routes/contentVersion.test.ts`
- Modify: `backend/src/index.ts` (add `import` + one `app.use` line)

**Interfaces:**
- Consumes: `db` from `../db/database`; `optionalAuth` from `../auth/middleware`.
- Produces:
  - `export function computeContentVersion(rows: DeckVersionRow[]): ContentVersionResponse`
  - `interface DeckVersionRow { id: number; slug: string; exercise_count: number; max_updated: string | null; deck_updated: string }`
  - `interface ContentVersionResponse { decksCursor: string; decks: { id: number; slug: string; contentVersion: string }[] }`
  - `export const contentVersionRouter: Router`
  - Route: `GET /api/content/version` → `200 ContentVersionResponse`

- [ ] **Step 1: Write the failing test for `computeContentVersion`**

Create `backend/src/routes/contentVersion.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { computeContentVersion } from './contentVersion'

describe('computeContentVersion', () => {
  const rows = [
    { id: 1, slug: 'einburgertest', exercise_count: 310, max_updated: '2026-09-01T10:00:00.000Z', deck_updated: '2026-08-01T00:00:00.000Z' },
    { id: 2, slug: 'de-grammar', exercise_count: 40, max_updated: '2026-07-15T09:00:00.000Z', deck_updated: '2026-07-15T09:00:00.000Z' },
  ]

  test('produces one contentVersion per deck plus a global decksCursor', () => {
    const result = computeContentVersion(rows)
    expect(result.decks.map((d) => d.slug)).toEqual(['einburgertest', 'de-grammar'])
    expect(result.decks[0].contentVersion).toMatch(/^[a-f0-9]{16}$/)
    expect(result.decksCursor).toMatch(/^[a-f0-9]{16}$/)
  })

  test('is stable for identical input and changes when any deck timestamp or count changes', () => {
    const a = computeContentVersion(rows)
    const b = computeContentVersion(rows.map((r) => ({ ...r })))
    expect(a).toEqual(b)

    const bumped = computeContentVersion([
      { ...rows[0], max_updated: '2026-09-02T10:00:00.000Z' },
      rows[1],
    ])
    expect(bumped.decks[0].contentVersion).not.toBe(a.decks[0].contentVersion)
    expect(bumped.decksCursor).not.toBe(a.decksCursor)
  })

  test('handles a deck with zero exercises (max_updated null)', () => {
    const result = computeContentVersion([{ id: 3, slug: 'empty', exercise_count: 0, max_updated: null, deck_updated: '2026-01-01T00:00:00.000Z' }])
    expect(result.decks[0].contentVersion).toMatch(/^[a-f0-9]{16}$/)
  })
})
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm --prefix backend test -- contentVersion`
Expected: FAIL — `computeContentVersion` is not exported / file missing.

- [ ] **Step 3: Implement `backend/src/routes/contentVersion.ts`**

```typescript
import { createHash } from 'crypto'
import { Router } from 'express'
import { db } from '../db/database'
import { optionalAuth } from '../auth/middleware'

export interface DeckVersionRow {
  id: number
  slug: string
  exercise_count: number
  max_updated: string | null
  deck_updated: string
}

export interface ContentVersionResponse {
  decksCursor: string
  decks: { id: number; slug: string; contentVersion: string }[]
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function computeContentVersion(rows: DeckVersionRow[]): ContentVersionResponse {
  const decks = rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    contentVersion: shortHash(
      [row.id, row.deck_updated, row.max_updated ?? 'none', row.exercise_count].join('|')
    ),
  }))
  const decksCursor = shortHash(decks.map((d) => `${d.id}:${d.contentVersion}`).join(','))
  return { decksCursor, decks }
}

export const contentVersionRouter = Router()

contentVersionRouter.use(optionalAuth)

contentVersionRouter.get('/version', async (req, res) => {
  try {
    const officialOnly = !req.userId
    const result = await db.query<DeckVersionRow>(
      `SELECT
         d.id,
         d.slug,
         COUNT(e.exercise_id)::INT AS exercise_count,
         to_char(MAX(e.updated_at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS max_updated,
         to_char(d.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS deck_updated
       FROM decks d
       LEFT JOIN exercises e ON e.deck_id = d.id
       WHERE ($1::BOOLEAN IS FALSE OR d.origin = 'official')
       GROUP BY d.id
       ORDER BY d.slug ASC`,
      [officialOnly]
    )
    res.json(computeContentVersion(result.rows))
  } catch (error) {
    console.error('Failed to compute content version:', error)
    res.status(500).json({ error: 'Failed to compute content version' })
  }
})
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm --prefix backend test -- contentVersion`
Expected: PASS (3 tests).

- [ ] **Step 5: Register the router in `backend/src/index.ts`**

Add with the other imports:
```typescript
import { contentVersionRouter } from './routes/contentVersion'
```
Add in the `app.use` block (after the `/api/decks` line):
```typescript
app.use('/api/content', contentVersionRouter)
```

- [ ] **Step 6: Typecheck + full test run**

Run: `npm --prefix backend run build && npm --prefix backend test`
Expected: build succeeds; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/contentVersion.ts backend/src/routes/contentVersion.test.ts backend/src/index.ts
git commit -m "feat(api): add GET /api/content/version for client content-sync cursor

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: Extract `applyProgressEvent` from the `POST /api/progress` handler

Pull the "insert one progress row (idempotent) + recompute `user_review_schedule`" logic out of the inline handler into one reusable async function taking a `pg` client. The existing handler is refactored to call it; behavior is unchanged. Task 3's batch endpoint reuses it.

**Files:**
- Create: `backend/src/services/applyProgressEvent.ts`
- Create: `backend/src/services/applyProgressEvent.test.ts`
- Modify: `backend/src/routes/progress.ts` (the `progressRouter.post('/', ...)` handler, ~lines 300-430)

**Interfaces:**
- Consumes: `computeNextReview`, `isAnswerGrade`, `type AnswerGrade`, `type ReviewScheduleState` from `../services/reviewScheduler`; a `pg` `PoolClient` passed in by the caller (caller owns `BEGIN`/`COMMIT`).
- Produces:
  - `export interface ProgressEventInput { userId: number; exerciseId: string; correct: boolean; grade: AnswerGrade; mode: 'practice' | 'exam'; idempotencyKey: string | null }`
  - `export type ProgressEventStatus = 'acked' | 'duplicate' | 'conflict'`
  - `export async function applyProgressEvent(client: ProgressDbClient, input: ProgressEventInput): Promise<ProgressEventStatus>`
  - `export interface ProgressDbClient { query<R extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: R[]; rowCount: number | null }> }`

- [ ] **Step 1: Write the failing test with a fake client**

Create `backend/src/services/applyProgressEvent.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { applyProgressEvent, type ProgressDbClient, type ProgressEventInput } from './applyProgressEvent'

/** Records statements and simulates the (user_id, idempotency_key) unique constraint. */
class FakeClient implements ProgressDbClient {
  ran: { text: string; values: unknown[] }[] = []
  private seenKeys = new Map<string, { exercise_id: string; correct: boolean; answer_grade: string }>()
  scheduleRow: Record<string, unknown> | null = null

  async query(text: string, values: unknown[] = []) {
    this.ran.push({ text: text.trim().split('\n')[0], values })

    if (text.includes('INSERT INTO progress') && text.includes('ON CONFLICT (user_id, idempotency_key)')) {
      const key = `${values[2]}:${values[3]}`
      if (this.seenKeys.has(key)) return { rows: [], rowCount: 0 }
      this.seenKeys.set(key, { exercise_id: values[0] as string, correct: values[1] as boolean, answer_grade: values[4] as string })
      return { rows: [{ id: this.seenKeys.size }], rowCount: 1 }
    }
    if (text.includes('SELECT exercise_id, correct, answer_grade') && text.includes('FROM progress')) {
      const key = `${values[0]}:${values[1]}`
      const existing = this.seenKeys.get(key)
      return { rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 }
    }
    if (text.includes('INSERT INTO progress') && !text.includes('ON CONFLICT (user_id, idempotency_key)')) {
      return { rows: [], rowCount: 1 }
    }
    if (text.includes('FROM user_review_schedule')) {
      return { rows: this.scheduleRow ? [this.scheduleRow] : [], rowCount: this.scheduleRow ? 1 : 0 }
    }
    if (text.includes('INTO user_review_schedule')) {
      return { rows: [], rowCount: 1 }
    }
    return { rows: [], rowCount: 0 }
  }
}

const base: ProgressEventInput = {
  userId: 42,
  exerciseId: 'de-grammar-articles-001-3',
  correct: true,
  grade: 'good',
  mode: 'practice',
  idempotencyKey: 'key-abc',
}

describe('applyProgressEvent', () => {
  test('first call with an idempotency key inserts and returns "acked", and writes a schedule row', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, base)
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('INTO user_review_schedule'))).toBe(true)
  })

  test('replaying the same key with the same payload returns "duplicate" and does not touch the schedule', async () => {
    const client = new FakeClient()
    await applyProgressEvent(client, base)
    const before = client.ran.length
    const status = await applyProgressEvent(client, base)
    expect(status).toBe('duplicate')
    expect(client.ran.slice(before).some((s) => s.text.includes('INTO user_review_schedule'))).toBe(false)
  })

  test('reusing a key with a different payload returns "conflict"', async () => {
    const client = new FakeClient()
    await applyProgressEvent(client, base)
    const status = await applyProgressEvent(client, { ...base, correct: false, grade: 'again' })
    expect(status).toBe('conflict')
  })

  test('exam mode inserts progress but skips the schedule update', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, { ...base, mode: 'exam', idempotencyKey: 'key-exam' })
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('INTO user_review_schedule'))).toBe(false)
  })

  test('with a null idempotency key it always inserts (plain INSERT, no ON CONFLICT) and returns "acked"', async () => {
    const client = new FakeClient()
    const status = await applyProgressEvent(client, { ...base, idempotencyKey: null })
    expect(status).toBe('acked')
    expect(client.ran.some((s) => s.text.includes('ON CONFLICT (user_id, idempotency_key)'))).toBe(false)
  })
})
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm --prefix backend test -- applyProgressEvent`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `backend/src/services/applyProgressEvent.ts`**

Move the body of the current `progressRouter.post('/')` handler (from the `client.query('BEGIN')` block through the schedule upsert, excluding `BEGIN`/`COMMIT`/`ROLLBACK` and the `res.*` calls) into this function. Preserve the exact SQL strings.

```typescript
import {
  computeNextReview,
  type AnswerGrade,
  type ReviewScheduleState,
} from './reviewScheduler'

export interface ProgressDbClient {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: R[]; rowCount: number | null }>
}

export interface ProgressEventInput {
  userId: number
  exerciseId: string
  correct: boolean
  grade: AnswerGrade
  mode: 'practice' | 'exam'
  idempotencyKey: string | null
}

export type ProgressEventStatus = 'acked' | 'duplicate' | 'conflict'

export async function applyProgressEvent(
  client: ProgressDbClient,
  input: ProgressEventInput
): Promise<ProgressEventStatus> {
  const { userId, exerciseId, correct, grade, mode, idempotencyKey } = input

  if (idempotencyKey) {
    const insertResult = await client.query<{ id: number }>(
      `INSERT INTO progress (exercise_id, correct, user_id, idempotency_key, answer_grade)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, idempotency_key)
       DO NOTHING
       RETURNING id`,
      [exerciseId, correct, userId, idempotencyKey, grade]
    )

    if ((insertResult.rowCount ?? 0) === 0) {
      const existingResult = await client.query<{
        exercise_id: string
        correct: boolean
        answer_grade: string | null
      }>(
        `SELECT exercise_id, correct, answer_grade
         FROM progress
         WHERE user_id = $1 AND idempotency_key = $2
         ORDER BY id DESC
         LIMIT 1`,
        [userId, idempotencyKey]
      )
      const existing = existingResult.rows[0]
      if (
        existing &&
        (existing.exercise_id !== exerciseId ||
          existing.correct !== correct ||
          (existing.answer_grade ?? null) !== grade)
      ) {
        return 'conflict'
      }
      return 'duplicate'
    }
  } else {
    await client.query(
      'INSERT INTO progress (exercise_id, correct, user_id, answer_grade) VALUES ($1, $2, $3, $4)',
      [exerciseId, correct, userId, grade]
    )
  }

  if (mode !== 'exam') {
    const scheduleResult = await client.query<ReviewScheduleState>(
      `SELECT repetition_count, interval_days, lapse_count, stability, difficulty, state, last_reviewed_at, scheduler_version, ease_factor
       FROM user_review_schedule
       WHERE user_id = $1 AND exercise_id = $2`,
      [userId, exerciseId]
    )
    const nextReview = computeNextReview(scheduleResult.rows[0] ?? null, grade)

    await client.query(
      `INSERT INTO user_review_schedule (
         user_id, exercise_id, repetition_count, interval_days, stability, difficulty, state,
         due_at, last_reviewed_at, last_outcome_correct, scheduler_version, lapse_count, last_answer_grade, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, $11, $12, NOW())
       ON CONFLICT (user_id, exercise_id)
       DO UPDATE SET
         repetition_count = EXCLUDED.repetition_count,
         interval_days = EXCLUDED.interval_days,
         stability = EXCLUDED.stability,
         difficulty = EXCLUDED.difficulty,
         state = EXCLUDED.state,
         due_at = EXCLUDED.due_at,
         last_reviewed_at = NOW(),
         last_outcome_correct = EXCLUDED.last_outcome_correct,
         scheduler_version = EXCLUDED.scheduler_version,
         lapse_count = EXCLUDED.lapse_count,
         last_answer_grade = EXCLUDED.last_answer_grade,
         updated_at = NOW()`,
      [
        userId,
        exerciseId,
        nextReview.repetitionCount,
        nextReview.intervalDays,
        nextReview.stability,
        nextReview.difficulty,
        nextReview.state,
        nextReview.dueAt,
        correct,
        nextReview.schedulerVersion,
        nextReview.lapseCount,
        grade,
      ]
    )
  }

  return 'acked'
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm --prefix backend test -- applyProgressEvent`
Expected: PASS (5 tests).

- [ ] **Step 5: Refactor `progressRouter.post('/')` to call the helper**

In `backend/src/routes/progress.ts`, keep all existing request validation (the `typeof exercise_id`, `isAnswerGrade`, `isValidProgressMode`, grade/correct compatibility checks, `idempotency-key` header read) and the `client`/`BEGIN`/`COMMIT`/`ROLLBACK` scaffolding. Replace the inline insert+schedule block with:

```typescript
const status = await applyProgressEvent(client, {
  userId: req.userId!,
  exerciseId: exercise_id,
  correct,
  grade,
  mode: progressMode,
  idempotencyKey,
})
await client.query('COMMIT')

if (status === 'conflict') {
  res.status(409).json({
    error: 'Idempotency key has already been used with a different payload',
    requestId: req.requestId ?? null,
  })
  return
}
if (status === 'duplicate') {
  res.status(200).json({ ok: true, duplicate: true })
  return
}
res.status(201).json({ ok: true })
```

Add `import { applyProgressEvent } from '../services/applyProgressEvent'` at the top.

- [ ] **Step 6: Typecheck + full test run; manual smoke of the single endpoint**

Run: `npm --prefix backend run build && npm --prefix backend test`
Expected: build + all tests pass.
Then run `npm --prefix backend run smoke` if a local DB is configured (the repo's `scripts/smoke-api.mjs`); otherwise note in the commit that smoke was not run.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/applyProgressEvent.ts backend/src/services/applyProgressEvent.test.ts backend/src/routes/progress.ts
git commit -m "refactor(api): extract applyProgressEvent; POST /api/progress now calls it

No behavior change to POST /api/progress. Shared helper prepares for batch replay.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `POST /api/progress/batch` and `GET /api/progress/schedule`

The two remaining endpoints, both on `progressRouter` (already `requireAuth`-gated).

**Files:**
- Modify: `backend/src/routes/progress.ts` (add two handlers + two small pure helpers)
- Create: `backend/src/routes/progressBatch.test.ts`

**Interfaces:**
- Consumes: `applyProgressEvent`, `ProgressEventStatus` from `../services/applyProgressEvent`; `isAnswerGrade` from `../services/reviewScheduler`; `db` from `../db/database`.
- Produces:
  - `export function parseBatchItems(body: unknown): { items: BatchItemInput[] } | { error: string }`
  - `export interface BatchItemInput { clientId: string; exercise_id: string; correct: boolean; answer_grade: AnswerGrade; mode: 'practice' | 'exam' }`
  - `export function parseSince(raw: unknown): string | null` — validates an ISO-8601 string, returns it or `null`
  - Route `POST /api/progress/batch` → `200 { results: { clientId: string; status: ProgressEventStatus }[] }`, `400 { error }`
  - Route `GET /api/progress/schedule` → `200 { syncedAt: string; rows: ScheduleRow[] }`
  - `interface ScheduleRow { exerciseId: string; dueAt: string | null; intervalDays: number; repetitionCount: number; lapseCount: number; lastAnswerGrade: string | null }`

- [ ] **Step 1: Write the failing tests for the pure helpers**

Create `backend/src/routes/progressBatch.test.ts`:

```typescript
import { describe, expect, test } from 'vitest'
import { parseBatchItems, parseSince } from './progress'

describe('parseBatchItems', () => {
  const ok = { clientId: 'c1', exercise_id: 'ex-1', correct: true, answer_grade: 'good', mode: 'practice' }

  test('accepts a well-formed items array', () => {
    const result = parseBatchItems({ items: [ok] })
    expect('items' in result && result.items).toEqual([ok])
  })

  test('rejects a non-object / missing items', () => {
    expect('error' in parseBatchItems(null)).toBe(true)
    expect('error' in parseBatchItems({})).toBe(true)
    expect('error' in parseBatchItems({ items: 'nope' })).toBe(true)
  })

  test('rejects an empty batch and a batch over 200', () => {
    expect('error' in parseBatchItems({ items: [] })).toBe(true)
    expect('error' in parseBatchItems({ items: Array(201).fill(ok) })).toBe(true)
  })

  test('rejects an item with a bad grade, missing clientId, or non-boolean correct', () => {
    expect('error' in parseBatchItems({ items: [{ ...ok, answer_grade: 'meh' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, clientId: '' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, correct: 'yes' }] })).toBe(true)
  })

  test('rejects grade/correct mismatch (again+correct, good+incorrect)', () => {
    expect('error' in parseBatchItems({ items: [{ ...ok, answer_grade: 'again' }] })).toBe(true)
    expect('error' in parseBatchItems({ items: [{ ...ok, correct: false }] })).toBe(true)
  })

  test('defaults mode to practice when omitted', () => {
    const { clientId, exercise_id, correct, answer_grade } = ok
    const result = parseBatchItems({ items: [{ clientId, exercise_id, correct, answer_grade }] })
    expect('items' in result && result.items[0].mode).toBe('practice')
  })
})

describe('parseSince', () => {
  test('returns a valid ISO-8601 string unchanged', () => {
    expect(parseSince('2026-09-01T10:00:00.000Z')).toBe('2026-09-01T10:00:00.000Z')
  })
  test('returns null for absent or invalid input', () => {
    expect(parseSince(undefined)).toBeNull()
    expect(parseSince('last tuesday')).toBeNull()
    expect(parseSince(12345)).toBeNull()
  })
})
```

- [ ] **Step 2: Run it, expect failure**

Run: `npm --prefix backend test -- progressBatch`
Expected: FAIL — `parseBatchItems` / `parseSince` not exported.

- [ ] **Step 3: Add the pure helpers + handlers to `backend/src/routes/progress.ts`**

Add near `isValidProgressMode`:

```typescript
import { applyProgressEvent, type ProgressEventStatus } from '../services/applyProgressEvent'
import { isAnswerGrade, type AnswerGrade } from '../services/reviewScheduler'

export interface BatchItemInput {
  clientId: string
  exercise_id: string
  correct: boolean
  answer_grade: AnswerGrade
  mode: 'practice' | 'exam'
}

export function parseBatchItems(body: unknown): { items: BatchItemInput[] } | { error: string } {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { items?: unknown }).items)) {
    return { error: 'body.items must be an array' }
  }
  const raw = (body as { items: unknown[] }).items
  if (raw.length === 0) return { error: 'body.items must not be empty' }
  if (raw.length > 200) return { error: 'body.items must not exceed 200 entries' }

  const items: BatchItemInput[] = []
  for (const entry of raw) {
    const e = entry as Record<string, unknown>
    if (typeof e.clientId !== 'string' || e.clientId.trim() === '') return { error: 'each item needs a non-empty clientId' }
    if (typeof e.exercise_id !== 'string' || e.exercise_id.trim() === '') return { error: 'each item needs an exercise_id' }
    if (typeof e.correct !== 'boolean') return { error: 'each item needs a boolean correct' }
    if (!isAnswerGrade(e.answer_grade)) return { error: 'answer_grade must be again|hard|good|easy' }
    const mode = e.mode ?? 'practice'
    if (mode !== 'practice' && mode !== 'exam') return { error: 'mode must be practice|exam' }
    const grade = e.answer_grade as AnswerGrade
    if (grade === 'again' && e.correct) return { error: 'answer_grade "again" is not compatible with correct=true' }
    if (grade !== 'again' && !e.correct) return { error: `answer_grade "${grade}" is not compatible with correct=false` }
    items.push({ clientId: e.clientId, exercise_id: e.exercise_id, correct: e.correct, answer_grade: grade, mode })
  }
  return { items }
}

export function parseSince(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return null
  return raw
}
```

Add the two handlers (after the existing `progressRouter.post('/')`, before `progressRouter.get('/:exerciseId')` — order matters so `/batch` and `/schedule` are not captured by `/:exerciseId`... actually `/:exerciseId` is a GET and `/batch` is a POST so no clash, but keep `/schedule` above `/:exerciseId`):

```typescript
progressRouter.post('/batch', async (req, res) => {
  const parsed = parseBatchItems(req.body)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error })
    return
  }

  const client = await db.connect()
  const results: { clientId: string; status: ProgressEventStatus }[] = []
  try {
    await client.query('BEGIN')
    for (const item of parsed.items) {
      const status = await applyProgressEvent(client, {
        userId: req.userId!,
        exerciseId: item.exercise_id,
        correct: item.correct,
        grade: item.answer_grade,
        mode: item.mode,
        idempotencyKey: item.clientId,
      })
      results.push({ clientId: item.clientId, status })
    }
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Failed to apply progress batch:', error)
    res.status(500).json({ error: 'Failed to apply progress batch' })
    return
  } finally {
    client.release()
  }
  res.json({ results })
})

progressRouter.get('/schedule', async (req, res) => {
  try {
    const since = parseSince(req.query.since)
    const deckId = parseDeckIdParam(req.query.deckId)
    const rowsResult = await db.query(
      `SELECT
         urs.exercise_id AS "exerciseId",
         to_char(urs.due_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "dueAt",
         urs.interval_days AS "intervalDays",
         urs.repetition_count AS "repetitionCount",
         urs.lapse_count AS "lapseCount",
         urs.last_answer_grade AS "lastAnswerGrade"
       FROM user_review_schedule urs
       LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
       WHERE urs.user_id = $1
         AND ($2::TIMESTAMPTZ IS NULL OR urs.updated_at > $2)
         AND ($3::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $3)
       ORDER BY urs.updated_at ASC`,
      [req.userId, since, deckId]
    )
    res.json({ syncedAt: new Date().toISOString(), rows: rowsResult.rows })
  } catch (error) {
    console.error('Failed to load schedule:', error)
    res.status(500).json({ error: 'Failed to load schedule' })
  }
})
```

- [ ] **Step 4: Run the tests, expect pass**

Run: `npm --prefix backend test -- progressBatch`
Expected: PASS.

- [ ] **Step 5: Typecheck + full test run**

Run: `npm --prefix backend run build && npm --prefix backend test`
Expected: build + all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/progress.ts backend/src/routes/progressBatch.test.ts
git commit -m "feat(api): add POST /api/progress/batch and GET /api/progress/schedule

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4 (optional, performance only): index for the content-version query

Only do this if `EXPLAIN ANALYZE` on the Task 1 query shows a slow `MAX(e.updated_at)` group aggregate at production row counts.

**Files:**
- Create: `backend/src/db/migrations/021_exercises_deck_updated_idx.sql`

- [ ] **Step 1: Write the migration**

```sql
CREATE INDEX IF NOT EXISTS idx_exercises_deck_id_updated_at
  ON exercises (deck_id, updated_at DESC);
```

- [ ] **Step 2: Verify it applies**

Run the backend once against a local DB (`npm --prefix backend run dev`) and confirm the startup log shows `021_exercises_deck_updated_idx` applied with no error, then stop it.

- [ ] **Step 3: Commit**

```bash
git add backend/src/db/migrations/021_exercises_deck_updated_idx.sql
git commit -m "perf(db): index exercises(deck_id, updated_at) for content-version query

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (section "Backend additions"):**
- `GET /api/content/version` with anon = official-only → Task 1. ✅
- `POST /api/progress/batch` (max 200, one transaction, per-item `acked|duplicate|conflict`, reuses idempotency constraint) → Tasks 2 + 3. ✅ (Spec said `'acked' | 'duplicate' | 'conflict'`; plan uses the same three.)
- `GET /api/progress/schedule?since=&deckId=` returning the projection → Task 3. ✅
- "No migrations strictly required" + materialized column as follow-up → Task 4 optional. ✅

**Placeholder scan:** No TBD/TODO; every step has literal code or a literal command. ✅

**Type consistency:** `ProgressEventStatus` defined in Task 2, imported in Task 3. `AnswerGrade` sourced from `reviewScheduler` in both. `BatchItemInput.mode` non-optional in the type, defaulted in `parseBatchItems`. `parseSince` returns `string | null` and is passed straight to a `$2::TIMESTAMPTZ IS NULL OR ...` guard. ✅

**Note for executor:** the existing `POST /api/progress` handler references `req.userId` (non-null after `requireAuth`); the plan uses `req.userId!` in the new call sites to match the file's existing style. If the file uses a different non-null pattern, follow that instead.
