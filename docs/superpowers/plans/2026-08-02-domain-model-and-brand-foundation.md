# Domain Model Foundation & Brand Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce the subject-neutral deck/facet domain types alongside the existing app (no
breaking changes to the running product), and rename storage keys from `langquiz.` to `reps.` with
a legacy-read fallback so no user is signed out. This is Plan 1 of the Reps platform rewrite
described in `docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`; it stands alone and
produces working, tested software without touching the backend, the UI, or the 43 existing exercise
files.

**Architecture:** Add new types in `frontend/src/types/deck.ts` and a pure mapping function in
`frontend/src/lib/legacyExerciseMapper.ts` that converts today's `Exercise` shape into the new
`DeckExercise` shape, purely additive and unit-tested. Separately, consolidate the six duplicated
`TOKEN_STORAGE_KEY` literals and the three other `langquiz.`-prefixed keys into one module,
`frontend/src/lib/storageKeys.ts`, with a fallback reader so existing `localStorage` values under the
old prefix keep working.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7. No test runner exists yet — this plan adds Vitest.

**Plan sequence (this repo will need more plans after this one):**
1. **This plan** — domain types, legacy mapper, storage-key rebrand, test infrastructure.
2. Backend: `decks` and `exercises` Postgres tables, deck CRUD API, seed migration importing the 43
   exercise files as a deck.
3. Frontend IA rewrite: Library / My decks / Progress / Admin navigation, deck detail screen,
   `TopicFilter` driven by `facetDefinitions`.
4. Exam mode: exam screen, `examConfig`-driven question selection, scoring, SM-2 exclusion.
5. Deck-scoped progress dashboard.
6. Einbürgerungstest import (separate spec — sourcing image assets and English translations is
   content work, not covered by any code plan).

---

### Task 1: Add Vitest

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/vitest.config.ts`

- [ ] **Step 1: Install Vitest and jsdom**

Run: `cd frontend && npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom`

Expected: packages added to `devDependencies` in `frontend/package.json`.

- [ ] **Step 2: Add a Vitest config**

Create `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

- [ ] **Step 3: Add test scripts**

In `frontend/package.json`, inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner works with a throwaway test**

Create `frontend/src/lib/__smoke.test.ts` temporarily:

```ts
import { expect, test } from 'vitest'

test('vitest is wired up', () => {
  expect(1 + 1).toBe(2)
})
```

Run: `cd frontend && npm test`
Expected: `1 passed`

Delete `frontend/src/lib/__smoke.test.ts` after confirming — it was only to verify wiring.

- [ ] **Step 5: Commit**

```bash
cd ~/projects/langquiz
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.ts
git commit -m "chore: add Vitest test runner to frontend"
```

---

### Task 2: Storage key consolidation module

**Files:**
- Create: `frontend/src/lib/storageKeys.ts`
- Test: `frontend/src/lib/storageKeys.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/storageKeys.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { AUTH_TOKEN_KEY, PROGRESS_UPDATED_EVENT, readWithLegacyFallback } from './storageKeys'

describe('storage key constants', () => {
  test('AUTH_TOKEN_KEY uses the reps prefix', () => {
    expect(AUTH_TOKEN_KEY).toBe('reps.auth-token')
  })

  test('PROGRESS_UPDATED_EVENT uses the reps prefix', () => {
    expect(PROGRESS_UPDATED_EVENT).toBe('reps:progress-updated')
  })
})

describe('readWithLegacyFallback', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  test('reads the new key when present', () => {
    localStorage.setItem('reps.auth-token', 'new-value')
    localStorage.setItem('langquiz.auth-token', 'old-value')

    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBe('new-value')
  })

  test('falls back to the legacy key when the new key is absent', () => {
    localStorage.setItem('langquiz.auth-token', 'old-value')

    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBe('old-value')
  })

  test('returns null when neither key is present', () => {
    expect(readWithLegacyFallback('reps.auth-token', 'langquiz.auth-token')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- storageKeys`
Expected: FAIL — `storageKeys.ts` does not exist yet.

- [ ] **Step 3: Implement the module**

Create `frontend/src/lib/storageKeys.ts`:

