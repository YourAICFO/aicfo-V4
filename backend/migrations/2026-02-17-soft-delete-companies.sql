ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by_user_id UUID NULL REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS companies_owner_is_deleted_idx
  ON companies(owner_id, is_deleted);

CREATE INDEX IF NOT EXISTS companies_deleted_at_idx
  ON companies(deleted_at);
