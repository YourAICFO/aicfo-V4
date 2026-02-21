# Data Health / Mapping Transparency (Phase 1.9)

## Overview

The **Data Health** page is a read-only diagnostics view that helps users understand how well their accounting data is mapped into the platform’s CFO categories. It supports scalable onboarding across different accounting sources by surfacing coverage gaps and impact without exposing raw source schema.

## What the metrics mean

| Metric | Description |
|--------|-------------|
| **Coverage % (classifiedPct)** | Percentage of known ledgers that are classified into at least one CFO category (Revenue, Expenses, Debtors, Creditors, Cash/Bank, Inventory). |
| **Total / Classified / Unclassified ledgers** | Counts of ledgers: total known to the system, how many are mapped to a category, and how many are not. |
| **Top unclassified ledgers** | Up to 10 ledgers that have no CFO category. Balance may be null when not available from normalized data. |
| **COGS mapping status** | Whether the last closed month has expense data mapped to a COGS proxy category (e.g. Purchases, COGS, Direct Expenses). |
| **Inventory mapping status** | Inventory total for last closed month, count of inventory ledgers, and an optional warning when total is zero but P&L suggests activity. |
| **Debtors / Creditors mapping status** | Totals and whether aging metrics (DSO/DPO) are available for the period. |
| **Last sync** | From `data_sync_status`: last sync time, status, and error message if the last run failed. |
| **Available months / Latest month** | Number of months with trial balance summary and the latest month key (YYYY-MM). |

## Why COGS and inventory mapping matter

- **COGS (Cost of Goods Sold) proxy**  
  Used as the denominator (or part of it) for **DIO** (Days Inventory Outstanding) and **DPO** (Days Payable Outstanding). If no expense ledgers are mapped to a COGS-like category, the platform cannot compute a meaningful **CCC** (Cash Conversion Cycle) or DIO/DPO.

- **Inventory mapping**  
  Inventory balances feed working-capital views and DIO. If inventory ledgers are not mapped to the Inventory category, inventory total stays zero and the “inventory build-up” style alerts and CCC may be wrong or unavailable.

## How to fix missing mappings (high-level)

1. **Unclassified ledgers**  
   Use the mapping rules (or future mapping UI) so that each ledger’s group/parent maps to a CFO category. Data Health lists top unclassified ledgers to prioritize.

2. **COGS not available**  
   Ensure expense ledgers that represent cost of sales (e.g. Purchases, COGS, Direct Expenses) are categorized under a **COGS proxy** category in the expense breakdown / mapping. The exact category names are normalized (e.g. “purchases”, “cost of goods sold”).

3. **Inventory zero but you have stock**  
   Map all inventory/stock ledgers to the **Inventory** CFO category so they appear in trial balance and working capital.

4. **Debtors/creditors aging missing**  
   Ensure Sundry Debtors / Accounts Receivable and Sundry Creditors / Accounts Payable are mapped to **Debtors** and **Creditors** respectively, and that sync has run so that monthly debtor/creditor snapshots and metrics (e.g. debtor_days, creditor_days) are populated.

5. **Last sync failed**  
   Check the last sync error on Data Health or in Integrations/Sync status; fix the cause (e.g. connector, permissions, source connectivity) and re-run sync.

## Data sources (normalized only)

- **MonthlyTrialBalanceSummary** – available months, latest month, inventory total, revenue/expenses for warnings.
- **LedgerMonthlyBalance** – classified ledger counts and inventory ledger count for last closed month.
- **CFOLedgerClassification** – total vs classified ledger counts; unclassified list (null/empty `cfo_category`).
- **MonthlyExpenseBreakdown** – COGS proxy sum for last closed month (`normalizedExpenseCategory` in COGS proxy list).
- **Debtors/Creditors** – debtorCreditorService.getDebtorsSummary / getCreditorsSummary (from LedgerMonthlyBalance and related).
- **CFOMetric** – debtor_days, creditor_days for aging availability.
- **data_sync_status** – last sync time, status, error message.

No raw Tally (or other source) schema is used; all data comes from these normalized tables and services.

## Smoke checklist

- [ ] Data Health page loads at `/data-health` (or under Integrations/Settings as configured).
- [ ] Top row shows Coverage %, Latest month, Last sync status.
- [ ] “What’s missing” shows top unclassified ledgers (or empty if none).
- [ ] “Impact” shows a message like “CCC unavailable because COGS not mapped” when COGS proxy is missing for last closed month.
- [ ] When inventory total is zero but P&L has activity, an inventory warning appears in Impact or Suggested next steps.
- [ ] Suggested next steps show deterministic bullets (e.g. map unclassified ledgers, map COGS, fix sync).
- [ ] No dependency on raw source schema; all data from normalized tables only.

---

## Layer 1 Closure — Block 1

- [ ] `dataReadyForInsights` appears in API response (`/finance/data-health` and dashboard overview).
- [ ] Dashboard shows green or amber badge (Data Ready / Data Incomplete) next to “Command Center”.
- [ ] Data Health shows Data Ready badge in top row (near Coverage %).
- [ ] Impact messages show severity-based border colors (critical=red, high=orange, medium=amber, low=blue).
- [ ] Clicking “View →” on an impact message navigates to the correct screen (e.g. /integrations, /data-health, /working-capital).
- [ ] No raw source schema used; all data from normalized tables only.
