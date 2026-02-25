ALTER TABLE user_exercises
ADD COLUMN IF NOT EXISTS share_status TEXT NOT NULL DEFAULT 'private';

ALTER TABLE user_exercises
ADD COLUMN IF NOT EXISTS share_requested_at TIMESTAMPTZ;

ALTER TABLE user_exercises
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE user_exercises
ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES users(id);

ALTER TABLE user_exercises
DROP CONSTRAINT IF EXISTS user_exercises_share_status_check;

ALTER TABLE user_exercises
ADD CONSTRAINT user_exercises_share_status_check
CHECK (share_status IN ('private', 'pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_user_exercises_share_status ON user_exercises(share_status);
