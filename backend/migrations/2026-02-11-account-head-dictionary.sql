CREATE TABLE IF NOT EXISTS account_head_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_type TEXT NOT NULL,
  canonical_subtype TEXT,
  match_pattern TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_head_dictionary_type_idx ON account_head_dictionary(canonical_type);
CREATE INDEX IF NOT EXISTS account_head_dictionary_pattern_idx ON account_head_dictionary(match_pattern);

-- Revenue patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('revenue', NULL, 'sales', 10),
  ('revenue', NULL, 'income', 9),
  ('revenue', NULL, 'turnover', 9),
  ('revenue', NULL, 'operating income', 8),
  ('revenue', NULL, 'service income', 8)
ON CONFLICT DO NOTHING;

-- Expense patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('expense', NULL, 'expense', 10),
  ('expense', NULL, 'cost', 9),
  ('expense', NULL, 'charges', 8),
  ('expense', NULL, 'overhead', 8),
  ('expense', 'marketing_expense', 'marketing', 7),
  ('expense', 'salary_expense', 'salary', 7),
  ('expense', 'salary_expense', 'wages', 7),
  ('expense', 'rent_expense', 'rent', 7)
ON CONFLICT DO NOTHING;

-- Debtors patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('debtor', NULL, 'accounts receivable', 10),
  ('debtor', NULL, 'sundry debtors', 9),
  ('debtor', NULL, 'trade receivables', 9)
ON CONFLICT DO NOTHING;

-- Creditors patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('creditor', NULL, 'accounts payable', 10),
  ('creditor', NULL, 'sundry creditors', 9),
  ('creditor', NULL, 'trade payables', 9)
ON CONFLICT DO NOTHING;

-- Cash patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('cash', NULL, 'cash in hand', 10),
  ('cash', NULL, 'cash balance', 9)
ON CONFLICT DO NOTHING;

-- Bank patterns
INSERT INTO account_head_dictionary (canonical_type, canonical_subtype, match_pattern, priority)
VALUES
  ('bank', NULL, 'bank balance', 10),
  ('bank', NULL, 'current account', 9),
  ('bank', NULL, 'bank account', 9)
ON CONFLICT DO NOTHING;

-- Add canonical fields to snapshot tables
ALTER TABLE monthly_revenue_breakdown ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_revenue_breakdown ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_revenue_breakdown ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;

ALTER TABLE monthly_expense_breakdown ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_expense_breakdown ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_expense_breakdown ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;

ALTER TABLE monthly_debtors_snapshot ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_debtors_snapshot ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_debtors_snapshot ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;

ALTER TABLE monthly_creditors_snapshot ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_creditors_snapshot ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_creditors_snapshot ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;

ALTER TABLE monthly_debtors ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_debtors ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_debtors ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;

ALTER TABLE monthly_creditors ADD COLUMN IF NOT EXISTS raw_head_name TEXT;
ALTER TABLE monthly_creditors ADD COLUMN IF NOT EXISTS canonical_type TEXT;
ALTER TABLE monthly_creditors ADD COLUMN IF NOT EXISTS canonical_subtype TEXT;
