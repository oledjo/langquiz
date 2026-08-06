-- Supabase's auto-generated PostgREST API exposes every table in the `public` schema by
-- default, regardless of whether the app uses it. This backend never uses Supabase's client
-- libraries or REST API — it connects directly via DATABASE_URL as the table owner, which
-- bypasses Row-Level Security entirely (Postgres does not apply RLS to a table's owner unless
-- FORCE ROW LEVEL SECURITY is also set, which is not done here). So enabling RLS with no
-- policies blocks all access through Supabase's public API (closing the "table publicly
-- accessible" / "sensitive columns exposed" advisories — users.password_hash chief among them)
-- without affecting this backend's own queries at all.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_review_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
