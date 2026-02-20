-- Add inventory closing balance to monthly trial balance summary (Layer-1 Inventory Intelligence).
-- Populated from normalized ledger snapshot (inventory group total).
ALTER TABLE monthly_trial_balance_summary
  ADD COLUMN IF NOT EXISTS inventory_total NUMERIC(18,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN monthly_trial_balance_summary.inventory_total IS 'Sum of inventory-group ledgers for the month (closing balance).';
