# AI CFO Platform - Data Dictionary

## Overview

This document provides a comprehensive reference for all database tables, their purposes, and how they relate to the user interface and business logic.

## Core Business Tables

### companies
**Purpose**: Master table for company/organization data
**UI Screens**: Company creation, settings, dashboard header
**Key Columns**:
- `id` (UUID): Primary key
- `name` (TEXT): Company display name
- `owner_id` (UUID): Links to users table
- `pan` (TEXT): Permanent Account Number (India)
- `gstin` (TEXT): GST Identification Number
- `created_at`, `updated_at`: Audit timestamps

### integrations
**Purpose**: Stores accounting software connections
**UI Screens**: Integrations page, connection status
**Key Columns**:
- `id` (UUID): Primary key
- `company_id` (UUID): Links to companies
- `type` (ENUM): TALLY, ZOHO, QUICKBOOKS
- `status` (ENUM): CONNECTED, DISCONNECTED, SYNCING, ERROR
- `config` (JSONB): Connection settings (server URL, company name)
- `last_sync_status` (ENUM): SUCCESS, FAILED, IN_PROGRESS
- `last_sync_error` (TEXT): Error details for failed syncs

### financial_transactions
**Purpose**: Raw transaction data from accounting systems
**UI Screens**: Transactions list, cash flow analysis
**Key Columns**:
- `id` (UUID): Primary key
- `company_id` (UUID): Links to companies
- `date` (DATE): Transaction date
- `type` (ENUM): REVENUE, EXPENSE, OPENING_BALANCE
- `category` (TEXT): Account/category name
- `amount` (DECIMAL): Transaction amount
- `description` (TEXT): Transaction description
- `external_id` (TEXT): ID from source system
- `source` (TEXT): Integration type (TALLY, ZOHO, etc.)

## Monthly Snapshot Tables

### accounting_months
**Purpose**: Tracks which months are closed/booked
**UI Screens**: Dashboard month selection, sync status
**Key Columns**:
- `company_id` (UUID): Links to companies
- `month` (TEXT): YYYY-MM format
- `is_closed` (BOOLEAN): Whether month is closed
- `source_last_synced_at` (TIMESTAMPTZ): Last sync timestamp

### monthly_trial_balance_summary
**Purpose**: Monthly financial summary (P&L + Balance Sheet)
**UI Screens**: Dashboard overview, financial reports
**Key Columns**:
- `company_id` (UUID): Links to companies
- `month` (TEXT): YYYY-MM format
- `total_revenue` (DECIMAL): Monthly revenue
- `total_expenses` (DECIMAL): Monthly expenses
- `net_profit` (DECIMAL): Revenue - Expenses
- `cash_and_bank_balance` (DECIMAL): Ending cash balance

### monthly_revenue_breakdown
**Purpose**: Detailed revenue by category
**UI Screens**: Revenue analysis page, charts
**Key Columns**:
- `company_id` (UUID): Links to companies
- `month` (TEXT): YYYY-MM format
- `revenue_name` (TEXT): Revenue category name
- `normalized_revenue_category` (TEXT): Mapped category
- `amount` (DECIMAL): Revenue amount

### monthly_expense_breakdown
**Purpose**: Detailed expenses by category
**UI Screens**: Expense analysis page, charts
**Key Columns**:
- `company_id` (UUID): Links to companies
- `month` (TEXT): YYYY-MM format
- `expense_name` (TEXT): Expense category name
- `normalized_expense_category` (TEXT): Mapped category
- `amount` (DECIMAL): Expense amount

## Current Balance Tables

### current_cash_balances
**Purpose**: Real-time cash and bank balances
**UI Screens**: Dashboard cash position, cash flow
**Key Columns**:
- `company_id` (UUID): Links to companies
- `account_name` (TEXT): Bank/cash account name
- `balance` (DECIMAL): Current balance

### current_debtors
**Purpose**: Accounts receivable (customers who owe money)
**UI Screens**: Debtors page, aging reports
**Key Columns**:
- `company_id` (UUID): Links to companies
- `debtor_name` (TEXT): Customer name
- `balance` (DECIMAL): Amount owed

### current_creditors
**Purpose**: Accounts payable (suppliers to be paid)
**UI Screens**: Creditors page, payment tracking
**Key Columns**:
- `company_id` (UUID): Links to companies
- `creditor_name` (TEXT): Supplier name
- `balance` (DECIMAL): Amount owed

## Source Normalization Tables

### source_ledgers
**Purpose**: Raw ledger data from accounting systems
**UI Screens**: Admin mapping interface
**Key Columns**:
- `company_id` (UUID): Links to companies
- `source_system` (TEXT): TALLY, ZOHO, etc.
- `source_ledger_name` (TEXT): Original ledger name
- `source_group_name` (TEXT): Parent group name
- `raw_payload` (JSONB): Complete source data

### source_mapping_rules
**Purpose**: Rules to map source accounts to standard categories
**UI Screens**: Admin mapping configuration
**Key Columns**:
- `source_system` (TEXT): TALLY, ZOHO, etc.
- `match_field` (TEXT): Field to match (group_name, account_type)
- `match_value` (TEXT): Value to match
- `normalized_type` (TEXT): REVENUE, EXPENSE, ASSET, LIABILITY
- `normalized_bucket` (TEXT): Standard category name
- `priority` (INTEGER): Rule priority (lower = higher priority)

