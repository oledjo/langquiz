-- Audit trail for Anki imports. The backend connects as the table owner; RLS has no policies so
-- Supabase's public API cannot expose import metadata or mappings.
CREATE TABLE IF NOT EXISTS anki_import_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manifest_hash TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('analyze', 'apply', 'verify')),
  status TEXT NOT NULL CHECK (status IN ('analyzed', 'applied', 'partial', 'failed')),
  source_decks JSONB NOT NULL,
  summary JSONB NOT NULL,
  history_status TEXT NOT NULL CHECK (history_status IN ('not_requested', 'unavailable', 'partial', 'imported')),
  importer_version TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS anki_import_card_mappings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anki_card_id TEXT NOT NULL,
  anki_note_id TEXT NOT NULL,
  source_deck TEXT NOT NULL,
  source_model TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  schedule_hash TEXT NOT NULL,
  import_run_id BIGINT REFERENCES anki_import_runs(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('imported', 'skipped_unchanged', 'needs_review')),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, anki_card_id)
);

CREATE INDEX IF NOT EXISTS idx_anki_import_card_mappings_user_status
  ON anki_import_card_mappings(user_id, status);
CREATE INDEX IF NOT EXISTS idx_anki_import_card_mappings_user_exercise
  ON anki_import_card_mappings(user_id, exercise_id);

ALTER TABLE anki_import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE anki_import_card_mappings ENABLE ROW LEVEL SECURITY;
