CREATE TABLE IF NOT EXISTS snapshot_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  snapshot_month TEXT NOT NULL,
  validation_version INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  issues_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS snapshot_validations_company_month_version_idx
  ON snapshot_validations(company_id, snapshot_month, validation_version);

CREATE INDEX IF NOT EXISTS snapshot_validations_company_month_status_idx
  ON snapshot_validations(company_id, snapshot_month, status);

CREATE TABLE IF NOT EXISTS data_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'syncing',
  last_sync_started_at TIMESTAMPTZ,
  last_sync_completed_at TIMESTAMPTZ,
  last_snapshot_month TEXT,
  last_balance_asof_date DATE,
  error_message TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS data_sync_status_status_updated_idx
  ON data_sync_status(status, "updatedAt");