### accounting_term_mapping
**Purpose**: Maps source terms to normalized terms
**UI Screens**: Mapping coverage reports
**Key Columns**:
- `source_system` (TEXT): TALLY, ZOHO, etc.
- `source_term` (TEXT): Original term
- `normalized_term` (TEXT): Standardized term
- `confidence_score` (DECIMAL): Mapping confidence (0-1)

## CFO Intelligence Tables

### cfo_metrics
**Purpose**: Computed financial metrics and KPIs
**UI Screens**: Dashboard metrics, AI insights
**Key Columns**:
- `company_id` (UUID): Links to companies
- `metric_key` (TEXT): Unique metric identifier
- `metric_value` (DECIMAL): Numeric value
- `metric_text` (TEXT): Text value
- `time_scope` (TEXT): live, 3m, 6m, 12m, mom, yoy
- `month` (TEXT): Reference month (YYYY-MM)

### cfo_alerts
**Purpose**: Financial alerts and warnings
**UI Screens**: Dashboard alerts, notifications
**Key Columns**:
- `company_id` (UUID): Links to companies
- `alert_type` (TEXT): Alert category (e.g., DEBTORS_UP_REVENUE_FLAT)
- `severity` (ENUM): RED, AMBER, GREEN
- `metadata` (JSONB): Alert-specific data

### cfo_questions
**Purpose**: AI-generated financial questions
**UI Screens**: AI chat, insights page
**Key Columns**:
- `question_text` (TEXT): The question being asked
- `category` (TEXT): Question category
- `severity` (ENUM): LOW, MEDIUM, HIGH

## User Management Tables

### users
**Purpose**: User account information
**UI Screens**: Login, registration, profile
**Key Columns**:
- `email` (TEXT): Unique email address
- `name` (TEXT): User display name
- `password_hash` (TEXT): Bcrypt password hash
- `email_verified` (BOOLEAN): Email verification status

### subscriptions
**Purpose**: Subscription and billing information
**UI Screens**: Billing, subscription management
**Key Columns**:
- `company_id` (UUID): Links to companies
- `subscription_status` (ENUM): trial, active, expired
- `trial_ends_at` (TIMESTAMPTZ): Trial expiration
- `max_integrations` (INTEGER): Integration limit

## Audit and Logging Tables

### app_logs
**Purpose**: Application logging and debugging
**UI Screens**: Admin control tower, system health
**Key Columns**:
- `level` (ENUM): error, warn, info, debug
- `message` (TEXT): Log message
- `run_id` (TEXT): Request/operation ID
- `company_id` (UUID): Associated company
- `metadata` (JSONB): Additional context

### audit_log
**Purpose**: Security and compliance audit trail
**UI Screens**: Admin audit view
**Key Columns**:
- `user_id` (UUID): User who performed action
- `company_id` (UUID): Affected company
- `action` (TEXT): Action performed
- `resource_type` (TEXT): Type of resource
- `resource_id` (UUID): Resource identifier
- `changes` (JSONB): What changed

## Sync Status Tables

### data_sync_status
**Purpose**: Overall sync health for each company
**UI Screens**: Dashboard sync status
**Key Columns**:
- `company_id` (UUID): Links to companies
- `status` (ENUM): syncing, processing, ready, failed
- `last_snapshot_month` (TEXT): Latest processed month
- `last_balance_asof_date` (DATE): Balance sheet date
- `error_message` (TEXT): Sync error details

### snapshot_validations
**Purpose**: Data quality validation results
**UI Screens**: Admin data health dashboard
**Key Columns**:
- `company_id` (UUID): Links to companies
- `snapshot_month` (TEXT): Validated month
- `status` (ENUM): valid, warning, invalid
- `issues_json` (JSONB): Validation issues found

## Table-to-Screen Mapping

### Dashboard (/)
- `companies` - Company name in header
- `current_cash_balances` - Cash position cards
- `current_liquidity_metrics` - Runway calculations
- `monthly_trial_balance_summary` - Revenue/expense trends
- `data_sync_status` - Sync status banner

### Revenue (/revenue)
- `monthly_revenue_breakdown` - Revenue by category
- `monthly_trial_balance_summary` - Total revenue trends

### Expenses (/expenses)
- `monthly_expense_breakdown` - Expense by category
- `monthly_trial_balance_summary` - Total expense trends

### Cashflow (/cashflow)
- `current_cash_balances` - Bank account balances
- `monthly_trial_balance_summary` - Cash flow trends
- `cfo_metrics` - Runway and liquidity metrics

### Debtors (/debtors)
- `current_debtors` - Customer balances
- `monthly_debtors` - Historical debtor analysis

### Creditors (/creditors)
- `current_creditors` - Supplier balances
- `monthly_creditors` - Historical creditor analysis

### Integrations (/integrations)
- `integrations` - Connection status and settings
- `data_sync_status` - Sync progress and errors

### Admin Control Tower (/admin/control-tower)
- `app_logs` - System health and errors
- `audit_log` - Security audit trail
- `admin_usage_events` - Usage analytics

## Common Queries for Support

### Check if company has data
```sql
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
```

### Check sync status
```sql
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
```

### Check monthly snapshots
```sql
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
```

This dictionary should be updated as the schema evolves.