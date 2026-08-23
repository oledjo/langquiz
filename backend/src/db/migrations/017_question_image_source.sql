-- Where a row in question_images came from, so the boot-time content seeder and a human admin can
-- both write to the same table without fighting.
--
-- 'seed'  = written by seedQuestionImages() from data/question-images.json. The seeder owns these:
--           it overwrites them when the manifest changes and deletes them when an entry is removed.
-- 'admin' = uploaded through /admin. Never touched by the seeder — a person deciding what a
--           question should show outranks the checked-in default.
--
-- The default is 'admin' so every row that already exists (all of them uploaded by hand, since
-- this is the migration that introduces seeding) keeps winning.
ALTER TABLE question_images
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE question_images
  DROP CONSTRAINT IF EXISTS question_images_source_valid;
ALTER TABLE question_images
  ADD CONSTRAINT question_images_source_valid CHECK (source IN ('seed', 'admin'));

-- The seeder's reconcile step scans by source; every other query on this table goes by exercise_id.
CREATE INDEX IF NOT EXISTS idx_question_images_source ON question_images(source);
