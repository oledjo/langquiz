# Library and Deck Detail Screens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Library screen (`/library`, browse all decks) and a Deck Detail screen (`/deck/:slug`,
view one deck), consuming the `GET /api/decks` / `GET /api/decks/:slug` endpoints that have been live
since Plan 2 but have had no frontend consumer until now. Also close the route-guard gap Plan 3 found
and deferred: unauthorized users can currently type `/progress` or `/admin` into the URL bar and see a
blank page.

**Why this is scoped narrowly (read-only browsing, no session-starting yet):** Starting a practice
session currently lives entirely inside `MainApp`'s home section — `startOrContinueSession`,
`selectWeightedExercises`, `sessionExercises`/`sessionKey`/`sessionInProgress` state, all coupled to
the bundle-registry-backed `filters`/`exercises` memo chain (`frontend/src/App.tsx` lines ~236–290).
Wiring "start a session for this deck" into the Deck Detail screen means either duplicating that
logic or lifting it out of `MainApp` and redesigning how it's triggered — a real, coupled design
decision (how does a deck-scoped session interact with the existing language/topic filters? does the
existing quiz overlay move, or does the deck detail screen get its own?) that deserves its own plan
once these two screens exist to make the shape of that decision concrete. This plan ships decks you
can browse and read about; the next plan makes them practiceable.

**Non-goals (explicitly deferred):**
- Starting a practice session from a deck (next plan).
- My-decks / deck creation — the backend has no write endpoint for decks at all yet (Plan 2 only
  built `GET /api/decks` and `GET /api/decks/:slug`); that's backend work for a future plan.
- `TopicFilter` rewrite against `facetDefinitions` — only useful once there's a deck-scoped session
  to filter within.
- Anything about the Einbürgerungstest content itself (separate spec).

