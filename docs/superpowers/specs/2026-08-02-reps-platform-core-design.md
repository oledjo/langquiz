# Reps — Platform Core

**Date:** 2026-08-02
**Status:** Approved (sections 1–3), section 4 pending review
**Supersedes:** the language-only framing in `PLAN.md` and `docs/mvp-simplification-plan.md`

## Context

LangQuiz is a language-practice app: React 19 + Tailwind 3 frontend, Express + Postgres backend with
its own JWT auth, SM-2 spaced repetition, and 43 exercise files compiled into the bundle via
`import.meta.glob`. The subject is baked into the domain type — `Exercise` carries `language`,
`level: A1–C2`, `group: grammar | vocabulary`, `grammarNote`, and a free-type validator hardcoded
with German articles.

We are turning it into a platform for learning anything, where users create their own content and
curated official content lives alongside it. The first official deck is the German
Einbürgerungstest.

## Goals

1. Rebrand LangQuiz to **Reps**.
2. Remove the language assumption from the domain model.
3. Introduce decks as the unit of content, ownership, and study.
4. Move content from the bundle into Postgres so user-created and official content share one path.
5. Add exam mode, so the Einbürgerungstest deck works.
6. Scope progress per deck.

## Non-goals (deferred to a follow-up spec)

- Importing all 310 Einbürgerungstest questions and sourcing the missing image assets.
- Authoring English translations for the Einbürgerungstest content.
- Deck moderation workflow beyond what `AdminQuestions` already does per question.
- Monetization, retention email, and marketing-site content.
- Any change to the `einburgertest` repository, which stays live and independent.

## Decisions

### Naming and brand

> **Superseded 2026-08-14:** the name below ("Reps") collided with an existing same-category app
> (`getreps.io`, an active-recall flashcard product). See
> `docs/superpowers/plans/2026-08-14-repzy-rebrand.md` for the current name ("Repzy") and the
> rebrand execution plan. The rest of this section's rationale (brand promise, palette) still holds.

