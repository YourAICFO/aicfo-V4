CREATE TABLE IF NOT EXISTS accounting_months (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT false,
  source_last_synced_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounting_months_company_id_idx ON accounting_months(company_id);
CREATE INDEX IF NOT EXISTS accounting_months_month_idx ON accounting_months(month);

CREATE TABLE IF NOT EXISTS monthly_trial_balance_summary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  cash_and_bank_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_assets NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_equity NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_revenue NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_expenses NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_profit NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_cashflow NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, month)
);

CREATE INDEX IF NOT EXISTS monthly_trial_balance_company_id_idx ON monthly_trial_balance_summary(company_id);
CREATE INDEX IF NOT EXISTS monthly_trial_balance_month_idx ON monthly_trial_balance_summary(month);

CREATE TABLE IF NOT EXISTS monthly_revenue_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  revenue_name VARCHAR(255) NOT NULL,
  normalized_revenue_category VARCHAR(255) NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monthly_revenue_breakdown_company_id_idx ON monthly_revenue_breakdown(company_id);
CREATE INDEX IF NOT EXISTS monthly_revenue_breakdown_month_idx ON monthly_revenue_breakdown(month);

CREATE TABLE IF NOT EXISTS monthly_expense_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  expense_name VARCHAR(255) NOT NULL,
  normalized_expense_category VARCHAR(255) NOT NULL,
  amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monthly_expense_breakdown_company_id_idx ON monthly_expense_breakdown(company_id);
CREATE INDEX IF NOT EXISTS monthly_expense_breakdown_month_idx ON monthly_expense_breakdown(month);

CREATE TABLE IF NOT EXISTS monthly_debtors_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  debtor_name VARCHAR(255) NOT NULL,
  outstanding_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monthly_debtors_snapshot_company_id_idx ON monthly_debtors_snapshot(company_id);
CREATE INDEX IF NOT EXISTS monthly_debtors_snapshot_month_idx ON monthly_debtors_snapshot(month);

CREATE TABLE IF NOT EXISTS monthly_creditors_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  month VARCHAR(7) NOT NULL,
  creditor_name VARCHAR(255) NOT NULL,
  outstanding_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS monthly_creditors_snapshot_company_id_idx ON monthly_creditors_snapshot(company_id);
CREATE INDEX IF NOT EXISTS monthly_creditors_snapshot_month_idx ON monthly_creditors_snapshot(month);

CREATE TABLE IF NOT EXISTS accounting_term_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system VARCHAR(64) NOT NULL,
  source_term VARCHAR(255) NOT NULL,
  normalized_term VARCHAR(255) NOT NULL,
  normalized_type VARCHAR(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS accounting_term_mapping_source_system_idx ON accounting_term_mapping(source_system);
CREATE INDEX IF NOT EXISTS accounting_term_mapping_source_term_idx ON accounting_term_mapping(source_term);