**Architecture:** A new `frontend/src/api/decksApi.ts` mirrors the existing `exercisesApi.ts` pattern
(`BASE_URL` + `authHeaders()` + typed `fetch` wrappers), using the `Deck` type already defined in
`frontend/src/types/deck.ts` since Plan 1 (unused until now — its shape is field-identical to the
backend's `DeckDto`). A `useDecks()`/`useDeck(slug)` hook pair in `frontend/src/hooks/useDecks.ts`
follows the existing `{ data, loading, error }` convention from `useStats()`/`useReviewMetrics()`.
Two new page components (`LibraryPage`, `DeckDetailPage`) are added as new sibling routes inside
`AppShell`'s route tree — `MainApp` and everything inside it is untouched. A new `RequireAuthenticated`
wrapper component redirects to `/` when a guest hits `/library`, `/deck/:slug`, `/progress`, or
`/admin` (the backend already rejects unauthenticated requests to all of these with 401 — this makes
the frontend behavior match instead of showing a blank/broken page), and a `RequireAdmin` wrapper
does the same for `/admin` when the signed-in user isn't an admin.

**Tech Stack:** React 19, react-router-dom 7 (from Plan 3), Vitest + `@testing-library/react` +
`@testing-library/user-event` (from Plans 1 and 3).

**Plan sequence (updated):**
1. Domain model foundation & brand rebrand — done (merged to `master`).
2. Backend decks table & content storage — done (merged to `master`).
3. Frontend routing foundation — done (merged to `master`).
4. **This plan** — Library and Deck Detail screens, route guards.
5. Deck-scoped session starting (redesigns quiz-session triggering to work from Deck Detail).
6. Exam mode.
7. Deck-scoped progress dashboard.
8. Einbürgerungstest import (separate spec) — needs a backend write path for decks first, or a direct
   seed migration, since My-decks/deck-creation isn't built yet either.

---

### Task 1: Frontend decks API client

**Files:**
- Create: `frontend/src/api/decksApi.ts`
- Test: `frontend/src/api/decksApi.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/api/decksApi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchDeckBySlug, fetchDecks } from './decksApi'

const originalFetch = globalThis.fetch

describe('decksApi', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('fetchDecks calls GET /api/decks and returns the parsed array', async () => {
    const mockDecks = [
      { id: '1', slug: 'german-grammar-vocabulary', title: 'German', description: '', origin: 'official', studyModes: ['practice'], facetDefinitions: [], locales: ['en'] },
    ]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDecks),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchDecks()

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/decks$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockDecks)
  })

  test('fetchDecks throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchDecks()).rejects.toThrow('GET /api/decks failed: 500')
  })

  test('fetchDeckBySlug calls GET /api/decks/:slug and returns the parsed deck', async () => {
    const mockDeck = { id: '1', slug: 'german-grammar-vocabulary', title: 'German', description: '', origin: 'official', studyModes: ['practice'], facetDefinitions: [], locales: ['en'] }
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDeck),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchDeckBySlug('german-grammar-vocabulary')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/decks\/german-grammar-vocabulary$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockDeck)
  })

  test('fetchDeckBySlug returns null on a 404 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch

    const result = await fetchDeckBySlug('does-not-exist')

    expect(result).toBeNull()
  })

  test('fetchDeckBySlug throws on a non-404 error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchDeckBySlug('german-grammar-vocabulary')).rejects.toThrow(
      'GET /api/decks/german-grammar-vocabulary failed: 500'
    )
  })

  test('fetchDeckBySlug URL-encodes the slug', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(null) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchDeckBySlug('a slug/with special?chars')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('a slug/with special?chars')),
      expect.anything()
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- decksApi`
Expected: FAIL — `decksApi.ts` does not exist yet.

- [ ] **Step 3: Implement the client**

Create `frontend/src/api/decksApi.ts`:

```ts
import type { Deck } from '../types/deck'
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function authHeaders(): Record<string, string> {
  const token = readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function fetchDecks(): Promise<Deck[]> {
  const res = await fetch(`${BASE_URL}/api/decks`, { headers: authHeaders() })
  if (!res.ok) throw new Error(`GET /api/decks failed: ${res.status}`)
  return res.json() as Promise<Deck[]>
}

export async function fetchDeckBySlug(slug: string): Promise<Deck | null> {
  const res = await fetch(`${BASE_URL}/api/decks/${encodeURIComponent(slug)}`, { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /api/decks/${slug} failed: ${res.status}`)
  return res.json() as Promise<Deck>
}
```

This mirrors `frontend/src/api/exercisesApi.ts`'s exact pattern (`BASE_URL`, `authHeaders()`, a thrown
`Error` with the same message format on non-ok responses) with one addition: `fetchDeckBySlug` treats
404 as a valid "not found" result (returning `null`) rather than throwing, since the Deck Detail
screen (Task 3) needs to distinguish "this deck doesn't exist" from "the request failed."

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- decksApi`
Expected: `6 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/projects/langquiz
git add frontend/src/api/decksApi.ts frontend/src/api/decksApi.test.ts
git commit -m "feat: add frontend API client for decks"
```

---

### Task 2: `useDecks`/`useDeck` hooks

**Files:**
- Create: `frontend/src/hooks/useDecks.ts`
- Test: `frontend/src/hooks/useDecks.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useDecks.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useDeck, useDecks } from './useDecks'
import * as decksApi from '../api/decksApi'

describe('useDecks', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts in a loading state and then resolves with the fetched decks', async () => {
    const mockDecks = [
      { id: '1', slug: 'a', title: 'A', description: '', origin: 'official' as const, studyModes: ['practice' as const], facetDefinitions: [], locales: ['en'] },
    ]
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue(mockDecks)

    const { result } = renderHook(() => useDecks())

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.decks).toEqual(mockDecks)
    expect(result.current.error).toBeNull()
  })

  test('captures an error message when the fetch rejects', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockRejectedValue(new Error('GET /api/decks failed: 500'))

    const { result } = renderHook(() => useDecks())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.decks).toEqual([])
    expect(result.current.error).toBe('GET /api/decks failed: 500')
  })
})

describe('useDeck', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('fetches the deck for the given slug', async () => {
    const mockDeck = { id: '1', slug: 'a', title: 'A', description: '', origin: 'official' as const, studyModes: ['practice' as const], facetDefinitions: [], locales: ['en'] }
    const spy = vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)

    const { result } = renderHook(() => useDeck('a'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(spy).toHaveBeenCalledWith('a')
    expect(result.current.deck).toEqual(mockDeck)
    expect(result.current.error).toBeNull()
  })

  test('sets deck to null without an error when the deck is not found', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    const { result } = renderHook(() => useDeck('does-not-exist'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.deck).toBeNull()
    expect(result.current.error).toBeNull()
  })

  test('re-fetches when the slug changes', async () => {
    const spy = vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    const { rerender } = renderHook(({ slug }) => useDeck(slug), { initialProps: { slug: 'a' } })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('a'))

    await act(async () => {
      rerender({ slug: 'b' })
    })
    await waitFor(() => expect(spy).toHaveBeenCalledWith('b'))

    expect(spy).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- useDecks`
