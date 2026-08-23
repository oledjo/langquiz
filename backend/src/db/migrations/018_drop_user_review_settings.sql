-- Removes an orphan table. 014_user_review_settings.sql created it (commit bc65151) and was
-- deleted again (commit ac6e784) when the review-frequency slider was replaced by Anki-style
-- progress statistics — but deleting the file does not drop the table from any database that had
-- already run it, and those databases still carry both the table and its schema_migrations row.
--
-- Nothing in the codebase reads or writes user_review_settings; per-user scheduling state lives in
-- user_review_schedule (009, extended by 015 for FSRS). Dropping it here makes a database's actual
-- schema match the migrations the repository describes.
DROP TABLE IF EXISTS user_review_settings;
