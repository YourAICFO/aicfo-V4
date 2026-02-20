# Data Consistency Validator (Trust Audit)

## Purpose

The Layer-1 Data Consistency Validator runs reconciliation checks to ensure key numbers align across services and tables. It is **backend-only** and exposed for **admin-only** use (e.g. Control Tower). No customer-facing changes; no AI. For working-capital and DIO/DSO/DPO/CCC terminology, see [INVENTORY_INTELLIGENCE.md](INVENTORY_INTELLIGENCE.md).

---

## Checks (minimum set)

### A) Cash consistency

- **What:** Dashboard cash (runway `cashBase`) must equal the latest `cash_and_bank_balance` in `MonthlyTrialBalanceSummary` for the company.
- **Why:** The dashboard and runway use the same cash base; any mismatch would show different numbers in different places.
- **How:** `runwayService.getRunway(companyId).cashBase` is compared to `MonthlyTrialBalanceSummary` (latest month) `cash_and_bank_balance` within tolerance.

### B) P&L totals reconcile

- **What:** For the selected month, pl-pack revenue must equal the sum of `MonthlyRevenueBreakdown.amount`; pl-pack expenses must equal the sum of `MonthlyExpenseBreakdown.amount`.
- **Why:** Pl-pack reads from `MonthlyTrialBalanceSummary` for totals; breakdowns are line-level. They should match (breakdown sum = summary total).
- **How:** Load pl-pack for the month; query `SUM(amount)` from revenue and expense breakdown tables; compare within tolerance.

### C) YTD consistency

- **What:** Pl-pack YTD current FY (revenue, expenses, net profit) must equal the sum of monthly `MonthlyTrialBalanceSummary` values over the FY-to-date range. Same for YTD last FY same period.
- **Why:** YTD is computed in pl-pack by summing summary rows; the validator recomputes the sum independently to detect drift.
- **How:** Use same FY range as pl-pack (`getFyStartMonthKey` … month, and last FY same period); sum `totalRevenue`, `totalExpenses`, `netProfit` from `MonthlyTrialBalanceSummary`; compare to `pack.ytd` and `pack.ytdLastFy`.

### D) Month availability

- **What:** The list of months returned by pl-months must match the distinct months present in `MonthlyTrialBalanceSummary` for the company.
- **Why:** Pl-months drives the P&L Pack month selector; it should reflect the same snapshot source.
- **How:** Compare `plPackService.getPlMonths(companyId).months` (sorted) to distinct `month` from `MonthlyTrialBalanceSummary` (sorted).

### E) Inventory consistency

- **What:** For the selected month, `MonthlyTrialBalanceSummary.inventory_total` must equal the sum of `LedgerMonthlyBalance.balance` where `cfoCategory = 'inventory'` (and same company/month).
- **Why:** Snapshot inventory is populated from the same normalized ledger totals; a mismatch would indicate classification or aggregation drift.
- **How:** Load summary `inventory_total` for the month; query `SUM(balance)` from `LedgerMonthlyBalance` where `companyId`, `monthKey`, `cfoCategory = 'inventory'`; compare within tolerance. If no inventory ledgers exist, check is WARN (or PASS when summary is zero).

---

## Tolerance

- **Amount tolerance:** Default ₹1. Configurable via query param `amountTol`.
- **Percent tolerance:** Optional; default 0.01 (1%). Configurable via `pctTol`. Used when the absolute difference exceeds the amount tolerance (for large numbers).
- A check **PASS**es if `|actual - expected| ≤ amountTol` or, if greater, `|actual - expected| / max(|expected|, |actual|, 1) ≤ pctTol`.

---

## Endpoint (admin-only)

**GET** `/api/admin/data-consistency?companyId=<uuid>&month=YYYY-MM[&amountTol=1][&pctTol=0.01]`

- **Auth:** `authenticate` + `requireAdmin` (logged-in admin user).
- **Query params:**
  - `companyId` (required): Company UUID.
  - `month` (required): `YYYY-MM`.
  - `amountTol` (optional): Amount tolerance (default 1).
  - `pctTol` (optional): Percent tolerance (default 0.01).

**Response:**

```json
{
  "success": true,
  "data": {
    "month": "2025-01",
    "checks": [
      { "key": "cash_consistency", "status": "PASS", "message": "...", "expected": 12345, "actual": 12345 },
      { "key": "pl_revenue_breakdown", "status": "PASS", "message": "...", "expected": 1000, "actual": 1000 },
      { "key": "pl_expenses_breakdown", "status": "PASS", "message": "...", "expected": 800, "actual": 800 },
      { "key": "inventory_consistency", "status": "PASS", "message": "...", "expected": 5000, "actual": 5000 },
      { "key": "ytd_current_fy", "status": "PASS", "message": "...", "expected": [...], "actual": [...] },
      { "key": "ytd_last_fy", "status": "PASS", "message": "...", "expected": [...], "actual": [...] },
      { "key": "month_availability", "status": "PASS", "message": "...", "expected": 12, "actual": 12 }
    ],
    "tolerance": { "amount": 1, "pct": 0.01 }
  }
}
```

- **status** is one of `PASS`, `WARN`, `FAIL`.

---

## How to run checks locally

1. **Backend running** with DB (e.g. `npm run dev` in `backend`).
2. **Admin user** logged in (token with admin role).
3. **Company and month** that have snapshot data (e.g. company with `MonthlyTrialBalanceSummary` rows).
4. Call:

```bash
curl -s -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "X-Company-Id: <COMPANY_ID>" \
  "http://localhost:3000/api/admin/data-consistency?companyId=<COMPANY_ID>&month=2025-01"
```

Or from the Control Tower UI (if you add a small “Data consistency” section): same URL with the selected company and month.

5. **Optional tolerance:** `&amountTol=2&pctTol=0.02`

---

## Implementation notes

- **Service:** `backend/src/services/dataConsistencyService.js` — `runChecks(companyId, monthKey, tolerance)`.
- **Route:** `backend/src/routes/admin.js` — GET `/data-consistency` (mounted under `/api/admin`).
- No refactors to existing services; validator **reads** the same sources (MonthlyTrialBalanceSummary, breakdowns, pl-pack, runway, pl-months) and compares.
- If pl-pack or runway fail to load, the corresponding checks are WARN or FAIL with a message.

---

## Smoke checklist

- [ ] **Params:** Missing `companyId` or `month` returns 400 with a clear error.
- [ ] **Month format:** Invalid month (not `YYYY-MM`) returns 400.
- [ ] **Auth:** Request without admin auth returns 401 (or 403).
- [ ] **Run validator** for a known company and month that has snapshot data: response has `month`, `checks` array, `tolerance`; each check has `key`, `status`, `message`; optionally `expected` and `actual`.
- [ ] **All PASS:** For a company/month where data is consistent, all checks (cash_consistency, pl_revenue_breakdown, pl_expenses_breakdown, ytd_current_fy, ytd_last_fy, month_availability) show `PASS` (or expected WARN when no data).
- [ ] **Tolerance:** Increasing `amountTol` or `pctTol` can turn a FAIL into PASS when the difference is within the new tolerance.
