# Inventory Intelligence (Layer-1)

Deterministic inventory metrics and working-capital extensions. No SKU-level tracking; no stock-management UI. Uses normalized accounting data only.

## Audit summary: DIO / DSO / DPO / CCC denominators

| Metric | Denominator (preferred) | Fallback / note |
|--------|-------------------------|------------------|
| **DSO** (debtor_days) | Monthly revenue (3m avg) | If revenue 0/missing → **null**. |
| **DPO** (creditor_days) | Monthly COGS/purchases proxy | If COGS proxy 0/missing → **null**. Not total expenses. |
| **DIO** (inventory_days) | Monthly COGS/purchases proxy | If COGS proxy 0/missing → **null**; do not use total expenses. |
| **CCC** | DSO + DIO − DPO | **null** unless DSO, DIO, DPO all finite. No fallback. When only DIO is missing, use **cash_gap_ex_inventory** = DSO − DPO (exposed separately). |

**COGS proxy:** Sum of `MonthlyExpenseBreakdown.amount` for the month where `normalizedExpenseCategory` (case-insensitive) is in: `Cost of Goods Sold`, `COGS`, `Purchases`, `Purchase Accounts`, `Direct Expenses`. If none or sum 0, proxy is **null** and DIO/DPO are **null**; `inventory_days_high` alert does not fire.

## Terminology: working capital

- **Net working capital (NWC)** = Receivables + Inventory − Payables. Standard definition. Stored as `net_working_capital`.
- **Liquidity (Cash + NWC)** = Cash + Receivables + Inventory − Payables. Stored as `working_capital`; API also exposes as `liquidity_position` for clarity. UI labels: “Net working capital” and “Liquidity (Cash + NWC)”.

## Scope

- **Snapshot:** `MonthlyTrialBalanceSummary.inventory_total` = sum of ledger balances in the **inventory** group (Stock-in-Hand, Inventory).
- **Metrics:** `inventory_total`, `inventory_delta` (MoM), `average_inventory`, `inventory_days` (DIO), `net_working_capital`, `working_capital` (liquidity), `cash_conversion_cycle` = DSO + DIO − DPO (or DSO − DPO when DIO null).
- **pl-pack:** `current`/`previous` include `inventoryTotal`; `workingCapital` section has `inventoryTotal`, `inventoryDelta`, `inventoryDays`, `cashConversionCycle`.
- **Working Capital page:** Net working capital; Liquidity; Inventory block (current inventory, MoM, DIO, CCC).
- **Alerts:** Inventory up >25% MoM with revenue flat/down (only when previous inventory > 0 and finite); inventory days above threshold only when `inventory_days` is not null (default 90; `INVENTORY_DAYS_ALERT_THRESHOLD`).
- **Data consistency:** Check that `inventory_total` equals sum of inventory-account balances (see [DATA_CONSISTENCY.md](DATA_CONSISTENCY.md)).

## Snapshot

- Migration `2026-02-22-inventory-trial-balance.sql` adds `inventory_total` to `monthly_trial_balance_summary`.
- CFO mapping (`cfoAccountMappingService`) classifies **inventory** from groups: Stock-in-Hand, Inventory.
- `writeLedgerMonthlyBalances` writes inventory-ledger rows and returns `totals.inventory`; snapshot update sets `inventoryTotal` from that.

## Metrics (monthlySnapshotService)

- **Net working capital** = debtors + inventory − creditors. Stored as `net_working_capital`.
- **Liquidity (working_capital)** = cash + debtors + inventory − creditors. Stored as `working_capital`.
- **DIO** = (averageInventory / monthly COGS proxy) × 30; **null** if COGS proxy missing/0.
- **DPO** = (creditors / monthly COGS proxy) × 30; **null** if COGS proxy missing/0.
- **DSO** = (debtors / 3m avg monthly revenue) × 30; **null** if revenue 0.
- **CCC** = DSO + DIO − DPO **only when all three are finite**; otherwise **null** (no DSO−DPO fallback labeled as CCC).
- **Cash gap (ex. inventory)** = DSO − DPO; stored as `cash_gap_ex_inventory` when DSO and DPO are finite and DIO is null (so CCC cannot be computed). Shown in API and UI only when CCC is unavailable.
- Stored: `inventory_total`, `inventory_delta`, `average_inventory`, `inventory_days`, `debtor_days`, `creditor_days`, `cash_conversion_cycle`, `cash_gap_ex_inventory`, `working_capital`, `net_working_capital`.

## How to run locally

1. **Apply migration:** Run `2026-02-22-inventory-trial-balance.sql` on your DB.
2. **Snapshot:** Run monthly snapshot generation so ledger data (with inventory group) is written; summary `inventory_total` is then set from `writeLedgerMonthlyBalances` totals.
3. **Working Capital API:** `GET /api/finance/working-capital` returns `inventory_total`, `inventory_delta`, `inventory_days` (and existing fields).
4. **pl-pack:** `GET` pl-pack for a company/month; response includes `current.inventoryTotal`, `workingCapital.inventoryDays`, `workingCapital.cashConversionCycle`.
5. **Data consistency:** `GET /api/admin/data-consistency?companyId=...&month=YYYY-MM` includes `inventory_consistency` check.

## Smoke checklist

- [ ] Migration applied; `monthly_trial_balance_summary.inventory_total` exists (default 0).
- [ ] For a company with inventory ledgers (Stock-in-Hand / Inventory group): run snapshot; verify `inventory_total` is updated for that month.
- [ ] **Net working capital** displayed correctly (Receivables + Inventory − Payables); **Liquidity (Cash + NWC)** shown separately and consistent with API.
- [ ] Working Capital page shows Inventory block (current inventory, MoM, DIO, CCC).
- [ ] **DIO shows “—” when COGS not mapped** (no expense breakdown rows with COGS-like category); **CCC shows “—” when COGS not mapped** (CCC is null unless all three finite). When CCC is unavailable, Cash gap (ex. inventory) is shown if DSO and DPO are available.
- [ ] pl-pack response has `workingCapital.inventoryDays` and `workingCapital.cashConversionCycle` (and `current.inventoryTotal`); null when COGS proxy absent.
- [ ] Alerts: inventory_up_revenue_flat only when previous inventory > 0 and finite; inventory_days_high only when `inventory_days` is not null.
- [ ] Data consistency: for a company+month with inventory ledgers, `inventory_consistency` check runs (PASS when summary matches sum of inventory accounts).
- [ ] Unit tests: `node --test test/daysMetrics.test.js` pass (DIO/DSO/DPO/CCC null when denominators missing).
