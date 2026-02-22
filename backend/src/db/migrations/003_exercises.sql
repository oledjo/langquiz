CREATE TABLE IF NOT EXISTS exercises (
  id          BIGSERIAL PRIMARY KEY,
  exercise_id TEXT NOT NULL UNIQUE,
  data        JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exercises_exercise_id ON exercises(exercise_id);
