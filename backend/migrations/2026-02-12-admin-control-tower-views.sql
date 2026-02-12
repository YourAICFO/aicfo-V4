-- Admin Control Tower aggregate views (additive)

CREATE INDEX IF NOT EXISTS idx_integrations_company_last_synced_at
ON integrations(company_id, last_synced_at);

CREATE INDEX IF NOT EXISTS idx_monthly_trial_balance_summary_company_month
ON monthly_trial_balance_summary(company_id, month);

CREATE INDEX IF NOT EXISTS idx_source_ledgers_company
ON source_ledgers(company_id);

CREATE OR REPLACE VIEW admin_company_metrics AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  c.subscription_status,
  c.created_at,
  MAX(i.last_synced_at) AS last_sync_at,
  MAX(aue."createdAt") AS last_activity_at,
  COUNT(DISTINCT m.month) AS months_ingested,
  COUNT(DISTINCT s.month) AS months_snapshotted
FROM companies c
LEFT JOIN integrations i ON i.company_id = c.id
LEFT JOIN admin_usage_events aue ON aue.company_id = c.id
LEFT JOIN accounting_months m ON m.company_id = c.id
LEFT JOIN monthly_trial_balance_summary s ON s.company_id = c.id
GROUP BY c.id, c.name, c.subscription_status, c.created_at;

CREATE OR REPLACE VIEW admin_usage_metrics AS
SELECT
  TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
  event_type,
  COUNT(*)::int AS events_count,
  COUNT(DISTINCT user_id)::int AS users_count,
  COUNT(DISTINCT company_id)::int AS companies_count
FROM admin_usage_events
GROUP BY 1, 2;

CREATE OR REPLACE VIEW admin_ai_metrics AS
SELECT
  TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
  COUNT(*)::int AS total_questions,
  SUM(CASE WHEN success = true THEN 1 ELSE 0 END)::int AS answered_questions,
  SUM(CASE WHEN success = false THEN 1 ELSE 0 END)::int AS unanswered_questions,
  COUNT(DISTINCT user_id)::int AS users_count
FROM admin_ai_questions
GROUP BY 1;

CREATE OR REPLACE VIEW admin_mapping_coverage AS
WITH mapped AS (
  SELECT DISTINCT LOWER(source_term) AS source_term_lower
  FROM accounting_term_mapping
)
SELECT
  sl.company_id,
  COUNT(*)::int AS ledgers_total,
  COUNT(*) FILTER (
    WHERE LOWER(sl.source_ledger_name) IN (SELECT source_term_lower FROM mapped)
  )::int AS ledgers_mapped,
  ROUND(
    CASE
      WHEN COUNT(*) = 0 THEN 0
      ELSE (
        COUNT(*) FILTER (
          WHERE LOWER(sl.source_ledger_name) IN (SELECT source_term_lower FROM mapped)
        )::numeric / COUNT(*)::numeric
      ) * 100
    END,
    2
  ) AS mapping_coverage_percent
FROM source_ledgers sl
GROUP BY sl.company_id;

CREATE OR REPLACE VIEW admin_snapshot_health AS
SELECT
  c.id AS company_id,
  c.name AS company_name,
  COUNT(DISTINCT s.month)::int AS months_snapshotted,
  MAX(s.month) AS latest_snapshot_month,
  COUNT(*)::int AS snapshot_row_count,
  MAX(i.last_synced_at) AS last_sync_at
FROM companies c
LEFT JOIN monthly_trial_balance_summary s ON s.company_id = c.id
LEFT JOIN integrations i ON i.company_id = c.id
GROUP BY c.id, c.name;
