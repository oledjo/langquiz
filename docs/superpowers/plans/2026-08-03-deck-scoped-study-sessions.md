# Deck-Scoped Study Sessions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Start practicing" action to Deck Detail that starts a real practice session scoped
to that deck's exercises, at a new route `/deck/:slug/study`. This is Plan 5 of the Reps platform
rewrite (see `docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`); Plans 1–4 are merged
to `master`.

**Why this doesn't touch `MainApp` at all:** Plan 4 deferred session-starting specifically because
`MainApp`'s session-starting logic (`startOrContinueSession`, `sessionExercises`/`sessionKey`/
`sessionInProgress` state, the `shouldMountQuiz` CSS-toggle mount-persistence pattern) is ~200 lines
of state entangled with topic filters, session presets, and the custom-exercise-import modal — none
of which a deck-scoped session needs. Investigating `frontend/src/components/QuizSession.tsx` found
it's already a genuinely self-contained component: it takes `exercises`/`sessionId`/`sessionMode` as
props, records progress internally via `useExerciseSession` (which calls `postResult` and is already
guest-aware), and renders its own completion screen with a "Try Again" button. `MainApp` doesn't need
to be involved at all — a new page can mount `<QuizSession>` directly with deck-scoped exercises.

**The tradeoff this creates, stated plainly:** `MainApp`'s quiz overlay stays mounted (via CSS
`hidden`/`block`) across navigation to `/progress` and back, so an in-progress home session survives.
This plan's `/deck/:slug/study` is a normal top-level route — navigating away from it (e.g. to
`/progress`) unmounts it, and navigating back re-mounts fresh, losing in-session position (though any
already-submitted answers stay saved via `useExerciseSession`'s per-answer `postResult` calls — only
the current-question position within the session resets). This is an accepted, explicitly non-goal
limitation for this plan, not an oversight: solving it would mean either lifting session state to a
persistent store or replicating `MainApp`'s CSS-toggle pattern for an arbitrary number of decks, both
real designs that deserve their own consideration once deck-scoped sessions are actually in use.

**Non-goals (explicitly deferred):**
- Session-position survival across navigation away from `/deck/:slug/study` (see above).
- Exam mode (`sessionMode: 'exam'`) — this plan only wires the existing `'practice'` mode.
- Deck-scoped progress display (`ProgressDashboard` stays deck-agnostic) — Plan 6's job.
- Session presets / topic sub-filtering within a deck — a deck-scoped session uses all of the deck's
  exercises; narrowing by topic/level within a deck is a future enhancement, not required to ship a
  working "start practicing" action.

**Architecture:** `frontend/src/api/exercisesApi.ts` gains `fetchExercisesForDeck(deckId)`, reusing
`GET /api/exercises?deckId=` (live since Plan 2 Task 5) — additive, the existing `fetchAllExercisesFromApi`
is untouched. A new hook `frontend/src/hooks/useDeckExercises.ts` follows the same `{ data, loading,
error }` shape as `useDecks`/`useDeck` (Plan 4). A new page `frontend/src/pages/StudySessionPage.tsx`
re-fetches the deck by slug (via `useDeck`, already built) to get its numeric `id`, fetches that
deck's exercises via the new hook, and renders `<QuizSession>` with a generated `sessionId` and
`sessionMode: 'practice'`, with `onExit` navigating back to `/deck/:slug`. `DeckDetailPage` gains a
"Start practicing" button matching `MainApp`'s existing primary-CTA button style. The new route is
wired the same way `/deck/:slug` was in Plan 4: wrapped in `RequireSignedIn` + `LibraryLayout`.

**Tech Stack:** React 19, react-router-dom 7, Vitest + `@testing-library/react` +
`@testing-library/user-event` (all already in place from Plans 1, 3, 4).

**Plan sequence (updated):**
1. Domain model foundation & brand rebrand — done (merged to `master`).
2. Backend decks table & content storage — done (merged to `master`).
3. Frontend routing foundation — done (merged to `master`).
4. Library and Deck Detail screens — done (merged to `master`).
5. **This plan** — deck-scoped study sessions.
6. Exam mode.
7. Deck-scoped progress dashboard.
8. Einbürgerungstest import (separate spec).

---

### Task 1: `fetchExercisesForDeck` API client function

