-- =============================================
-- AI CFO Platform - Validation Queries
-- =============================================
-- Use these queries to validate Tally data ingestion
-- Replace company_id with actual company ID
-- =============================================

-- Company Health Overview
-- Shows basic data presence for a company
SELECT 
  c.id, 
  c.name,
  COUNT(ft.*) as transaction_count,
  COUNT(ccb.*) as cash_accounts,
  COUNT(cd.*) as debtors,
  COUNT(cc.*) as creditors,
  COUNT(am.*) as accounting_months,
  COUNT(mtbs.*) as monthly_snapshots
FROM companies c
LEFT JOIN financial_transactions ft ON ft.company_id = c.id
LEFT JOIN current_cash_balances ccb ON ccb.company_id = c.id
LEFT JOIN current_debtors cd ON cd.company_id = c.id
LEFT JOIN current_creditors cc ON cc.company_id = c.id
LEFT JOIN accounting_months am ON am.company_id = c.id
LEFT JOIN monthly_trial_balance_summary mtbs ON mtbs.company_id = c.id
WHERE c.id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
GROUP BY c.id, c.name;

-- Integration Status Check
-- Shows connection and sync status for all integrations
SELECT 
  i.id,
  i.company_name,
  i.type,
  i.status,
  i.last_sync_status,
  i.last_synced_at,
  i.last_sync_error,
  i.config->>'serverUrl' as server_url,
  i.config->>'companyName' as tally_company,
  dss.status as overall_status,
  dss.last_snapshot_month,
  dss.last_balance_asof_date,
  EXTRACT(DAYS FROM (NOW() - COALESCE(i.last_synced_at, i.created_at))) as days_since_sync
FROM integrations i
LEFT JOIN data_sync_status dss ON dss.company_id = i.company_id
WHERE i.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY i.updated_at DESC;

-- Transaction Analysis
-- Shows transaction distribution and date range
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN type = 'REVENUE' THEN 1 END) as revenue_transactions,
  COUNT(CASE WHEN type = 'EXPENSE' THEN 1 END) as expense_transactions,
  COUNT(CASE WHEN type = 'OPENING_BALANCE' THEN 1 END) as opening_balances,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT category) as unique_categories,
  SUM(CASE WHEN type = 'REVENUE' THEN amount ELSE 0 END) as total_revenue,
  SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END) as total_expenses,
  AVG(CASE WHEN type = 'REVENUE' THEN amount ELSE NULL END) as avg_revenue,
  AVG(CASE WHEN type = 'EXPENSE' THEN amount ELSE NULL END) as avg_expense
FROM financial_transactions 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  AND source = 'TALLY';

-- Monthly Snapshot Health
-- Shows monthly financial summaries with validation
SELECT 
  am.month,
  am.is_closed,
  am.source_last_synced_at,
  COALESCE(mtbs.total_revenue, 0) as revenue,
  COALESCE(mtbs.total_expenses, 0) as expenses,
  COALESCE(mtbs.net_profit, 0) as profit,
  COALESCE(mtbs.cash_and_bank_balance, 0) as cash_balance,
  CASE 
    WHEN mtbs.total_revenue IS NULL THEN 'MISSING_SNAPSHOT'
    WHEN mtbs.total_revenue = 0 AND am.is_closed THEN 'ZERO_REVENUE'
    WHEN mtbs.total_expenses = 0 AND am.is_closed THEN 'ZERO_EXPENSES'
    WHEN mtbs.net_profit IS NULL THEN 'MISSING_PROFIT'
    ELSE 'OK'
  END as health_status
FROM accounting_months am
LEFT JOIN monthly_trial_balance_summary mtbs 
  ON mtbs.company_id = am.company_id AND mtbs.month = am.month
WHERE am.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY am.month DESC
LIMIT 12;

-- Current Balance Summary
-- Shows real-time balances by type
SELECT 
  'Cash' as balance_type, 
  COUNT(*) as account_count, 
  COALESCE(SUM(balance), 0) as total_balance,
  AVG(balance) as avg_balance,
  MIN(balance) as min_balance,
  MAX(balance) as max_balance
FROM current_cash_balances 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 
  'Debtors' as balance_type, 
  COUNT(*) as account_count, 
  COALESCE(SUM(balance), 0) as total_balance,
  AVG(balance) as avg_balance,
  MIN(balance) as min_balance,
  MAX(balance) as max_balance
FROM current_debtors 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 
  'Creditors' as balance_type, 
  COUNT(*) as account_count, 
  COALESCE(SUM(balance), 0) as total_balance,
  AVG(balance) as avg_balance,
  MIN(balance) as min_balance,
  MAX(balance) as max_balance
FROM current_creditors 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b';

-- Source Ledger Mapping
-- Shows Tally ledger import and mapping status
SELECT 
  COUNT(*) as total_ledgers,
  COUNT(DISTINCT source_ledger_name) as unique_ledgers,
  COUNT(DISTINCT source_group_name) as unique_groups,
  COUNT(CASE WHEN raw_payload IS NOT NULL THEN 1 END) as with_payload,
  COUNT(CASE WHEN source_group_name ILIKE '%sales%' THEN 1 END) as sales_groups,
  COUNT(CASE WHEN source_group_name ILIKE '%purchase%' THEN 1 END) as purchase_groups,
  COUNT(CASE WHEN source_group_name ILIKE '%bank%' THEN 1 END) as bank_groups,
  COUNT(CASE WHEN source_group_name ILIKE '%cash%' THEN 1 END) as cash_groups
