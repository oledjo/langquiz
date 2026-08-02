# Frontend Routing Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce `react-router-dom` and give the app's existing top-level screens (home, progress,
admin, marketing, auth) real URLs, without touching the quiz-session mount-persistence behavior or
building any new screens. This is Plan 3 of the Reps platform rewrite (see
`docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`); Plans 1 and 2 are merged to
`master`.

**Why this is its own plan, not bundled with the Library/Deck-detail screens the spec describes:**
`frontend/src/App.tsx` is 1128 lines. Its `MainApp` component (lines 188–1103, ~915 lines) holds
session-starting logic, topic-insight computation, and a custom-exercise-import modal, all as local
state in one component. The quiz session is deliberately kept mounted across "tab" switches via a
CSS `hidden`/`block` toggle (`shouldMountQuiz`, line ~938) rather than true routing, specifically so
navigating away and back doesn't reset an in-progress session. Moving straight to `/deck/:slug` and
new Library/My-decks screens in the same change as introducing a router would mean redesigning that
session-continuity behavior at the same time as wiring up navigation — two risky changes at once in
a large file with zero existing tests on it. This plan does only the router wiring; the new screens
(and the session-continuity redesign that deck-scoped study sessions will eventually need) are a
separate follow-up plan.

**Non-goals (explicitly deferred):**
- No `/library`, `/deck/:slug`, or `/my-decks` screens — those don't exist yet; building them is the
  next plan, once `GET /api/decks` (already live, from Plan 2) has a UI consumer.
- The quiz session stays exactly as it is today: an internally-toggled section of the home screen,
  not its own route. `view` state's `'quiz'` value and the `shouldMountQuiz` mount-persistence
  pattern are untouched.
- `TopicFilter` is not touched — it still reads from the bundle registry. Rewriting it against
  `facetDefinitions` is part of the Library/deck-detail plan, since that's when it needs to filter by
  deck instead of by hardcoded language.
- `MarketingSite`'s internal path parsing (`window.location.pathname`, plain `<a href>` tags for its
  own sub-pages) is untouched — it already self-contained and works fine mounted under a route.

**Architecture:** Wrap the app in `<BrowserRouter>`. Split `AppShell` into two route branches:
`/learn/*` renders `MarketingSite` unchanged, everything else renders a new `AuthenticatedShell` that
keeps today's loading/auth-gate logic and then renders `MainApp` once. `MainApp` itself is mounted at
a single wildcard route (`/*` under the non-marketing branch) so it never remounts when the user
moves between home, progress, and admin — inside `MainApp`, the two screen-switching reads that
currently use `view === 'dashboard'` / `view === 'admin'` local state instead read
`useLocation().pathname`, and their nav buttons call `useNavigate()` instead of `setView(...)`. The
`View` type shrinks from `'home' | 'quiz' | 'dashboard' | 'admin'` to `'home' | 'quiz'` since only
those two remain state-driven.

**Tech Stack:** React 19, react-router-dom 7 (peer range `>=18`, compatible), Vite 7, Vitest +
`@testing-library/react` (already installed from Plan 1 Task 1).

