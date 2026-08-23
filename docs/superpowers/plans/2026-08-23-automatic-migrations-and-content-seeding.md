# Automatic Migrations and Content Seeding Implementation Plan

**Goal:** Make a deploy converge the database on its own — schema *and* content — so shipping a
question, an image, or a mapper change never requires an operator to run a script against
production by hand. The immediate payload is the 13 official Einbürgerungstest question sheets,
which replace every hand-sourced per-option image.

**Architecture:** Two tracked layers behind one boot sequence.

- **Schema** (`schema_migrations`) — the existing numbered-`.sql` runner, hardened with a Postgres
  advisory lock and per-file checksums. Runs *before* `app.listen()`: a bad migration fails the
  boot, Render keeps the previous instance serving.
- **Content** (`content_seeds`) — a new runner keyed by a checksum of each seed's **mapped
  output**, not its input file. A change to `einburgertest-demo-catalog.json` *or* to
  `mapEinburgertestQuestion.ts` *or* to a vendored image therefore re-seeds automatically, which
  is the footgun `docs/render-deployment.md` currently documents as a manual step. Runs *after*
  `app.listen()`: stale content is better than a down API.

The mapper stops carrying artwork entirely. After this plan it produces only the accessible
text fallback (`url: null` + official description); every real picture lives in `question_images`
and is layered on by `mergeQuestionImages`. One path for artwork, not two.

**Tech Stack:** TypeScript, Postgres (`pg`), Vitest, GitHub Actions — all already in place.

**Non-goals:**
- Rollback/`down` migrations. Forward-only, as today.
- Suppressing the per-option description text on picker questions now that the composite image is
  visible. Noted as follow-up; it is the accessible fallback and is not wrong, just verbose.
- Moving image bytes to object storage. Postgres holds them, per migration 016's reasoning.

---

### Task 1: Vendor the 13 question sheets

The source files are the official BAMF answer sheets, one PNG per image-bearing question, named by
official question number. `301`/`308` are the Bavaria-scope questions 1 and 8 (BAMF numbers the
per-state block 301–310); every other file is general scope.

**Files:**
- Create: `backend/data/images/einburgertest/q{NNN}-*.png` (13 files)
- Create: `backend/data/question-images.json` (manifest)
- Delete: the 17 superseded `.svg` files and `q55-reichstag-building.jpg`

- [x] **Step 1:** Copy the 13 PNGs in, named `q<official>-<slug>.png`, using the `bavaria-` prefix
      for the two Bavaria questions so the general/bavaria number collision stays readable.
