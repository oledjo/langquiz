-- Stop learning one topic of a deck rather than the whole deck. Same semantics as
-- user_paused_decks: the topic's questions are never due, history and schedule are kept.
CREATE TABLE IF NOT EXISTS user_paused_topics (
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  deck_id   BIGINT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  topic     TEXT NOT NULL,
  paused_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, deck_id, topic)
);
ALTER TABLE user_paused_topics ENABLE ROW LEVEL SECURITY;
