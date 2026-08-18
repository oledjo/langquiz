CREATE TABLE IF NOT EXISTS user_review_settings (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  interval_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00
    CHECK (interval_multiplier >= 0.50 AND interval_multiplier <= 2.00),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_review_settings ENABLE ROW LEVEL SECURITY;
