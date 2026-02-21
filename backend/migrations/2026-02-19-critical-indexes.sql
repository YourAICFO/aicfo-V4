-- Critical query indexes for Layer 1 performance (Block 4).
-- IF NOT EXISTS used where supported (PostgreSQL 9.5+).

-- monthly_trial_balance_summary: composite for (company_id, month) lookups (table may already have unique on these)
CREATE INDEX IF NOT EXISTS monthly_trial_balance_summary_company_month_idx
  ON monthly_trial_balance_summary(company_id, month);

-- monthly_revenue_breakdown
CREATE INDEX IF NOT EXISTS monthly_revenue_breakdown_company_month_idx
  ON monthly_revenue_breakdown(company_id, month);

-- monthly_expense_breakdown
CREATE INDEX IF NOT EXISTS monthly_expense_breakdown_company_month_idx
  ON monthly_expense_breakdown(company_id, month);

-- ledger_monthly_balances: (company_id, month_key, cfo_category) for data health / filters
CREATE INDEX IF NOT EXISTS ledger_monthly_balances_company_month_category_idx
  ON ledger_monthly_balances(company_id, month_key, cfo_category);

-- cfo_metrics: (company_id, month, metric_key) for metric lookups
CREATE INDEX IF NOT EXISTS cfo_metrics_company_month_key_idx
  ON cfo_metrics(company_id, month, metric_key);
