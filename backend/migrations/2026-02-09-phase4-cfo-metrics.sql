CREATE TABLE IF NOT EXISTS cfo_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_value NUMERIC(20,4),
  metric_text TEXT,
  time_scope TEXT NOT NULL DEFAULT 'live',
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, metric_key, time_scope)
);

CREATE INDEX IF NOT EXISTS cfo_metrics_company_id_idx ON cfo_metrics(company_id);
CREATE INDEX IF NOT EXISTS cfo_metrics_metric_key_idx ON cfo_metrics(metric_key);
