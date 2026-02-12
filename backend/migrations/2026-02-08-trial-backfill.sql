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

DO $$
DECLARE
  enum_type_name TEXT;
BEGIN
  SELECT t.typname
  INTO enum_type_name
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'subscriptions'
    AND n.nspname = 'public'
    AND a.attname = 'subscription_status'
    AND a.attnum > 0
    AND NOT a.attisdropped
  LIMIT 1;

  IF enum_type_name IS NULL THEN
    RAISE EXCEPTION 'Could not determine enum type for subscriptions.subscription_status';
  END IF;

  EXECUTE format(
    'UPDATE subscriptions
     SET subscription_status = CASE
       WHEN plan_type IS NOT NULL AND plan_type <> ''FREE'' THEN %L::%I
       ELSE %L::%I
     END,
     trial_start_date = COALESCE(trial_start_date, NOW()),
     trial_end_date = COALESCE(trial_end_date, NOW() - INTERVAL ''1 day''),
     account_locked = CASE
       WHEN plan_type IS NOT NULL AND plan_type <> ''FREE'' THEN FALSE
       ELSE TRUE
     END
     WHERE subscription_status IS NULL;',
    'active', enum_type_name, 'expired', enum_type_name
  );
END $$;

DO $$
DECLARE
  company_enum_type TEXT;
BEGIN
  SELECT t.typname
  INTO company_enum_type
  FROM pg_attribute a
  JOIN pg_type t ON t.oid = a.atttypid
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = 'companies'
    AND n.nspname = 'public'
    AND a.attname = 'subscription_status'
    AND a.attnum > 0
    AND NOT a.attisdropped
  LIMIT 1;

  IF company_enum_type IS NULL THEN
    RAISE EXCEPTION 'Could not determine enum type for companies.subscription_status';
  END IF;

  EXECUTE format(
    'UPDATE companies c
     SET subscription_status = (s.subscription_status::text)::%I,
         trial_start_date = s.trial_start_date,
         trial_end_date = s.trial_end_date
     FROM subscriptions s
     WHERE s.company_id = c.id
       AND c.subscription_status IS NULL;',
    company_enum_type
  );
END $$;
