-- Plan-based usage tracking: daily counts per company and feature (AI explanations, chat, report downloads).
CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  date DATE NOT NULL,
  feature_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, date, feature_key)
);

CREATE INDEX IF NOT EXISTS ai_usage_daily_company_date_idx
  ON ai_usage_daily(company_id, date);

CREATE INDEX IF NOT EXISTS ai_usage_daily_company_feature_idx
  ON ai_usage_daily(company_id, feature_key);
