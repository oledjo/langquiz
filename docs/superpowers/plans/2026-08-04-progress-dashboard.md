# Deck-Scoped Progress Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user scope their progress view to a single deck (or "All decks", today's behavior),
via a new routed `ProgressPage` with a deck selector, backed by real backend `deckId` filtering on
`GET /api/stats` and `GET /api/progress/review-metrics`. This is Plan 7 of the Reps platform
rewrite (see `docs/superpowers/specs/2026-08-02-reps-platform-core-design.md` and this plan's own
design spec `docs/superpowers/specs/2026-08-04-progress-dashboard-design.md`); Plans 1–6 are merged
to `master`.

**Architecture:** A shared `parseDeckIdParam` helper (mirroring the existing `deckId` parsing
already used by `GET /api/exercises?deckId=`) is added once and reused by both `GET /api/stats` and
`GET /api/progress/review-metrics`, each of which joins its rows to `exercises`/`user_exercises` on
`exercise_id` and filters on `COALESCE(deck_id) = $deckId` when given. On the frontend, a new
`frontend/src/pages/ProgressPage.tsx` (routed at `/progress`, replacing the `ProgressDashboard`
block currently inside legacy `MainApp`) renders a deck-tab selector backed by `useDecks()`, storing
the selection in a `?deck=<slug>` URL query param, and threads the resolved `deckId` through to
`useStats`/`useReviewMetrics` (both gain an optional `deckId?: string` param) and to either
`useDeckExercises(deckId)` or the existing global `useExercises()`.

**Tech Stack:** React 19, react-router-dom 7, Express 5, Postgres, Vitest (frontend and backend) —
all already in place from Plans 1–6.

**Non-goals (explicitly deferred, per the design spec):**
- `GET /api/progress/summary` / `useProgressSummary` — confirmed unused by any screen today, not
  touched by this plan.
- Facet-based grouping for weak topics — stays keyed on the legacy `topic` field.
- The Admin screen/route — still inside legacy `MainApp`, untouched.

---

### Task 1: Backend — shared `deckId` query-param parser

**Files:**
- Create: `backend/src/routes/queryParams.ts`
- Test: `backend/src/routes/queryParams.test.ts`

`backend/src/routes/exercises.ts` already has inline `deckId` parsing logic
(`typeof req.query.deckId === 'string' && req.query.deckId !== '' ? Number(req.query.deckId) : null`
plus a `Number.isFinite` check). This task extracts that into a shared, testable helper so
`stats.ts` and `progress.ts` (Tasks 2–3) don't duplicate it.

- [ ] **Step 1: Write the failing test**

Create `backend/src/routes/queryParams.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { parseDeckIdParam } from './queryParams'

describe('parseDeckIdParam', () => {
  test('parses a numeric string into a number', () => {
    expect(parseDeckIdParam('42')).toBe(42)
  })

  test('returns null for undefined', () => {
    expect(parseDeckIdParam(undefined)).toBeNull()
  })

  test('returns null for an empty string', () => {
    expect(parseDeckIdParam('')).toBeNull()
  })

  test('returns null for a non-numeric string', () => {
    expect(parseDeckIdParam('not-a-number')).toBeNull()
  })

  test('returns null for a non-string value (e.g. an array from repeated query params)', () => {
    expect(parseDeckIdParam(['1', '2'])).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- queryParams`
Expected: FAIL — `queryParams.ts` does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `backend/src/routes/queryParams.ts`:

```ts
export function parseDeckIdParam(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- queryParams`
Expected: `5 passed`

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/langquiz
git add backend/src/routes/queryParams.ts backend/src/routes/queryParams.test.ts
git commit -m "feat: extract shared deckId query-param parser"
```

---

### Task 2: Backend — `deckId` scoping on `GET /api/stats`

**Files:**
- Modify: `backend/src/routes/stats.ts`

- [ ] **Step 1: Read the current file**

Read `backend/src/routes/stats.ts` in full to confirm the current shape of the `GET /` handler
matches what's assumed below (it should, per Task 2's exploration — the query selects from the
`exercise_stats` view joined to `user_review_schedule`).

- [ ] **Step 2: Add the deckId-scoped query**

In `backend/src/routes/stats.ts`, find:

```ts
import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'

