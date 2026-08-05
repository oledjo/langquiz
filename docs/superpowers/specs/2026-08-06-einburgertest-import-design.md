# Einbürgerungstest Import — Design

**Goal:** Import the Einbürgerungstest (German citizenship test) question bank as a real, working
deck in Reps — the first deck whose `examConfig.quotas` actually has meaningful facet data to
select against, closing the gap Plan 6 (exam mode) explicitly could not verify. This is Plan 8, the
last plan of the Reps platform rewrite (see
`docs/superpowers/specs/2026-08-02-reps-platform-core-design.md`, "Einbürgerungstest deck" section);
Plans 1–7 are merged to `master`.

**Source of truth:** `/Users/oledjo/Projects/einburgertest/src/demo/demo-catalog.generated.json` — a
separate repository, not modified by this plan. 310 questions: 300 `scope: "general"`, 10
`scope: "bavaria"`. Verified directly against the file: all entries have exactly 4 `answersDe`
options, all 310 `id`s are unique, `officialQuestionNumber` runs 1–300 (bavaria questions share the
1–300 range with general ones, not a separate range). 13 questions (11 general, 2 bavaria) have a
non-null `image` field with only a German text description (`image.descriptionDe`) — no image files
exist in either repository.

**Non-goals (explicitly deferred):**
- Any UI for displaying `translations` (Russian) or `media` (image descriptions) — the shared
  question-rendering components (`QuizCard`, the components `getQuestionComponent` returns) have no
  concept of either today. This plan stores the data on the `Exercise` type so it exists in Postgres
  for a future UI plan to render; it builds no new UI.
- Sourcing real image assets for the 13 image-referencing questions — tracked separately per the
  core spec ("content work tracked in the follow-up spec"). This plan imports those 13 questions
  as-is (text-only multiple choice, e.g. options literally reading "Bild 1"/"Bild 2"), matching the
  source content 1:1.
- Any redesign of the legacy Home screen. This plan makes one small, additive change to it (see
  "Home screen exclusion" below) — not a migration of Home onto the deck-routing pattern the way
  Library/Deck Detail/Study/Exam/Progress already were in Plans 3–7.
- English content authoring. The imported content is German with Russian translations only; the
  core spec already names this as a known, accepted risk not solvable in code.

---

## Architecture

### Vendored content snapshot, not a live cross-repo read

The import script needs a stable, reproducible input — a hardcoded path to a sibling repository
checkout would break for any other contributor, in CI, or if the local path differs. Instead, a copy
of `demo-catalog.generated.json` is vendored into `backend/data/einburgertest-demo-catalog.json`
(checked into git). Re-running the import (the core spec's "reconciliation mechanism") means:
manually refresh this vendored file from the source repo, then re-run the script.

### Import script, not a migration

`backend/scripts/import-einburgertest.ts` (run via `tsx`, added as an npm script
`"import:einburgertest": "tsx scripts/import-einburgertest.ts"` in `backend/package.json`) — a
standalone script using the same `db` Pool export from `backend/src/db/database.ts`, deliberately
**not** a numbered migration file. Migrations run automatically on every deploy for schema changes;
this is a content operation a human deliberately triggers, and the core spec's own language
("re-running the import is the reconciliation mechanism") describes a script, not a one-time
irreversible schema change.

The script:
1. Upserts one row into `decks` (`ON CONFLICT (slug) DO UPDATE`, so re-running updates config without
   duplicating):
   ```
   slug: 'einbuergerungstest'
   title: 'Einbürgerungstest'
   description: 'Practice the official German citizenship test question bank.'
   origin: 'official'
   study_modes: ['practice', 'exam']
   facet_definitions: [{ key: 'scope', label: 'Scope', values: ['general', 'bavaria'] }]
   locales: ['de', 'ru']
   exam_config: {
     questionCount: 33,
     passingScore: 17,
     quotas: [
       { facetKey: 'scope', facetValue: 'general', count: 30 },
       { facetKey: 'scope', facetValue: 'bavaria', count: 3 }
     ]
   }
   ```
   `locales: ['de', 'ru']` reflects the content's actual languages (German prompts, Russian
   translations) — deliberately different from the existing German-grammar deck's `locales: ['en']`,
   which represents "this deck's UI/audience is English speakers learning German," a framing that
   doesn't fit citizenship-exam content with no English at all.
2. For each of the 310 questions, upserts one row into `exercises` (`ON CONFLICT (exercise_id) DO
   UPDATE`, matching the existing pattern in `POST /api/exercises/bootstrap`), with `deck_id` set
   directly in the `INSERT` (bypassing the HTTP bootstrap endpoint entirely — that endpoint has no
   deckId parameter and is shared with the unrelated per-user login bootstrap flow; adding deckId
   support to it is out of scope here since nothing else needs it).

### Field mapping

Each question becomes a `selection`-type `Exercise`:

| Source field | Target field | Notes |
| --- | --- | --- |
| `id` | `id` | Already a stable UUID in the source data |
| `promptDe` | `prompt` | |
| `answersDe` | `options` | |
| `correctAnswerIndex` | `answer` | |
| — | `type` | Always `'selection'` |
| — | `topic` | Always `'einbuergerungstest'` (required field, matches the deck) |
| — | `subtopic` | The question's `scope` value (`'general'` or `'bavaria'`) |
| — | `language` | `'de'` |
| — | `difficulty` | `3` (fixed — the source data has no per-question difficulty, and inventing one would be arbitrary; matches this deck's flat, official-exam nature where every question carries equal weight) |
| `scope` | `facets.scope` | New optional `facets` field on `Exercise` (see below) |
| `explanationRu` | `explanation` | The only explanation text available — no German explanation exists in the source |
| `promptRu`, `answersRu` | `translations.ru.prompt`, `translations.ru.options` | Stored, not rendered (see Non-goals) |
| `image.descriptionDe` | `media.alt` (with `media.kind: 'image'`, `media.url: null`) | Only set when `image` is non-null; stored, not rendered |
| `sourceUrl`, `sourceVersion` | Not imported | No provenance columns exist on `exercises` today, and nothing reads them; adding unused columns would be speculative. If a future plan needs provenance tracking, it can add these then. |

### The facet-matching fix (real code change, not just data)

`frontend/src/lib/legacyExerciseMapper.ts`'s `toDeckExercise()` — the function
`selectExamQuestions` uses to match `examConfig.quotas`' `facetKey`/`facetValue` pairs — currently
hardcodes only `topic`/`subtopic`/`language`/`level`/`group` as derivable facets. It has no way to
expose a `scope` facet, so without a fix, this deck's exam quotas (`facetKey: 'scope'`) would match
zero questions and `selectExamQuestions` would silently return an empty exam.

Fix: `BaseExercise` (`frontend/src/types/exercise.ts`) gains an optional
`facets?: Record<string, string>` field. Every Einbürgerungstest question sets
`facets: { scope: question.scope }`. `toDeckExercise()` is extended to merge `legacy.facets` into
its derived facets object (spread after the existing hardcoded ones, so a future exercise could
still override `topic`/`language`/etc. if it ever needed to — though nothing does today). This is a
small, generic extension point: any future deck with genuinely custom facets (not just
topic/subtopic/language/level/group) can use the same `facets` field without further code changes.

### Home screen exclusion

`GET /api/exercises`'s response (`backend/src/routes/exercises.ts`) currently never serializes
`deck_id` into the JSON payload it returns — the data exists in the column but the response mapping
(`{ ...row.data, isUserAdded, voteCount, userVoted, ... }`) drops it. This plan adds a `deckId`
field to both the `exercises` and `user_exercises` branches of that response (`deckId: row.deck_id
!== null ? String(row.deck_id) : undefined`, matching the string-id convention used elsewhere for
decks).

`frontend/src/App.tsx`'s `MainApp` (the legacy Home screen) resolves the grammar deck's id via the
already-used `useDecks()` hook (find the deck where `slug === 'german-grammar-vocabulary'`) and adds
one filter step to its `allExercises`/`baseFilteredExercises` computation: exclude any exercise whose
`deckId` is set and does not match the grammar deck's id. Exercises with no `deckId` (e.g. anything
not yet migrated, or a future edge case) still pass through unchanged — this is a narrowing filter,
not a rewrite of Home's exercise pipeline.

**Deliberately not done:** making `useExercises()` itself deck-aware (e.g. an optional `deckId`
param mirroring Plan 7's `useStats`/`useReviewMetrics` pattern). That hook's built-in-exercise
bootstrap logic (`bootstrapExercises`) inserts new exercise rows without setting `deck_id`, so a
deck-scoped fetch would never see a freshly-bootstrapped built-in exercise, risking an infinite
"still missing, bootstrap again" loop. Filtering client-side in `MainApp` after the existing
unscoped fetch avoids this entirely, at the cost of one extra array filter on an already-small
dataset (a few hundred exercises).

---

## Testing

- **Import mapping function**, extracted as a pure, unit-testable function (not inline in the
  script) — `backend/scripts/mapEinburgertestQuestion.ts` (or similar), imported by both the script
  and its test. Tests assert: total count (310), scope counts (300 general / 10 bavaria), correct
  field mapping for a `general` question with no image, correct field mapping for a `bavaria`
  question, and that all 13 image-bearing questions produce `media.url: null` with
  `media.alt` equal to the source's `image.descriptionDe`.
- **`toDeckExercise()`'s facet merging** (`frontend/src/lib/legacyExerciseMapper.test.ts`, new file —
  this function currently has no tests): a test asserting `legacy.facets` values appear in the
  output's `facets` object alongside the existing hardcoded ones, and a test confirming existing
  behavior (no `facets` field on the input) is unchanged.
- **`GET /api/exercises`'s new `deckId` field**: no new automated test (no CI database, consistent
  with this route file's existing untested state) — verified manually in the live-verification step
  below.
- **Manual live verification** (same pattern as Plans 5–7): run
  `npm run import:einburgertest` against local Postgres, confirm the deck appears in Library with the
  right title/description, confirm "Start exam" pulls a real question set with a 30/3 general/bavaria
  split (the full pool is 300 general / 10 bavaria, both comfortably exceeding the 30/3 quota),
  confirm the Home screen's practice-session topic list no longer includes Einbürgerungstest content
  after the fix.