Expected: FAIL — `useDecks.ts` does not exist yet.

- [ ] **Step 3: Implement the hooks**

Create `frontend/src/hooks/useDecks.ts`:

```ts
import { useEffect, useState } from 'react'
import { fetchDeckBySlug, fetchDecks } from '../api/decksApi'
import type { Deck } from '../types/deck'

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchDecks()
      .then((result) => {
        if (cancelled) return
        setDecks(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load decks.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { decks, loading, error }
}

export function useDeck(slug: string) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchDeckBySlug(slug)
      .then((result) => {
        if (cancelled) return
        setDeck(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load deck.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  return { deck, loading, error }
}
```

The `cancelled` flag guards against setting state after the component unmounts or the `slug` changes
mid-request (e.g. navigating from `/deck/a` to `/deck/b` before `/deck/a`'s fetch resolves) — a
standard pattern for effect-driven data fetching, matching the intent (if not the exact code) of the
existing `useExercises`/`useStats` hooks in this codebase.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- useDecks`
Expected: `5 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/hooks/useDecks.ts frontend/src/hooks/useDecks.test.tsx
git commit -m "feat: add useDecks and useDeck hooks"
```

---

### Task 3: Library page

**Files:**
- Create: `frontend/src/pages/LibraryPage.tsx`
- Test: `frontend/src/pages/LibraryPage.test.tsx`

`frontend/src/pages/` doesn't exist yet — this task creates it. New top-level route components go
here rather than in `components/`, to keep "things a route renders directly" separate from
"reusable pieces a page is built from" (`ProgressDashboard`, `AdminQuestions`, etc. stay in
`components/` — they're not routes, `MainApp` renders them conditionally).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/LibraryPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { LibraryPage } from './LibraryPage'
import * as decksApi from '../api/decksApi'

describe('LibraryPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the fetched decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'german-grammar-vocabulary',
        title: 'German Grammar & Vocabulary',
        description: 'Practice German grammar and vocabulary.',
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary.')).toBeInTheDocument()
  })

  test('shows an empty state when there are no decks', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/no decks/i)).toBeInTheDocument())
  })

  test('shows an error message when the fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockRejectedValue(new Error('GET /api/decks failed: 500'))

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks failed: 500/)).toBeInTheDocument())
  })

  test('links each deck to its detail page', async () => {
    vi.spyOn(decksApi, 'fetchDecks').mockResolvedValue([
      {
        id: '1',
        slug: 'german-grammar-vocabulary',
        title: 'German Grammar & Vocabulary',
        description: '',
        origin: 'official',
        studyModes: ['practice'],
        facetDefinitions: [],
        locales: ['en'],
      },
    ])

    render(
      <MemoryRouter>
        <LibraryPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /German Grammar & Vocabulary/ })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- LibraryPage`
Expected: FAIL — `LibraryPage.tsx` does not exist yet.

- [ ] **Step 3: Implement the page**

Create `frontend/src/pages/LibraryPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import { useDecks } from '../hooks/useDecks'

export function LibraryPage() {
  const { decks, loading, error } = useDecks()

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Library</h2>
        <p className="mt-1 text-sm text-slate-500">Browse decks and pick one to study.</p>
      </div>

      {loading && <p className="text-sm text-slate-400">Loading decks…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && decks.length === 0 && (
        <p className="text-sm text-slate-500">No decks available yet.</p>
      )}

      {!loading && !error && decks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              to={`/deck/${deck.slug}`}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-800">{deck.title}</h3>
              {deck.description && <p className="mt-1 text-sm text-slate-500">{deck.description}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- LibraryPage`
Expected: `4 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LibraryPage.tsx frontend/src/pages/LibraryPage.test.tsx
git commit -m "feat: add Library page"
```

---

### Task 4: Deck Detail page

**Files:**
- Create: `frontend/src/pages/DeckDetailPage.tsx`
- Test: `frontend/src/pages/DeckDetailPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/DeckDetailPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { DeckDetailPage } from './DeckDetailPage'
import * as decksApi from '../api/decksApi'

function renderAtSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/deck/${slug}`]}>
      <Routes>
        <Route path="/deck/:slug" element={<DeckDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('DeckDetailPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the deck details', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue({
      id: '1',
      slug: 'german-grammar-vocabulary',
      title: 'German Grammar & Vocabulary',
      description: 'Practice German grammar and vocabulary across CEFR levels.',
      origin: 'official',
      studyModes: ['practice'],
      facetDefinitions: [{ key: 'level', label: 'CEFR level', values: ['A1', 'A2'] }],
      locales: ['en'],
    })

    renderAtSlug('german-grammar-vocabulary')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary across CEFR levels.')).toBeInTheDocument()
    expect(screen.getByText('CEFR level')).toBeInTheDocument()
  })

  test('shows a not-found message when the deck does not exist', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByText(/deck not found/i)).toBeInTheDocument())
  })

  test('shows an error message when the fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockRejectedValue(new Error('GET /api/decks/x failed: 500'))

    renderAtSlug('x')

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks\/x failed: 500/)).toBeInTheDocument())
  })

  test('links back to the library', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByRole('link', { name: /library/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /library/i })).toHaveAttribute('href', '/library')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- DeckDetailPage`
Expected: FAIL — `DeckDetailPage.tsx` does not exist yet.

- [ ] **Step 3: Implement the page**

Create `frontend/src/pages/DeckDetailPage.tsx`:

```tsx
import { Link, useParams } from 'react-router-dom'
import { useDeck } from '../hooks/useDecks'

