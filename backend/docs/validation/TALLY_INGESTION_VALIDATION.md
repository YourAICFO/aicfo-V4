# Tally Data Ingestion Validation Checklist

## Overview

This checklist helps verify that Tally data ingestion is working correctly for a company. Use this when troubleshooting sync issues or validating new integrations.

## Before You Start

**Required Information:**
- Company ID (example: `d70836db-9122-4b9f-8d92-1bd5559e288b`)
- Access to database (via psql, pgAdmin, or admin dashboard)

## Step-by-Step Validation

### Step 1: Check Integration Status ✅

**What to verify:** Tally integration is properly connected

**SQL Query:**
```sql
SELECT 
  id,
  type,
  status,
  company_name,
  config->>'serverUrl' as server_url,
  config->>'companyName' as tally_company,
  last_sync_status,
  last_synced_at,
  last_sync_error
FROM integrations 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b' 
  AND type = 'TALLY'
ORDER BY updated_at DESC;
```

**Expected Results:**
- ✅ Status should be "CONNECTED" 
- ✅ Last sync status should be "SUCCESS"
- ✅ Last sync error should be NULL
- ✅ Server URL and company name should be populated

**Common Issues:**
- ❌ Status = "ERROR" → Check last_sync_error for details
- ❌ Status = "SYNCING" → Sync may be stuck, wait or investigate
- ❌ Last sync error = "Cannot connect to Tally server" → Tally not running or wrong URL

---

### Step 2: Verify Raw Data Ingestion ✅

**What to verify:** Transactions are being imported from Tally

**SQL Query:**
```sql
SELECT 
  COUNT(*) as total_transactions,
  COUNT(CASE WHEN type = 'REVENUE' THEN 1 END) as revenue_transactions,
  COUNT(CASE WHEN type = 'EXPENSE' THEN 1 END) as expense_transactions,
  MIN(date) as earliest_date,
  MAX(date) as latest_date,
  COUNT(DISTINCT category) as unique_categories
FROM financial_transactions 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b' 
  AND source = 'TALLY';
```

**Expected Results:**
- ✅ Total transactions > 0 (should have data)
- ✅ Revenue and expense transactions present
- ✅ Date range covers recent months
- ✅ Multiple categories found

**Common Issues:**
- ❌ 0 transactions → Tally connection failed or no data to import
- ❌ Only one type (revenue/expense) → Mapping issues
- ❌ Very old dates → Sync not running or Tally data outdated

---

### Step 3: Check Source Ledger Mapping ✅

**What to verify:** Tally ledgers are being mapped to our system

**SQL Query:**
```sql
SELECT 
  COUNT(*) as total_ledgers,
  COUNT(DISTINCT source_ledger_name) as unique_ledgers,
  COUNT(DISTINCT source_group_name) as unique_groups
FROM source_ledgers 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b' 
  AND source_system = 'tally';
```

**Expected Results:**
- ✅ Total ledgers > 0
- ✅ Multiple unique ledgers found
- ✅ Multiple unique groups found

---

### Step 4: Validate Monthly Snapshots ✅

**What to verify:** Monthly financial summaries are generated

**SQL Query:**
```sql
SELECT 
  am.month,
  am.is_closed,
  am.source_last_synced_at,
  COALESCE(mtbs.total_revenue, 0) as revenue,
  COALESCE(mtbs.total_expenses, 0) as expenses,
  COALESCE(mtbs.net_profit, 0) as profit,
  COALESCE(mtbs.cash_and_bank_balance, 0) as cash_balance
FROM accounting_months am
LEFT JOIN monthly_trial_balance_summary mtbs 
  ON mtbs.company_id = am.company_id AND mtbs.month = am.month
WHERE am.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY am.month DESC
LIMIT 6;
```

**Expected Results:**
- ✅ At least 3 months of data
- ✅ Revenue and expenses are non-zero for closed months
- ✅ Net profit calculated correctly (revenue - expenses)
- ✅ Cash balance populated
- ✅ Recent months have sync timestamps

**Common Issues:**
- ❌ Missing months → Snapshot generation failed
- ❌ Zero revenue/expenses → Data mapping issues
- ❌ Negative cash balance → Possible data quality issue

---

### Step 5: Check Current Balances ✅

**What to verify:** Real-time balances are available

**SQL Query:**
```sql
SELECT 'Cash' as balance_type, COUNT(*) as count, SUM(balance) as total_balance
FROM current_cash_balances 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 'Debtors' as balance_type, COUNT(*) as count, SUM(balance) as total_balance
FROM current_debtors 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'

UNION ALL

SELECT 'Creditors' as balance_type, COUNT(*) as count, SUM(balance) as total_balance
FROM current_creditors 
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b';
```

**Expected Results:**
- ✅ Cash accounts: 1+ accounts, positive balance
- ✅ Debtors: 1+ customers, reasonable balance
- ✅ Creditors: 1+ suppliers, reasonable balance

---

### Step 6: Verify Sync Status ✅

**What to verify:** Overall sync health

**SQL Query:**
```sql
SELECT 
  status,
  last_snapshot_month,
  last_balance_asof_date,
  error_message,
  EXTRACT(DAYS FROM (NOW() - last_sync_completed_at)) as days_since_sync
FROM data_sync_status
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b';
```

