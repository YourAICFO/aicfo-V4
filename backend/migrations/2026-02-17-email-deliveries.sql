CREATE TABLE IF NOT EXISTS email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  sent_at TIMESTAMP NULL,
  to_emails_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  meta_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_deliveries_unique_period_idx
  ON email_deliveries(company_id, type, period_start, period_end);

CREATE INDEX IF NOT EXISTS email_deliveries_company_sent_idx
  ON email_deliveries(company_id, sent_at DESC);
