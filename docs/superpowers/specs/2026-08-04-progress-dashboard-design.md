# Deck-Scoped Progress Dashboard — Design

**Goal:** Let a user scope their progress view to a single deck, or see it aggregated across all
decks (today's behavior). This is Plan 7 of the Reps platform rewrite (see
`docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`); Plans 1–6 are merged to `master`.
The core spec calls this out directly: "Progress — per-deck metrics | Rework of `ProgressDashboard`".

**Current state:** `ProgressDashboard` (`frontend/src/components/ProgressDashboard.tsx`) is
deck-agnostic — it calls `useStats()`, `useProgressSummary()` (unused directly by the component
today, but exists), and `useReviewMetrics()`, none of which accept any scoping parameter, and
computes "weak topics" by grouping stats client-side using an `exercises` prop the caller supplies.
It's rendered from the legacy `MainApp` component (`frontend/src/App.tsx`) behind a
`location.pathname === '/progress'` check, not from a dedicated routed page like
`LibraryPage`/`DeckDetailPage`/`StudySessionPage`/`ExamSessionPage` from Plans 3–6.

**Non-goals:**
- Generalizing "weak topics" from the legacy `topic` field to the newer facet system
  (`facetKey`/`facetValue`) — deferred until the Einbürgerungstest import (Plan 8) actually needs
  it, matching how Exam mode (Plan 6) deferred the same generalization.
- Touching the Admin screen or its route — still inside legacy `MainApp`, out of scope here.
- Any new statistics/metrics beyond what's already shown (this plan is about *scoping* existing
  metrics per deck, not adding new ones).

---

## Architecture

### Backend: deckId scoping on progress endpoints

Two existing endpoints gain an optional `?deckId=<id>` query param, following the exact pattern
already used by `GET /api/exercises?deckId=` (`backend/src/routes/exercises.ts`):

- `GET /api/stats` (`backend/src/routes/stats.ts`) — powers the exercise-table and weak-topics
  sections of `ProgressDashboard`.
- `GET /api/progress/review-metrics` (`backend/src/routes/progress.ts`) — powers the "Due reviews"
  stat.

`GET /api/progress/summary` (and its frontend hook `useProgressSummary`/`fetchProgressSummary`) is
**not** touched by this plan: it's currently unused by `ProgressDashboard` or any other screen
(confirmed by grep — `fetchProgressSummary` has no call site outside its own hook definition and
test). Scoping an endpoint nothing renders would be speculative work with no way to verify it's
correct; if a future plan wires the daily/weekly/monthly summary bars into the UI, that plan can add
`deckId` scoping to it then, following the same pattern established here.

Each scoped query joins its underlying rows to `exercises`/`user_exercises` on `exercise_id`,
filtering on `COALESCE(e.deck_id, ue.deck_id) = $deckId` when a deckId is given (both tables are
joined because a user's own custom exercises can also carry a `deck_id`, per Plan 2's
`012_decks.sql` migration). When `deckId` is omitted, behavior is byte-for-byte unchanged from
today — existing callers that don't pass it keep working exactly as before.

`GET /api/stats` currently selects from the `exercise_stats` view (itself a `GROUP BY` over
`progress`), so the join target is `exercise_stats.exercise_id`. `GET /api/progress/review-metrics`
queries `user_review_schedule` directly, so that joins on `user_review_schedule.exercise_id`.

### Frontend: routing

`Progress` moves out of `MainApp`'s conditional block into a new routed
`frontend/src/pages/ProgressPage.tsx`, mounted at `/progress` under `LibraryLayout`, guarded by
`RequireSignedIn` — matching how Library/Deck Detail/Study/Exam are already wired in
`frontend/src/App.tsx`'s `AppShell`. The existing
`{location.pathname === '/progress' && isGuest && <Navigate to="/" replace />}` guest-redirect logic
inside `MainApp` is deleted; `RequireSignedIn` already redirects guests the same way.

### Frontend: deck selector

`ProgressPage` fetches the deck list via the existing `useDecks()` hook and renders a tab-style
selector: "All decks" plus one tab per deck (`deck.title`). Selection is stored in a `?deck=<slug>`
URL query param via `useSearchParams` (react-router-dom, already a dependency since Plan 3), absent
by default — so a first visit to `/progress` looks and behaves exactly like today's unscoped view.

When a deck is selected, `ProgressPage`:
- Resolves the selected deck's `id` from `useDecks()`'s already-fetched list (no extra fetch).
- Passes that `id` as an optional `deckId` param through to `useStats` and `useReviewMetrics` (both
  hooks gain an optional `deckId?: string` parameter, added to each hook's dependency array so
  switching decks re-fetches).
- Uses `useDeckExercises(deckId)` (existing hook, Plan 5) instead of the global `useExercises()` to
  supply `ProgressDashboard`'s `exercises` prop, so prompt/topic lookups match the scoped stats.

When "All decks" is selected (`deckId` undefined), both hooks call their existing unscoped fetch
functions and `ProgressPage` uses the existing global `useExercises()` — identical to current
behavior.

`ProgressDashboard` itself is otherwise unchanged: it already accepts `exercises` as a prop, and its
weak-topics/exercise-table logic operates purely on whatever `stats`/`exercises` it's given, with no
deck-awareness baked in. No deck-selector UI lives inside `ProgressDashboard` — that's `ProgressPage`'s
job, keeping the dashboard component itself reusable and testable in isolation (as it is today).

---

## Data flow

```
ProgressPage (/progress?deck=<slug>)
  ├─ useDecks() → deck list for the selector, resolves slug → deck.id
  ├─ selected deckId (string | undefined, from useSearchParams + resolved deck)
  ├─ useStats(deckId) ─────────┐
  ├─ useReviewMetrics(deckId) ─┴─→ ProgressDashboard(stats, reviewMetrics, exercises)
  └─ deckId ? useDeckExercises(deckId) : useExercises()
```

## API contract changes

```
GET /api/stats?deckId=<id>                  (deckId optional; omitted = unscoped, unchanged)
GET /api/progress/review-metrics?deckId=<id>
```

Frontend `fetchStats` and `fetchReviewMetrics` (`frontend/src/api/progressApi.ts`) each gain an
optional `deckId?: string` parameter, appended as a query string when present.

## Testing

- Backend: extend `backend/src/routes/progress.test.ts` (for the `review-metrics` deckId parsing)
  and add `backend/src/routes/stats.test.ts` (for `GET /api/stats`'s deckId parsing), with the same
  request-validation-style tests already used for `progress.ts`'s `isValidProgressMode` (no CI
  database exists, per Plan 2's known gap, so these test query-param parsing/validation logic
  directly rather than spinning up the full Express app with a real Postgres connection).
- Frontend: new `frontend/src/pages/ProgressPage.test.tsx` — renders with the deck selector present,
  selecting a deck updates the URL and triggers hooks to re-fetch with the resolved `deckId`,
  selecting "All decks" omits it. Existing `useProgress`/`ProgressDashboard` behavior has no existing
  test file to extend (consistent with this codebase's existing test coverage gaps, not something
  this plan needs to backfill beyond what it touches).
- Manual verification: with the real seeded deck (`german-grammar-vocabulary`), confirm the
  dashboard renders identically whether reached via "All decks" or via the single real deck's tab
  (since there's only one deck today, this also serves as a regression check that scoping doesn't
  drop or duplicate any rows).
