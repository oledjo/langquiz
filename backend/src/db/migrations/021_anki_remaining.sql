-- Private Anki content is accessible through the authenticated API only.
ALTER TABLE decks ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_decks_private_owner ON decks(owner_id) WHERE is_private = TRUE;

CREATE TABLE IF NOT EXISTS private_anki_media (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sha256 TEXT NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  bytes BYTEA NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  PRIMARY KEY (user_id, sha256)
);
CREATE TABLE IF NOT EXISTS anki_remaining_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manifest_hash TEXT NOT NULL,
  summary JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS anki_remaining_mappings (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_profile TEXT NOT NULL,
  anki_card_id TEXT NOT NULL,
  variant_key TEXT NOT NULL,
  anki_note_id TEXT NOT NULL,
  source_deck TEXT NOT NULL,
  exercise_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  content_hash TEXT NOT NULL,
  source_json JSONB NOT NULL,
  run_id BIGINT REFERENCES anki_remaining_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, source_profile, anki_card_id, variant_key)
);
ALTER TABLE private_anki_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE anki_remaining_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE anki_remaining_mappings ENABLE ROW LEVEL SECURITY;
-- No client policies: direct client access must never expose personal source data or media.
