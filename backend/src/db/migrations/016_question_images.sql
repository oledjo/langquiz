-- Admin-uploaded question artwork. The bytes live in Postgres rather than on disk because the
-- app's filesystem is ephemeral (a redeploy wipes it), and rather than in the exercises row
-- because content re-imports (npm run import:einburgertest) rewrite `data` wholesale — an upload
-- has to survive that.
--
-- option_index NULL = the question's own illustration; 0..n = the picture that IS answer option n
-- (the "which of these four coats of arms" questions).
CREATE TABLE IF NOT EXISTS question_images (
  id           BIGSERIAL PRIMARY KEY,
  exercise_id  TEXT NOT NULL,
  option_index SMALLINT,
  content_type TEXT NOT NULL,
  bytes        BYTEA NOT NULL,
  alt          TEXT NOT NULL DEFAULT '',
  attribution  TEXT,
  uploaded_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT question_images_option_index_range CHECK (option_index IS NULL OR option_index BETWEEN 0 AND 9)
);

-- One row per slot. Split in two because a plain UNIQUE(exercise_id, option_index) would not
-- constrain the NULL (question illustration) rows at all.
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_images_illustration
  ON question_images(exercise_id) WHERE option_index IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_question_images_option
  ON question_images(exercise_id, option_index) WHERE option_index IS NOT NULL;

-- Same reasoning as 013: this backend connects as the table owner and is unaffected, while
-- Supabase's auto-generated REST API is blocked from exposing the table.
ALTER TABLE public.question_images ENABLE ROW LEVEL SECURITY;
