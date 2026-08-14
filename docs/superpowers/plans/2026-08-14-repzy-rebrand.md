# Repzy Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every "LangQuiz" surface — UI copy, logo, SEO metadata, backend strings, retention
emails, storage keys — with the new brand name **Repzy**, while keeping existing signed-in users
signed in and existing bookmarked/indexed URLs working.

**Supersedes:** the "Naming and brand" section of
`docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`, which chose **Reps**. That name
collides directly with `getreps.io`, an existing spaced-repetition flashcard app in the same
category — not a peripheral trademark risk, a same-category name clash. **Repzy** was chosen instead
after a quick search-engine pass turned up no flashcard/learning app or registered-looking domain
using it (see Decisions below). This is spot-checking, not legal clearance — Task 0 covers what has
to happen before the name is public or a domain is purchased.

## Context

The subject-neutral rewrite described in the Reps spec has already landed on `master`: decks,
facets, exam mode, per-deck progress, and the Einbürgerungstest import are all live. Separately, an
earlier plan (`2026-08-02-domain-model-and-brand-foundation.md`) migrated `localStorage` keys from a
`langquiz.` prefix to a `reps.` prefix with a legacy-read fallback (`frontend/src/lib/storageKeys.ts`),
fully wired through auth, every API client, and analytics. That work is real and shipped — it just
picked the name that's now being replaced.

Everything else in the product — page titles, the logo component, marketing copy, backend startup
banner, retention email copy, SEO metadata, the deployed domain — still says "LangQuiz". This plan
inventories all of it and sequences the swap to "Repzy".

## Decisions

**Name:** Repzy. Keeps the "Reps" root (spaced repetition, verb-able — "do your Repzy") while being
distinct enough to avoid the getreps.io collision. Rejected alternatives:
- *Reps* — direct collision with getreps.io (same category: spaced-repetition flashcards).
- *Repwise* — collides with an existing fitness app, a B2B sales-rep platform, and a coaching
  product, all using the name already.
