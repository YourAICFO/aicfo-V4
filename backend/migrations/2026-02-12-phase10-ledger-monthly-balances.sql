CREATE TABLE IF NOT EXISTS ledger_monthly_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  month_key TEXT NOT NULL,
  ledger_guid TEXT NOT NULL,
  ledger_name TEXT NOT NULL,
  parent_group TEXT,
  cfo_category TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 0,
  as_of_date DATE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_monthly_balances_company_month_ledger_idx
  ON ledger_monthly_balances(company_id, month_key, ledger_guid);

CREATE INDEX IF NOT EXISTS ledger_monthly_balances_company_category_month_idx
  ON ledger_monthly_balances(company_id, cfo_category, month_key);