**Plan sequence (updated):**
1. Domain model foundation & brand rebrand — done (merged to `master`).
2. Backend decks table & content storage — done (merged to `master`).
3. **This plan** — router installed, existing screens get real URLs.
4. Library, deck detail (`/deck/:slug`), and My-decks screens; `TopicFilter` rewritten against
   `facetDefinitions`; quiz-session mounting redesigned for deck-scoped study (this is where the
   session-continuity behavior this plan deliberately doesn't touch gets revisited).
5. Exam mode.
6. Deck-scoped progress dashboard.
7. Einbürgerungstest import (separate spec).

---

### Task 1: Install react-router-dom

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install**

Run: `cd frontend && npm install react-router-dom@^7`

Expected: `react-router-dom` added to `dependencies` in `frontend/package.json`.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors (nothing imports it yet, so this just confirms the install didn't break anything).

- [ ] **Step 3: Commit**

```bash
cd ~/projects/langquiz
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add react-router-dom"
```

---

### Task 2: Wrap the app in `BrowserRouter`

**Files:**
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Read the current file**

`frontend/src/main.tsx` currently reads:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary title="LangQuiz failed to load">
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
```

- [ ] **Step 2: Add the router**

Replace the entire file with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/index.css'
import App from './App.tsx'
import { AppErrorBoundary } from './components/AppErrorBoundary.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary title="LangQuiz failed to load">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
```

`BrowserRouter` goes inside `AppErrorBoundary` (not outside) so routing errors are still caught by
the existing error boundary, matching how everything else in the app is already wrapped.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/main.tsx
git commit -m "feat: wrap app in BrowserRouter"
```

---

### Task 3: Split `AppShell` into route branches

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read the current `AppShell`**

At the end of `frontend/src/App.tsx` (lines 1104–1121), the current code is:

```tsx
function AppShell() {
  const { user, isLoading, isGuest } = useAuth()
  const isMarketingRoute = window.location.pathname === '/learn' || window.location.pathname.startsWith('/learn/')

  if (isMarketingRoute) return <MarketingSite />

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

- [ ] **Step 2: Replace it with route branches**

Replace that entire function with:

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

function AppShell() {
  return (
    <Routes>
      <Route path="/learn/*" element={<MarketingSite />} />
      <Route path="/*" element={<AuthenticatedShell />} />
    </Routes>
  )
}
```

`MarketingSite` keeps doing its own internal path parsing off `window.location.pathname` for which
post to show — that's unchanged and still works, since it's still a real browser URL under `/learn/*`,
just now matched by the router instead of a manual string check.

- [ ] **Step 3: Add the import**

At the top of `frontend/src/App.tsx`, alongside the other imports, add:

```tsx
import { Route, Routes } from 'react-router-dom'
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: route the marketing site and authenticated shell separately"
```

---

### Task 4: Route `MainApp`'s progress and admin screens

**Files:**
- Modify: `frontend/src/App.tsx`

This is the task that touches the most surface. Each step below is a precise, anchored replacement —
find the exact old text and replace it with the exact new text. Do not make any other changes to
`MainApp` in this task (its session-starting logic, filters, and import-modal code are unrelated and
must stay exactly as they are).

- [ ] **Step 1: Add the router imports and shrink the `View` type**

Find:

```tsx
type View = 'home' | 'quiz' | 'dashboard' | 'admin'
```

Replace with:

```tsx
type View = 'home' | 'quiz'
```

Add `useLocation` and `useNavigate` to the `react-router-dom` import added in Task 3 — change:

```tsx
import { Route, Routes } from 'react-router-dom'
```

to:

```tsx
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
```

- [ ] **Step 2: Call the router hooks inside `MainApp`**

Find the start of `MainApp`:

```tsx
function MainApp() {
  const { user, logout, isGuest } = useAuth()
```

Replace with:

```tsx
function MainApp() {
  const { user, logout, isGuest } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
```

- [ ] **Step 3: Route the nav tabs**

Find the nav-tab block:

```tsx
          <nav
            className={[
              'grid w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto',
              isGuest ? 'grid-cols-1 sm:min-w-[120px]' : user?.role === 'admin' ? 'grid-cols-3 sm:min-w-[330px]' : 'grid-cols-2 sm:min-w-[220px]',
            ].join(' ')}
          >
            {(
              isGuest
                ? (['home'] as const)
                : user?.role === 'admin'
                ? (['home', 'dashboard', 'admin'] as const)
                : (['home', 'dashboard'] as const)
            ).map((tab) => {
              const isActive = view === tab
              const label = tab === 'home' ? 'Home' : tab === 'dashboard' ? 'Progress' : 'Admin'
              return (
                <button
                  key={tab}
                  onClick={() => setView(tab)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    focusRingClass,
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
```

Replace with:

```tsx
          <nav
            className={[
              'grid w-full gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto',
              isGuest ? 'grid-cols-1 sm:min-w-[120px]' : user?.role === 'admin' ? 'grid-cols-3 sm:min-w-[330px]' : 'grid-cols-2 sm:min-w-[220px]',
            ].join(' ')}
          >
            {(
              isGuest
                ? (['home'] as const)
                : user?.role === 'admin'
                ? (['home', 'progress', 'admin'] as const)
                : (['home', 'progress'] as const)
            ).map((tab) => {
              const tabPath = tab === 'home' ? '/' : `/${tab}`
              const isActive = location.pathname === tabPath
              const label = tab === 'home' ? 'Home' : tab === 'progress' ? 'Progress' : 'Admin'
              return (
                <button
                  key={tab}
                  onClick={() => navigate(tabPath)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    focusRingClass,
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
```

The tab identifiers changed from `'dashboard'` to `'progress'` to match the new URL (`/progress`) —
this only affects the local `tab` loop variable and its derived `tabPath`/`label`, not the `View`
type from Step 1 (which no longer has `'dashboard'`/`'admin'` at all, since those screens are now
routed, not state-driven).

- [ ] **Step 4: Route the home/quiz section's visibility**

Find:

```tsx
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        {view === 'home' && (
```

Replace with:

```tsx
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        {location.pathname === '/' && view === 'home' && (
```

This keeps the home section's own internal `view === 'home'` check (still needed, since `view` can
also be `'quiz'` while still on the `/` path — the quiz overlay is a sibling block, see Step 5) but
adds the path check so the home section doesn't render when the user has navigated to `/progress` or
`/admin`.

- [ ] **Step 5: Route the quiz section's visibility**

Find:

```tsx
        {shouldMountQuiz && (
          <AppErrorBoundary title="Quiz session unavailable">
            <div className={view === 'quiz' ? 'block' : 'hidden'}>
```

Replace with:

```tsx
        {location.pathname === '/' && shouldMountQuiz && (
          <AppErrorBoundary title="Quiz session unavailable">
            <div className={view === 'quiz' ? 'block' : 'hidden'}>
```

This is the one place session-continuity behavior is touched at all, and only to add a path guard:
if the user navigates to `/progress` or `/admin` while a session is in progress, the quiz section
now stops rendering (previously it had no path concept at all, so it would never have hidden itself
this way — but there was also no way to navigate to a "progress" or "admin" URL before this plan, so
this is new behavior, not a regression of old behavior). The component itself does not unmount when
navigating within `/` (home vs. quiz `view` toggle stays exactly as before); it only conditionally
renders based on path in addition to the pre-existing `view`/`shouldMountQuiz` state. If the user
returns to `/` while `sessionInProgress` is still true, the section reappears with all its state
intact, since `MainApp` itself never unmounted (see Task 3 — `MainApp` is one component rendered at
a wildcard route, not remounted between paths).

- [ ] **Step 6: Route the progress and admin sections**

Find:

```tsx
        {!isGuest && view === 'dashboard' && (
          <AppErrorBoundary title="Progress dashboard unavailable">
            <ProgressDashboard exercises={allExercises} />
          </AppErrorBoundary>
        )}
        {!isGuest && view === 'admin' && user?.role === 'admin' && (
          <AppErrorBoundary title="Admin tools unavailable">
            <AdminQuestions onChanged={reloadExercises} />
          </AppErrorBoundary>
        )}
```

Replace with:

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

- [ ] **Step 7: Find and update any remaining `setView('dashboard')` or `setView('admin')` calls**

Run: `cd frontend && grep -n "setView('dashboard')\|setView('admin')" src/App.tsx`

As of this plan being written, there are none outside the nav tab block already handled in Step 3 —
but if this search finds any (e.g. a "go to admin" link elsewhere in the file), replace each with the
equivalent `navigate('/progress')` / `navigate('/admin')` call. If you find one, treat it the same way
as Step 3's replacement: it needs `navigate` in scope (already added in Step 2, since it's the same
component) and the literal path string, not the old `View` value.

- [ ] **Step 8: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors. If `setView('dashboard')` or `setView('admin')` linger anywhere, this step will
catch it as a type error (`'dashboard'`/`'admin'` no longer assignable to `View`), which is exactly
why Step 1 shrunk the type first — the compiler finds anything Step 7's grep might have missed.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: route the progress and admin screens"
```

---

### Task 5: Navigation tests

**Files:**
- Create: `frontend/src/App.routing.test.tsx`

`App.tsx` has no existing tests. This plan changes real navigation behavior in a 1128-line file with
no regression net, so this task adds one. Testing `App` itself requires mocking `useAuth` (it calls
`fetch` inside an effect) and the exercise/progress hooks, which pulls in a lot of unrelated setup —
instead, test the piece that actually changed: that clicking a nav tab updates the URL and swaps which
section is visible, using a minimal stand-in shell rather than the full `App`/`MainApp` tree.

- [ ] **Step 1: Write the test**

Create `frontend/src/App.routing.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { describe, expect, test } from 'vitest'

/**
 * Stands in for MainApp's nav-tab pattern (Task 4, Step 3): a button that
 * calls navigate() and a section that renders based on useLocation().
 * Exercises the exact mechanism App.tsx now uses, without needing to mock
 * AuthContext/useExercises/useStats just to render the real MainApp.
 */
function NavTabsFixture() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div>
      <button onClick={() => navigate('/')}>Home</button>
      <button onClick={() => navigate('/progress')}>Progress</button>
      {location.pathname === '/' && <p>Home section</p>}
      {location.pathname === '/progress' && <p>Progress section</p>}
    </div>
  )
}

describe('nav-tab routing pattern', () => {
  test('starts on the home section for the root path', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Home section')).toBeInTheDocument()
    expect(screen.queryByText('Progress section')).not.toBeInTheDocument()
  })

  test('clicking the Progress tab swaps the visible section without unmounting the component', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Progress' }))

    expect(screen.getByText('Progress section')).toBeInTheDocument()
    expect(screen.queryByText('Home section')).not.toBeInTheDocument()
  })

  test('clicking Home from Progress returns to the home section', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/progress']}>
        <Routes>
          <Route path="/*" element={<NavTabsFixture />} />
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText('Progress section')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Home' }))

    expect(screen.getByText('Home section')).toBeInTheDocument()
    expect(screen.queryByText('Progress section')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Install `@testing-library/user-event`**

Run: `cd frontend && npm install --save-dev @testing-library/user-event`

- [ ] **Step 3: Run the test**

Run: `cd frontend && npm test -- App.routing`
Expected: `3 passed`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.routing.test.tsx frontend/package.json frontend/package-lock.json
git commit -m "test: cover the nav-tab routing pattern used in App.tsx"
```

---

### Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `cd frontend && npm test`
Expected: all tests pass, including the pre-existing 14 from Plans 1 and the 3 new ones from Task 5
(17 total).

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors (the pre-existing `QuizCard.tsx` warning from prior plans is fine, unrelated to
this change).

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: succeeds.

- [ ] **Step 5: Manual smoke check**

Run: `cd frontend && npm run dev`, open the app in a browser (guest mode is fine, no backend needed
for this check since `useExercises` falls back to bundle content for guests):
- Confirm the URL bar shows `/` on load.
- Start a practice session, confirm it works exactly as before (this exercises the untouched
  `shouldMountQuiz` path).
- If not in guest mode (requires a running backend + `VITE_API_URL`), click the "Progress" tab and
  confirm the URL bar updates to `/progress` and the dashboard renders; click "Home" and confirm the
  URL returns to `/` and the home section reappears with an in-progress session (if any) still intact.
- Navigate directly to `http://localhost:5173/learn` and confirm the marketing site still renders.

If a backend isn't running, at minimum confirm the guest-mode home/quiz flow and the `/learn` route
manually, and note in your report that the progress/admin routes were not manually verified against
a live backend.

## Self-Review Notes

- **Spec coverage:** This plan gives the app real URLs for its existing screens and installs the
  router that Plan 4 will extend with `/library`, `/deck/:slug`, and `/my-decks`. It deliberately does
  not build those new screens or touch `TopicFilter`/quiz-session mounting — see "Non-goals" above.
- **No placeholders:** every step's code edit shows both the exact old text and the exact new text,
  not a description of the change.
- **Type consistency:** `View` (now `'home' | 'quiz'`), `location`, `navigate` are used identically
  across Task 4's steps. The new nav-tab identifiers (`'progress'` replacing `'dashboard'`) are
  scoped to the local `.map()` loop and don't leak into the `View` type or anywhere else.
- **Regression risk, stated plainly:** Task 4 is a surgical edit to a 1128-line, previously-untested
  file. Task 5 adds tests for the routing *pattern* (via a fixture), not for `MainApp` itself, because
  testing `MainApp` directly would require mocking `useAuth`, `useExercises`, `useUserExercises`, and
  `useStats` — a large undertaking that would expand this plan considerably. Task 6's manual smoke
  check is the actual regression check for `MainApp`'s wiring; treat it as mandatory, not optional.
