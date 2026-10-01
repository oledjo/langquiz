-- Daily study limits (Anki-style): how many review cards and how many never-seen cards a learner
-- takes on per day. Rows are optional; a missing row means the defaults below.
CREATE TABLE IF NOT EXISTS user_study_settings (
  user_id            BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  daily_review_limit INT NOT NULL DEFAULT 200 CHECK (daily_review_limit BETWEEN 0 AND 9999),
  daily_new_limit    INT NOT NULL DEFAULT 20 CHECK (daily_new_limit BETWEEN 0 AND 999),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE user_study_settings ENABLE ROW LEVEL SECURITY;

-- Which mode an answer was given in. Exam answers don't touch the review schedule, so they must
-- not count against the day's review/new limits either. NULL = recorded before this column
-- existed, treated as practice.
ALTER TABLE progress ADD COLUMN IF NOT EXISTS mode TEXT CHECK (mode IN ('practice', 'exam'));
