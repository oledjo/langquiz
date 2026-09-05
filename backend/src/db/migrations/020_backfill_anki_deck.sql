-- Anki imports are German vocabulary and must appear in the German practice deck.
-- Older approval/import paths left deck_id NULL, so repair both private and promoted rows.
UPDATE exercises e
SET deck_id = d.id
FROM decks d
WHERE d.slug = 'german-grammar-vocabulary'
  AND e.deck_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM anki_import_card_mappings m
    WHERE m.exercise_id = e.exercise_id
  );

UPDATE user_exercises ue
SET deck_id = d.id
FROM decks d
WHERE d.slug = 'german-grammar-vocabulary'
  AND ue.deck_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM anki_import_card_mappings m
    WHERE m.user_id = ue.user_id
      AND m.exercise_id = ue.exercise_id
  );
