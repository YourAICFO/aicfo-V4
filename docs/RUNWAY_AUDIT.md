# Cash Runway — Audit Summary

## 1) Where metrics are computed and displayed

### Backend computation

| Metric / concept | Location | How it’s computed |
|-----------------|----------|-------------------|
| **Cash (current)** | `dashboardService.getCFOOverview` | `CurrentCashBalance` sum; else `CashBalance` latest; also `latestSummaryFromRange.cash_and_bank_balance` from `MonthlyTrialBalanceSummary`. |
| **Runway (current)** | `runwayService.getRunway` → `dashboardService.getCFOOverview` | **Cash & bank movement** from `MonthlyTrialBalanceSummary.cash_and_bank_balance` (last 6 available months). `avgNetCashChange6M`; if &lt; 3 months → Insufficient data; if currentCash ≤ 0 → Critical; if avg ≥ 0 → Growing; else `runwayMonths = cashBase / abs(avg)`. Returns `runwaySeries`, `cashBase`, `avgNetCashChange6M`. |
| **Runway (ETL)** | `monthlySnapshotService.computeLiquidityMetrics` | Optional stored runway in `CurrentLiquidityMetric`; Dashboard primary source is `runwayService.getRunway`. |
| **Revenue/expense proxy** | `dashboardService.getCFOOverview` | `revenueProxy3m` = avg of 3 months’ **revenue**; `expenseProxy3m` = avg of 3 months’ **expenses**. Not cash inflow/outflow; labeled as “Revenue proxy (3m)” / “Expense proxy (3m)” in UI. Legacy: `avgMonthlyInflow` / `avgMonthlyOutflow` (deprecated labels). |
| **Cashflow (dashboard)** | `dashboardService.getCashflowDashboard` | Monthly inflow/outflow from **revenue/expenses** (P&L proxy); cash history from `CashBalance`. |
| **Working capital** | `financeApi.getWorkingCapital` | `CFOMetric` / `CurrentLoan` (working_capital, CCC, receivable_days, payable_days, loans, interest). |

### Frontend display

| Screen | What’s shown |
|--------|----------------|
| **Dashboard** (`ModernDashboard.tsx`) | Cash position (same as runway cashBase when available), Runway (months + status + “How calculated” tooltip + optional runwaySeries hover), Revenue proxy (3m), Expense proxy (3m), Revenue vs Expense chart (not labeled as inflow/outflow), Quick actions. |
| **Cashflow** (`Cashflow.tsx`) | Avg net cashflow, avg inflow, avg outflow (from `getCashflow`), charts. **No runway.** |
| **Working Capital** (`WorkingCapital.tsx`) | Working capital, CCC, receivable/payable days, loans, interest. **No runway.** |

---

## 2) Current runway formula (documented)

- **Cash base:** Latest `MonthlyTrialBalanceSummary.cash_and_bank_balance`, or if none, sum of `CurrentCashBalance`. Exposed as `cashBase`; Dashboard cash position uses this when runway is available.
- **Net cash movement:** Month-over-month change in `cash_and_bank_balance` over last 6 **available** months; `avgNetCashChange6M` = average of those net changes.
- **Runway:** &lt; 3 months data → “Insufficient data”. currentCash ≤ 0 → 0 months, “Critical”. avg ≥ 0 → null months, “Growing”. avg &lt; 0 → `runwayMonths = cashBase / abs(avg)`; GREEN if ≥6, AMBER if ≥3, else RED.
- **Data source:** `MonthlyTrialBalanceSummary.cash_and_bank_balance` only for runway; revenue/expense used only as **proxy** labels (Revenue proxy, Expense proxy), not for runway.

---

## 3) Mismatches vs required formula

| Requirement | Current | Mismatch |
|-------------|---------|----------|
| Use **cash & bank movement** from snapshots | Uses **revenue − expenses** (P&L) as proxy | Wrong: P&L ≠ cash movement. Must use `cash_and_bank_balance` month-over-month. |
| `netCashMovement(month) = cashBankClosing(month) − cashBankOpening(month)` | Not computed | Need closing from `MonthlyTrialBalanceSummary.cash_and_bank_balance` and opening = previous month’s closing. |
| `avgNetCashChange6M` = average over **last 6 available months** | 3 months, and fixed calendar | Should use **6** months and **available** months only (from snapshot list). |
| If avg ≥ 0 → “Growing” (or null + “Cash increasing”) | 99 months + GREEN | Should return null runway and label “Growing” / “Cash increasing”. |
| &lt; 3 months available → “Insufficient data” | Not enforced | Need guard and explicit label. |
| currentCashBankClosing ≤ 0 → runway 0, “Critical” | Not explicit | Should set runwayMonths = 0 and status “Critical”. |
| Prefer **available months** only | Fixed calendar months | Should use months that exist in `MonthlyTrialBalanceSummary` for the company. |

---

## 4) Corrections implemented

1. **`runwayService.js`**
   - `getCashBankSeries(companyId, lastN = 6)` and `getRunway(companyId)` as above. `getRunway` also returns `runwaySeries` (max 6 rows: month, netChange, closing), `cashBase`, and `avgNetCashChange6M` for explainability.

2. **Dashboard**
   - Uses `runwayService.getRunway()`; cash position uses same **cashBase** as runway when available. Runway object includes `revenueProxy3m`, `expenseProxy3m` (and legacy `avgMonthlyInflow` / `avgMonthlyOutflow`). No UI label uses “inflow” or “outflow” for these; they are “Revenue proxy (3m)” and “Expense proxy (3m)”.

3. **Cashflow / Working Capital**
   - Unchanged; no runway duplication.

4. **Frontend**
   - Runway card: “How calculated” tooltip; optional runwaySeries hover. Revenue/Expense cards and chart labeled as proxy only, not cashflow.

5. **Tests + docs**
   - `runwayService.test.js` updated for new response fields; `docs/RUNWAY_LOGIC.md` documents formula, explainability, and revenue/expense proxy naming.