**Expected Results:**
- ✅ Status = "ready"
- ✅ Last snapshot month = most recent closed month
- ✅ Error message = NULL
- ✅ Days since sync < 2 (recent sync)

---

### Step 7: Check Data Quality ✅

**What to verify:** Data validation results

**SQL Query:**
```sql
SELECT 
  snapshot_month,
  status,
  validation_version,
  updated_at,
  JSON_ARRAY_LENGTH(issues_json::json) as issue_count
FROM snapshot_validations
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY snapshot_month DESC, validation_version DESC
LIMIT 5;
```

**Expected Results:**
- ✅ Status = "valid" or "warning" (not "invalid")
- ✅ Issue count = 0 or low number
- ✅ Recent validation timestamp

---

## Quick Health Check Script

Run this single query for a comprehensive overview:

```sql
WITH company_health AS (
  SELECT 
    'Transactions' as metric,
    COUNT(*)::text as value,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
  FROM financial_transactions 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  
  UNION ALL
  
  SELECT 
    'Monthly Snapshots' as metric,
    COUNT(*)::text as value,
    CASE WHEN COUNT(*) >= 3 THEN '✅' ELSE '❌' END as status
  FROM monthly_trial_balance_summary 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  
  UNION ALL
  
  SELECT 
    'Cash Accounts' as metric,
    COUNT(*)::text as value,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
  FROM current_cash_balances 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  
  UNION ALL
  
  SELECT 
    'Debtors' as metric,
    COUNT(*)::text as value,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
  FROM current_debtors 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  
  UNION ALL
  
  SELECT 
    'Creditors' as metric,
    COUNT(*)::text as value,
    CASE WHEN COUNT(*) > 0 THEN '✅' ELSE '❌' END as status
  FROM current_creditors 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
  
  UNION ALL
  
  SELECT 
    'Latest Month' as metric,
    COALESCE(MAX(month), 'None') as value,
    CASE WHEN MAX(month) >= TO_CHAR(CURRENT_DATE - INTERVAL '2 months', 'YYYY-MM') THEN '✅' ELSE '❌' END as status
  FROM monthly_trial_balance_summary 
  WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
)
SELECT * FROM company_health;
```

## Troubleshooting Common Issues

### Issue: "Cannot connect to Tally server"
**Possible Causes:**
1. Tally is not running
2. Tally API is not enabled
3. Wrong server URL (not localhost:9000)
4. Firewall blocking connection

**Solution:**
1. Start Tally ERP 9/Prime
2. Enable Tally API (F12 > Advanced Configuration > Tally API)
3. Verify correct server URL with customer
4. Check firewall settings

### Issue: "0 transactions imported"
**Possible Causes:**
1. No transactions in selected date range
2. Company name mismatch
3. Tally data export permissions

**Solution:**
1. Check Tally has transactions in recent months
2. Verify company name matches exactly
3. Check Tally user permissions for data export

### Issue: "Missing monthly snapshots"
**Possible Causes:**
1. Snapshot generation job failed
2. No transactions to process
3. Data validation errors

**Solution:**
1. Check worker logs for errors
2. Verify transactions exist (Step 2)
3. Check validation results (Step 7)

### Issue: "Zero cash/debtors/creditors"
**Possible Causes:**
1. Tally chart of accounts not mapped
2. Ledger classification failed
3. Current balances not provided

**Solution:**
1. Check source_ledgers table has data
2. Verify mapping rules are applied
3. Check if Tally provides current balances

## Next Steps After Validation

If all checks pass ✅:
1. Dashboard should show financial data
2. AI insights should be generated
3. Alerts should trigger based on metrics

If any checks fail ❌:
1. Check application logs for errors
2. Review integration configuration
3. Contact technical support with specific error messages

## Validation Queries File

Save these queries as `validation_queries.sql` for easy access:

```sql
-- Company Health Overview
SELECT 
  c.id, c.name,
  COUNT(ft.*) as transaction_count,
  COUNT(ccb.*) as cash_accounts,
  COUNT(cd.*) as debtors,
  COUNT(cc.*) as creditors
FROM companies c
LEFT JOIN financial_transactions ft ON ft.company_id = c.id
LEFT JOIN current_cash_balances ccb ON ccb.company_id = c.id
LEFT JOIN current_debtors cd ON cd.company_id = c.id
LEFT JOIN current_creditors cc ON cc.company_id = c.id
WHERE c.id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
GROUP BY c.id, c.name;

-- Integration Status
SELECT 
  i.company_name,
  i.status,
  i.last_sync_status,
  i.last_synced_at,
  i.last_sync_error,
  dss.status as overall_status,
  dss.last_snapshot_month
FROM integrations i
LEFT JOIN data_sync_status dss ON dss.company_id = i.company_id
WHERE i.company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY i.updated_at DESC;

-- Monthly Summary
SELECT 
  month,
  total_revenue,
  total_expenses,
  net_profit,
  cash_and_bank_balance
FROM monthly_trial_balance_summary
WHERE company_id = 'd70836db-9122-4b9f-8d92-1bd5559e288b'
ORDER BY month DESC
LIMIT 6;