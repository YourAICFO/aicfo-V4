# Source Adapter Architecture (Multi-Accounting)

## Purpose

The intelligence layer (snapshot, metrics, runway, alerts, pl-pack, executive summary) is **source-agnostic**. All downstream services consume only **normalized tables** and never reference raw source schema or Tally/Zoho/QBO-specific fields. This document formalizes the Source Adapter interface and data flow.

---

## 1) Data flow diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCES (raw)                                                               │
│  Tally connector │ Zoho │ QBO │ Xero │ API ingestion                         │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ rawPayload
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCE ADAPTER (per source)                                                 │
│  AccountingSourceAdapter:                                                    │
│    normalizeChartOfAccounts(rawPayload)                                      │
│    normalizeMonthlyBalances(rawPayload)   [or merged in CoA]                 │
│    normalizePartyBalances(rawPayload)     [optional]                         │
│    normalizeAging(rawPayload)              [optional]                         │
│    getSourceMetadata(rawPayload)                                             │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ normalized shape (Unified Financial Model)
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NORMALIZATION LAYER                                                         │
│  sourceNormalizationService: SourceLedger, AccountingTermMapping              │
│  coaPayloadValidator: validates normalized chartOfAccounts                   │
│  cfoAccountMappingService: mapLedgersToCFOTotals (canonical categories)       │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  NORMALIZED TABLES (single source of truth for intelligence)                │
│  LedgerMonthlyBalance │ MonthlyTrialBalanceSummary │ MonthlyRevenueBreakdown │
│  MonthlyExpenseBreakdown │ CurrentDebtor │ CurrentCreditor │ CurrentCashBalance │
│  CurrentLoan │ CFOMetric │ alert_states │ pl_remarks │ …                     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  INTELLIGENCE LAYER (must not reference source-specific fields)              │
│  monthlySnapshotService │ runwayService │ alertsService │ plPackService       │
│  dashboardService │ executive summary │ metrics catalog                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2) Adapter responsibilities

| Method | Responsibility | Current implementation |
|--------|----------------|------------------------|
| **normalizeChartOfAccounts(rawPayload)** | Turn source COA into `{ chartOfAccounts: { groups, ledgers [, balances] }, asOfDate? }`. Ledgers must have `guid`, `name`, `parent` (or `groupName`). | `tallyCoaAdapter.normalizeCoaPayload` (Tally); returns same shape with `balances.current` and `balances.closedMonths`. |
| **normalizeMonthlyBalances(rawPayload)** | Turn source balance snapshot into `{ current?, closedMonths? }` with `items: [{ ledgerGuid, balance }]`. Can be merged into chartOfAccounts by the adapter. | Tally: merged inside `normalizeCoaPayload`. |
| **normalizePartyBalances(rawPayload)** | Turn source AR/AP list into `{ debtors?, creditors? }` with `{ name, balance }`. | Optional; connector can send separately; pipeline may derive from ledger balances. |
| **normalizeAging(rawPayload)** | Turn source aging report into debtors/creditors by bucket (current, 30, 60, 90+). | Optional; not yet required. |
| **getSourceMetadata(rawPayload)** | Return `{ sourceId?, sourceName?, asOfDate?, generatedAt? }`. | Tally: can be derived from payload; not yet formalized. |

Adapters must not be referenced by the intelligence layer. Only the **integration/orchestration layer** (e.g. `integrationService`) calls the adapter and then passes the **normalized output** into the rest of the pipeline.

---

## 3) Unified financial model (normalized shape)

- **Chart of accounts**
  - **groups:** `{ name, parent?, guid?, type? }[]`
  - **ledgers:** `{ guid, name, parent|groupName, type? }[]`
  - **balances:** optional `{ current: { monthKey, asOfDate?, items: [{ ledgerGuid, balance }] }, closedMonths: [{ monthKey, items }] }`

- **Classification (post-adapter)**  
  `cfoAccountMappingService.mapLedgersToCFOTotals` maps group names to canonical categories: revenue, expenses, debtors, creditors, cash_bank. Adapters should output group/parent names that can be mapped via the canonical vocabulary (or the mapping layer is extended per source).

- **Downstream tables**  
  All intelligence and UI read from: `MonthlyTrialBalanceSummary`, `MonthlyRevenueBreakdown`, `MonthlyExpenseBreakdown`, `LedgerMonthlyBalance`, `CurrentDebtor`, `CurrentCreditor`, `CurrentCashBalance`, `CurrentLoan`, `CFOMetric`, `alert_states`, `pl_remarks`, etc. No table in this list stores raw source payload or source-specific field names.

---

## 4) Rules

1. **UI and intelligence layer must never reference raw source schema.**  
   No `tally`, `Tally`, `rawPayload`, or source-specific keys in: `runwayService`, `alertsService`, `plPackService`, `dashboardService`, `monthlySnapshotService` (except when it receives the **already-normalized** `chartOfAccounts` from the job payload).

2. **All downstream services consume only normalized tables.**  
   Pl-pack, alerts, runway, executive summary, metrics, and drivers read only from the normalized tables listed above (and from `getLatestClosedMonthKey` etc.). They do not read from `SourceLedger` for business logic; `SourceLedger` is for mapping/audit only.

3. **Adapter is the only place that knows source shape.**  
   Tally-specific parsing (e.g. `Groups`, `Ledgers`, `closingBalance`) lives in `tallyCoaAdapter`. Zoho/QBO adapters would implement the same interface with their own payload shapes.

4. **Contract.**  
   The formal interface is defined in `backend/src/contracts/AccountingSourceAdapter.js` (JSDoc). New sources must implement the same normalized output shape.

---

## 5) Current implementation summary

| Component | Role |
|-----------|------|
| **tallyCoaAdapter** | Implements chart + balances normalization for Tally. Exposes `normalizeCoaPayload(raw, companyId)` → `{ chartOfAccounts, asOfDate }`. |
| **sourceNormalizationService** | Writes `SourceLedger` and `AccountingTermMapping` from normalized COA or transactions; uses `sourceSystem` (string) so it is source-agnostic. |
| **integrationService** | Calls `normalizeCoaPayload` for Tally, then `upsertSourceLedgersFromChartOfAccounts(companyId, 'tally', …)`, then enqueues snapshot job with **normalized** `chartOfAccounts`. |
| **monthlySnapshotService** | Receives normalized `chartOfAccounts` (groups, ledgers, balances); uses `mapLedgersToCFOTotals` and writes `LedgerMonthlyBalance`, trial balance, breakdowns. No Tally-specific logic. |
| **runwayService, alertsService, plPackService, dashboardService** | Read only from normalized tables and `getLatestClosedMonthKey`. **Verified: no Tally or raw source references.** |

---

## 6) Verification (downstream independence)

- **runwayService:** Uses `MonthlyTrialBalanceSummary.cash_and_bank_balance`, `CurrentCashBalance`; no Tally/source references.
- **alertsService:** Uses `MonthlyTrialBalanceSummary`, `runwayService`, `debtorCreditorService` (which uses `LedgerMonthlyBalance`/current tables); no Tally/source references.
- **plPackService:** Uses `MonthlyTrialBalanceSummary`, `MonthlyRevenueBreakdown`, `MonthlyExpenseBreakdown`, `runwayService`, `debtorCreditorService`; no Tally/source references.
- **Executive summary:** Built inside plPackService from the same normalized data; no Tally/source references.
- **dashboardService:** Uses `runwayService`, `MonthlyTrialBalanceSummary`, `CurrentDebtor`, `CurrentCreditor`, etc.; no Tally/source references.
