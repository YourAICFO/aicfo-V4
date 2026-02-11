CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  filename TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  run_id TEXT NULL,
  company_id UUID NULL,
  event TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_stack TEXT NULL
);

CREATE INDEX IF NOT EXISTS app_logs_time_desc_idx ON app_logs(time DESC);
CREATE INDEX IF NOT EXISTS app_logs_company_time_desc_idx ON app_logs(company_id, time DESC);
CREATE INDEX IF NOT EXISTS app_logs_run_id_idx ON app_logs(run_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL,
  actor_id UUID NULL,
  company_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NULL,
  diff JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS audit_log_company_time_desc_idx ON audit_log(company_id, time DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_time_desc_idx ON audit_log(action, time DESC);
