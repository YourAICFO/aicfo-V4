CREATE TABLE IF NOT EXISTS source_ledgers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL,
  source_ledger_id TEXT NULL,
  source_ledger_name TEXT NOT NULL,
  source_group_name TEXT NULL,
  source_parent_group TEXT NULL,
  source_group_path TEXT NULL,
  raw_payload JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS source_ledgers_unique_idx
  ON source_ledgers(company_id, source_system, source_ledger_name);

CREATE TABLE IF NOT EXISTS source_mapping_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  match_field TEXT NOT NULL,
  match_value TEXT NOT NULL,
  normalized_type TEXT NOT NULL,
  normalized_bucket TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS source_mapping_rules_lookup_idx
  ON source_mapping_rules(source_system, match_field, match_value);

CREATE UNIQUE INDEX IF NOT EXISTS source_mapping_rules_unique_idx
  ON source_mapping_rules(source_system, match_field, match_value, normalized_type, normalized_bucket);

ALTER TABLE accounting_term_mapping
  ADD COLUMN IF NOT EXISTS mapping_rule_type TEXT NOT NULL DEFAULT 'system_rule',
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source_rule_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'accounting_term_mapping_source_rule_fk'
  ) THEN
    ALTER TABLE accounting_term_mapping
      ADD CONSTRAINT accounting_term_mapping_source_rule_fk
      FOREIGN KEY (source_rule_id) REFERENCES source_mapping_rules(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO source_mapping_rules (source_system, match_field, match_value, normalized_type, normalized_bucket, priority, is_active)
VALUES
  ('tally', 'group_name', 'sales accounts', 'REVENUE', 'revenue', 10, TRUE),
  ('tally', 'group_name', 'direct incomes', 'REVENUE', 'revenue', 10, TRUE),
  ('tally', 'group_name', 'indirect incomes', 'REVENUE', 'revenue', 10, TRUE),
  ('tally', 'group_name', 'indirect expenses', 'EXPENSE', 'expense', 10, TRUE),
  ('tally', 'group_name', 'direct expenses', 'EXPENSE', 'expense', 10, TRUE),
  ('tally', 'group_name', 'sundry debtors', 'ASSET', 'debtors', 10, TRUE),
  ('tally', 'group_name', 'sundry creditors', 'LIABILITY', 'creditors', 10, TRUE),
  ('tally', 'group_name', 'bank accounts', 'ASSET', 'cash_bank', 10, TRUE),
  ('tally', 'group_name', 'cash-in-hand', 'ASSET', 'cash_bank', 10, TRUE),

  ('zoho', 'account_type', 'income', 'REVENUE', 'revenue', 10, TRUE),
  ('zoho', 'account_type', 'other_income', 'REVENUE', 'revenue', 10, TRUE),
  ('zoho', 'account_type', 'expense', 'EXPENSE', 'expense', 10, TRUE),
  ('zoho', 'account_type', 'cost_of_goods_sold', 'EXPENSE', 'expense', 10, TRUE),
  ('zoho', 'account_type', 'accounts_receivable', 'ASSET', 'debtors', 10, TRUE),
  ('zoho', 'account_type', 'accounts_payable', 'LIABILITY', 'creditors', 10, TRUE),
  ('zoho', 'account_type', 'bank', 'ASSET', 'cash_bank', 10, TRUE),
  ('zoho', 'account_type', 'cash', 'ASSET', 'cash_bank', 10, TRUE),

  ('quickbooks', 'account_type', 'income', 'REVENUE', 'revenue', 10, TRUE),
  ('quickbooks', 'account_type', 'other income', 'REVENUE', 'revenue', 10, TRUE),
  ('quickbooks', 'account_type', 'expense', 'EXPENSE', 'expense', 10, TRUE),
  ('quickbooks', 'account_type', 'cost of goods sold', 'EXPENSE', 'expense', 10, TRUE),
  ('quickbooks', 'account_type', 'accounts receivable', 'ASSET', 'debtors', 10, TRUE),
  ('quickbooks', 'account_type', 'accounts payable', 'LIABILITY', 'creditors', 10, TRUE),
  ('quickbooks', 'account_type', 'bank', 'ASSET', 'cash_bank', 10, TRUE),
  ('quickbooks', 'account_type', 'cash', 'ASSET', 'cash_bank', 10, TRUE),

  ('xero', 'account_type', 'revenue', 'REVENUE', 'revenue', 10, TRUE),
  ('xero', 'account_type', 'other income', 'REVENUE', 'revenue', 10, TRUE),
  ('xero', 'account_type', 'expense', 'EXPENSE', 'expense', 10, TRUE),
  ('xero', 'account_type', 'direct costs', 'EXPENSE', 'expense', 10, TRUE),
  ('xero', 'account_type', 'current asset', 'ASSET', 'debtors', 30, TRUE),
  ('xero', 'account_type', 'current liability', 'LIABILITY', 'creditors', 30, TRUE),
  ('xero', 'account_type', 'bank', 'ASSET', 'cash_bank', 10, TRUE)
ON CONFLICT DO NOTHING;
