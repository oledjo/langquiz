CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, notification_key, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_id ON notification_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_key ON notification_deliveries(notification_key);