**Files:**
- Modify: `frontend/src/api/exercisesApi.ts`
- Test: `frontend/src/api/exercisesApi.test.ts`

`frontend/src/api/exercisesApi.ts` has no existing test file (it predates the testing plans). This
task creates one, but only tests the new function — it does not retroactively add coverage for
`fetchAllExercisesFromApi`/`bootstrapExercises`/`addExerciseVote`/`removeExerciseVote`, which is out
of scope here.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/api/exercisesApi.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fetchExercisesForDeck } from './exercisesApi'

const originalFetch = globalThis.fetch

describe('fetchExercisesForDeck', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  test('calls GET /api/exercises with the deckId query param and returns the parsed array', async () => {
    const mockExercises = [{ id: 'x', type: 'selection', topic: 't', subtopic: 's', language: 'de', difficulty: 1, prompt: 'p', options: ['a'], answer: 0 }]
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExercises),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchExercisesForDeck('1')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/exercises\?deckId=1$/),
      expect.objectContaining({ headers: expect.any(Object) })
    )
    expect(result).toEqual(mockExercises)
  })

  test('throws on a non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    await expect(fetchExercisesForDeck('1')).rejects.toThrow('GET /api/exercises?deckId=1 failed: 500')
  })

  test('URL-encodes the deckId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    await fetchExercisesForDeck('a b/c')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`deckId=${encodeURIComponent('a b/c')}`),
      expect.anything()
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- exercisesApi`
Expected: FAIL — `fetchExercisesForDeck` is not exported yet.

- [ ] **Step 3: Implement the function**

In `frontend/src/api/exercisesApi.ts`, add this new function after `fetchAllExercisesFromApi` (do not
modify `fetchAllExercisesFromApi` itself):

```ts
export async function fetchExercisesForDeck(deckId: string): Promise<Exercise[]> {
  const res = await fetch(`${BASE_URL}/api/exercises?deckId=${encodeURIComponent(deckId)}`, {
    headers: authHeaders(),
  })
  if (!res.ok) throw new Error(`GET /api/exercises?deckId=${deckId} failed: ${res.status}`)
  return res.json() as Promise<Exercise[]>
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- exercisesApi`
Expected: `3 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors (the pre-existing `QuizCard.tsx` warning is fine). Run this now, not only at the
final regression task — an earlier plan in this sequence skipped per-task linting and two real errors
went unnoticed for three tasks as a result.

- [ ] **Step 7: Commit**

```bash
cd ~/projects/langquiz
git add frontend/src/api/exercisesApi.ts frontend/src/api/exercisesApi.test.ts
git commit -m "feat: add fetchExercisesForDeck API client function"
```

---

### Task 2: `useDeckExercises` hook

**Files:**
- Create: `frontend/src/hooks/useDeckExercises.ts`
- Test: `frontend/src/hooks/useDeckExercises.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/useDeckExercises.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { useDeckExercises } from './useDeckExercises'
import * as exercisesApi from '../api/exercisesApi'

describe('useDeckExercises', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('starts in a loading state and then resolves with the fetched exercises', async () => {
    const mockExercises = [{ id: 'x', type: 'selection' as const, topic: 't', subtopic: 's', language: 'de', difficulty: 1 as const, prompt: 'p', options: ['a'], answer: 0 }]
    const spy = vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue(mockExercises)

    const { result } = renderHook(() => useDeckExercises('1'))

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(spy).toHaveBeenCalledWith('1')
    expect(result.current.exercises).toEqual(mockExercises)
    expect(result.current.error).toBeNull()
  })

  test('captures an error message when the fetch rejects', async () => {
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockRejectedValue(new Error('GET /api/exercises?deckId=1 failed: 500'))

    const { result } = renderHook(() => useDeckExercises('1'))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.exercises).toEqual([])
    expect(result.current.error).toBe('GET /api/exercises?deckId=1 failed: 500')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- useDeckExercises`
Expected: FAIL — `useDeckExercises.ts` does not exist yet.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/useDeckExercises.ts`:

```ts
import { useEffect, useState } from 'react'
import { fetchExercisesForDeck } from '../api/exercisesApi'
import type { Exercise } from '../types/exercise'

export function useDeckExercises(deckId: string) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchExercisesForDeck(deckId)
      .then((result) => {
        if (cancelled) return
        setExercises(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load exercises.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [deckId])

  return { exercises, loading, error }
}
```

Note: unlike `useDeck` in `frontend/src/hooks/useDecks.ts`, this effect does NOT call
`setLoading(true)`/`setError(null)` at the top. `useDeck` needs that because it can re-fetch for a
new `slug` after already having settled into a non-loading state (navigating from one deck to
another). This hook's only caller (`StudySessionPage`, Task 3) creates one instance per mounted page
and the `deckId` it receives doesn't change during that page's lifetime, so a second run of this
effect never happens in practice — but to guard against a future caller passing a changing `deckId`,
if you want to add the reset anyway, do so the same way `useDeck` does it: with a comment explaining
why, and an `eslint-disable-next-line react-hooks/set-state-in-effect` if `npm run lint` (Step 6 of
Task 1) flags it. Run lint on this file specifically before deciding — don't add the reset
speculatively if it's not needed and lint is clean without it.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- useDeckExercises`
Expected: `2 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/useDeckExercises.ts frontend/src/hooks/useDeckExercises.test.tsx
git commit -m "feat: add useDeckExercises hook"
```

---

### Task 3: `StudySessionPage`

**Files:**
- Create: `frontend/src/pages/StudySessionPage.tsx`
- Test: `frontend/src/pages/StudySessionPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/StudySessionPage.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { StudySessionPage } from './StudySessionPage'
import { AuthProvider } from '../auth/AuthContext'
import * as decksApi from '../api/decksApi'
import * as exercisesApi from '../api/exercisesApi'

const mockDeck = {
  id: '1',
  slug: 'german-grammar-vocabulary',
  title: 'German Grammar & Vocabulary',
  description: '',
  origin: 'official' as const,
  studyModes: ['practice' as const],
  facetDefinitions: [],
  locales: ['en'],
}

const mockExercise = {
  id: 'ex-1',
  type: 'selection' as const,
  topic: 'articles',
  subtopic: 'der',
  language: 'de',
  difficulty: 1 as const,
  prompt: 'Which article is correct for "Hund"?',
  options: ['der', 'die', 'das'],
  answer: 0,
}

function renderAtSlug(slug: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/deck/${slug}/study`]}>
        <Routes>
          <Route path="/deck/:slug/study" element={<StudySessionPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  )
}

