CREATE INDEX IF NOT EXISTS admin_usage_events_company_created_idx ON admin_usage_events(company_id, created_at);
CREATE INDEX IF NOT EXISTS admin_usage_events_type_created_idx ON admin_usage_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS admin_ai_questions_company_created_idx ON admin_ai_questions(company_id, created_at);
CREATE INDEX IF NOT EXISTS admin_ai_questions_success_created_idx ON admin_ai_questions(success, created_at);
CREATE INDEX IF NOT EXISTS admin_ai_questions_detected_key_idx ON admin_ai_questions(detected_question_key, created_at);