The product is **Reps** — spaced repetition in one syllable, subject-neutral, verb-able ("do your
reps"), and it composes with decks: *Reps for German*, *Reps for Einbürgerungstest*.

Rejected: *Deckhand* (memorable but the pun does not translate), *Interval* (precise but cold and
too generic to defend). Quizlet-adjacent names were excluded deliberately as a legal risk.

Brand promise moves from "practice a language" to "learn anything, one deck at a time". The blue
palette stays — it is subject-neutral and already applied everywhere; changing it multiplies work
without benefit. `LangQuizLogo.tsx` is replaced by a mark built on rhythm and repetition rather than
books or globes.

Domain and trademark availability for "Reps" is **unverified** and must be checked before purchase.

### Domain model

The exercise core becomes subject-neutral. Subject specifics move to the deck.

```ts
interface BaseExercise {
  id: string
  deckId: string
  type: 'selection' | 'multiselect' | 'free-type'
  prompt: string
  context?: string
  hint?: string
  reference?: string              // was grammarNote — shown before answering
  explanation?: string            // shown after answering
  media?: QuestionMedia
  difficulty: 1 | 2 | 3 | 4 | 5
  facets: Record<string, string>  // replaces language / level / group
  tags?: string[]
  translations?: Record<LocaleCode, ExerciseTranslation>
  isUserAdded?: boolean
  shareStatus?: ExerciseShareStatus
  voteCount?: number
}

interface QuestionMedia {
  kind: 'image'
  url: string | null              // null when only a description is available
  alt: string
  attribution?: string
}

interface ExerciseTranslation {
  prompt: string
  options?: string[]
  explanation?: string
}

interface Deck {
  id: string
  slug: string
  title: string
  description: string
  origin: 'official' | 'community'
  ownerId?: string
  studyModes: StudyMode[]           // ['practice'] | ['practice', 'exam']
  facetDefinitions: FacetDefinition[]
  locales: LocaleCode[]
  examConfig?: ExamConfig
  answerRules?: AnswerRules         // where the German-article validator goes
}

interface FacetDefinition {
  key: string          // 'level'
  label: string        // 'CEFR level'
  values: string[]     // ['A1', ..., 'C2']
}

interface ExamConfig {
  questionCount: number
  passingScore: number
  quotas: FacetQuota[]
  timeLimitMinutes?: number
}

interface FacetQuota {
  facetKey: string
  facetValue: string
  count: number
}
```

A German grammar deck declares facets `level` and `group`, mode `practice`, and
`answerRules: 'german-articles'`. The Einbürgerungstest deck declares facet `scope`, modes
`practice` and `exam`, and an `examConfig`. A user deck declares nothing and still works.

`TopicFilter` renders filters from `facetDefinitions` and stops knowing about CEFR.

`media.url` is nullable because the imported Einbürgerungstest content has descriptions but no image
files. When `url` is null the renderer shows `alt` as text — the behaviour `einburgertest` already
ships and tests.

### Content storage

All decks live in Postgres. `exerciseRegistry` and `import.meta.glob` are deleted: user-created
content cannot be compiled into the bundle, and official content must not take a different path.

The 43 existing exercise files become seed data — versioned in git, loaded by a migration. Content
stays reviewable in pull requests without being bundled.

### Information architecture

Navigation becomes `Library | My decks | Progress | Admin`.

| Screen | Status |
| --- | --- |
| Library — browse official and published community decks | New |
| Deck detail at `/deck/:slug` — description, counts, modes, start | New |
| My decks — create, edit, submit for moderation | New; absorbs user-exercises |
| Progress — per-deck metrics | Rework of `ProgressDashboard` |
| Admin | Unchanged |

Deck detail gives each deck a URL, which is what `generate-sitemap.mjs` needs to be useful.

| Component | Fate |
| --- | --- |
| `QuizCard` | Kept; gains media rendering and a translation toggle |
| `QuizSession` | Kept; `sessionMode` gains `'exam'` |
| `TopicFilter` | Rewritten against `facetDefinitions` |
| `ProgressDashboard` | Gains deck selection |
| `exerciseRegistry` | Deleted |
| `MarketingSite` | Rewritten for the new promise |

### Exam mode

A separate screen, not a variant of practice: questions are drawn by `examConfig.quotas`, there is
no per-question feedback, navigation across all questions is free, and scoring happens at the end
against `passingScore`.

**Exam answers update correct/incorrect statistics but do not move spaced-repetition intervals.**
`ease_factor` in SM-2 models subjective recall difficulty, which a guess among four options does not
measure; feeding exams into the scheduler would add noise to review timing. Exams remain a useful
signal for per-question statistics and for surfacing difficult questions.

### Guest mode

Retained. On a UGC platform a visitor must be able to try a deck before registering.

### Einbürgerungstest deck

An `official` deck, facet `scope` with values `general` and `bavaria`, modes `practice` and `exam`,
`examConfig: { questionCount: 33, passingScore: 17, quotas: [general × 30, bavaria × 3] }`.

Source content is `einburgertest/src/demo/demo-catalog.generated.json`: 310 questions, 300 `general`
and 10 `bavaria`, which matches the 30 + 3 quota exactly. Field mapping:

| Source | Target |
| --- | --- |
| `promptDe` | `prompt` |
| `answersDe` | `options` |
| `correctAnswerIndex` | `answer` |
| `scope` | `facets.scope` |
| `promptRu`, `answersRu`, `explanationRu` | `translations.ru` |
| `image.descriptionDe` | `media.alt` (with `url: null`) |
| `sourceUrl`, `sourceVersion` | provenance columns |

13 of 310 questions reference an image; none of the image files exist in either repository, only
German descriptions. Sourcing the assets from BAMF is content work tracked in the follow-up spec.

The `einburgertest` repository is the source of truth for this content and is not modified. Content
is copied by a one-way import script, so the two will drift; re-running the import is the
reconciliation mechanism.

### Migration

Storage keys move from the `langquiz.` prefix to `reps.`, but the old keys are read as a fallback so
existing sessions survive. `langquiz.auth-token` is currently duplicated as a literal in six files
(`AuthContext.tsx` and five API modules); the rename consolidates it into one exported constant.

Existing `progress` rows have no deck. The migration assigns them to the seeded German deck, since
that is what all current content is.

## Testing

LangQuiz has **zero automated tests**. This is the single largest risk in the plan: we are
restructuring the domain model, moving content out of the bundle, and rewriting navigation, with no
regression net and a CI that runs `lint` with `continue-on-error: true` plus a build.

The work therefore adds, as part of the change rather than after it:

- Unit tests for the deck/facet model, the exam question-selection quotas, and the SM-2 scheduler.
- Unit tests for the Einbürgerungstest import mapping, asserting counts (310 / 300 / 10) and the
  translation and media mappings.
- End-to-end coverage for the core loop: browse library, open deck, answer, reload and keep
  progress; and a full exam run that scores against the passing threshold.
- CI updated to run tests and to stop swallowing lint failures.

`einburgertest` demonstrates the target: 224 unit tests and 9 e2e specs over comparable surface.

## Risks and open questions

1. **Scope.** This is a rewrite of an existing application, not a feature. It should land as a
   sequence of merged increments, not one branch.
2. **Translations.** The audience is English-speaking; the imported content is German with Russian
   translations only. English speakers will see untranslated German until English content is
   authored. Not solvable in code.
3. **Two live products.** `einburgertest` keeps serving the same content independently. Divergence
   is expected and accepted.
4. **Unverified brand.** "Reps" has not been checked against domains or trademarks.
5. **Open:** does a community deck author get facet definitions at all, or are facets reserved for
   official decks in the first release? Reserving them is simpler and is the assumed default here.
