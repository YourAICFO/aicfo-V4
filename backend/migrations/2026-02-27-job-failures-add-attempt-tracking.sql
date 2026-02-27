-- Add columns to track every attempt vs final-only
ALTER TABLE job_failures ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 5;
ALTER TABLE job_failures ADD COLUMN IF NOT EXISTS is_final_attempt BOOLEAN NOT NULL DEFAULT false;

-- Composite index for the admin /failures endpoint filters
CREATE INDEX IF NOT EXISTS job_failures_company_job_idx ON job_failures(company_id, job_name);

-- Add payload_hash to idempotency locks for content-aware dedup
ALTER TABLE job_idempotency_locks ADD COLUMN IF NOT EXISTS payload_hash TEXT;
