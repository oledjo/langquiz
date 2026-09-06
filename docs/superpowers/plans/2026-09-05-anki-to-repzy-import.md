# Anki-to-Repzy Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import private German Anki cards and their current scheduling state into Repzy through an authenticated, idempotent migration workflow.

**Architecture:** A local TypeScript CLI reads AnkiConnect and sends an approved import payload to a new authenticated backend route. The backend owns validation, transactions, user-scoped audit records, private `user_exercises`, and `user_review_schedule`; the CLI never receives a database credential.

**Tech Stack:** Node.js 20 fetch, TypeScript, Express 5, PostgreSQL/Supabase, pg, Vitest, AnkiConnect v6.

**Spec:** `/Users/oledjo/Documents/01 Projects/Архив/🚀 Разработать проект LangQuiz/RepzyMobile-upstream/docs/superpowers/specs/2026-09-04-anki-to-repzy-import-design.md`

## Global Constraints

- Import only the three selected `German::…` source decks and never mutate Anki.
- Target the authenticated user; never accept a client-supplied user ID.
- Store imported content only in `user_exercises` with `share_status = 'private'`.
- Preserve current schedule state with `scheduler_version = 'anki-sm2-import-v1'`.
- Require a dry-run manifest before apply; an unchanged manifest rerun is idempotent.
- Treat unsupported Anki note models as `needs_review`, never guessed exercises.
- Enable RLS with no policies on every new public table; the backend's database owner remains the only access path.

---

### Task 1: Add import audit schema and migration tests

**Files:**
- Create: `backend/src/db/migrations/019_anki_import.sql`
- Modify: `backend/src/db/database.test.ts`

**Interfaces:**
- Produces `anki_import_runs` and `anki_import_card_mappings` for Tasks 3–5.
- `anki_import_card_mappings` is unique on `(user_id, anki_card_id)`.

- [ ] **Step 1: Write a failing migration assertion**

```ts
expect(executedSql).toContain('CREATE TABLE IF NOT EXISTS anki_import_runs')
expect(executedSql).toContain('UNIQUE (user_id, anki_card_id)')
expect(executedSql).toContain('ALTER TABLE anki_import_runs ENABLE ROW LEVEL SECURITY')
```

- [ ] **Step 2: Run the focused test**

Run: `cd backend && npm test -- database`
Expected: FAIL because migration `019_anki_import.sql` does not exist.

- [ ] **Step 3: Add the forward-only migration**

Create tables with these exact columns:

```sql
CREATE TABLE IF NOT EXISTS anki_import_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manifest_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('analyze', 'apply', 'verify')),
  status TEXT NOT NULL CHECK (status IN ('analyzed', 'applied', 'partial', 'failed')),
  source_decks JSONB NOT NULL,
  summary JSONB NOT NULL,
  history_status TEXT NOT NULL CHECK (history_status IN ('not_requested', 'unavailable', 'partial', 'imported')),
  importer_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS anki_import_card_mappings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anki_card_id TEXT NOT NULL,
  anki_note_id TEXT NOT NULL,
  source_deck TEXT NOT NULL,
  source_model TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  schedule_hash TEXT NOT NULL,
  import_run_id BIGINT REFERENCES anki_import_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('imported', 'skipped_unchanged', 'needs_review')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, anki_card_id)
);
```

Add indexes on `(user_id, status)` and `(user_id, exercise_id)`. Enable RLS with no policies, matching the existing backend-only access model; do not create a permissive policy or use `auth.uid()`, because authentication is handled by the application's own JWT and `users` table.

- [ ] **Step 4: Run the focused test**

