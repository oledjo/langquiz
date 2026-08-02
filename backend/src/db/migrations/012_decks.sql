CREATE TABLE IF NOT EXISTS decks (
  id                BIGSERIAL PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  origin            TEXT NOT NULL CHECK (origin IN ('official', 'community')),
  owner_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  study_modes       TEXT[] NOT NULL DEFAULT ARRAY['practice']::TEXT[],
  facet_definitions JSONB NOT NULL DEFAULT '[]'::JSONB,
  locales           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  exam_config       JSONB,
  answer_rule_id    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decks_origin ON decks(origin);

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS deck_id BIGINT REFERENCES decks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exercises_deck_id ON exercises(deck_id);

ALTER TABLE user_exercises ADD COLUMN IF NOT EXISTS deck_id BIGINT REFERENCES decks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_exercises_deck_id ON user_exercises(deck_id);

-- Seed the one deck that exists today: the bundled German grammar/vocabulary content.
-- facet_definitions mirrors the level/group/language fields already present on every
-- exercise in frontend/src/exercises/ (see frontend/src/types/exercise.ts's ExerciseLevel/ExerciseGroup).
INSERT INTO decks (slug, title, description, origin, study_modes, facet_definitions, locales)
VALUES (
  'german-grammar-vocabulary',
  'German Grammar & Vocabulary',
  'Practice German grammar and vocabulary across CEFR levels A1 through C2.',
  'official',
  ARRAY['practice']::TEXT[],
  '[
    {"key": "level", "label": "CEFR level", "values": ["A1", "A2", "B1", "B2", "C1", "C2"]},
    {"key": "group", "label": "Category", "values": ["grammar", "vocabulary"]}
  ]'::JSONB,
  ARRAY['en']::TEXT[]
)
ON CONFLICT (slug) DO NOTHING;

-- Backfill: every exercises row stored so far is this bundle content (nothing else has been
-- imported yet). user_exercises is intentionally NOT backfilled — user-authored content isn't
-- deck-scoped in this plan.
UPDATE exercises
SET deck_id = (SELECT id FROM decks WHERE slug = 'german-grammar-vocabulary')
WHERE deck_id IS NULL;