- *RepDeck* — thematically strong (the app's core unit is literally called a "deck"), but
  `repdeck.com` is already registered.

**Storage key prefix:** `reps.` → `repzy.`, chained as a *second* legacy hop behind the existing
`reps.` → `langquiz.` fallback, not a replacement of it. A user who never opened the app between the
two migrations must still recover their session by walking `repzy.` → `reps.` → `langquiz.`.

**Domain:** target `repzy.com` / `repzy.app` / `repzy.io` (whichever is available — Task 0). Until a
domain is purchased and DNS is live, `APP_BASE_URL` / `SITE_BASE_URL` keep pointing at the existing
Render URL; only the *brand name in copy* changes in this plan, not the deployed hostname. Cutting
over the hostname is Task 7, gated on Task 0.

## Non-goals

- Any further change to the domain model (decks/facets/exam mode) — that shipped separately.
- A new visual identity beyond the logo mark and color already established (blue palette stays; see
  the superseded spec's brand-promise note, which still holds: "learn anything, one deck at a time").
- Formal trademark clearance — Task 0 flags it as a prerequisite, it does not perform it.

---

### Task 0: Verify the name before committing spend or making it public

**This task has no code.** It gates Task 7 (domain cutover) and any external announcement.

- [ ] **Step 1:** Run a proper trademark search (USPTO TESS at minimum; EUIPO/UKIPO if operating in
      those markets) for "Repzy" in software/education classes. The searches done while drafting this
      plan were search-engine spot checks only, not a legal clearance.
- [ ] **Step 2:** Check domain availability and price for `repzy.com`, `repzy.app`, `repzy.io` via a
      registrar (not search engines — availability isn't reliably inferable from search results).
- [ ] **Step 3:** Check social handle availability (X/Twitter, GitHub org, etc.) if those matter for
      launch.
- [ ] **Step 4:** If Repzy fails clearance, stop here and re-run the naming decision before continuing
      to Task 1 — every later task assumes the name is confirmed.

---

### Task 1: Storage keys — add the Repzy hop

**Files:**
- Modify: `frontend/src/lib/storageKeys.ts`
- Modify: `frontend/src/lib/storageKeys.test.ts`

- [ ] **Step 1: Update the test file first**

Add a third tier to each existing test in `frontend/src/lib/storageKeys.test.ts` — a value written
only under the `langquiz.` key must still resolve through two fallback hops:

```ts
test('AUTH_TOKEN_KEY uses the repzy prefix', () => {
  expect(AUTH_TOKEN_KEY).toBe('repzy.auth-token')
})

test('falls back two hops to the langquiz-era key when neither newer key is present', () => {
  localStorage.setItem('langquiz.auth-token', 'oldest-value')
  const resolved =
    readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY) ??
    readWithLegacyFallback(REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)
  expect(resolved).toBe('oldest-value')
})
```

Decide the exact test shape once Step 3's API is settled — the cleanest fix is a
`readWithLegacyChain(keys: string[])` helper rather than nesting two-argument calls at every call
site (six files currently call `readWithLegacyFallback` with two arguments). Prefer changing the
helper's signature to accept an ordered array over asking every call site to nest two calls.

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- storageKeys`

- [ ] **Step 3: Implement**

In `frontend/src/lib/storageKeys.ts`, rename the current "new" constants to `REPS_*` (they become the
middle tier), add `REPZY_*` as the new primary tier, and replace `readWithLegacyFallback` with a
chain-aware version so existing call sites only need their two-argument call widened to three:

```ts
export const AUTH_TOKEN_KEY = 'repzy.auth-token'
export const REPS_AUTH_TOKEN_KEY = 'reps.auth-token'
export const LEGACY_AUTH_TOKEN_KEY = 'langquiz.auth-token'

export const CUSTOM_EXERCISES_KEY = 'repzy.custom-exercises.v1'
export const REPS_CUSTOM_EXERCISES_KEY = 'reps.custom-exercises.v1'
export const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'

export const ANALYTICS_DAY7_KEY = 'repzy.analytics.day7.last-fired'
export const REPS_ANALYTICS_DAY7_KEY = 'reps.analytics.day7.last-fired'
export const LEGACY_ANALYTICS_DAY7_KEY = 'langquiz.analytics.day7.last-fired'

export const UTM_FIRST_TOUCH_KEY = 'repzy.utm.first-touch.v1'
export const REPS_UTM_FIRST_TOUCH_KEY = 'reps.utm.first-touch.v1'
export const LEGACY_UTM_FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'

export const PROGRESS_UPDATED_EVENT = 'repzy:progress-updated'

export function readWithLegacyFallback(...keysInPriorityOrder: string[]): string | null {
  for (const key of keysInPriorityOrder) {
    const value = localStorage.getItem(key)
    if (value !== null) return value
  }
  return null
}
```

Widening `readWithLegacyFallback` to accept `...keysInPriorityOrder` (instead of exactly two
positional args) means every existing call site — `AuthContext.tsx`, `adminApi.ts`, `decksApi.ts`,
`exercisesApi.ts`, `progressApi.ts`, `retentionApi.ts`, `userExercisesApi.ts`,
`analytics/client.ts`, `analytics/utm.ts` — just needs its call updated from
`readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)` to
`readWithLegacyFallback(AUTH_TOKEN_KEY, REPS_AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)`, without a
signature mismatch anywhere else in the codebase.

- [ ] **Step 4: Update every write and every explicit removeItem call**

Writes (`localStorage.setItem`) move to the new `AUTH_TOKEN_KEY` / `CUSTOM_EXERCISES_KEY` /
`ANALYTICS_DAY7_KEY` / `UTM_FIRST_TOUCH_KEY` constants (already correct, since those names are
reused — only their string values changed). Explicit `removeItem` calls on logout
(`AuthContext.tsx`'s `logout` and `continueAsGuest`) must clear all three tiers, not just two:

```ts
localStorage.removeItem(AUTH_TOKEN_KEY)
localStorage.removeItem(REPS_AUTH_TOKEN_KEY)
localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
```

- [ ] **Step 5: Update the nine call sites**

`frontend/src/auth/AuthContext.tsx`, `frontend/src/api/adminApi.ts`,
`frontend/src/api/decksApi.ts`, `frontend/src/api/exercisesApi.ts`,
`frontend/src/api/progressApi.ts`, `frontend/src/api/retentionApi.ts`,
`frontend/src/api/userExercisesApi.ts`, `frontend/src/analytics/client.ts`,
`frontend/src/analytics/utm.ts` — widen each `readWithLegacyFallback(...)` call to three arguments
per Step 3, and import the new `REPS_*` constant alongside the existing `AUTH_TOKEN_KEY` /
`LEGACY_AUTH_TOKEN_KEY` imports.

- [ ] **Step 6: Typecheck and test**

Run: `cd frontend && npx tsc -b --noEmit && npm test -- storageKeys`

- [ ] **Step 7: Manual verification**

`npm run dev`, log in, confirm `localStorage` shows `repzy.auth-token` (DevTools → Application →
Local Storage), reload to confirm persistence, log out, confirm all three token keys
(`repzy.`, `reps.`, `langquiz.`) are gone.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/storageKeys.ts frontend/src/lib/storageKeys.test.ts frontend/src/auth/AuthContext.tsx frontend/src/api/adminApi.ts frontend/src/api/decksApi.ts frontend/src/api/exercisesApi.ts frontend/src/api/progressApi.ts frontend/src/api/retentionApi.ts frontend/src/api/userExercisesApi.ts frontend/src/analytics/client.ts frontend/src/analytics/utm.ts
git commit -m "refactor: add repzy. storage key tier ahead of reps./langquiz. fallback chain"
```

---

### Task 2: Logo component rename

**Files:**
- Rename: `frontend/src/components/LangQuizLogo.tsx` → `frontend/src/components/RepzyLogo.tsx`
- Modify: `frontend/src/App.tsx` (2 import + 2 usage sites), `frontend/src/auth/AuthPage.tsx` (1
  import + 1 usage site)

- [ ] **Step 1:** `git mv frontend/src/components/LangQuizLogo.tsx frontend/src/components/RepzyLogo.tsx`,
      rename the exported function `LangQuizLogo` → `RepzyLogo` inside it.
- [ ] **Step 2:** Update `frontend/src/App.tsx` — the import at line 11 and both JSX usages at lines
      532 and 1183.
- [ ] **Step 3:** Update `frontend/src/auth/AuthPage.tsx` — the import at line 3 and usage at line 134.
- [ ] **Step 4:** Typecheck: `cd frontend && npx tsc -b --noEmit`.
- [ ] **Step 5:** Commit:

```bash
git add -A frontend/src/components/RepzyLogo.tsx frontend/src/App.tsx frontend/src/auth/AuthPage.tsx
git status  # confirm LangQuizLogo.tsx shows as renamed, not deleted+added-elsewhere
git commit -m "rename: LangQuizLogo -> RepzyLogo"
```

---

### Task 3: In-app UI copy

**Files:**
- `frontend/src/App.tsx` — lines 49 (`LLM_EXERCISE_PROMPT_SAMPLE` header string), 88 (prompt's closing
  instruction line), 533/1184 (`<h1>LangQuiz</h1>` → `<h1>Repzy</h1>`, after Task 2's logo rename)
- `frontend/src/auth/AuthPage.tsx` — lines 58, 97, 135 (`<h1>LangQuiz</h1>` → `<h1>Repzy</h1>`)
- `frontend/src/main.tsx` — line 10 (`AppErrorBoundary title="LangQuiz failed to load"` →
  `"Repzy failed to load"`)
- `frontend/src/marketing/MarketingSite.tsx` — lines 75, 142, 196, 201

- [ ] **Step 1:** In `App.tsx` line 49, replace `Generate 12 German learning exercises as strict JSON
      for LangQuiz.` with `... for Repzy.`; line 88 replace `(LangQuiz auto-generates IDs on import)`
      with `(Repzy auto-generates IDs on import)`.
- [ ] **Step 2:** In `App.tsx` and `AuthPage.tsx`, replace the header text `LangQuiz` → `Repzy` at each
      site listed above. Read the surrounding copy in `AuthPage.tsx` lines 55–60 and 94–98 before
      editing — those are full sentences ("LangQuiz gives you short sessions...", "the same LangQuiz
      workflow...") that need the word swapped in place, not just the heading.
- [ ] **Step 3:** In `main.tsx`, swap the error boundary title string.
- [ ] **Step 4:** In `MarketingSite.tsx`, swap all four occurrences (`LangQuiz is not limited to a
      fixed catalog...`, the `<p>LangQuiz</p>` eyebrow label, `<p>LangQuiz guide</p>` eyebrow label,
      and `LangQuiz automatically prioritizes missed questions...`).
- [ ] **Step 5:** Grep to confirm no `LangQuiz` string remains in `frontend/src` outside of
      `storageKeys.ts`'s intentional legacy-key literals (those stay — they're reading old data, not
      displaying brand copy):

```bash
grep -rn "LangQuiz" frontend/src --include="*.tsx" --include="*.ts" | grep -v storageKeys
```

Expected: no output.

- [ ] **Step 6:** Commit:

```bash
git add frontend/src/App.tsx frontend/src/auth/AuthPage.tsx frontend/src/main.tsx frontend/src/marketing/MarketingSite.tsx
git commit -m "rebrand: replace LangQuiz with Repzy in UI copy"
```

---

### Task 4: SEO metadata and static assets

**Files:**
- `frontend/index.html` — title, meta description, canonical, all OG/Twitter tags, three JSON-LD
  blocks (`name` fields and the two FAQ `name`/`text` strings), favicon `href`
- `frontend/public/og-card.svg` — `aria-label` and the visible `<text>` node
- `frontend/public/robots.txt` — sitemap URL (domain change deferred to Task 7; only touch this file
  if the hostname is already cut over)
- `frontend/public/sitemap.xml` — same caveat as robots.txt
- `frontend/scripts/generate-sitemap.mjs` — `SITE_BASE_URL` default (same caveat)
- New asset: `frontend/public/repzy-logo.svg` (rename/redraw of `langquiz-logo.svg`; reuse the
  existing SVG if the mark itself doesn't need to change, per the "brand promise... blue palette
  stays" decision inherited from the superseded spec)

- [ ] **Step 1:** Add `frontend/public/repzy-logo.svg`. If keeping the same mark, `git mv
      frontend/public/langquiz-logo.svg frontend/public/repzy-logo.svg`; if the mark changes, that's
      design work outside this plan's scope — flag it rather than guessing at new artwork.
- [ ] **Step 2:** In `frontend/index.html`:
  - `<link rel="icon" ... href="/langquiz-logo.svg" />` → `href="/repzy-logo.svg"`
  - `<title>LangQuiz - Learn Languages with Focused Practice</title>` → update to reflect the
    subject-neutral positioning too, not just the name (the current title still says "Learn
    Languages" even though the product now supports any subject via decks) — e.g. `<title>Repzy -
    Focused Practice for Anything You're Learning</title>`. Confirm final copy with whoever owns
    marketing before shipping; this plan flags the mismatch, not the exact wording.
  - meta description, OG title/description, Twitter title/description: same LangQuiz→Repzy swap,
    same flag about "languages"-specific phrasing now being stale given decks/Einbürgerungstest.
  - Three `"name": "LangQuiz"` JSON-LD fields → `"Repzy"`.
  - FAQ `"name": "How long is a LangQuiz practice session?"` → `"...Repzy practice session?"`, and
    the "Yes. LangQuiz supports importing..." answer text.
  - `canonical`, `og:url`, `og:image`, `twitter:image` keep pointing at the current Render URL until
    Task 7 — do not change the hostname here.
- [ ] **Step 3:** In `og-card.svg`, update `aria-label="LangQuiz"` and the `<text>` content to
      `Repzy`.
- [ ] **Step 4:** Leave `robots.txt`, `sitemap.xml`, and `generate-sitemap.mjs`'s `SITE_BASE_URL`
      default untouched in this task — they're addressed together in Task 7 once a real domain exists,
      so the sitemap's URLs don't get rewritten twice.
- [ ] **Step 5:** Commit:

```bash
git add frontend/public/repzy-logo.svg frontend/public/og-card.svg frontend/index.html
git status  # confirm langquiz-logo.svg removed if renamed
git commit -m "rebrand: replace LangQuiz branding in SEO metadata and static assets"
```

---

### Task 5: Backend strings

**Files:**
- `backend/src/index.ts` — line 55 (`name: 'LangQuiz API'`), line 93 (startup log)
- `backend/src/services/retention.ts` — line 179 (`'Finish your first 10 LangQuiz questions'`), line
  181 (`'...gives LangQuiz enough signal...'`), and any other `LangQuiz` occurrences in this file's
  email copy (grep the whole file — Step 1 below covers more than the two lines already seen)
- `backend/src/services/email.ts` — `APP_BASE_URL` default (hostname — same Task 7 caveat as above,
  leave as-is here)
- `backend/src/routes/retention.ts` — line 33 (`"...will no longer receive LangQuiz emails."`)

- [ ] **Step 1:** Grep the backend for every occurrence before editing, since `retention.ts` likely
      has more than the two lines already found:

```bash
grep -rn "LangQuiz" backend/src
```

- [ ] **Step 2:** Replace every UI-facing string (API root `name`, startup console log, retention
      email subject/body copy, unsubscribe-page copy) — `LangQuiz` → `Repzy`. Leave `APP_BASE_URL`'s
      hostname default (`https://langquiz.onrender.com`) untouched; that's infrastructure, handled in
      Task 7.
- [ ] **Step 3:** Run backend tests: `cd backend && npm test` (check `package.json` for the actual
      script name/runner first).
- [ ] **Step 4:** Commit:

```bash
git add backend/src/index.ts backend/src/services/retention.ts backend/src/routes/retention.ts
git commit -m "rebrand: replace LangQuiz with Repzy in backend strings and retention emails"
```

---

### Task 6: Package metadata and remaining docs

**Files:**
- `backend/package.json`, `frontend/package.json` — `name` fields are currently generic (`"backend"`,
  `"frontend"`), not brand-specific; low priority, optional rename to `repzy-backend` /
  `repzy-frontend` for clarity in tooling output. Skip if it risks breaking any deploy config that
  references the literal package name.
- `docs/render-deployment.md` — likely references the `langquiz` Render service name; update once
  Task 7's infra rename actually happens, not before (avoid documenting a rename that hasn't
  shipped).
- `README.md` — none exists at the repo root today; not in scope to create one as part of a rebrand
  unless requested separately.
- Historical docs (`PLAN.md`, `docs/mvp-simplification-plan.md`,
  `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md`) — **do not edit**. They're a
  chronological record of decisions already made (including the superseded "Reps" naming section) and
  rewriting them would erase why the domain model looks the way it does. This plan document is the
  amendment; the old spec stays as-is with this plan superseding just its naming section.

- [ ] **Step 1:** Add one line at the top of `docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`'s
      "Naming and brand" section pointing forward:

```
> **Superseded 2026-08-14:** the name below ("Reps") collided with an existing same-category app.
> See `docs/superpowers/plans/2026-08-14-repzy-rebrand.md` for the current name ("Repzy") and the
> rebrand execution plan. The rest of this section's rationale (brand promise, palette) still holds.
```

- [ ] **Step 2:** Decide on `package.json` `name` fields — skip unless there's a concrete reason to
      touch them (e.g., they're about to be published or referenced by a monorepo tool).
- [ ] **Step 3:** Commit:

```bash
git add docs/superpowers/specs/2026-08-02-reps-platform-core-design.md
git commit -m "docs: mark Reps naming decision as superseded by Repzy"
```

---

### Task 7: Domain and infrastructure cutover (gated on Task 0)

**Do not start this task until Task 0 confirms the name is clear and a domain is purchased.**

**Files:**
- `frontend/public/robots.txt`, `frontend/public/sitemap.xml`, `frontend/scripts/generate-sitemap.mjs`
- `frontend/index.html` (`canonical`, `og:url`, `og:image`, `twitter:image`)
- `backend/src/services/email.ts`, `backend/src/services/retention.ts` (`APP_BASE_URL` default)
- Render service configuration (external to this repo — service name, env vars `APP_BASE_URL` /
  `SITE_BASE_URL`, custom domain + DNS)

- [ ] **Step 1:** Purchase the domain confirmed in Task 0 and point DNS at the existing Render
      deployment (or a renamed Render service — decide based on whether the `.onrender.com` fallback
      URL should keep working as a redirect).
- [ ] **Step 2:** Set `APP_BASE_URL` and `SITE_BASE_URL` env vars in the Render dashboard to the new
      domain. This is a deploy-config change outside the repo; do it in Render directly, not by
      hardcoding the new URL as the code default (keep the code defaults as they are, or point them at
      the new domain only if the old `.onrender.com` env var is being fully retired).
- [ ] **Step 3:** Update `frontend/index.html`'s `canonical`, `og:url`, `og:image`, `twitter:image` to
      the new domain.
- [ ] **Step 4:** Regenerate `sitemap.xml` via `generate-sitemap.mjs` against the new
      `SITE_BASE_URL`, and update `robots.txt`'s `Sitemap:` line to match.
- [ ] **Step 5:** If the old `langquiz.onrender.com` URL had any external backlinks or was indexed by
      search engines, set up a 301 redirect from old → new rather than leaving it to 404 or serve stale
      content.
- [ ] **Step 6:** Commit the repo-side changes:

```bash
git add frontend/public/robots.txt frontend/public/sitemap.xml frontend/index.html
git commit -m "chore: point SEO metadata and sitemap at the repzy domain"
```

---

## Sequencing and risk notes

- **Tasks 1–6 are independent of Task 0 and Task 7** — they're pure find-and-replace plus one
  storage-key fallback hop, safe to ship before a domain exists. Land them first.
- **Task 0 blocks Task 7 only.** Nothing about buying a domain blocks shipping the in-app rename.
- **No user gets signed out.** Task 1's three-tier fallback chain (`repzy.` → `reps.` → `langquiz.`)
  is the load-bearing piece of this whole plan — skipping it or collapsing it to two tiers would sign
  out anyone who hasn't opened the app since before the *first* rebrand attempt.
- **The "LangQuiz" strings in `storageKeys.ts` are not bugs.** They're intentionally-preserved legacy
  key literals for reading old data. Task 3's grep check explicitly excludes that file — don't "fix"
  it by deleting the legacy tier.
- **SEO copy still says "Learn Languages"** in several places (`index.html` title/description,
  `MarketingSite.tsx`) even after the LangQuiz→Repzy swap, because the underlying copy was written
  before the subject-neutral rewrite and was never updated. Task 4 flags this; fixing the positioning
  copy itself (not just the name) is a content decision, not this plan's call to make unilaterally.
- **Backend email copy affects a live retention flow** (`services/retention.ts` sends real emails to
  real users per the D1/D3/D7 cadence visible in that file). Renaming subject lines resets nothing
  functionally, but is worth a heads-up if anyone tracks open-rate baselines across the change.