Run: `cd backend && npm test -- database`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/migrations/019_anki_import.sql backend/src/db/database.test.ts
git commit -m "feat: add Anki import audit schema"
```

### Task 2: Build pure Anki conversion and schedule mapping

**Files:**
- Create: `backend/src/services/ankiImport.ts`
- Create: `backend/src/services/ankiImport.test.ts`

**Interfaces:**
- Consumes AnkiConnect note/card payloads.
- Produces `ImportCandidate`, `NeedsReviewCandidate`, `AnkiSchedule`, and deterministic SHA-256 hashes for Task 3.

- [ ] **Step 1: Write failing conversion tests**

```ts
expect(toImportCandidate(basicNote, forwardCard)).toMatchObject({
  exercise: { id: 'anki-123', type: 'free-type', answers: ['Haus'] },
  source: { ankiCardId: '123', ankiNoteId: '456', model: 'Basic' },
})
expect(toImportCandidate(unknownNote, card)).toEqual({
  status: 'needs_review',
  reason: 'Unsupported Anki model: Cloze',
})
expect(toSchedule(reviewCard, collectionNow)).toMatchObject({
  repetitionCount: 12,
  intervalDays: 21,
  schedulerVersion: 'anki-sm2-import-v1',
})
```

- [ ] **Step 2: Run the focused test**

Run: `cd backend && npm test -- ankiImport`
Expected: FAIL because `ankiImport.ts` does not exist.

- [ ] **Step 3: Implement deterministic adapters**

Define:

```ts
export type SupportedAnkiModel =
  | 'Basic'
  | 'Basic (and reversed card)'
  | 'Basic (type in the answer)'
  | 'DE-RU (4 fields)'
  | 'Goethe Vocab List'

export function toImportCandidate(note: AnkiNote, card: AnkiCard): ImportResult
export function toSchedule(card: AnkiCard, now: Date): ImportedSchedule
export function contentHash(exercise: Exercise): string
export function scheduleHash(schedule: ImportedSchedule): string
```

Strip HTML, decode entities, normalize whitespace, preserve direction per card, and generate only `free-type` exercises in v1. Map empty Front/Back fields, unsupported models, embedded-only media, and ambiguous model fields to `needs_review`. Convert Anki review states to the existing 0–3 FSRS states; convert interval days, repetitions, lapses, factor, and due date without inventing review-history rows.

- [ ] **Step 4: Run the focused test**

Run: `cd backend && npm test -- ankiImport`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/ankiImport.ts backend/src/services/ankiImport.test.ts
git commit -m "feat: map Anki cards into private exercises"
```

### Task 3: Implement the authenticated backend import API

**Files:**
- Create: `backend/src/routes/ankiImport.ts`
- Create: `backend/src/routes/ankiImport.test.ts`
- Modify: `backend/src/index.ts`

**Interfaces:**
- Consumes `POST /api/anki-import/analyze` and `POST /api/anki-import/apply` with a candidate manifest.
- Produces persisted imports, schedules, and a user-scoped run response.

- [ ] **Step 1: Write failing route tests**

```ts
await request(app)
  .post('/api/anki-import/apply')
  .set('Authorization', 'Bearer valid-token')
  .send(validManifest)
  .expect(201)

expect(sql).toContain('INSERT INTO user_exercises')
expect(sql).toContain('INSERT INTO user_review_schedule')
expect(sql).toContain('ON CONFLICT (user_id, anki_card_id)')
```

Also assert `401` without auth, `400` for a manifest whose hash does not match, and that a second identical apply does not add another exercise or schedule.

- [ ] **Step 2: Run the focused test**

Run: `cd backend && npm test -- ankiImport`
Expected: FAIL because the router is not registered.

- [ ] **Step 3: Implement route and transaction**

Register `app.use('/api/anki-import', ankiImportRouter)`. Require authentication and rate-limit apply requests. In one transaction:

1. verify the declared manifest hash from normalized candidates;
2. create an `anki_import_runs` row;
3. upsert private `user_exercises` by authenticated `req.userId`;
4. upsert `user_review_schedule` by `(user_id, exercise_id)` with the imported schedule;
5. upsert source mappings by `(user_id, anki_card_id)`;
6. record skipped and review-needed cards in mappings/run summary; and
7. commit or roll back the entire batch.

