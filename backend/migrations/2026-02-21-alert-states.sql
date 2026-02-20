-- Alert fatigue: per-company, per-rule state (snooze, dismiss, condition hash)
CREATE TABLE IF NOT EXISTS alert_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  rule_key VARCHAR(64) NOT NULL,
  snoozed_until TIMESTAMP WITH TIME ZONE NULL,
  dismissed_at TIMESTAMP WITH TIME ZONE NULL,
  last_condition_hash VARCHAR(256) NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT alert_states_company_rule_unique UNIQUE (company_id, rule_key)
);

CREATE INDEX IF NOT EXISTS alert_states_company_id_idx ON alert_states(company_id);

COMMENT ON TABLE alert_states IS 'Alert fatigue: snooze/dismiss state per company and rule; condition hash allows re-show when condition changes';
