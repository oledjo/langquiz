CREATE TABLE IF NOT EXISTS progress (
  id           BIGSERIAL PRIMARY KEY,
  exercise_id  TEXT    NOT NULL,
  correct      BOOLEAN NOT NULL,
  answered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_exercise_id ON progress(exercise_id);

CREATE VIEW IF NOT EXISTS exercise_stats AS
SELECT
  exercise_id,
  COUNT(*)::INT AS total_attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END)::INT AS correct_attempts,
  MAX(answered_at) AS last_answered
FROM progress
GROUP BY exercise_id;