Expose `GET /api/anki-import/runs/:id`, filtering by `user_id`, for verification. The backend does not accept review-history events in v1; the analyze response must explicitly report `history_status: 'unavailable'` until a verified AnkiConnect review-log adapter exists.

- [ ] **Step 4: Run route and scheduler regressions**

Run: `cd backend && npm test -- ankiImport reviewScheduler progress`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/ankiImport.ts backend/src/routes/ankiImport.test.ts backend/src/index.ts
git commit -m "feat: add authenticated Anki import API"
```

### Task 4: Add the local AnkiConnect CLI and dry-run report

**Files:**
- Create: `backend/scripts/import-anki.ts`
- Create: `backend/scripts/import-anki.test.ts`
- Modify: `backend/package.json`
- Modify: `backend/README.md`

**Interfaces:**
- Consumes local AnkiConnect at `http://127.0.0.1:8765`, `REPS_API_URL`, and `REPS_AUTH_TOKEN`.
- Produces a JSON report and calls the authenticated API only for `apply`.

- [ ] **Step 1: Write failing CLI tests**

```ts
const report = await analyzeAnki({ ankiFetch: fakeAnkiFetch, apiFetch: fakeApiFetch })
expect(report.mode).toBe('analyze')
expect(fakeApiFetch).not.toHaveBeenCalledWith(expect.stringContaining('/apply'), expect.anything())
expect(report.decks['German::2. Deutsch'].cardCount).toBe(0)
```

- [ ] **Step 2: Run the focused test**

Run: `cd backend && npm test -- import-anki`
Expected: FAIL because the CLI module does not exist.

- [ ] **Step 3: Implement the CLI**

Add `npm run import:anki -- analyze|apply|verify`. The CLI:

1. calls `deckNames`, `findNotes`, `notesInfo`, and card-info actions through AnkiConnect;
2. limits input to the three approved source decks;
3. emits `anki-import-report.json` with counts, candidate samples, unsupported models, duplicate candidates, and manifest hash;
4. requires `--report anki-import-report.json` for apply and rejects a changed source manifest;
5. sends the auth token only to `REPS_API_URL`, never AnkiConnect; and
6. runs verify by fetching the import-run endpoint and comparing source IDs to mappings.

Document environment variables and state that Anki is never modified.

- [ ] **Step 4: Run focused CLI tests**

Run: `cd backend && npm test -- import-anki`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/scripts/import-anki.ts backend/scripts/import-anki.test.ts backend/package.json backend/README.md
git commit -m "feat: add local Anki import CLI"
```

### Task 5: Validate the release workflow

**Files:**
- Modify: `backend/README.md`
- Test: `backend/src/services/ankiImport.test.ts`
- Test: `backend/src/routes/ankiImport.test.ts`
- Test: `backend/scripts/import-anki.test.ts`

- [ ] **Step 1: Add an end-to-end fixture test**

```ts
const report = await analyzeAnki({ ankiFetch: fixtureAnkiFetch, apiFetch: fixtureApiFetch })
const applied = await applyReport(report, { apiFetch: fixtureApiFetch })
const verification = await verifyImport(applied.runId, { apiFetch: fixtureApiFetch })
expect(verification.missingSourceCardIds).toEqual([])
expect(verification.duplicateExerciseIds).toEqual([])
```

- [ ] **Step 2: Run the complete backend suite and build**

Run: `cd backend && npm test && npm run build`
Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Execute only a local dry run**

Run: `cd backend && REPS_API_URL=https://langquiz.onrender.com REPS_AUTH_TOKEN=<token> npm run import:anki -- analyze`
Expected: a local report; no Supabase writes and no Anki mutations.

- [ ] **Step 4: Update the README release instructions**

Document the required sequence: `analyze` → inspect report → pilot `apply` → `verify` → full `apply`. State that production apply requires a human confirmation and is not part of automated tests.

- [ ] **Step 5: Commit**

```bash
git add backend/README.md backend/src/services/ankiImport.test.ts backend/src/routes/ankiImport.test.ts backend/scripts/import-anki.test.ts
git commit -m "docs: document Anki import release workflow"
```
