ALTER TABLE progress
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

ALTER TABLE progress
ADD COLUMN IF NOT EXISTS answer_grade TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'progress_answer_grade_check'
  ) THEN
    ALTER TABLE progress
    ADD CONSTRAINT progress_answer_grade_check
    CHECK (answer_grade IS NULL OR answer_grade IN ('again', 'hard', 'good', 'easy'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_user_id_idempotency_key
ON progress(user_id, idempotency_key);
