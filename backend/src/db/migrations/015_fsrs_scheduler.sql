-- Adds the memory-state fields the FSRS (Free Spaced Repetition Scheduler) algorithm needs.
-- Existing columns are reused with FSRS semantics rather than renamed, to keep this migration
-- additive: repetition_count -> FSRS "reps", interval_days -> FSRS "scheduled_days",
-- lapse_count -> FSRS "lapses", due_at -> FSRS "due", last_reviewed_at -> FSRS "last_review".
-- ease_factor is no longer written to (FSRS has no single ease factor) but is left in place
-- rather than dropped, consistent with this table's additive migration history.
ALTER TABLE user_review_schedule ADD COLUMN IF NOT EXISTS stability NUMERIC(10,4) NOT NULL DEFAULT 0;
ALTER TABLE user_review_schedule ADD COLUMN IF NOT EXISTS difficulty NUMERIC(10,4) NOT NULL DEFAULT 0;

-- FSRS Card.state: 0=New, 1=Learning, 2=Review, 3=Relearning.
ALTER TABLE user_review_schedule ADD COLUMN IF NOT EXISTS state SMALLINT NOT NULL DEFAULT 0;
