CREATE TABLE IF NOT EXISTS company_notification_settings (
  company_id UUID PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  enabled_weekly BOOLEAN NOT NULL DEFAULT FALSE,
  weekly_day_of_week INT NULL CHECK (weekly_day_of_week BETWEEN 1 AND 7),
  weekly_time_hhmm TEXT NOT NULL DEFAULT '09:00',
  enabled_monthly BOOLEAN NOT NULL DEFAULT FALSE,
  monthly_day_of_month INT NULL CHECK (monthly_day_of_month BETWEEN 1 AND 28),
  monthly_time_hhmm TEXT NOT NULL DEFAULT '09:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CHECK (weekly_time_hhmm ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CHECK (monthly_time_hhmm ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

CREATE INDEX IF NOT EXISTS company_notification_settings_weekly_enabled_idx
  ON company_notification_settings(enabled_weekly);
CREATE INDEX IF NOT EXISTS company_notification_settings_monthly_enabled_idx
  ON company_notification_settings(enabled_monthly);
