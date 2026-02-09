DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='detected_question_key'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN detected_question_key TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='failure_reason'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN failure_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='admin_ai_questions' AND column_name='metrics_used_json'
  ) THEN
    ALTER TABLE admin_ai_questions ADD COLUMN metrics_used_json JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;