describe('StudySessionPage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows a loading state, then the first question from the deck', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([mockExercise])

    renderAtSlug('german-grammar-vocabulary')

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('Which article is correct for "Hund"?')).toBeInTheDocument())
  })

  test('shows a not-found message when the deck does not exist', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(null)
    const exercisesSpy = vi.spyOn(exercisesApi, 'fetchExercisesForDeck')

    renderAtSlug('does-not-exist')

    await waitFor(() => expect(screen.getByText(/deck not found/i)).toBeInTheDocument())
    expect(exercisesSpy).not.toHaveBeenCalled()
  })

  test('shows an error message when the deck fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockRejectedValue(new Error('GET /api/decks/x failed: 500'))

    renderAtSlug('x')

    await waitFor(() => expect(screen.getByText(/GET \/api\/decks\/x failed: 500/)).toBeInTheDocument())
  })

  test('shows an error message when the exercises fetch fails', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockRejectedValue(new Error('GET /api/exercises?deckId=1 failed: 500'))

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByText(/GET \/api\/exercises\?deckId=1 failed: 500/)).toBeInTheDocument())
  })

  test('links back to the deck', async () => {
    vi.spyOn(decksApi, 'fetchDeckBySlug').mockResolvedValue(mockDeck)
    vi.spyOn(exercisesApi, 'fetchExercisesForDeck').mockResolvedValue([mockExercise])

    renderAtSlug('german-grammar-vocabulary')

    await waitFor(() => expect(screen.getByRole('link', { name: /german grammar & vocabulary/i })).toBeInTheDocument())
    expect(screen.getByRole('link', { name: /german grammar & vocabulary/i })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary'
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- StudySessionPage`
Expected: FAIL — `StudySessionPage.tsx` does not exist yet.

- [ ] **Step 3: Implement the page**

Create `frontend/src/pages/StudySessionPage.tsx`:

```tsx
import { Link, useNavigate, useParams } from 'react-router-dom'
import { QuizSession } from '../components/QuizSession'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'

export function StudySessionPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const { exercises, loading: exercisesLoading, error: exercisesError } = useDeckExercises(deck?.id ?? '')

  const loading = deckLoading || (Boolean(deck) && exercisesLoading)
  const error = deckError ?? exercisesError

  return (
    <section className="space-y-4">
      {deck && (
        <Link to={`/deck/${deck.slug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← {deck.title}
        </Link>
      )}

      {loading && <p className="text-sm text-slate-400">Loading…</p>}

      {!deckLoading && !deckError && !deck && <p className="text-sm text-slate-500">Deck not found.</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && deck && (
        <QuizSession
          exercises={exercises}
          sessionId={`deck-${deck.id}-${Date.now()}`}
          sessionMode="practice"
          onExit={() => navigate(`/deck/${deck.slug}`)}
        />
      )}
    </section>
  )
}
```

`exercisesLoading` is only consulted once `deck` has resolved (`Boolean(deck) && exercisesLoading`),
because `useDeckExercises(deck?.id ?? '')` fires immediately with an empty string before `deck` has
loaded — without this guard, the page would briefly show "not loading" based on the exercises hook's
initial state before the deck fetch has even started. `sessionId` is generated inline
(`deck-${deck.id}-${Date.now()}`) rather than with `crypto.randomUUID()` or similar, matching the
existing `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` pattern already used in
`MainApp`'s `startOrContinueSession` — good enough for an analytics correlation ID, not a security
token.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- StudySessionPage`
Expected: `5 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/StudySessionPage.tsx frontend/src/pages/StudySessionPage.test.tsx
git commit -m "feat: add StudySessionPage"
```

---

### Task 4: Wire the route and add the "Start practicing" button

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/DeckDetailPage.tsx`

- [ ] **Step 1: Add the import and route in `App.tsx`**

Find:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { LibraryPage } from './pages/LibraryPage'
```

Replace with:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { LibraryPage } from './pages/LibraryPage'
import { StudySessionPage } from './pages/StudySessionPage'
```

Find:

```tsx
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
```

Replace with:

```tsx
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
      <Route
        path="/deck/:slug/study"
        element={
          <RequireSignedIn>
            <LibraryLayout>
              <StudySessionPage />
            </LibraryLayout>
          </RequireSignedIn>
        }
      />
      <Route path="/*" element={<AuthenticatedShell />} />
```

- [ ] **Step 2: Typecheck after the route change**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Add the "Start practicing" button to `DeckDetailPage`**

In `frontend/src/pages/DeckDetailPage.tsx`, find:

```tsx
import { Link, useParams } from 'react-router-dom'
import { useDeck } from '../hooks/useDecks'
```

Replace with:

```tsx
import { Link, useParams } from 'react-router-dom'
import { useDeck } from '../hooks/useDecks'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'
```

Find:

```tsx
          <p className="mt-4 text-xs text-slate-400">
            Modes: {deck.studyModes.join(', ')} · Languages: {deck.locales.join(', ') || '—'}
          </p>
        </div>
      )}
    </section>
  )
}
```

Replace with:

```tsx
          <p className="mt-4 text-xs text-slate-400">
            Modes: {deck.studyModes.join(', ')} · Languages: {deck.locales.join(', ') || '—'}
          </p>

          <Link
            to={`/deck/${deck.slug}/study`}
            className={[
              'mt-4 block w-full rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors sm:inline-block sm:w-auto',
              focusRingClass,
              'bg-blue-600 text-white hover:bg-blue-700',
            ].join(' ')}
          >
            Start practicing
          </Link>
        </div>
      )}
    </section>
  )
}
```

This matches `MainApp`'s existing primary-CTA button styling (`bg-blue-600 text-white hover:bg-blue-700`,
same padding/radius) so the new button doesn't look like a different design language, but uses `<Link>`
instead of a `<button onClick={navigate(...)}>` since there's no conditional logic (unlike `MainApp`'s
button, which toggles between "start" and "continue" and can be disabled) — a plain navigational link
is the more correct semantic element here.

- [ ] **Step 4: Update `DeckDetailPage`'s existing tests for the new button**

The existing `frontend/src/pages/DeckDetailPage.test.tsx` (from Plan 4) doesn't wrap its render in a
`<Routes>` with a `/deck/:slug/study` route, so the new `<Link>`'s `to` prop will still render fine
(React Router `<Link>` doesn't require the target route to exist to render the anchor), but add one
assertion to the existing "shows a loading state, then the deck details" test to confirm the button
appears. Find, in `frontend/src/pages/DeckDetailPage.test.tsx`:

```tsx
    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary across CEFR levels.')).toBeInTheDocument()
    expect(screen.getByText('CEFR level')).toBeInTheDocument()
  })
```

Replace with:

```tsx
    await waitFor(() => expect(screen.getByText('German Grammar & Vocabulary')).toBeInTheDocument())
    expect(screen.getByText('Practice German grammar and vocabulary across CEFR levels.')).toBeInTheDocument()
    expect(screen.getByText('CEFR level')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start practicing' })).toHaveAttribute(
      'href',
      '/deck/german-grammar-vocabulary/study'
    )
  })
```

- [ ] **Step 5: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: all tests pass — 38 pre-existing (from Plans 1, 3, 4) + 3 (Task 1) + 2 (Task 2) + 5 (Task 3)
= 48 total.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/DeckDetailPage.tsx frontend/src/pages/DeckDetailPage.test.tsx
git commit -m "feat: wire /deck/:slug/study route and Start practicing button"
```

---

### Task 5: Full regression pass with live manual verification

**Files:** none (verification only)

Plan 4's equivalent task found a real, significant bug (`RequireSignedIn`/`RequireAdmin` only checked
`isGuest`, never `!user`) that 38 passing unit tests and two rounds of code review both missed — only
caught by actually running the app in a browser. Treat this task with the same seriousness; do not
skip the manual portion even if the automated checks are clean.

- [ ] **Step 1: Full test suite**

Run: `cd frontend && npm test`
Expected: 48 tests passed (see Task 4 Step 5).

- [ ] **Step 2: Typecheck, lint, build**

```bash
cd frontend && npx tsc -b --noEmit && npm run lint && npm run build
```

Expected: typecheck clean, 0 lint errors, build succeeds.

- [ ] **Step 3: Manual smoke check against a real backend**

Start a local backend with the `decks` table migrated (same setup as prior plans' manual checks) and
the frontend dev server, then in a browser:

- Sign in as a real (non-guest) user.
- Navigate to Library → click the German Grammar & Vocabulary deck → confirm the "Start practicing"
  button is visible and its URL is `/deck/german-grammar-vocabulary/study` (hover or inspect before
  clicking).
- Click "Start practicing". Confirm the URL becomes `/deck/german-grammar-vocabulary/study`, a real
  question renders (not a loading spinner stuck, not an empty state — the seeded deck has hundreds of
  exercises), and the "← German Grammar & Vocabulary" back-link is visible.
- Answer the question, confirm normal `QuizSession` behavior (feedback, advancing to the next
  question) — this is pre-existing, unmodified `QuizSession`/`useExerciseSession` behavior, so this
  step is a smoke check that nothing about mounting it in a new context broke it, not new behavior to
  scrutinize deeply.
- Click "Exit session" mid-session (confirm the browser `confirm()` dialog, accept it), confirm you
  land back on `/deck/german-grammar-vocabulary/study`'s parent — the URL should become
  `/deck/german-grammar-vocabulary`.
- Navigate directly to `/deck/does-not-exist/study` via the URL bar, confirm "Deck not found."
  renders rather than a crash.
- As a guest, or logged out, navigate directly to `/deck/german-grammar-vocabulary/study` via the URL
  bar, confirm it redirects to `/` (this exercises the same `RequireSignedIn` guard fixed in Plan 4 —
  confirm that fix's coverage extends correctly to this new route without any further changes needed;
  if it does NOT redirect, that is a serious regression, stop and report it rather than proceeding).

If no backend is available, at minimum confirm the guest/logged-out redirect (doesn't require a
successful API call, the redirect happens before any fetch) and note in your report that the
authenticated session-taking flow was not manually verified against a live backend.

## Self-Review Notes

- **Spec coverage:** This plan makes deck-scoped practice sessions real and reachable from Deck
  Detail. It does not touch `MainApp`, does not solve session-position survival across navigation
  away from the study route, and does not add exam mode or deck-scoped progress — see "Non-goals".
- **No placeholders:** every step's code edit shows complete code or an exact anchored find/replace.
- **Type consistency:** `Exercise` (existing type, unchanged) flows from `fetchExercisesForDeck` →
  `useDeckExercises` → `StudySessionPage` → `QuizSession`'s existing `exercises` prop, with no new
  exercise-shaped type introduced. `Deck` (from Plan 1/4) is used identically to `DeckDetailPage`.
- **Process note carried forward from Plan 4:** every task in this plan runs `npm run lint` as its own
  step, not only at the final regression pass — Plan 4 found real lint errors that went unnoticed for
  three tasks because this wasn't done consistently.

## Implementation Notes (added after execution)

All 5 tasks landed as commits `51e1577..6912db9` on `feat/deck-study-sessions`. This plan's own claim
that `QuizSession` is "fully self-contained" was wrong in one respect discovered during Task 3: it
required an `AuthProvider` ancestor. Between that and three further bugs found only by actually
running the test suite and the app, this was the highest bug-density task sequence in the whole plan
series so far — five real, distinct defects across three tasks, all caught before merge:

- **Task 3, `QuizSession` needs `AuthProvider`:** it calls `useAuth()` internally (for guest-mode
  progress skipping and admin delete controls). The plan's test rendered `StudySessionPage` under a
  bare `MemoryRouter` with no `AuthProvider`, which crashed the whole tree with no error boundary
  present. Fixed by wrapping the test render in `<AuthProvider>`.
- **Task 3, a vitest-version incompatibility:** `expect(unspiedFn).not.toHaveBeenCalled()` throws
  `TypeError` in this repo's vitest 4.1.10 rather than failing the assertion normally — confirmed by
  reproducing it in isolation against an unrelated function first. Every other test file in this repo
  already avoids this by spying before asserting; the plan's not-found test didn't. Fixed the same way.
- **Task 3, `useDeckExercises('')` fired a real network request:** `StudySessionPage` calls
  `useDeckExercises(deck?.id ?? '')` before the deck has resolved, and the hook fired
  `fetchExercisesForDeck('')` regardless. Fixed with a guard that skips the fetch when `deckId` is
  falsy — but the first version of that fix introduced a sixth bug (below).
- **Task 3, `Date.now()` called inline in a JSX prop violated `react-hooks/purity`:** the plan's
  `sessionId={\`deck-${deck.id}-${Date.now()}\`}` is an impure call during render, which this
  codebase's stricter, newer eslint-plugin-react-hooks rule set (not present when earlier plans in
  this series were reviewed) now catches. Fixed by moving to a lazy `useState` initializer keyed on
  `slug` (available immediately from the route, unlike `deck.id` which needs the deck fetch to
  resolve) — the React-sanctioned pattern for one-time non-deterministic values computed at mount.
- **Task 3, the empty-deckId guard's first version broke `loading`:** it called `setLoading(false)`
  when `deckId` was empty but never `setLoading(true)` when the effect re-ran with a real id, so
  `exercisesLoading` read `false` during the real fetch's entire in-flight window. Code review traced
  this precisely and predicted the user-visible symptom (a flash of `QuizSession`'s "No exercises
  match the current filters" empty state before the real questions loaded) before it was ever
  manually observed. Fixed by resetting both `loading` and `error` on every effect run — the same
  pattern `useDeck` in `useDecks.ts` already uses for the identical "dependency actually changes"
  case, which the first fix attempt had mis-copied from the wrong sibling (`useDecks`'s truly
  once-only effect) instead. A regression test using a manually-controlled (not auto-resolving)
  promise was added and verified to actually fail against the original buggy code before confirming
  the fix — not just written and assumed to work.

Live browser verification (Task 5) went beyond the plan's own checklist: rather than just checking
the guard redirect, it exercised the full loop with a real backend — start session, answer a
question, exit mid-session (browser `confirm()` stubbed via `window.confirm = () => true` since
native dialogs aren't reliably automatable), confirm the exit lands back on the deck page, `/deck/does-not-exist/study`
renders "Deck not found." without crashing, and — the most valuable check — clicking "Sign out" while
already mounted on the protected `/deck/.../study` route triggered an immediate, reactive redirect to
`/` with no extra navigation needed, confirming `RequireSignedIn`'s guard re-evaluates correctly on
live auth-state changes, not just on initial mount.

Final state verified directly: `npm test` → 49/49 passed, `npx tsc -b --noEmit` → clean, `npm run
lint` → 0 errors (same pre-existing, out-of-scope `QuizCard.tsx` warning as every prior plan), `npm
run build` → succeeds.