export const statsRouter = Router()

statsRouter.use(requireAuth)

statsRouter.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         es.exercise_id,
         es.total_attempts,
         es.correct_attempts,
         es.last_answered,
         urs.due_at,
         urs.repetition_count,
         urs.interval_days,
         urs.ease_factor,
         urs.scheduler_version,
         urs.lapse_count,
         urs.last_answer_grade
       FROM exercise_stats es
       LEFT JOIN user_review_schedule urs
         ON urs.user_id = es.user_id
        AND urs.exercise_id = es.exercise_id
       WHERE es.user_id = $1
       ORDER BY
         CASE WHEN urs.due_at IS NOT NULL AND urs.due_at <= NOW() THEN 0 ELSE 1 END,
         urs.due_at ASC NULLS LAST,
         es.last_answered DESC NULLS LAST`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})
```

Replace with:

```ts
import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'

export const statsRouter = Router()

statsRouter.use(requireAuth)

statsRouter.get('/', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const result = await db.query(
      `SELECT
         es.exercise_id,
         es.total_attempts,
         es.correct_attempts,
         es.last_answered,
         urs.due_at,
         urs.repetition_count,
         urs.interval_days,
         urs.ease_factor,
         urs.scheduler_version,
         urs.lapse_count,
         urs.last_answer_grade
       FROM exercise_stats es
       LEFT JOIN user_review_schedule urs
         ON urs.user_id = es.user_id
        AND urs.exercise_id = es.exercise_id
       LEFT JOIN exercises e ON e.exercise_id = es.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = es.exercise_id AND ue.user_id = es.user_id
       WHERE es.user_id = $1
         AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
       ORDER BY
         CASE WHEN urs.due_at IS NOT NULL AND urs.due_at <= NOW() THEN 0 ELSE 1 END,
         urs.due_at ASC NULLS LAST,
         es.last_answered DESC NULLS LAST`,
      [req.userId, deckId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Failed to fetch stats:', error)
    res.status(500).json({ error: 'Failed to load stats' })
  }
})
```

Note: `statsRouter.get('/:exerciseId', ...)` below this is **not** touched — it already scopes to a
single known exercise, so deck filtering is meaningless there.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/stats.ts
git commit -m "feat: scope GET /api/stats to a deck via optional deckId"
```

---

### Task 3: Backend — `deckId` scoping on `GET /api/progress/review-metrics`

**Files:**
- Modify: `backend/src/routes/progress.ts`
- Test: `backend/src/routes/progress.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `backend/src/routes/progress.test.ts` (append after the existing `isValidProgressMode`
`describe` block):

```ts
import { parseDeckIdParam } from './queryParams'

describe('parseDeckIdParam (used by review-metrics deckId scoping)', () => {
  test('parses a numeric string into a number', () => {
    expect(parseDeckIdParam('7')).toBe(7)
  })

  test('returns null when absent', () => {
    expect(parseDeckIdParam(undefined)).toBeNull()
  })
})
```

This does not re-test `parseDeckIdParam`'s full behavior (already covered exhaustively by
`queryParams.test.ts` in Task 1) — it's a smoke check confirming `progress.ts` actually imports and
uses the shared helper rather than reimplementing its own parsing.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- progress`
Expected: FAIL — `progress.test.ts` doesn't import `parseDeckIdParam` from `./queryParams` yet (the
import itself will fail to resolve if `progress.ts` hasn't re-exported or used it — but since
`queryParams.ts` already exists from Task 1, this import succeeds regardless; the test passes
immediately). Confirm instead that the test currently passes trivially, then proceed — the real
verification for this task is Step 5's regression check that `review-metrics` behavior is
unchanged when `deckId` is omitted.

- [ ] **Step 3: Add deckId scoping to the review-metrics query**

In `backend/src/routes/progress.ts`, find:

```ts
import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import {
  computeNextReview,
  isAnswerGrade,
  type AnswerGrade,
  type ReviewScheduleState,
} from '../services/reviewScheduler'

