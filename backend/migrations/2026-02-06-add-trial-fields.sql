DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'expired');
  END IF;
END $$;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status_enum DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS account_locked BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions (company_id);
CREATE INDEX IF NOT EXISTS subscriptions_trial_end_date_idx ON subscriptions (trial_end_date);