```ts
/**
 * Storage keys moved from the `langquiz.` prefix to `reps.` as part of the
 * rebrand. `readWithLegacyFallback` lets existing sessions keep working
 * until they naturally re-write the value under the new key.
 */

export const AUTH_TOKEN_KEY = 'reps.auth-token'
export const LEGACY_AUTH_TOKEN_KEY = 'langquiz.auth-token'

export const CUSTOM_EXERCISES_KEY = 'reps.custom-exercises.v1'
export const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'

export const ANALYTICS_DAY7_KEY = 'reps.analytics.day7.last-fired'
export const LEGACY_ANALYTICS_DAY7_KEY = 'langquiz.analytics.day7.last-fired'

export const UTM_FIRST_TOUCH_KEY = 'reps.utm.first-touch.v1'
export const LEGACY_UTM_FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'

export const PROGRESS_UPDATED_EVENT = 'reps:progress-updated'

export function readWithLegacyFallback(key: string, legacyKey: string): string | null {
  const current = localStorage.getItem(key)
  if (current !== null) return current
  return localStorage.getItem(legacyKey)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- storageKeys`
Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/storageKeys.ts frontend/src/lib/storageKeys.test.ts
git commit -m "feat: add reps.-prefixed storage keys with legacy fallback"
```

---

### Task 3: Wire storage keys into auth (token key)

**Files:**
- Modify: `frontend/src/auth/AuthContext.tsx`
- Modify: `frontend/src/api/adminApi.ts`
- Modify: `frontend/src/api/exercisesApi.ts`
- Modify: `frontend/src/api/progressApi.ts`
- Modify: `frontend/src/api/retentionApi.ts`
- Modify: `frontend/src/api/userExercisesApi.ts`

This task has no new test: the six files call `localStorage.getItem(TOKEN_STORAGE_KEY)` directly,
and Task 2's test already covers `readWithLegacyFallback`. Each edit here is a mechanical swap
verified by the existing test suite plus a manual login check in Task 3 Step 8.

- [ ] **Step 1: Update `AuthContext.tsx`**

In `frontend/src/auth/AuthContext.tsx`, replace:

```ts
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'
const LEGACY_CUSTOM_EXERCISES_KEY = 'langquiz.custom-exercises.v1'
```

with:

```ts
import {
  AUTH_TOKEN_KEY,
  LEGACY_AUTH_TOKEN_KEY,
  CUSTOM_EXERCISES_KEY,
  LEGACY_CUSTOM_EXERCISES_KEY,
  readWithLegacyFallback,
} from '../lib/storageKeys'
```

(add this import alongside the existing imports at the top of the file; note `CUSTOM_EXERCISES_KEY`
and `LEGACY_CUSTOM_EXERCISES_KEY` now come from `storageKeys.ts` instead of being declared locally).

Then replace every `localStorage.getItem(TOKEN_STORAGE_KEY)` with
`readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)`, every
`localStorage.setItem(TOKEN_STORAGE_KEY, ...)` with `localStorage.setItem(AUTH_TOKEN_KEY, ...)`, and
every `localStorage.removeItem(TOKEN_STORAGE_KEY)` with
`localStorage.removeItem(AUTH_TOKEN_KEY); localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)` (clear
both on explicit logout, so a signed-out user is fully signed out under both keys).

The existing `localStorage.getItem(LEGACY_CUSTOM_EXERCISES_KEY)` read (guest-exercise migration
code, around line 63) already reads the old-prefix key by design — that code path is *for* migrating
old data, so it keeps pointing at the `langquiz.`-prefixed constant unchanged. Only the declaration
moves from a local `const` to the shared import.

- [ ] **Step 2: Update `adminApi.ts`**

In `frontend/src/api/adminApi.ts`, replace:

```ts
const TOKEN_STORAGE_KEY = 'langquiz.auth-token'
```

with:

```ts
import { AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY, readWithLegacyFallback } from '../lib/storageKeys'
```

and replace `localStorage.getItem(TOKEN_STORAGE_KEY)` with
`readWithLegacyFallback(AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY)`.

- [ ] **Step 3: Repeat Step 2's pattern for the remaining four API files**

Apply the identical replacement (delete the local `TOKEN_STORAGE_KEY` constant, import
`AUTH_TOKEN_KEY`, `LEGACY_AUTH_TOKEN_KEY`, `readWithLegacyFallback` from `../lib/storageKeys`, swap
the `localStorage.getItem` call) in:
- `frontend/src/api/exercisesApi.ts`
- `frontend/src/api/progressApi.ts`
- `frontend/src/api/retentionApi.ts`
- `frontend/src/api/userExercisesApi.ts`

- [ ] **Step 4: Update the analytics day-7 key**

In `frontend/src/analytics/client.ts`, replace:

```ts
const LAST_DAY7_KEY = 'langquiz.analytics.day7.last-fired'
```

with:

```ts
import { ANALYTICS_DAY7_KEY, LEGACY_ANALYTICS_DAY7_KEY, readWithLegacyFallback } from '../lib/storageKeys'
```

and replace every use of `LAST_DAY7_KEY` for reads with
`readWithLegacyFallback(ANALYTICS_DAY7_KEY, LEGACY_ANALYTICS_DAY7_KEY)` and for writes with
`ANALYTICS_DAY7_KEY`.

- [ ] **Step 5: Update the UTM first-touch key**

In `frontend/src/analytics/utm.ts`, replace:

```ts
const FIRST_TOUCH_KEY = 'langquiz.utm.first-touch.v1'
```

with:

```ts
import { UTM_FIRST_TOUCH_KEY, LEGACY_UTM_FIRST_TOUCH_KEY, readWithLegacyFallback } from './storageKeys'
```

and apply the same read-fallback / write-new-key pattern as Step 4.

- [ ] **Step 6: Update the progress-updated event name**

In `frontend/src/hooks/useProgress.ts`, replace:

```ts
export const PROGRESS_UPDATED_EVENT = 'langquiz:progress-updated'
```

with:

```ts
export { PROGRESS_UPDATED_EVENT } from '../lib/storageKeys'
```

This is an internal `window.dispatchEvent`/`addEventListener` name, not persisted data, so no legacy
fallback is needed — just re-export the new constant from its single source of truth.

- [ ] **Step 7: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors. If any file still imports the deleted local constants, fix the import.

- [ ] **Step 8: Manual verification**

Run: `cd frontend && npm run dev` (and separately `cd backend && npm run dev` if not already running)
In a browser, log in, confirm `localStorage` has a `reps.auth-token` entry (DevTools → Application →
Local Storage), reload the page, confirm the session persists, then log out and confirm both
`reps.auth-token` and `langquiz.auth-token` are removed.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/auth/AuthContext.tsx frontend/src/api/adminApi.ts frontend/src/api/exercisesApi.ts frontend/src/api/progressApi.ts frontend/src/api/retentionApi.ts frontend/src/api/userExercisesApi.ts frontend/src/analytics/client.ts frontend/src/analytics/utm.ts frontend/src/hooks/useProgress.ts
git commit -m "refactor: migrate storage keys to reps. prefix with legacy fallback"
```

