-- Add is_demo to companies for demo company generator (Layer 1 Block 4).
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.is_demo IS 'True when company is a seeded demo (no connector).';
