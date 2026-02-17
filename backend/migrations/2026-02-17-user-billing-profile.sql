CREATE TABLE IF NOT EXISTS user_billing_profile (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  trial_started_at TIMESTAMP NULL,
  trial_ends_at TIMESTAMP NULL,
  has_used_trial BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_billing_profile_trial_ends_idx
  ON user_billing_profile(trial_ends_at);
