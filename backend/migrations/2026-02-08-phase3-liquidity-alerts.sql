CREATE TABLE IF NOT EXISTS current_cash_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  account_name VARCHAR(255) NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, account_name)
);

CREATE TABLE IF NOT EXISTS current_debtors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  debtor_name VARCHAR(255) NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, debtor_name)
);

CREATE TABLE IF NOT EXISTS current_creditors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  creditor_name VARCHAR(255) NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, creditor_name)
);

CREATE TABLE IF NOT EXISTS current_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  loan_name VARCHAR(255) NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, loan_name)
);

CREATE TABLE IF NOT EXISTS current_liquidity_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  avg_net_cash_outflow_3m NUMERIC(18,2),
  cash_runway_months NUMERIC(18,2),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id)
);

CREATE TABLE IF NOT EXISTS cfo_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  alert_type VARCHAR(64) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS cfo_alerts_company_id_idx ON cfo_alerts(company_id);
CREATE INDEX IF NOT EXISTS cfo_alerts_generated_at_idx ON cfo_alerts(generated_at);
