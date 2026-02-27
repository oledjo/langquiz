CREATE TABLE IF NOT EXISTS analytics_events (
  id               BIGSERIAL PRIMARY KEY,
  event_name       TEXT NOT NULL,
  session_id       TEXT,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  client_timestamp TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  properties       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
