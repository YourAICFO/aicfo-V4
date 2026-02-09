ALTER TABLE cfo_metrics ADD COLUMN IF NOT EXISTS month VARCHAR(7);
ALTER TABLE cfo_metrics ADD COLUMN IF NOT EXISTS change_pct NUMERIC(12,4);
ALTER TABLE cfo_metrics ADD COLUMN IF NOT EXISTS severity TEXT;
ALTER TABLE cfo_metrics ADD COLUMN IF NOT EXISTS computed_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS cfo_metrics_company_month_idx ON cfo_metrics(company_id, month);