export function DeckDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { deck, loading, error } = useDeck(slug ?? '')

  return (
    <section className="space-y-4">
      <Link to="/library" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← Library
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading deck…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && !deck && (
        <p className="text-sm text-slate-500">Deck not found.</p>
      )}

      {!loading && !error && deck && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{deck.title}</h2>
          {deck.description && <p className="mt-2 text-sm text-slate-600">{deck.description}</p>}

          {deck.facetDefinitions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {deck.facetDefinitions.map((facet) => (
                <span
                  key={facet.key}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {facet.label}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Modes: {deck.studyModes.join(', ')} · Languages: {deck.locales.join(', ') || '—'}
          </p>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- DeckDetailPage`
Expected: `4 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/DeckDetailPage.tsx frontend/src/pages/DeckDetailPage.test.tsx
git commit -m "feat: add Deck Detail page"
```

---

### Task 5: Wire the new routes, nav tab, and route guards

**Files:**
- Modify: `frontend/src/App.tsx`

This task wires Tasks 3–4's pages into the route tree, adds a "Library" nav tab, and closes the
route-guard gap Plan 3 found: today, a guest can type `/progress` or `/admin` and see a blank content
area (the backend already rejects the underlying API calls with 401; the frontend just doesn't
redirect). This task adds that redirect for all four protected routes (`/library`, `/deck/:slug`,
`/progress`, `/admin`) in one pass, since they share the same guard.

- [ ] **Step 1: Add imports**

At the top of `frontend/src/App.tsx`, find:

```tsx
import { useEffect, useMemo, useState } from 'react'
```

Replace with:

```tsx
import { useEffect, useMemo, useState, type ReactNode } from 'react'
```

Find:

```tsx
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
```

Replace with:

```tsx
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
```

Also add, alongside the other component imports near the top of the file (find the line
`import { AdminQuestions } from './components/AdminQuestions'` and add after it):

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { LibraryPage } from './pages/LibraryPage'
```

- [ ] **Step 2: Add route guard components**

Find the `AuthenticatedShell` function:

```tsx
function AuthenticatedShell() {
  const { user, isLoading, isGuest } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user && !isGuest) return <AuthPage />
  return <MainApp />
}
```

Replace with:

```tsx
function RequireSignedIn({ children }: { children: ReactNode }) {
  const { isGuest } = useAuth()
  if (isGuest) return <Navigate to="/" replace />
  return <>{children}</>
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth()
  if (isGuest || user?.role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}

function AuthenticatedShell() {
  const { user, isLoading, isGuest } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user && !isGuest) return <AuthPage />
  return <MainApp />
}
```

`RequireSignedIn` covers `/library`, `/deck/:slug`, and `/progress` (guests are blocked from all
three — the backend's `GET /api/decks`/`GET /api/decks/:slug` require auth, same as `/api/progress`).
`RequireAdmin` covers `/admin` specifically, since being signed in isn't enough there — the existing
`MainApp` admin section already checks `user?.role === 'admin'` in addition to `!isGuest`, but that
check currently only hides the *section*, it doesn't redirect away from the *URL*. `ReactNode` is the
type imported in Step 1 (confirmed: `App.tsx` has no default `React` import, only named imports from
`'react'`, so `ReactNode` must be imported directly rather than referenced as `React.ReactNode`).

- [ ] **Step 3: Wire the routes**

Find the `AppShell` function:

```tsx
function AppShell() {
  return (
    <Routes>
      <Route path="/learn/*" element={<MarketingSite />} />
      <Route path="/*" element={<AuthenticatedShell />} />
    </Routes>
  )
}
```

Replace with:

```tsx
function AppShell() {
  return (
    <Routes>
      <Route path="/learn/*" element={<MarketingSite />} />
      <Route
        path="/library"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <LibraryPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route
        path="/deck/:slug"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <DeckDetailPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route path="/*" element={<AuthenticatedShell />} />
    </Routes>
  )
}
```

`/progress` and `/admin` are NOT added as separate top-level `<Route>` entries here — they're still
rendered from inside `MainApp` (Plan 3's design, unchanged), reached via the catch-all `/*` →
`AuthenticatedShell` → `MainApp`. This task only adds the guard *inside* `MainApp` for those two (Step
4), rather than restructuring them into their own routes, which would require moving `MainApp`'s
header/nav out to a shared layout — a larger change than this task's scope. `/library` and
`/deck/:slug` DO get their own top-level routes because they're new pages, not existing sections of
`MainApp`.

`LibraryLayout` (defined in Step 3b below) exists because `LibraryPage`/`DeckDetailPage` need the same
header/nav chrome `MainApp` has (logo, nav tabs, sign-out) — without it, navigating to `/library` would
show the bare page with no way to navigate back except the browser's back button.

- [ ] **Step 3b: Add a shared layout for the new pages**

Add this new function directly above `AppShell` (i.e., after `AuthenticatedShell`, before
`function AppShell() {`):

```tsx
function LibraryLayout({ children }: { children: ReactNode }) {
  const { user, logout, isGuest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const tabs = isGuest
    ? (['home'] as const)
    : user?.role === 'admin'
    ? (['home', 'library', 'progress', 'admin'] as const)
    : (['home', 'library', 'progress'] as const)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <LangQuizLogo />
            <h1 className="text-xl font-bold text-blue-700">LangQuiz</h1>
          </div>

          <nav className="grid w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto sm:min-w-[220px]">
            {tabs.map((tab) => {
              const tabPath = tab === 'home' ? '/' : `/${tab}`
              const isActive = location.pathname === tabPath
              const label = tab.charAt(0).toUpperCase() + tab.slice(1)
              return (
                <button
                  key={tab}
                  onClick={() => navigate(tabPath)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 sm:ml-2">
            <span className="hidden text-xs text-slate-500 sm:block">{isGuest ? 'Guest trial' : user?.email}</span>
            <button
              onClick={logout}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {isGuest ? 'Exit guest mode' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">{children}</main>
    </div>
  )
}
```

This duplicates `MainApp`'s header markup rather than extracting a shared component. That's a
deliberate, acknowledged tradeoff for this task: `MainApp`'s header is entangled with its own
`focusRingClass` constant and its own `tabs`/`view` logic in a way that would require a larger
refactor to share cleanly, and this plan's scope is "add two new pages," not "refactor MainApp's
shell." Duplication here is flagged in this plan's Self-Review Notes as a known, intentional
follow-up candidate — not something to fix in this task.

- [ ] **Step 4: Add the guard inside `MainApp` for `/progress` and `/admin`**

Find:

```tsx
        {!isGuest && location.pathname === '/progress' && (
          <AppErrorBoundary title="Progress dashboard unavailable">
            <ProgressDashboard exercises={allExercises} />
          </AppErrorBoundary>
        )}
        {!isGuest && location.pathname === '/admin' && user?.role === 'admin' && (
          <AppErrorBoundary title="Admin tools unavailable">
            <AdminQuestions onChanged={reloadExercises} />
          </AppErrorBoundary>
        )}
```

Replace with:

```tsx
        {location.pathname === '/progress' && isGuest && <Navigate to="/" replace />}
        {location.pathname === '/progress' && !isGuest && (
          <AppErrorBoundary title="Progress dashboard unavailable">
            <ProgressDashboard exercises={allExercises} />
          </AppErrorBoundary>
        )}
        {location.pathname === '/admin' && (isGuest || user?.role !== 'admin') && <Navigate to="/" replace />}
        {location.pathname === '/admin' && !isGuest && user?.role === 'admin' && (
          <AppErrorBoundary title="Admin tools unavailable">
            <AdminQuestions onChanged={reloadExercises} />
          </AppErrorBoundary>
        )}
```

This keeps the exact same rendering conditions for the *content* (unchanged), but adds a sibling
`<Navigate>` for the unauthorized case at each path, so visiting `/admin` as a guest (or as a
non-admin signed-in user) now redirects to `/` instead of rendering a blank content area next to a
still-visible header/nav.

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire Library and Deck Detail routes with auth guards"
```

---

### Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd frontend && npm test`
Expected: all tests pass — 17 pre-existing (from Plans 1 and 3) + 6 (Task 1) + 5 (Task 2) + 4 (Task 3)
+ 4 (Task 4) = 36 total.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors (the pre-existing `QuizCard.tsx` warning is fine, unrelated to this change).

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke check against a real backend**

This requires a running backend with the `decks` table migrated (from Plan 2) — use the same local
setup pattern as Plan 2/3's manual verification:

```bash
cd backend && DATABASE_URL="postgres://<your-local-db>" PGSSLMODE=disable JWT_SECRET=local-dev-secret-not-for-production npm run dev
```

Then, with the frontend dev server running (`cd frontend && npm run dev`), in a browser:
- Sign in as a real (non-guest) user.
- Click the "Library" tab, confirm the URL becomes `/library` and the seeded
  `german-grammar-vocabulary` deck appears as a card.
- Click the deck card, confirm the URL becomes `/deck/german-grammar-vocabulary` and the deck's
  title, description, and facet labels (CEFR level, Category) render.
- Click "← Library" to confirm the back-link works.
- Navigate to `/deck/does-not-exist` directly via the URL bar, confirm "Deck not found." renders
  rather than a crash or blank page.
- As a guest (or by opening a private/incognito window and clicking "Continue as guest"), navigate
  directly to `http://localhost:5173/library` via the URL bar, confirm it redirects to `/` rather than
  showing a blank or broken page.
- As a signed-in non-admin user, navigate directly to `http://localhost:5173/admin`, confirm it
  redirects to `/`.

If no backend is available, at minimum confirm the guest redirect behavior for `/library` (this
doesn't require a successful API call, just the route guard, so it works even against a backend that
isn't running — the redirect happens before any fetch), and note in your report that the
signed-in/admin flows were not manually verified against a live backend.

## Self-Review Notes

- **Spec coverage:** This plan makes `GET /api/decks`/`GET /api/decks/:slug` (live since Plan 2)
  actually reachable from the UI, and closes the guest/non-admin URL-guard gap Plan 3 flagged. It does
  not add session-starting, deck creation, or `TopicFilter` changes — see "Non-goals" above.
- **No placeholders:** every step's code edit shows complete code or an exact anchored find/replace.
- **Type consistency:** `Deck` (from `frontend/src/types/deck.ts`, Plan 1) is used identically across
  `decksApi.ts`, `useDecks.ts`, `LibraryPage.tsx`, and `DeckDetailPage.tsx` — no new deck-shaped type
  is introduced.
- **Known follow-up, stated plainly:** Task 5's `LibraryLayout` duplicates `MainApp`'s header markup
  rather than sharing it. This was a deliberate scope call — extracting a shared layout component
  cleanly would require touching `MainApp`'s `focusRingClass`/nav logic, which is exactly the kind of
  unrelated refactor this plan's own non-goals list warns against. Worth revisiting once `MainApp`'s
  header needs a third consumer, or when Plan 5's session-starting work touches this area anyway.
