CREATE TABLE IF NOT EXISTS exercise_votes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_votes_exercise_id ON exercise_votes(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_votes_user_id ON exercise_votes(user_id);
