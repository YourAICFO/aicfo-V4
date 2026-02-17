DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='reason'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='missing_metric_keys'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN missing_metric_keys JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='requested_at'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN requested_at TIMESTAMP NOT NULL DEFAULT NOW();
  END IF;
END $$;
