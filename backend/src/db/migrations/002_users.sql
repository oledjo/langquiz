-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add user_id to progress (nullable to preserve existing anonymous rows)
ALTER TABLE progress ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);

-- Replace global view with user-scoped view
DROP VIEW IF EXISTS exercise_stats;
CREATE OR REPLACE VIEW exercise_stats AS
SELECT
  user_id,
  exercise_id,
  COUNT(*)::INT AS total_attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END)::INT AS correct_attempts,
  MAX(answered_at) AS last_answered
FROM progress
WHERE user_id IS NOT NULL
GROUP BY user_id, exercise_id;

-- User-owned custom exercises stored server-side
CREATE TABLE IF NOT EXISTS user_exercises (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, exercise_id)
);
CREATE INDEX IF NOT EXISTS idx_user_exercises_user_id ON user_exercises(user_id);
