# Einbürgerungstest Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the Einbürgerungstest (German citizenship test) question bank as a real, working
deck — the first deck whose `examConfig.quotas` has meaningful facet data to actually select
against. This is Plan 8, the last plan of the Reps platform rewrite (see
`docs/superpowers/specs/2026-08-02-reps-platform-core-design.md` and this plan's own design spec
`docs/superpowers/specs/2026-08-06-einburgertest-import-design.md`); Plans 1–7 are merged to
`master`.

**Architecture:** A vendored, checked-in JSON snapshot of the source content
(`backend/data/einburgertest-demo-catalog.json`) is read by a standalone, idempotent import script
(`backend/scripts/import-einburgertest.ts`, run via `tsx`, not a numbered migration) that upserts one
`decks` row and 310 `exercises` rows directly via SQL. Two small, real code changes make the rest of
the app actually work with this content: `toDeckExercise()` gains a generic `facets` passthrough so
exam-mode quota matching (`facetKey: 'scope'`) can find these questions at all, and the legacy Home
screen gets a one-line exclusion filter so citizenship-exam trivia doesn't get mixed into German
grammar practice sessions.

**Tech Stack:** TypeScript, `tsx` (already a backend devDependency), Postgres (`pg`), Vitest
(frontend and backend) — all already in place from Plans 1–7.

**Non-goals (explicitly deferred, per the design spec):**
- Any UI for displaying `translations`/`media` — stored only, not rendered.
- Sourcing real image assets for the 13 image-referencing questions — imported as-is.
- Redesigning the legacy Home screen beyond the one exclusion filter.
- English content authoring.

---

### Task 1: Vendor the source content snapshot

**Files:**
- Create: `backend/data/einburgertest-demo-catalog.json`

- [ ] **Step 1: Copy the source file**

```bash
mkdir -p /Users/oledjo/Projects/langquiz/backend/data
cp /Users/oledjo/Projects/einburgertest/src/demo/demo-catalog.generated.json /Users/oledjo/Projects/langquiz/backend/data/einburgertest-demo-catalog.json
```

- [ ] **Step 2: Verify the copy is valid JSON with the expected shape**

```bash
cd /Users/oledjo/Projects/langquiz/backend
node -e "
const data = require('./data/einburgertest-demo-catalog.json');
console.log('total:', data.length);
console.log('general:', data.filter(q => q.scope === 'general').length);
console.log('bavaria:', data.filter(q => q.scope === 'bavaria').length);
"
```

Expected output:
```
total: 310
general: 300
bavaria: 10
```

- [ ] **Step 3: Commit**

```bash
cd ~/Projects/langquiz
git add backend/data/einburgertest-demo-catalog.json
git commit -m "chore: vendor Einbürgerungstest source content snapshot"
```

---

### Task 2: Extend `Exercise`'s type with `facets`, `translations`, `media`, `deckId`

**Files:**
- Modify: `frontend/src/types/exercise.ts`

- [ ] **Step 1: Read the current file**

Read `frontend/src/types/exercise.ts` in full to confirm `BaseExercise`'s current shape matches what's
assumed below (it should — nothing has touched this file since Plan 1).

- [ ] **Step 2: Add the four optional fields**

Find:

```ts
export interface BaseExercise {
  id: string
  type: ExerciseType
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  level?: ExerciseLevel
  group?: ExerciseGroup
  prompt: string
  context?: string
  hint?: string
  grammarNote?: string
  explanation?: string
  tags?: string[]
  isUserAdded?: boolean
  shareStatus?: ExerciseShareStatus
  voteCount?: number
  userVoted?: boolean
  adminRecordId?: number
}
```

Replace with:

