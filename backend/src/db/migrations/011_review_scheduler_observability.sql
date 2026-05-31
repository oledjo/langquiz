ALTER TABLE user_review_schedule
ADD COLUMN IF NOT EXISTS scheduler_version TEXT NOT NULL DEFAULT 'sr-v2-2026-05';

ALTER TABLE user_review_schedule
ADD COLUMN IF NOT EXISTS lapse_count INT NOT NULL DEFAULT 0;

ALTER TABLE user_review_schedule
ADD COLUMN IF NOT EXISTS last_answer_grade TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_review_schedule_last_answer_grade_check'
  ) THEN
    ALTER TABLE user_review_schedule
    ADD CONSTRAINT user_review_schedule_last_answer_grade_check
    CHECK (last_answer_grade IS NULL OR last_answer_grade IN ('again', 'hard', 'good', 'easy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_review_schedule_scheduler_version
ON user_review_schedule(user_id, scheduler_version);
