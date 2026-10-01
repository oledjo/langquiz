-- FSRS parameters fitted to one learner's own answer history (see services/fsrsOptimizer.ts).
-- No row = the scheduler's default parameters.
CREATE TABLE IF NOT EXISTS user_fsrs_parameters (
  user_id      BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  parameters   DOUBLE PRECISION[] NOT NULL,
  review_count INT NOT NULL,
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_fsrs_parameters ENABLE ROW LEVEL SECURITY;
