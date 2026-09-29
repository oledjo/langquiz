-- A user can stop learning a deck: its questions leave the spaced-repetition queue (nothing from
-- the deck is ever "due"), while progress history and the FSRS state stay untouched so the
-- statistics remain and resuming picks the schedule back up where it was.
CREATE TABLE IF NOT EXISTS user_paused_decks (
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id   BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, deck_id)
);

ALTER TABLE user_paused_decks ENABLE ROW LEVEL SECURITY;