FROM source_ledgers 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b' 
  AND source_system = 'tally';

-- Mapping Coverage
-- Shows how well Tally accounts are mapped to standard categories
SELECT 
  atm.normalized_type,
  atm.normalized_bucket,
  COUNT(*) as mapped_count,
  COUNT(DISTINCT atm.source_term) as unique_terms,
  AVG(atm.confidence_score) as avg_confidence,
  COUNT(CASE WHEN atm.mapping_rule_type = 'system_rule' THEN 1 END) as system_rules,
  COUNT(CASE WHEN atm.mapping_rule_type = 'manual_rule' THEN 1 END) as manual_rules
FROM accounting_term_mapping atm
WHERE atm.source_system = 'tally'
  AND atm.source_term IN (
    SELECT DISTINCT source_ledger_name 
    FROM source_ledgers 
    WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b' 
      AND source_system = 'tally'
  )
GROUP BY atm.normalized_type, atm.normalized_bucket
ORDER BY mapped_count DESC;

-- Sync Status Details
-- Shows comprehensive sync health
SELECT 
  dss.status,
  dss.last_snapshot_month,
  dss.last_balance_asof_date,
  dss.error_message,
  dss.last_sync_started_at,
  dss.last_sync_completed_at,
  EXTRACT(DAYS FROM (NOW() - COALESCE(dss.last_sync_completed_at, dss.last_sync_started_at))) as days_since_sync,
  CASE 
    WHEN dss.status = 'ready' AND dss.last_snapshot_month >= TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM') THEN 'HEALTHY'
    WHEN dss.status = 'ready' AND dss.last_snapshot_month >= TO_CHAR(CURRENT_DATE - INTERVAL '6 months', 'YYYY-MM') THEN 'STALE'
    WHEN dss.status IN ('syncing', 'processing') THEN 'IN_PROGRESS'
    WHEN dss.status = 'failed' THEN 'FAILED'
    ELSE 'UNKNOWN'
  END as health_status
FROM data_sync_status dss
WHERE dss.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b';

-- Validation Results
-- Shows data quality validation results
SELECT 
  sv.snapshot_month,
  sv.status,
  sv.validation_version,
  sv.updated_at,
  JSON_ARRAY_LENGTH(sv.issues_json::json) as issue_count,
  CASE 
    WHEN sv.status = 'valid' AND JSON_ARRAY_LENGTH(sv.issues_json::json) = 0 THEN 'PERFECT'
    WHEN sv.status = 'valid' AND JSON_ARRAY_LENGTH(sv.issues_json::json) <= 3 THEN 'GOOD'
    WHEN sv.status = 'warning' THEN 'NEEDS_ATTENTION'
    WHEN sv.status = 'invalid' THEN 'CRITICAL'
    ELSE 'UNKNOWN'
  END as quality_status
FROM snapshot_validations sv
WHERE sv.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY sv.snapshot_month DESC, sv.validation_version DESC
LIMIT 10;

-- CFO Metrics Summary
-- Shows key financial metrics
SELECT 
  metric_key,
  metric_value,
  metric_text,
  time_scope,
  month,
  change_pct,
  severity,
  computed_at
FROM cfo_metrics
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  AND time_scope = 'live'
ORDER BY metric_key;

-- Recent Errors and Warnings
-- Shows application errors for troubleshooting
SELECT 
  level,
  message,
  run_id,
  time,
  metadata
FROM app_logs
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  AND level IN ('error', 'warn')
  AND time >= NOW() - INTERVAL '7 days'
ORDER BY time DESC
LIMIT 20;

-- Dashboard Data Readiness
-- Quick check if dashboard can display data
SELECT 
  'Dashboard Ready' as check_type,
  CASE 
    WHEN COUNT(ccb.*) > 0 AND COUNT(mtbs.*) >= 3 THEN '✅ READY'
    ELSE '❌ NOT READY'
  END as status,
  COUNT(ccb.*) || ' cash accounts, ' || COUNT(mtbs.*) || ' monthly snapshots' as details
FROM companies c
LEFT JOIN current_cash_balances ccb ON ccb.company_id = c.id
LEFT JOIN monthly_trial_balance_summary mtbs ON mtbs.company_id = c.id
WHERE c.id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 
  'AI Insights Ready' as check_type,
  CASE 
    WHEN COUNT(cm.*) > 5 THEN '✅ READY'
    ELSE '❌ NOT READY'
  END as status,
  COUNT(cm.*) || ' metrics available' as details
FROM companies c
LEFT JOIN cfo_metrics cm ON cm.company_id = c.id
WHERE c.id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 
  'Alerts Active' as check_type,
  CASE 
    WHEN COUNT(ca.*) > 0 THEN '✅ ACTIVE'
    ELSE '❌ NO ALERTS'
  END as status,
  COUNT(ca.*) || ' alerts triggered' as details
FROM companies c
LEFT JOIN cfo_alerts ca ON ca.company_id = c.id
WHERE c.id = 'd70836db-9122-4b9f-8d92-1bd5559e288b';