export const progressRouter = Router()

progressRouter.use(requireAuth)
```

Replace with:

```ts
import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { parseDeckIdParam } from './queryParams'
import {
  computeNextReview,
  isAnswerGrade,
  type AnswerGrade,
  type ReviewScheduleState,
} from '../services/reviewScheduler'

export const progressRouter = Router()

progressRouter.use(requireAuth)
```

Find the `review-metrics` handler:

```ts
progressRouter.get('/review-metrics', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
         COUNT(*)::INT AS scheduled_total,
         COUNT(*) FILTER (WHERE due_at <= NOW())::INT AS due_now,
         COUNT(*) FILTER (WHERE due_at < NOW() - INTERVAL '1 day')::INT AS overdue,
         COUNT(*) FILTER (WHERE due_at > NOW() AND due_at <= NOW() + INTERVAL '7 days')::INT AS due_next_7_days,
         COALESCE(SUM(lapse_count), 0)::INT AS total_lapses,
         COUNT(*) FILTER (WHERE last_answer_grade = 'again')::INT AS last_review_failed,
         scheduler_version
       FROM user_review_schedule
       WHERE user_id = $1
       GROUP BY scheduler_version
       ORDER BY scheduler_version ASC`,
      [req.userId]
    )
```

Replace with:

```ts
progressRouter.get('/review-metrics', async (req, res) => {
  try {
    const deckId = parseDeckIdParam(req.query.deckId)

    const result = await db.query(
      `SELECT
         COUNT(*)::INT AS scheduled_total,
         COUNT(*) FILTER (WHERE due_at <= NOW())::INT AS due_now,
         COUNT(*) FILTER (WHERE due_at < NOW() - INTERVAL '1 day')::INT AS overdue,
         COUNT(*) FILTER (WHERE due_at > NOW() AND due_at <= NOW() + INTERVAL '7 days')::INT AS due_next_7_days,
         COALESCE(SUM(urs.lapse_count), 0)::INT AS total_lapses,
         COUNT(*) FILTER (WHERE urs.last_answer_grade = 'again')::INT AS last_review_failed,
         urs.scheduler_version
       FROM user_review_schedule urs
       LEFT JOIN exercises e ON e.exercise_id = urs.exercise_id
       LEFT JOIN user_exercises ue ON ue.exercise_id = urs.exercise_id AND ue.user_id = urs.user_id
       WHERE urs.user_id = $1
         AND ($2::BIGINT IS NULL OR COALESCE(e.deck_id, ue.deck_id) = $2)
       GROUP BY urs.scheduler_version
       ORDER BY urs.scheduler_version ASC`,
      [req.userId, deckId]
    )
```

The rest of the handler (the `reduce` into `totals` and the `res.json(...)` call) is unchanged —
leave it exactly as-is below this block.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- progress`
Expected: `6 passed` (3 existing `isValidProgressMode` + 2 new `parseDeckIdParam` smoke tests, plus
confirm no existing test regressed).

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/progress.ts backend/src/routes/progress.test.ts
git commit -m "feat: scope GET /api/progress/review-metrics to a deck via optional deckId"
```

---

### Task 4: Frontend — `progressApi.ts` gains optional `deckId` on `fetchStats`/`fetchReviewMetrics`

**Files:**
- Modify: `frontend/src/api/progressApi.ts`
- Modify: `frontend/src/api/progressApi.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/api/progressApi.test.ts` (append new `describe` blocks after the existing
`postResult` block; keep the existing `originalFetch`/`beforeEach`/`afterEach` pattern already in
the file):

```ts
describe('fetchStats', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('omits deckId from the URL when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchStats()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/stats')
  })

  test('appends ?deckId=<id> when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchStats('1')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/stats?deckId=1')
  })
})

describe('fetchReviewMetrics', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('omits deckId from the URL when not provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ totals: {}, bySchedulerVersion: [] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchReviewMetrics()

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/progress/review-metrics')
  })

  test('appends ?deckId=<id> when provided', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: () => Promise.resolve({ totals: {}, bySchedulerVersion: [] }) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchReviewMetrics('2')

    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toBe('http://localhost:3001/api/progress/review-metrics?deckId=2')
  })
})
```

Update the file's top import line from:

```ts
import { postResult } from './progressApi'
```

to:

```ts
import { fetchReviewMetrics, fetchStats, postResult } from './progressApi'
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npm test -- progressApi`
Expected: FAIL — the two new `deckId`-appending assertions fail since `fetchStats`/`fetchReviewMetrics`
don't accept a parameter yet (the "omits" tests pass trivially already, since that's current
behavior).

