-- P&L Pack: manual remarks + cached AI narrative per company+month
CREATE TABLE IF NOT EXISTS pl_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,
  text TEXT NULL,
  ai_draft_text TEXT NULL,
  ai_draft_updated_at TIMESTAMP NULL,
  updated_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT pl_remarks_company_month_unique UNIQUE (company_id, month)
);

CREATE INDEX IF NOT EXISTS pl_remarks_company_month_idx ON pl_remarks(company_id, month);

COMMENT ON TABLE pl_remarks IS 'P&L Pack: manual remarks and cached AI narrative per company+month';
