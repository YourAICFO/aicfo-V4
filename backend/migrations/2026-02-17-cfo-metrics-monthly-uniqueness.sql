ALTER TABLE cfo_metrics
  ADD COLUMN IF NOT EXISTS month VARCHAR(7);

UPDATE cfo_metrics
SET month = TO_CHAR(DATE_TRUNC('month', COALESCE(updated_at, NOW())), 'YYYY-MM')
WHERE time_scope = 'month'
  AND month IS NULL;

ALTER TABLE cfo_metrics
  DROP CONSTRAINT IF EXISTS cfo_metrics_company_id_metric_key_time_scope_key;

DROP INDEX IF EXISTS cfo_metrics_company_id_metric_key_time_scope_key;
DROP INDEX IF EXISTS cfo_metrics_company_id_metric_key_time_scope_idx;

CREATE UNIQUE INDEX IF NOT EXISTS cfo_metrics_monthly_unique_idx
  ON cfo_metrics(company_id, metric_key, time_scope, month)
  WHERE time_scope = 'month';

CREATE UNIQUE INDEX IF NOT EXISTS cfo_metrics_latest_unique_idx
  ON cfo_metrics(company_id, metric_key, time_scope)
  WHERE time_scope <> 'month';

CREATE INDEX IF NOT EXISTS cfo_metrics_lookup_idx
  ON cfo_metrics(company_id, metric_key, time_scope, month DESC);