---

### Task 4: Deck and facet domain types

**Files:**
- Create: `frontend/src/types/deck.ts`
- Test: `frontend/src/types/deck.test.ts`

These are pure type definitions plus one small runtime helper (`isStudyMode`), so the test only
covers the runtime helper — TypeScript's compiler is the check for the types themselves (Task 4
Step 4).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/types/deck.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { isStudyMode } from './deck'

describe('isStudyMode', () => {
  test('accepts practice and exam', () => {
    expect(isStudyMode('practice')).toBe(true)
    expect(isStudyMode('exam')).toBe(true)
  })

  test('rejects anything else', () => {
    expect(isStudyMode('quiz')).toBe(false)
    expect(isStudyMode('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- deck.test`
Expected: FAIL — `frontend/src/types/deck.ts` does not exist yet.

- [ ] **Step 3: Implement the types**

Create `frontend/src/types/deck.ts`:

```ts
export type StudyMode = 'practice' | 'exam'

const STUDY_MODES: readonly StudyMode[] = ['practice', 'exam']

export function isStudyMode(value: string): value is StudyMode {
  return (STUDY_MODES as readonly string[]).includes(value)
}

export type LocaleCode = string // e.g. 'ru', 'en'

export type DeckOrigin = 'official' | 'community'

export interface FacetDefinition {
  key: string // e.g. 'level'
  label: string // e.g. 'CEFR level'
  values: string[] // e.g. ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
}

export interface FacetQuota {
  facetKey: string
  facetValue: string
  count: number
}

export interface ExamConfig {
  questionCount: number
  passingScore: number
  quotas: FacetQuota[]
  timeLimitMinutes?: number
}

export type AnswerRuleId = 'german-articles'

export interface Deck {
  id: string
  slug: string
  title: string
  description: string
  origin: DeckOrigin
  ownerId?: string
  studyModes: StudyMode[]
  facetDefinitions: FacetDefinition[]
  locales: LocaleCode[]
  examConfig?: ExamConfig
  answerRules?: AnswerRuleId
}

export interface QuestionMedia {
  kind: 'image'
  url: string | null // null when only a text description is available
  alt: string
  attribution?: string
}

export interface ExerciseTranslation {
  prompt: string
  options?: string[]
  explanation?: string
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- deck.test`
Expected: `2 passed`

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/deck.ts frontend/src/types/deck.test.ts
git commit -m "feat: add Deck, FacetDefinition, and ExamConfig domain types"
```

---

### Task 5: DeckExercise type and legacy mapper

**Files:**
- Modify: `frontend/src/types/exercise.ts`
- Create: `frontend/src/lib/legacyExerciseMapper.ts`
- Test: `frontend/src/lib/legacyExerciseMapper.test.ts`

The 43 files in `frontend/src/exercises/` keep their current shape and keep working through
`exerciseRegistry` unchanged — this task does not touch them. `legacyExerciseMapper.ts` is a pure
function, exercised only by its own test, that Plan 2 will call from the seed-migration script when
moving this content into Postgres.

- [ ] **Step 1: Add the new exported type alongside the existing ones**

In `frontend/src/types/exercise.ts`, add at the end of the file (after the existing
`normalizeExerciseMetadata` function — do not remove or modify anything already in the file):

```ts
import type { ExerciseTranslation, LocaleCode, QuestionMedia } from './deck'

export interface DeckExercise {
  id: string
  deckId: string
  type: ExerciseType
  prompt: string
  context?: string
  hint?: string
  reference?: string
  explanation?: string
  media?: QuestionMedia
  difficulty: 1 | 2 | 3 | 4 | 5
  facets: Record<string, string>
  tags?: string[]
  translations?: Record<LocaleCode, ExerciseTranslation>
  isUserAdded?: boolean
  shareStatus?: ExerciseShareStatus
  voteCount?: number
}

export interface DeckSelectionExercise extends DeckExercise {
  type: 'selection'
  options: string[]
  answer: number
}

export interface DeckMultiSelectExercise extends DeckExercise {
  type: 'multiselect'
  options: string[]
  answers: number[]
}

export interface DeckFreeTypeExercise extends DeckExercise {
  type: 'free-type'
  answers: string[]
  caseSensitive?: boolean
}

export type AnyDeckExercise = DeckSelectionExercise | DeckMultiSelectExercise | DeckFreeTypeExercise
```

- [ ] **Step 2: Write the failing test**

Create `frontend/src/lib/legacyExerciseMapper.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import type { Exercise, SelectionExercise } from '../types/exercise'
import { toDeckExercise } from './legacyExerciseMapper'

const baseLegacy: SelectionExercise = {
  id: 'de-grammar-articles-der-001',
  type: 'selection',
  topic: 'grammar',
  subtopic: 'articles',
  language: 'de',
  difficulty: 1,
  level: 'A1',
  group: 'grammar',
  prompt: 'Which article is correct for "Hund" (dog)?',
  context: '___ Hund ist groß.',
  options: ['der', 'die', 'das', 'den'],
  answer: 0,
  explanation: '"Hund" is masculine in German, so it uses "der" in the nominative case.',
  grammarNote: 'Masculine nouns take "der" in the nominative case.',
  tags: ['articles', 'nominative', 'masculine'],
}

describe('toDeckExercise', () => {
  test('maps topic/subtopic/language/level/group into facets', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.facets).toEqual({
      topic: 'grammar',
      subtopic: 'articles',
      language: 'de',
      level: 'A1',
      group: 'grammar',
    })
  })

  test('maps grammarNote to reference', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.reference).toBe('Masculine nouns take "der" in the nominative case.')
  })

  test('carries deckId, id, difficulty, prompt, context, explanation, tags unchanged', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.deckId).toBe('deck-de-grammar')
    expect(result.id).toBe('de-grammar-articles-der-001')
    expect(result.difficulty).toBe(1)
    expect(result.prompt).toBe(baseLegacy.prompt)
    expect(result.context).toBe(baseLegacy.context)
    expect(result.explanation).toBe(baseLegacy.explanation)
    expect(result.tags).toEqual(baseLegacy.tags)
  })

  test('omits level and group facets when the legacy exercise has neither', () => {
    const legacy: Exercise = {
      ...baseLegacy,
      level: undefined,
      group: undefined,
    }

    const result = toDeckExercise(legacy, 'deck-de-grammar')

    expect(result.facets.level).toBeUndefined()
    expect(result.facets.group).toBeUndefined()
    expect(result.facets.topic).toBe('grammar')
  })

  test('selection exercises keep options and answer', () => {
    const result = toDeckExercise(baseLegacy, 'deck-de-grammar')

    expect(result.type).toBe('selection')
    if (result.type === 'selection') {
      expect(result.options).toEqual(baseLegacy.options)
      expect(result.answer).toBe(baseLegacy.answer)
    }
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd frontend && npm test -- legacyExerciseMapper`
Expected: FAIL — `legacyExerciseMapper.ts` does not exist yet.

- [ ] **Step 4: Implement the mapper**

Create `frontend/src/lib/legacyExerciseMapper.ts`:

```ts
import type { AnyDeckExercise, Exercise } from '../types/exercise'

/**
 * Converts a bundle-authored `Exercise` (the shape used by the 43 files in
 * `src/exercises/`) into the deck-aware `AnyDeckExercise` shape. Used by the
 * Plan 2 seed migration to load this content into Postgres as a deck.
 */
export function toDeckExercise(legacy: Exercise, deckId: string): AnyDeckExercise {
  const facets: Record<string, string> = {
    topic: legacy.topic,
    subtopic: legacy.subtopic,
    language: legacy.language,
  }
  if (legacy.level) facets.level = legacy.level
  if (legacy.group) facets.group = legacy.group

  const shared = {
    id: legacy.id,
    deckId,
    difficulty: legacy.difficulty,
    prompt: legacy.prompt,
    context: legacy.context,
    hint: legacy.hint,
    reference: legacy.grammarNote,
    explanation: legacy.explanation,
    facets,
    tags: legacy.tags,
    isUserAdded: legacy.isUserAdded,
    shareStatus: legacy.shareStatus,
    voteCount: legacy.voteCount,
  }

  switch (legacy.type) {
    case 'selection':
      return { ...shared, type: 'selection', options: legacy.options, answer: legacy.answer }
    case 'multiselect':
      return { ...shared, type: 'multiselect', options: legacy.options, answers: legacy.answers }
    case 'free-type':
      return {
        ...shared,
        type: 'free-type',
        answers: legacy.answers,
        caseSensitive: legacy.caseSensitive,
      }
    default: {
      const exhaustive: never = legacy
      throw new Error(`Unhandled exercise type: ${(exhaustive as Exercise).type}`)
    }
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd frontend && npm test -- legacyExerciseMapper`
Expected: `5 passed`

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/exercise.ts frontend/src/lib/legacyExerciseMapper.ts frontend/src/lib/legacyExerciseMapper.test.ts
git commit -m "feat: add DeckExercise type and legacy exercise mapper"
```

---

### Task 6: Wire tests into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Read the current frontend CI job**

Run: `cat .github/workflows/ci.yml`

Confirm the `frontend` job currently runs `npm run lint` with `continue-on-error: true` followed by
`npm run build`, and has no test step. (This was already noted as a risk in the design spec.)

- [ ] **Step 2: Add a test step and stop swallowing lint failures**

In `.github/workflows/ci.yml`, in the `frontend` job, change:

```yaml
      - run: npm ci
      - run: npm run lint
        continue-on-error: true
      - run: npm run build
```

to:

```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 3: Verify locally that lint currently passes**

Run: `cd frontend && npm run lint`
Expected: no errors. If there are pre-existing lint errors, fix them before removing
`continue-on-error` — do not merge a CI change that immediately goes red on unrelated pre-existing
issues. (If fixing pre-existing lint errors turns out to be nontrivial, stop and flag it rather than
silently reintroducing `continue-on-error: true`.)

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run frontend tests and stop ignoring lint failures"
```

---

## Self-Review Notes

- **Spec coverage:** This plan covers the "Naming and brand" storage-key migration and the
  "Domain model" type definitions from the spec. It does **not** cover content storage (Postgres),
  information architecture, exam mode, or the Einbürgerungstest import — those are Plans 2–6, listed
  in the header, and require their own plan documents once this one lands (each touches
  substantially more surface: new backend routes, a DB migration, and a navigation rewrite).
- **No placeholders:** every step has complete, runnable code.
- **Type consistency:** `AnyDeckExercise`, `toDeckExercise`, `Deck`, `FacetDefinition`, `ExamConfig`,
  `StudyMode` are named identically to their first definition everywhere they are reused across
  Tasks 4–5.
