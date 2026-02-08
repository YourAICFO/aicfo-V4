CREATE TABLE IF NOT EXISTS monthly_debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  debtor_name VARCHAR(255) NOT NULL,
  closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_debtors_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  percentage_of_total NUMERIC(8,4) NOT NULL DEFAULT 0,
  mom_change NUMERIC(12,4) NOT NULL DEFAULT 0,
  avg_3m NUMERIC(18,2) NOT NULL DEFAULT 0,
  avg_6m NUMERIC(18,2) NOT NULL DEFAULT 0,
  avg_12m NUMERIC(18,2) NOT NULL DEFAULT 0,
  trend_flag VARCHAR(8) NOT NULL DEFAULT 'STABLE',
  concentration_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, month, debtor_name)
);

CREATE INDEX IF NOT EXISTS monthly_debtors_company_id_idx ON monthly_debtors(company_id);
CREATE INDEX IF NOT EXISTS monthly_debtors_month_idx ON monthly_debtors(month);

CREATE TABLE IF NOT EXISTS monthly_creditors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  creditor_name VARCHAR(255) NOT NULL,
  closing_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_creditors_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  percentage_of_total NUMERIC(8,4) NOT NULL DEFAULT 0,
  mom_change NUMERIC(12,4) NOT NULL DEFAULT 0,
  avg_3m NUMERIC(18,2) NOT NULL DEFAULT 0,
  avg_6m NUMERIC(18,2) NOT NULL DEFAULT 0,
  avg_12m NUMERIC(18,2) NOT NULL DEFAULT 0,
  trend_flag VARCHAR(8) NOT NULL DEFAULT 'STABLE',
  concentration_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, month, creditor_name)
);

CREATE INDEX IF NOT EXISTS monthly_creditors_company_id_idx ON monthly_creditors(company_id);
CREATE INDEX IF NOT EXISTS monthly_creditors_month_idx ON monthly_creditors(month);

CREATE TABLE IF NOT EXISTS admin_usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  event_type VARCHAR(64) NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_usage_events_company_id_idx ON admin_usage_events(company_id);
CREATE INDEX IF NOT EXISTS admin_usage_events_user_id_idx ON admin_usage_events(user_id);
CREATE INDEX IF NOT EXISTS admin_usage_events_type_idx ON admin_usage_events(event_type);

CREATE TABLE IF NOT EXISTS admin_ai_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID,
  user_id UUID,
  question TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_ai_questions_company_id_idx ON admin_ai_questions(company_id);
CREATE INDEX IF NOT EXISTS admin_ai_questions_user_id_idx ON admin_ai_questions(user_id);
