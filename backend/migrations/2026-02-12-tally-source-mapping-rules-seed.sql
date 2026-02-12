INSERT INTO source_mapping_rules (source_system, match_field, match_value, normalized_type, normalized_bucket, priority, is_active)
VALUES
  ('tally', 'source_group_name', 'Sales Accounts', 'revenue', 'operating_revenue', 10, TRUE),
  ('tally', 'source_group_name', 'Direct Incomes', 'revenue', 'operating_revenue', 10, TRUE),
  ('tally', 'source_group_name', 'Indirect Incomes', 'revenue', 'other_income', 10, TRUE),

  ('tally', 'source_group_name', 'Purchase Accounts', 'expense', 'cogs', 10, TRUE),
  ('tally', 'source_group_name', 'Direct Expenses', 'expense', 'direct_cost', 10, TRUE),
  ('tally', 'source_group_name', 'Indirect Expenses', 'expense', 'operating_expense', 10, TRUE),

  ('tally', 'source_group_name', 'Sundry Debtors', 'debtor', 'receivable', 10, TRUE),
  ('tally', 'source_group_name', 'Sundry Creditors', 'creditor', 'payable', 10, TRUE),

  ('tally', 'source_group_name', 'Bank Accounts', 'asset', 'cash_bank', 10, TRUE),
  ('tally', 'source_group_name', 'Cash-in-Hand', 'asset', 'cash_bank', 10, TRUE),

  ('tally', 'source_group_name', 'Secured Loans', 'liability', 'debt', 10, TRUE),
  ('tally', 'source_group_name', 'Unsecured Loans', 'liability', 'debt', 10, TRUE),
  ('tally', 'source_group_name', 'Loans (Liability)', 'liability', 'debt', 10, TRUE),

  ('tally', 'source_group_name', 'Duties & Taxes', 'liability', 'statutory_payable', 10, TRUE),
  ('tally', 'source_group_name', 'Provisions', 'liability', 'provisions', 10, TRUE),

  ('tally', 'source_group_name', 'Investments', 'asset', 'investments', 10, TRUE),
  ('tally', 'source_group_name', 'Current Assets', 'asset', 'other_current_asset', 10, TRUE),
  ('tally', 'source_group_name', 'Current Liabilities', 'liability', 'other_current_liability', 10, TRUE)
ON CONFLICT DO NOTHING;
