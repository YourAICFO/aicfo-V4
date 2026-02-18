CREATE TABLE IF NOT EXISTS connector_company_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  tally_company_id TEXT NOT NULL,
  tally_company_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMP NULL,
  last_sync_status TEXT NULL,
  last_sync_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS connector_company_links_active_company_uidx
  ON connector_company_links(company_id)
  WHERE is_active = TRUE;

CREATE UNIQUE INDEX IF NOT EXISTS connector_company_links_active_user_tally_uidx
  ON connector_company_links(user_id, tally_company_id)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS connector_company_links_user_idx
  ON connector_company_links(user_id, is_active);
