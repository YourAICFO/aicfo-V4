CREATE TABLE IF NOT EXISTS cfo_ledger_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  ledger_name TEXT NOT NULL,
  ledger_guid TEXT NOT NULL,
  parent_group TEXT,
  cfo_category TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS cfo_ledger_classifications_company_ledger_idx
  ON cfo_ledger_classifications(company_id, ledger_guid);