- [ ] **Step 3: Add the optional deckId parameter**

In `frontend/src/api/progressApi.ts`, find:

```ts
export async function fetchStats(): Promise<ExerciseStats[]> {
  const res = await fetch(`${BASE_URL}/api/stats`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/stats failed: ${res.status}`)
  return res.json() as Promise<ExerciseStats[]>
}
```

Replace with:

```ts
export async function fetchStats(deckId?: string): Promise<ExerciseStats[]> {
  const url = deckId ? `${BASE_URL}/api/stats?deckId=${encodeURIComponent(deckId)}` : `${BASE_URL}/api/stats`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/stats failed: ${res.status}`)
  return res.json() as Promise<ExerciseStats[]>
}
```

Find:

```ts
export async function fetchReviewMetrics(): Promise<ReviewMetrics> {
  const res = await fetch(`${BASE_URL}/api/progress/review-metrics`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/progress/review-metrics failed: ${res.status}`)
  return res.json() as Promise<ReviewMetrics>
}
```

Replace with:

```ts
export async function fetchReviewMetrics(deckId?: string): Promise<ReviewMetrics> {
  const url = deckId
    ? `${BASE_URL}/api/progress/review-metrics?deckId=${encodeURIComponent(deckId)}`
    : `${BASE_URL}/api/progress/review-metrics`
  const res = await fetch(url, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/progress/review-metrics failed: ${res.status}`)
  return res.json() as Promise<ReviewMetrics>
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- progressApi`
Expected: `8 passed` (2 existing `postResult` + 4 new).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/progressApi.ts frontend/src/api/progressApi.test.ts
git commit -m "feat: fetchStats and fetchReviewMetrics accept an optional deckId"
```

---

### Task 5: Frontend — `useStats`/`useReviewMetrics` accept an optional `deckId`

**Files:**
- Modify: `frontend/src/hooks/useProgress.ts`
- Test: `frontend/src/hooks/useProgress.test.ts` (new file)

`useStats` and `useReviewMetrics` both call `useAuth()` internally, which throws outside an
`AuthProvider`. Rather than wrapping every `renderHook` call in a real `AuthProvider` (which would
require mocking `fetch('/api/auth/me')` for the token-check effect), this task mocks the
`../auth/AuthContext` module directly to return a fixed authenticated, non-guest user — the same
technique used in Task 6 for `ProgressPage.test.tsx`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useProgress.test.ts`:

```ts
import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useReviewMetrics, useStats } from './useProgress'
import * as progressApi from '../api/progressApi'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com', role: 'user' as const },
    isGuest: false,
    isLoading: false,
    token: 'test-token',
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('useStats', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches unscoped stats when no deckId is given', async () => {
    const spy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    renderHook(() => useStats())

    await waitFor(() => expect(spy).toHaveBeenCalledWith(undefined))
  })

  test('fetches deck-scoped stats and re-fetches when deckId changes', async () => {
    const spy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])

    const { rerender } = renderHook(({ deckId }) => useStats(deckId), { initialProps: { deckId: '1' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'))

    await act(async () => {
      rerender({ deckId: '2' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('2'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})

describe('useReviewMetrics', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches unscoped review metrics when no deckId is given', async () => {
    const spy = vi
      .spyOn(progressApi, 'fetchReviewMetrics')
      .mockResolvedValue({ totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 }, bySchedulerVersion: [] })

    renderHook(() => useReviewMetrics())

    await waitFor(() => expect(spy).toHaveBeenCalledWith(undefined))
  })

  test('fetches deck-scoped review metrics and re-fetches when deckId changes', async () => {
    const spy = vi
      .spyOn(progressApi, 'fetchReviewMetrics')
      .mockResolvedValue({ totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 }, bySchedulerVersion: [] })

    const { rerender } = renderHook(({ deckId }) => useReviewMetrics(deckId), { initialProps: { deckId: '1' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('1'))

    await act(async () => {
      rerender({ deckId: '2' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('2'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- useProgress`
Expected: FAIL — `useStats`/`useReviewMetrics` don't accept a `deckId` argument yet, so the
`rerender`-triggered second call never happens with a different argument (TypeScript will also
flag the extra argument once `--noEmit` runs, but the test itself fails at the `toHaveBeenCalledWith`
assertions first).

- [ ] **Step 3: Add the optional deckId parameter to both hooks**

In `frontend/src/hooks/useProgress.ts`, find:

```ts
export function useStats() {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setStats([])
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchStats()
      setStats(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])
```

Replace with:

```ts
export function useStats(deckId?: string) {
  const { user, isGuest } = useAuth()
  const [stats, setStats] = useState<ExerciseStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setStats([])
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchStats(deckId)
      setStats(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [deckId, isGuest, user])
```

Find:

```ts
export function useReviewMetrics() {
  const { user, isGuest } = useAuth()
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setMetrics(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchReviewMetrics()
      setMetrics(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isGuest, user])
```

Replace with:

```ts
export function useReviewMetrics(deckId?: string) {
  const { user, isGuest } = useAuth()
  const [metrics, setMetrics] = useState<ReviewMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user || isGuest) {
      setMetrics(null)
      setError(null)
      setLoading(false)
      return
    }
    setError(null)
    setLoading(true)
    try {
      const next = await fetchReviewMetrics(deckId)
      setMetrics(next)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [deckId, isGuest, user])
```

Neither hook's `useEffect` blocks need to change — both already list `refresh` as their sole
dependency, and `refresh` itself now changes identity whenever `deckId` changes (since it's in
`refresh`'s own `useCallback` dependency array), so the existing `useEffect(() => { void refresh() }, [refresh])`
already re-fires correctly on a `deckId` change with no further edits.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- useProgress`
Expected: `4 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useProgress.ts frontend/src/hooks/useProgress.test.ts
git commit -m "feat: useStats and useReviewMetrics accept an optional deckId"
```

---

### Task 6: Frontend — `ProgressPage` with a deck selector

**Files:**
- Create: `frontend/src/pages/ProgressPage.tsx`
- Test: `frontend/src/pages/ProgressPage.test.tsx`

**Note on `ProgressDashboard`:** this task does not modify `frontend/src/components/ProgressDashboard.tsx`
at all. It already accepts an `exercises` prop and computes everything else from `stats`/`reviewMetrics`
it fetches itself via `useStats()`/`useReviewMetrics()` — Task 6 makes `ProgressPage` call those same
hooks (now deck-aware) and pass the results down, but `ProgressDashboard`'s existing internal
`useStats()`/`useReviewMetrics()` calls mean **it already re-fetches on its own** whenever it
mounts. To scope it, `ProgressPage` needs `ProgressDashboard` to accept the already-fetched deck-scoped
data as props instead of fetching internally — this task threads `deckId` through as a prop instead,
since that's the smaller, more targeted change: `ProgressDashboard` gains one new optional prop.

- [ ] **Step 1: Give `ProgressDashboard` an optional `deckId` prop**

Read `frontend/src/components/ProgressDashboard.tsx` in full to confirm it still matches the shape
captured during design (it should — nothing has touched this file since Plan 5). Find:

```tsx
interface Props {
  exercises?: Exercise[]
}

const PAGE_SIZE = 12

interface TopicSummary {
  topic: string
  total: number
  correct: number
  accuracyPct: number
  dueNow: number
}

export function ProgressDashboard({ exercises = [] }: Props) {
  const { stats, loading, error } = useStats()
  const { metrics: reviewMetrics, loading: reviewMetricsLoading, error: reviewMetricsError } = useReviewMetrics()
```

Replace with:

```tsx
interface Props {
  exercises?: Exercise[]
  deckId?: string
}

const PAGE_SIZE = 12

interface TopicSummary {
  topic: string
  total: number
  correct: number
  accuracyPct: number
  dueNow: number
}

export function ProgressDashboard({ exercises = [], deckId }: Props) {
  const { stats, loading, error } = useStats(deckId)
  const { metrics: reviewMetrics, loading: reviewMetricsLoading, error: reviewMetricsError } = useReviewMetrics(deckId)
```

This is the only change to `ProgressDashboard.tsx` — everything below (weak topics, exercise table,
pagination) already operates purely on `stats`/`exercises`/`reviewMetrics`, with no other
deck-awareness needed.

- [ ] **Step 2: Write the failing test for `ProgressPage`**

Create `frontend/src/pages/ProgressPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { ProgressPage } from './ProgressPage'
import * as decksApi from '../api/decksApi'
import * as progressApi from '../api/progressApi'
import * as exercisesApi from '../api/exercisesApi'
import * as exerciseRegistry from '../registry/exerciseRegistry'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, email: 'test@example.com', role: 'user' as const },
    isGuest: false,
    isLoading: false,
    token: 'test-token',
    login: vi.fn(),
    register: vi.fn(),
    continueAsGuest: vi.fn(),
    logout: vi.fn(),
  }),
}))