- [x] **Step 2:** Write `question-images.json`: one entry per file with `exerciseId`, `file`,
      `slot` (always `"question"` — these are composites, not per-option art), `alt` (the
      catalog's own `image.descriptionDe`), and `attribution`.
- [x] **Step 3:** Delete the superseded per-option SVGs and the Reichstag JPG.

### Task 2: Migrations 017 and 018

**Files:**
- Create: `backend/src/db/migrations/017_question_image_source.sql`
- Create: `backend/src/db/migrations/018_drop_user_review_settings.sql`

- [x] **Step 1:** `017` adds `question_images.source TEXT NOT NULL DEFAULT 'admin'`, constrained to
      `('seed','admin')`. Default `'admin'` so any artwork already uploaded through `/admin` keeps
      winning over the seeder.
- [x] **Step 2:** `018` drops `user_review_settings`. It is an orphan: migration
      `014_user_review_settings.sql` was added in `bc65151` and deleted in `ac6e784`, so every
      database that booted in between still has the table while no file in the repo describes it.
      Nothing in the codebase references it.

### Task 3: Harden the schema migration runner

**Files:**
- Modify: `backend/src/db/database.ts`
- Create: `backend/src/db/database.test.ts`

- [x] **Step 1:** Wrap the whole run in `pg_advisory_lock(<constant>)` / `pg_advisory_unlock` on a
      single dedicated client, so two instances booting at once serialize instead of racing.
- [x] **Step 2:** Add `schema_migrations.checksum` (backfilled `NULL` for existing rows) and record
      a SHA-256 of each file as it is applied. On boot, an applied file whose checksum no longer
      matches **throws** — editing an applied migration is the failure this catches. A `NULL`
      checksum is treated as "recorded before checksums existed" and adopted, not failed.
- [x] **Step 3:** An applied row with no corresponding file logs a warning and continues. Deleting
      a migration file is legitimate history (see the 014 ghost); it must not wedge every boot.
- [x] **Step 4:** Unit-test checksum mismatch, orphan row, and fresh-apply against a stubbed pool.

### Task 4: The content seed runner

**Files:**
- Create: `backend/src/db/contentSeeds.ts`
- Create: `backend/src/db/contentSeeds.test.ts`
- Modify: `backend/src/index.ts`

- [x] **Step 1:** `content_seeds(name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at)`,
      created by the runner itself the same way `schema_migrations` is.
- [x] **Step 2:** A seed is `{ name, checksum(): string, run(): Promise<string> }`. The runner
      compares `checksum()` against the stored row, skips on a match, and records the new value on
      success. An unchanged deploy costs one `SELECT`.
- [x] **Step 3:** Register three seeds — `bundled-exercises`, `einburgertest`,
      `einburgertest-images` — each hashing its *mapped output* so mapper edits count as changes.
- [x] **Step 4:** Call from `bootstrap()` **after** `app.listen()`. A failure logs and is swallowed.
      `SKIP_CONTENT_SEED=true` short-circuits the whole thing.

### Task 5: Seed the images

**Files:**
- Modify: `backend/src/services/questionImages.ts`
- Modify: `backend/src/routes/questionImages.ts`
- Create: `backend/src/services/seedQuestionImages.ts`

- [x] **Step 1:** Lift the hand-rolled upsert out of the admin PUT handler into
      `upsertQuestionImage()` in the service, taking `source` as a parameter. Both callers then run
      identical SQL.
- [x] **Step 2:** `seedQuestionImages()` reads the manifest, verifies every referenced file exists,
      and upserts each with `source: 'seed'` — but only where no `source = 'admin'` row already
      occupies the slot. A human upload always outranks the seed.
- [x] **Step 3:** Delete `question_images` rows with `source = 'seed'` that the manifest no longer
      lists, so removing an image from git removes it from the app.

### Task 6: Strip the artwork overrides from the mapper

**Files:**
- Modify: `backend/src/services/mapEinburgertestQuestion.ts`
- Modify: `backend/src/services/mapEinburgertestQuestion.test.ts`

- [x] **Step 1:** Delete `EINBURGERTEST_MEDIA_OVERRIDES`, the `IMG` constant, and the override
      branches at the end of `mapEinburgertestQuestion`. The function reduces to: build the base
      exercise, attach the described-image fallback, return.
- [x] **Step 2:** Drop the `!(override && 'optionImages' in override)` guard on `split` — with no
      overrides, every picker question splits its description per option again.
- [x] **Step 3:** Replace the `sourcedIds` file-existence test with one asserting the manifest's
      referenced files all exist and its `exerciseId`s all resolve in the catalog.

### Task 7: CI guard

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] **Step 1:** Add a `migrations` job with a `postgres:16` service container that runs
      migrations then content seeds against an empty database. Auto-running migrations is only
      safe if a broken one fails the pull request rather than the deploy.

### Task 8: Documentation

**Files:**
- Modify: `docs/render-deployment.md`
- Modify: `docs/einburgertest-image-sourcing.md`

- [x] **Step 1:** Rewrite the "Content seeding" section: seeding happens on deploy; the npm scripts
      remain as manual escape hatches.
- [x] **Step 2:** Rewrite the image doc around the manifest, and record that all 13 questions now
      ship the official composite sheet.

---

## Risks

- **Boot-time content seeding ships a bad manifest to production with no human gate.** Mitigated by
  the CI job and by seeds running after `listen()`. Render's Pre-Deploy Command is the alternative
  if a per-deploy gate is wanted later.
- **Copyright.** Questions 70, 181, 216 and 235 embed third-party press photography (216 also a
  copyrighted sculpture) inside an otherwise-official BAMF sheet; § 5 Abs. 1 UrhG covers the sheet,
  not the photographs within it. Shipping all 13 was an explicit decision. The four are tagged in
  the manifest so they can be pulled in one edit.
