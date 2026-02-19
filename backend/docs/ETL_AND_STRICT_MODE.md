# ETL vs Request-Time and AI Strict Mode

## Overview

The backend separates **ETL (offline) computation** from **request-time (online) reads**. Dashboards and AI answers use only precomputed data in strict mode; they do not recompute from raw transactions at request time.

---

## ETL (Offline) Responsibilities

- **Source ingestion**: Raw data from Tally (and other integrations) is stored in `financial_transactions`, `source_ledgers`, and related tables.
- **Monthly snapshots**: The `monthlySnapshotService` and jobs (e.g. `generateMonthlySnapshots`) compute and write:
  - `monthly_trial_balance_summary` (revenue, expenses, cash, net profit per month)
  - `monthly_revenue_breakdown`, `monthly_expense_breakdown`
  - `monthly_debtor`, `monthly_creditor` aggregates
  - `current_*` tables (e.g. `current_debtor`, `current_creditor`, `current_cash_balance`)
  - `current_liquidity_metric` (runway, burn, etc.)
- **CFO metrics catalog**: `runCatalogMetrics` (and snapshot pipeline) writes precomputed KPIs into `cfo_metrics` (e.g. `revenue_last_closed`, `cash_runway_months`, `revenue_growth_3m`, `debtors_balance_live`).
- **Data sync status**: `data_sync_status` and connector/link state are updated by sync and snapshot jobs.

All numeric KPIs and aggregates that the API exposes for dashboards and AI should be produced by these ETL paths, not derived on the fly from `financial_transactions` or raw ledgers.

---

## Request-Time (Online) Responsibilities

- **Read-only**: Dashboards, revenue/expense/cashflow views, and AI answers read from:
  - `monthly_trial_balance_summary`, `monthly_revenue_breakdown`, `monthly_expense_breakdown`
  - `cfo_metrics` (prefer when available)
  - `current_*` and `current_liquidity_metric` where appropriate
- **No recomputation**: Request handlers must not aggregate `financial_transactions` or raw ledger tables to produce P&L, runway, or growth metrics. If snapshots or metrics are missing, the API returns a clear “data not ready” state (e.g. `dataReady: false`, `reason: 'snapshots_missing'`) instead of inventing numbers.
- **AI strict mode**: The AI layer answers only from stored `cfo_metrics` and related ETL outputs. If required metrics are missing, the answer is “missing metrics” (e.g. `MISSING_METRICS`) rather than computing from raw data.

---

## Data Flow (Strict Mode)

1. **Ingestion** → Raw data lands in `financial_transactions` and source tables.
2. **ETL jobs** → Snapshot and metrics jobs write to `monthly_trial_balance_summary`, `cfo_metrics`, and other ETL tables.
3. **API** → Dashboard and AI endpoints read only from those ETL tables and `cfo_metrics`; they never read from `financial_transactions` for KPIs.
4. **Missing data** → If there are no snapshots for a range, dashboards return `dataReady: false` and optional `reason: 'snapshots_missing'`. AI returns a missing-metrics response instead of computing from raw data.

---

## Key Services and Tables

| Concern            | ETL (writes)                    | Request-time (reads)                    |
|--------------------|----------------------------------|------------------------------------------|
| Monthly P&L        | `monthlySnapshotService` → `monthly_trial_balance_summary` | `dashboardService`, `cfoContextService` |
| Runway / liquidity | Snapshot pipeline → `current_liquidity_metric`; catalog → `cfo_metrics` | `dashboardService` (CFOMetric first, then CurrentLiquidityMetric) |
| Revenue/expense KPIs | `runCatalogMetrics` → `cfo_metrics`      | `dashboardService`, `debtorsService`, `creditorsService` |
| AI answers         | (metrics populated by ETL)       | `cfoQuestionService`, `cfoContextService` (stored metrics only) |

---

## Configuration and Safeguards

- **Mock integrations**: Non-Tally integration sync (mock data) is allowed only when `ENABLE_MOCK_INTEGRATIONS=true` and `NODE_ENV !== 'production'`.
- **Admin error display**: Admin Control Tower shows sanitized error summaries (no stack traces or sensitive strings) for connector and AI failures.

See also: `docs/data_dictionary.md`, `docs/observability.md`, and the metrics catalog in `src/metrics/metricsCatalog.js`.