const mockDecks = [
  {
    id: '1',
    slug: 'german-grammar-vocabulary',
    title: 'German Grammar & Vocabulary',
    description: '',
    origin: 'official' as const,
    studyModes: ['practice' as const],
    facetDefinitions: [],
    locales: ['en'],
  },
  {
    id: '2',
    slug: 'einbuergerungstest',
    title: 'Einbürgerungstest',
    description: '',
    origin: 'official' as const,
    studyModes: ['practice' as const, 'exam' as const],
    facetDefinitions: [],
    locales: ['en'],
  },
]

const emptyReviewMetrics = {
  totals: { scheduled_total: 0, due_now: 0, overdue: 0, due_next_7_days: 0, total_lapses: 0, last_review_failed: 0 },
  bySchedulerVersion: [],
}

function renderAtPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProgressPage />
    </MemoryRouter>
  )
}

describe('ProgressPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders a tab for "All decks" plus one per deck, with "All decks" selected by default', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    renderAtPath('/progress')

    await waitFor(() => expect(screen.getByRole('button', { name: 'All decks' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'German Grammar & Vocabulary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Einbürgerungstest' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All decks' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('selecting a deck calls fetchStats/fetchReviewMetrics with the resolved deckId', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    const statsSpy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    const metricsSpy = vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    const user = userEvent.setup()
    renderAtPath('/progress')

    await waitFor(() => expect(screen.getByRole('button', { name: 'German Grammar & Vocabulary' })).toBeInTheDocument())
    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith(undefined))

    await user.click(screen.getByRole('button', { name: 'German Grammar & Vocabulary' }))

    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith('1'))
    expect(metricsSpy).toHaveBeenCalledWith('1')
  })

  test('reads the initial selection from the ?deck= query param', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)
    const statsSpy = vi.spyOn(progressApi, 'fetchStats').mockResolvedValue([])
    vi.spyOn(progressApi, 'fetchReviewMetrics').mockResolvedValue(emptyReviewMetrics)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([])
    // useExercises() is always called (hooks can't be conditional — see ProgressPage's
    // implementation note), so its underlying calls need mocking even in this deck-selected
    // test, otherwise it attempts a real, unmocked network fetch in the background.
    vi.spyOn(exercisesApi, 'fetchAllExercisesFromApi').mockResolvedValue([])
    vi.spyOn(exerciseRegistry, 'getBuiltInExercises').mockReturnValue([])

    renderAtPath('/progress?deck=einbuergerungstest')

    await waitFor(() => expect(screen.getByRole('button', { name: 'Einbürgerungstest' })).toHaveAttribute('aria-pressed', 'true'))
    await waitFor(() => expect(statsSpy).toHaveBeenCalledWith('2'))
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- ProgressPage`
Expected: FAIL — `ProgressPage.tsx` does not exist yet.

- [ ] **Step 4: Implement `ProgressPage`**

Create `frontend/src/pages/ProgressPage.tsx`:

```tsx
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { useDecks } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../types/exercise'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { decks } = useDecks()

  const selectedSlug = searchParams.get('deck')
  const selectedDeck = useMemo(
    () => (selectedSlug ? (decks.find((deck) => deck.slug === selectedSlug) ?? null) : null),
    [decks, selectedSlug]
  )
  const deckId = selectedDeck?.id

  // Global exercises (used for "All decks") already carries its own loading/guest-aware
  // behavior via useExercises — always called (not conditionally) since hooks can't be called
  // conditionally, and its cost when unused (a deck is selected) is one extra fetch this page
  // already causes today for the unscoped case anyway.
  const { exercises: allExercises } = useExercises()
  const { exercises: deckExercises } = useDeckExercises(deckId ?? '')
  const exercises: Exercise[] = deckId ? deckExercises : allExercises

  const selectDeck = (slug: string | null) => {
    if (slug) {
      setSearchParams({ deck: slug })
    } else {
      setSearchParams({})
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Progress</h2>
        <p className="mt-1 text-sm text-slate-500">See how you're doing, across all decks or just one.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!selectedDeck}
          onClick={() => selectDeck(null)}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
            focusRingClass,
            !selectedDeck
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
        >
          All decks
        </button>
        {decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            aria-pressed={selectedDeck?.id === deck.id}
            onClick={() => selectDeck(deck.slug)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
              focusRingClass,
              selectedDeck?.id === deck.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {deck.title}
          </button>
        ))}
      </div>

      <ProgressDashboard exercises={exercises} deckId={deckId} />
    </section>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- ProgressPage`
Expected: `3 passed`

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors. If `react-hooks/exhaustive-deps` or a similar React-Compiler-derived rule flags
something unexpected, stop and report rather than adding a reflexive `eslint-disable` — Plans 4 and
6 both found real bugs hiding behind that pattern.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/ProgressDashboard.tsx frontend/src/pages/ProgressPage.tsx frontend/src/pages/ProgressPage.test.tsx
git commit -m "feat: add ProgressPage with a deck selector"
```

---

### Task 7: Wire the `/progress` route, remove the legacy `MainApp` block

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add the import and route**

In `frontend/src/App.tsx`, find:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { ExamSessionPage } from './pages/ExamSessionPage'
import { LibraryPage } from './pages/LibraryPage'
import { StudySessionPage } from './pages/StudySessionPage'
```

Replace with:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { ExamSessionPage } from './pages/ExamSessionPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudySessionPage } from './pages/StudySessionPage'
```

Find:

```tsx
      <Route
        path="/deck/:slug/exam"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <ExamSessionPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route path="/*" element={<AuthenticatedShell />} />
```

Replace with:

```tsx
      <Route
        path="/deck/:slug/exam"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <ExamSessionPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route
        path="/progress"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <ProgressPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route path="/*" element={<AuthenticatedShell />} />
```

- [ ] **Step 2: Remove the legacy Progress block from `MainApp`**

Find:

```tsx
        {location.pathname === '/progress' && isGuest && <Navigate to="/" replace />}
        {location.pathname === '/progress' && !isGuest && (
          <AppErrorBoundary title="Progress dashboard unavailable">
            <ProgressDashboard exercises={allExercises} />
          </AppErrorBoundary>
        )}
        {location.pathname === '/admin' && (isGuest || user?.role !== 'admin') && <Navigate to="/" replace />}
```

Replace with:

```tsx
        {location.pathname === '/admin' && (isGuest || user?.role !== 'admin') && <Navigate to="/" replace />}
```

(This deletes the two Progress-related conditional blocks; the Admin block immediately below is
untouched — the `<Navigate>` line shown here is the anchor for where the Progress blocks used to sit
directly above it.)

Find the now-unused import:

```tsx
import { ProgressDashboard } from './components/ProgressDashboard'
```

Delete this line entirely (no other line in `App.tsx` references `ProgressDashboard` after Step 2 —
confirm with `grep -n ProgressDashboard frontend/src/App.tsx` returning no matches before proceeding).

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors. (If `allExercises` is now reported unused, stop — per the plan's exploration it
is still used elsewhere in `MainApp` for the home-screen session builder and admin panel, so an
"unused variable" error here would mean something else was missed; re-check rather than deleting
`allExercises` itself.)

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire /progress route to ProgressPage, remove legacy MainApp block"
```

---

### Task 8: Full regression pass with live verification

**Files:** none (verification only)

- [ ] **Step 1: Automated checks**

```bash
cd backend && npm test && npx tsc --noEmit
cd ../frontend && npm test && npx tsc -b --noEmit && npm run lint && npm run build
```

Expected: backend tests pass (Task 1's 5 + Task 3's 2 new, plus all pre-existing), backend
typecheck clean; frontend tests pass (all pre-existing 62 from Plan 6 + Task 4's 4 new + Task 5's 4
new + Task 6's 3 new = 73 total), typecheck clean, 0 lint errors, build succeeds.

- [ ] **Step 2: Manual smoke check against a real backend**

Start the backend (`cd backend && DATABASE_URL="postgres://oledjo@localhost:5432/langquiz" JWT_SECRET="local-dev-secret" PGSSLMODE=disable npm run dev`) and the frontend dev server, then in a
browser:

- Sign in as a real (non-guest) user.
- Navigate to `/progress` (via the Progress nav tab). Confirm the "All decks" tab is selected by
  default and the dashboard renders exactly as it did before this plan (same numbers as a baseline
  check, if there's existing progress data for this user).
- Click the "German Grammar & Vocabulary" tab (the only real deck seeded today). Confirm the URL
  becomes `/progress?deck=german-grammar-vocabulary`, and the dashboard re-renders. Since there's
  only one deck today, its numbers should match "All decks" exactly — this is the regression check
  that scoping doesn't drop or duplicate any rows.
- Reload the page at `/progress?deck=german-grammar-vocabulary` directly (not via a click). Confirm
  the deck tab shows as selected on load (reading the query param correctly).
- As a guest or logged-out user, navigate directly to `/progress`, confirm it redirects to `/` (same
  `RequireSignedIn` guard as the other deck-scoped routes).

If no backend is available, at minimum confirm the guest/logged-out redirect (doesn't require a
database at all) and note in your report that the full deck-scoping flow was not manually verified.

## Self-Review Notes

- **Spec coverage:** This plan implements exactly what the design spec describes: `deckId` scoping
  on `GET /api/stats` and `GET /api/progress/review-metrics` (not `/api/progress/summary`, per the
  spec's explicit non-goal), a routed `ProgressPage` with a deck-tab selector backed by `?deck=<slug>`,
  and removal of the legacy `MainApp` Progress block. No facet-based weak-topics generalization, no
  Admin route changes — both explicitly out of scope per the spec.
- **No placeholders:** every step shows complete code or an exact anchored find/replace.
- **Type consistency:** `deckId?: string` is the consistent shape threaded through
  `ProgressPage` → `ProgressDashboard` (prop) → `useStats`/`useReviewMetrics` (hook param) →
  `fetchStats`/`fetchReviewMetrics` (api param) → backend `parseDeckIdParam` (which converts the
  string to a `number | null` only at the very last step, inside the route handler — the frontend
  never needs to know or care that the backend's `deck_id` column is numeric).