```ts
export interface BaseExercise {
  id: string
  type: ExerciseType
  topic: string
  subtopic: string
  language: string
  difficulty: 1 | 2 | 3 | 4 | 5
  level?: ExerciseLevel
  group?: ExerciseGroup
  prompt: string
  context?: string
  hint?: string
  grammarNote?: string
  explanation?: string
  tags?: string[]
  isUserAdded?: boolean
  shareStatus?: ExerciseShareStatus
  voteCount?: number
  userVoted?: boolean
  adminRecordId?: number
  // Generic facet bag for decks whose exam quotas need to match on something beyond
  // topic/subtopic/language/level/group (e.g. Einbürgerungstest's `scope`). Merged into
  // toDeckExercise()'s derived facets — see frontend/src/lib/legacyExerciseMapper.ts.
  facets?: Record<string, string>
  // Stored for a future UI plan to render — no current component displays either field.
  translations?: Record<LocaleCode, ExerciseTranslation>
  media?: QuestionMedia
  // Present only when this exercise was fetched from the backend API (which knows which
  // deck it belongs to); absent for built-in bundled exercises constructed client-side.
  deckId?: string
}
```

The file's top import line already includes `ExerciseTranslation`, `LocaleCode`, `QuestionMedia`
from `./deck` (used elsewhere in this same file by `DeckExercise`), so no import changes are needed.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/langquiz
git add frontend/src/types/exercise.ts
git commit -m "feat: add facets, translations, media, deckId to BaseExercise"
```

---

### Task 3: `toDeckExercise()` merges the new `facets` field

**Files:**
- Modify: `frontend/src/lib/legacyExerciseMapper.ts`
- Modify: `frontend/src/lib/legacyExerciseMapper.test.ts` (existing file — append tests, don't
  rewrite it)

- [ ] **Step 1: Write the failing tests**

Read `frontend/src/lib/legacyExerciseMapper.test.ts` in full first — it already exists with 7 tests
from Plan 1, including one ("maps topic/subtopic/language/level/group into facets") that already
covers the no-`facets`-field case, so no separate "unchanged" test is needed here. Append one new
test inside the existing `describe('toDeckExercise', ...)` block (after the last test, before the
closing `})`):

```ts
  test('merges a legacy exercise\'s facets into the derived facets', () => {
    const legacy: Exercise = {
      ...baseLegacy,
      facets: { scope: 'general' },
    }

    const result = toDeckExercise(legacy, 'deck-einbuergerungstest')

    expect(result.facets).toEqual({
      topic: 'grammar',
      subtopic: 'articles',
      language: 'de',
      level: 'A1',
      group: 'grammar',
      scope: 'general',
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- legacyExerciseMapper`
Expected: FAIL — the `scope` key is missing from `result.facets`, since `toDeckExercise` doesn't read
`legacy.facets` yet.

- [ ] **Step 3: Merge `legacy.facets` into the derived facets object**

In `frontend/src/lib/legacyExerciseMapper.ts`, find:

```ts
export function toDeckExercise(legacy: Exercise, deckId: string): AnyDeckExercise {
  const facets: Record<string, string> = {
    topic: legacy.topic,
    subtopic: legacy.subtopic,
    language: legacy.language,
  }
  if (legacy.level) facets.level = legacy.level
  if (legacy.group) facets.group = legacy.group
```

Replace with:

```ts
export function toDeckExercise(legacy: Exercise, deckId: string): AnyDeckExercise {
  const facets: Record<string, string> = {
    topic: legacy.topic,
    subtopic: legacy.subtopic,
    language: legacy.language,
  }
  if (legacy.level) facets.level = legacy.level
  if (legacy.group) facets.group = legacy.group
  if (legacy.facets) Object.assign(facets, legacy.facets)
```

Nothing else in this function changes — the `shared` object construction and the `switch` on
`legacy.type` below are unaffected.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd frontend && npm test -- legacyExerciseMapper`
Expected: `8 passed` (7 existing + 1 new).

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
cd ~/Projects/langquiz
git add frontend/src/lib/legacyExerciseMapper.ts frontend/src/lib/legacyExerciseMapper.test.ts
git commit -m "feat: toDeckExercise merges a legacy exercise's own facets"
```

---

### Task 4: Backend — expose `deckId` on `GET /api/exercises`

**Files:**
- Modify: `backend/src/routes/exercises.ts`

- [ ] **Step 1: Read the current file**

Read `backend/src/routes/exercises.ts` in full to confirm the current shape of the `GET /` handler's
response-mapping code matches what's assumed below.

- [ ] **Step 2: Add `deckId` to both response branches**

Find:

```ts
    const combined = [
      ...globalResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          vote_count: number
          user_voted: boolean
        }) => ({
        ...row.data,
        isUserAdded: false,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
      ...userResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          share_status: string
          vote_count: number
          user_voted: boolean
        }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
    ]
```

Replace with:

```ts
    const combined = [
      ...globalResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          vote_count: number
          user_voted: boolean
          deck_id: number | null
        }) => ({
        ...row.data,
        isUserAdded: false,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(row.deck_id !== null ? { deckId: String(row.deck_id) } : {}),
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
      ...userResult.rows.map(
        (row: {
          id: number
          data: Record<string, unknown>
          share_status: string
          vote_count: number
          user_voted: boolean
          deck_id: number | null
        }) => ({
        ...row.data,
        isUserAdded: true,
        shareStatus: row.share_status,
        voteCount: row.vote_count,
        userVoted: row.user_voted,
        ...(row.deck_id !== null ? { deckId: String(row.deck_id) } : {}),
        ...(req.userRole === 'admin' ? { adminRecordId: row.id } : {}),
      })
      ),
    ]
```

Now find each of the four `SELECT` queries earlier in the same handler (two for `globalResult` —
with-votes-table and without — and two for `userResult`) and add `e.deck_id`/`ue.deck_id` to their
column lists. Find:

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
```

Replace with:

```ts
    const globalResult = hasVotesTable
      ? await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             e.deck_id,
             COALESCE(v.vote_count, 0)::INT AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM exercises e
```

Find:

```ts
      : await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM exercises e
```

Replace with:

```ts
      : await db.query(
          `SELECT
             e.id,
             e.exercise_id,
             e.data,
             e.deck_id,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM exercises e
```

Find:

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
```

Replace with:

```ts
    const userResult = hasVotesTable
      ? await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             ue.deck_id,
             COALESCE(v.vote_count, 0) AS vote_count,
             (uv.exercise_id IS NOT NULL) AS user_voted
           FROM user_exercises ue
```

Find:

```ts
      : await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM user_exercises ue
```

Replace with:

```ts
      : await db.query(
          `SELECT
             ue.id,
             ue.exercise_id,
             ue.data,
             ue.share_status,
             ue.deck_id,
             0::INT AS vote_count,
             FALSE AS user_voted
           FROM user_exercises ue
```

Nothing else in this file changes — the `WHERE`/`ORDER BY` clauses, the `deckId` query-param
filtering already added in earlier plans, the vote/bootstrap endpoints below, are all untouched.

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/langquiz
git add backend/src/routes/exercises.ts
git commit -m "feat: expose deckId on GET /api/exercises responses"
```

---

### Task 5: Exclude non-grammar-deck exercises from the legacy Home screen

**Files:**
- Create: `frontend/src/lib/filterExercisesByDeck.ts`
- Test: `frontend/src/lib/filterExercisesByDeck.test.ts`
- Modify: `frontend/src/App.tsx`

**Why a separate pure function instead of inlining the filter in `App.tsx`:** `App.tsx`'s `MainApp`
component has no existing test coverage (confirmed — the only test file touching this area,
`App.routing.test.tsx`, tests a synthetic nav-tab fixture, not real `MainApp` behavior). Extracting
the filter logic into its own small, pure, directly-testable function avoids either adding untested
logic to an untested 1200+ line component, or taking on a much larger task of scaffolding tests for
`MainApp` itself (out of scope here).

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/filterExercisesByDeck.test.ts`:

```ts
import { describe, expect, test } from 'vitest'
import { filterExercisesByDeck } from './filterExercisesByDeck'
import type { SelectionExercise } from '../types/exercise'

function makeExercise(overrides: Partial<SelectionExercise>): SelectionExercise {
  return {
    id: 'ex-1',
    type: 'selection',
    topic: 'articles',
    subtopic: 'der',
    language: 'de',
    difficulty: 1,
    prompt: 'p',
    options: ['a', 'b'],
    answer: 0,
    ...overrides,
  }
}

describe('filterExercisesByDeck', () => {
  test('keeps exercises whose deckId matches the allowed deck', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '1' })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual(exercises)
  })

  test('drops exercises whose deckId does not match the allowed deck', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '2' })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual([])
  })

  test('keeps exercises with no deckId at all', () => {
    const exercises = [makeExercise({ id: 'a', deckId: undefined })]

    expect(filterExercisesByDeck(exercises, '1')).toEqual(exercises)
  })

  test('keeps everything when allowedDeckId is undefined', () => {
    const exercises = [makeExercise({ id: 'a', deckId: '2' }), makeExercise({ id: 'b', deckId: undefined })]

    expect(filterExercisesByDeck(exercises, undefined)).toEqual(exercises)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- filterExercisesByDeck`
Expected: FAIL — `filterExercisesByDeck.ts` does not exist yet.

- [ ] **Step 3: Implement the helper**

Create `frontend/src/lib/filterExercisesByDeck.ts`:

```ts
import type { Exercise } from '../types/exercise'

/**
 * Keeps an exercise only if it has no deckId (not yet deck-scoped) or its deckId matches
 * `allowedDeckId`. Passing `undefined` for `allowedDeckId` keeps everything unfiltered — used
 * by the legacy Home screen before the grammar deck's id has resolved.
 */
export function filterExercisesByDeck(exercises: Exercise[], allowedDeckId: string | undefined): Exercise[] {
  if (!allowedDeckId) return exercises
  return exercises.filter((exercise) => !exercise.deckId || exercise.deckId === allowedDeckId)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npm test -- filterExercisesByDeck`
Expected: `4 passed`

- [ ] **Step 5: Wire the filter into `MainApp`**

In `frontend/src/App.tsx`, find the import block:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { ExamSessionPage } from './pages/ExamSessionPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudySessionPage } from './pages/StudySessionPage'
```

Replace with:

```tsx
import { DeckDetailPage } from './pages/DeckDetailPage'
import { ExamSessionPage } from './pages/ExamSessionPage'
import { LibraryPage } from './pages/LibraryPage'
import { ProgressPage } from './pages/ProgressPage'
import { StudySessionPage } from './pages/StudySessionPage'
import { filterExercisesByDeck } from './lib/filterExercisesByDeck'
import { useDecks } from './hooks/useDecks'
```

Find:

```tsx
  const { exercises: dbExercises, reload: reloadExercises } = useExercises()
```

Replace with:

```tsx
  const { exercises: dbExercises, reload: reloadExercises } = useExercises()
  const { decks } = useDecks()
```

Find:

```tsx
  const allExercises = useMemo(() => dbExercises, [dbExercises])
```

Replace with:

```tsx
  // The Home screen predates the deck system and has no deck-selection UI of its own — it
  // always practices from the original bundled German grammar/vocabulary content. Without this
  // filter, importing any other deck (e.g. Einbürgerungstest) would silently mix unrelated
  // content into Home's random practice sessions.
  const grammarDeckId = useMemo(
    () => decks.find((deck) => deck.slug === 'german-grammar-vocabulary')?.id,
    [decks]
  )
  const allExercises = useMemo(
    () => filterExercisesByDeck(dbExercises, grammarDeckId),
    [dbExercises, grammarDeckId]
  )
```

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Lint**

Run: `cd frontend && npm run lint`
Expected: 0 errors.

- [ ] **Step 8: Run the full frontend test suite**

Run: `cd frontend && npm test`
Expected: all existing tests still pass, plus the 4 new `filterExercisesByDeck` tests and the 1 new
`legacyExerciseMapper` test from Task 3.

- [ ] **Step 9: Commit**

```bash
cd ~/Projects/langquiz
git add frontend/src/lib/filterExercisesByDeck.ts frontend/src/lib/filterExercisesByDeck.test.ts frontend/src/App.tsx
git commit -m "feat: exclude non-grammar-deck exercises from the legacy Home screen"
```

---

### Task 6: Backend — the question mapping function

**Files:**
- Create: `backend/scripts/mapEinburgertestQuestion.ts`
- Test: `backend/scripts/mapEinburgertestQuestion.test.ts`

- [ ] **Step 1: Write the failing test**

Create `backend/scripts/mapEinburgertestQuestion.test.ts`:

```ts
import fs from 'fs'
import path from 'path'
import { describe, expect, test } from 'vitest'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from './mapEinburgertestQuestion'

const dataPath = path.resolve(__dirname, '../data/einburgertest-demo-catalog.json')
const questions: EinburgertestQuestion[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

describe('vendored content snapshot', () => {
  test('has 310 questions: 300 general, 10 bavaria', () => {
    expect(questions).toHaveLength(310)
    expect(questions.filter((q) => q.scope === 'general')).toHaveLength(300)
    expect(questions.filter((q) => q.scope === 'bavaria')).toHaveLength(10)
  })
})

describe('mapEinburgertestQuestion', () => {
  test('maps a general question with no image', () => {
    const question = questions.find((q) => q.scope === 'general' && !q.image)
    if (!question) throw new Error('fixture assumption failed: expected a general question with no image')

    const result = mapEinburgertestQuestion(question)

    expect(result.id).toBe(question.id)
    expect(result.type).toBe('selection')
    expect(result.topic).toBe('einbuergerungstest')
    expect(result.subtopic).toBe('general')
    expect(result.language).toBe('de')
    expect(result.difficulty).toBe(3)
    expect(result.prompt).toBe(question.promptDe)
    expect(result.options).toEqual(question.answersDe)
    expect(result.answer).toBe(question.correctAnswerIndex)
    expect(result.explanation).toBe(question.explanationRu)
    expect(result.facets).toEqual({ scope: 'general' })
    expect(result.translations).toEqual({ ru: { prompt: question.promptRu, options: question.answersRu } })
    expect(result.media).toBeUndefined()
  })

  test('maps a bavaria question', () => {
    const question = questions.find((q) => q.scope === 'bavaria')
    if (!question) throw new Error('fixture assumption failed: expected at least one bavaria question')

    const result = mapEinburgertestQuestion(question)

    expect(result.subtopic).toBe('bavaria')
    expect(result.facets).toEqual({ scope: 'bavaria' })
  })

  test('maps image.descriptionDe to media.alt with a null url, for all 13 image questions', () => {
    const imageQuestions = questions.filter((q) => q.image)
    expect(imageQuestions).toHaveLength(13)

    for (const question of imageQuestions) {
      const result = mapEinburgertestQuestion(question)
      expect(result.media).toEqual({ kind: 'image', url: null, alt: question.image!.descriptionDe })
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd backend && npm test -- mapEinburgertestQuestion`
Expected: FAIL — `mapEinburgertestQuestion.ts` does not exist yet.

- [ ] **Step 3: Implement the mapping function**

Create `backend/scripts/mapEinburgertestQuestion.ts`:

```ts
export interface EinburgertestQuestionImage {
  path: string | null
  descriptionDe: string
  attribution: string | null
}

export interface EinburgertestQuestion {
  id: string
  officialQuestionNumber: number
  scope: 'general' | 'bavaria'
  promptDe: string
  answersDe: string[]
  correctAnswerIndex: number
  image: EinburgertestQuestionImage | null
  promptRu: string
  answersRu: string[]
  explanationRu: string
  explanationSourceUrl: string
  sourceUrl: string
  sourceVersion: string
  reviewStatus: string
  reviewedAt: string | null
}

export interface MappedExercise {
  id: string
  type: 'selection'
  topic: string
  subtopic: string
  language: string
  difficulty: 3
  prompt: string
  options: string[]
  answer: number
  explanation: string
  facets: { scope: string }
  translations: { ru: { prompt: string; options: string[] } }
  media?: { kind: 'image'; url: null; alt: string }
}

export function mapEinburgertestQuestion(question: EinburgertestQuestion): MappedExercise {
  return {
    id: question.id,
    type: 'selection',
    topic: 'einbuergerungstest',
    subtopic: question.scope,
    language: 'de',
    difficulty: 3,
    prompt: question.promptDe,
    options: question.answersDe,
    answer: question.correctAnswerIndex,
    explanation: question.explanationRu,
    facets: { scope: question.scope },
    translations: {
      ru: {
        prompt: question.promptRu,
        options: question.answersRu,
      },
    },
    ...(question.image ? { media: { kind: 'image' as const, url: null, alt: question.image.descriptionDe } } : {}),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd backend && npm test -- mapEinburgertestQuestion`
Expected: `4 passed` (1 snapshot-shape check + 3 mapping tests).

- [ ] **Step 5: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/Projects/langquiz
git add backend/scripts/mapEinburgertestQuestion.ts backend/scripts/mapEinburgertestQuestion.test.ts
git commit -m "feat: add Einbürgerungstest question mapping function"
```

---

### Task 7: The import script

**Files:**
- Create: `backend/scripts/import-einburgertest.ts`
- Modify: `backend/package.json`

- [ ] **Step 1: Add the npm script**

In `backend/package.json`, find:

```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "smoke": "node scripts/smoke-api.mjs",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

Replace with:

```json
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "smoke": "node scripts/smoke-api.mjs",
    "import:einburgertest": "tsx scripts/import-einburgertest.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 2: Write the import script**

Create `backend/scripts/import-einburgertest.ts`:

```ts
import fs from 'fs'
import path from 'path'
import { db } from '../src/db/database'
import { mapEinburgertestQuestion, type EinburgertestQuestion } from './mapEinburgertestQuestion'

async function main(): Promise<void> {
  const dataPath = path.resolve(__dirname, '../data/einburgertest-demo-catalog.json')
  const questions: EinburgertestQuestion[] = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))

  const deckResult = await db.query<{ id: number }>(
    `INSERT INTO decks (slug, title, description, origin, study_modes, facet_definitions, locales, exam_config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (slug) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       study_modes = EXCLUDED.study_modes,
       facet_definitions = EXCLUDED.facet_definitions,
       locales = EXCLUDED.locales,
       exam_config = EXCLUDED.exam_config,
       updated_at = NOW()
     RETURNING id`,
    [
      'einbuergerungstest',
      'Einbürgerungstest',
      'Practice the official German citizenship test question bank.',
      'official',
      ['practice', 'exam'],
      JSON.stringify([{ key: 'scope', label: 'Scope', values: ['general', 'bavaria'] }]),
      ['de', 'ru'],
      JSON.stringify({
        questionCount: 33,
        passingScore: 17,
        quotas: [
          { facetKey: 'scope', facetValue: 'general', count: 30 },
          { facetKey: 'scope', facetValue: 'bavaria', count: 3 },
        ],
      }),
    ]
  )
  const deckId = deckResult.rows[0].id

  let upserted = 0
  for (const question of questions) {
    const exercise = mapEinburgertestQuestion(question)
    await db.query(
      `INSERT INTO exercises (exercise_id, data, deck_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (exercise_id) DO UPDATE SET
         data = EXCLUDED.data,
         deck_id = EXCLUDED.deck_id,
         updated_at = NOW()`,
      [exercise.id, JSON.stringify(exercise), deckId]
    )
    upserted += 1
  }

  console.log(`Imported deck "einbuergerungstest" (id ${deckId}) with ${upserted} questions.`)
  await db.end()
}

main().catch((error) => {
  console.error('Import failed:', error)
  process.exit(1)
})
```

- [ ] **Step 3: Typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd ~/Projects/langquiz
git add backend/scripts/import-einburgertest.ts backend/package.json
git commit -m "feat: add Einbürgerungstest import script"
```

---

### Task 8: Full regression pass with live verification

**Files:** none (verification only)

- [ ] **Step 1: Automated checks**

```bash
cd backend && npm test && npx tsc --noEmit
cd ../frontend && npm test && npx tsc -b --noEmit && npm run lint && npm run build
```

Expected: backend tests pass (17 existing + Task 6's 4 new = 21), backend typecheck clean; frontend
tests pass (73 existing + Task 3's 1 new + Task 5's 4 new = 78), typecheck clean, 0 lint errors,
build succeeds.

- [ ] **Step 2: Run the import against the local dev database**

```bash
cd backend
DATABASE_URL="postgres://oledjo@localhost:5432/langquiz" JWT_SECRET="local-dev-secret" PGSSLMODE=disable npm run import:einburgertest
```

Expected output: `Imported deck "einbuergerungstest" (id <N>) with 310 questions.`

Confirm directly:

```bash
psql postgres://oledjo@localhost:5432/langquiz -c "SELECT slug, title, study_modes, exam_config FROM decks WHERE slug = 'einbuergerungstest';"
psql postgres://oledjo@localhost:5432/langquiz -c "SELECT COUNT(*) FROM exercises WHERE deck_id = (SELECT id FROM decks WHERE slug = 'einbuergerungstest');"
```

Expected: the deck row with the configured `study_modes`/`exam_config`, and a count of `310`.

- [ ] **Step 3: Manual smoke check against a real backend**

Start the backend against this same database and the frontend dev server (same pattern as prior
plans' manual checks), then in a browser:

- Sign in as a real (non-guest) user.
- Navigate to the Library. Confirm both "German Grammar & Vocabulary" and "Einbürgerungstest" decks
  now appear.
- Open the Einbürgerungstest deck. Confirm the description renders and both "Start practicing" and
  "Start exam" buttons are visible (this deck's `studyModes` includes both).
- Click "Start exam". Confirm "Question 1 of 33" appears (the full 30/3 quota fills, since the pool
  comfortably exceeds it), and that the questions shown are German citizenship-test content, not
  German-grammar content.
- Answer a few questions and submit; confirm a score screen appears with a Passed/Not passed verdict
  against `passingScore: 17`.
- Go to Home (the `/` route). Confirm the topic list and any practice session built from it contains
  only German grammar/vocabulary topics — no Einbürgerungstest questions should appear, confirming
  Task 5's exclusion filter works against real data.
- Go to Library → German Grammar & Vocabulary → Start practicing. Confirm this still works exactly
  as before (regression check that the deck-scoped study flow, built in Plan 5, is unaffected).

If no backend is available, note in your report that the full import-and-verify flow was not
manually run, and that this task should be re-run once one is.

## Self-Review Notes

- **Spec coverage:** This plan implements every section of the design spec: the vendored snapshot
  (Task 1), the `facets`/`translations`/`media`/`deckId` type extension (Task 2), the
  `toDeckExercise` facet-merge fix that makes exam quota matching actually work (Task 3), the
  backend `deckId` exposure needed for Home-screen filtering (Task 4), the Home screen exclusion
  itself (Task 5), the pure mapping function with count/field/image assertions (Task 6), the
  idempotent upsert-based import script (Task 7), and end-to-end live verification (Task 8). The
  spec's explicit non-goals (translation/media UI, image sourcing, Home screen redesign, English
  content) are not touched by any task.
- **No placeholders:** every step shows complete code or an exact anchored find/replace.
- **Type consistency:** `facets?: Record<string, string>` on `BaseExercise` (Task 2) is read by
  `toDeckExercise` (Task 3) exactly as named. `deckId?: string` on `BaseExercise` (Task 2) is
  produced by the backend response (Task 4, `String(row.deck_id)`) and consumed by
  `filterExercisesByDeck` (Task 5) with matching types on both sides — frontend `deckId` is always a
  string, backend `deck_id` is always converted to one before it crosses the API boundary.
  `mapEinburgertestQuestion`'s `MappedExercise` return type (Task 6) is a subset shape compatible
  with `BaseExercise`/`SelectionExercise`, imported unchanged by the script in Task 7.
