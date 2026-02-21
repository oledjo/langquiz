CREATE TABLE IF NOT EXISTS progress (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id  TEXT    NOT NULL,
  correct      INTEGER NOT NULL CHECK (correct IN (0, 1)),
  answered_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_progress_exercise_id ON progress(exercise_id);

CREATE VIEW IF NOT EXISTS exercise_stats AS
SELECT
  exercise_id,
  COUNT(*)      AS total_attempts,
  SUM(correct)  AS correct_attempts,
  MAX(answered_at) AS last_answered
FROM progress
GROUP BY exercise_id;
