CREATE TABLE IF NOT EXISTS party_balances_latest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  as_of_date DATE NOT NULL,
  party_type TEXT NOT NULL,
  party_name TEXT NOT NULL,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'snapshot',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, as_of_date, party_type, party_name)
);

CREATE INDEX IF NOT EXISTS party_balances_latest_company_type_date_idx ON party_balances_latest(company_id, party_type, as_of_date);
