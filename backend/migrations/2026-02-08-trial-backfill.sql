DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_enum') THEN
    CREATE TYPE subscription_status_enum AS ENUM ('trial', 'active', 'expired');
  END IF;
END $$;

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS subscription_status subscription_status_enum;

UPDATE subscriptions
SET subscription_status = CASE
  WHEN plan_type IS NOT NULL AND plan_type <> 'FREE' THEN 'active'
  ELSE 'expired'
END,
trial_start_date = COALESCE(trial_start_date, NOW()),
trial_end_date = COALESCE(trial_end_date, NOW() - INTERVAL '1 day'),
account_locked = CASE
  WHEN plan_type IS NOT NULL AND plan_type <> 'FREE' THEN FALSE
  ELSE TRUE
END
WHERE subscription_status IS NULL;

UPDATE companies c
SET subscription_status = s.subscription_status,
    trial_start_date = s.trial_start_date,
    trial_end_date = s.trial_end_date
FROM subscriptions s
WHERE s.company_id = c.id
  AND c.subscription_status IS NULL;
