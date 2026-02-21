# Cash Runway — Formula and Caveats

## Formula (Layer 1)

Runway is computed from **snapshot cash & bank movement only** (no P&L proxy).

1. **Net cash movement for a month**
   - `netCashMovement(month) = cashBankClosing(month) - cashBankOpening(month)`
   - `cashBankClosing(month)` = `MonthlyTrialBalanceSummary.cash_and_bank_balance` for that month
   - `cashBankOpening(month)` = closing of the previous month (same field for previous month)

2. **Average net cash change**
   - Use **available months only** (months that exist in `MonthlyTrialBalanceSummary` for the company).
   - Take the last 6 months of data (chronologically); between consecutive months we get one net movement. So 6 months of data yield 5 net movements; we average over those.
   - `avgNetCashChange6M` = average of these net movement values (up to 6 months of data).

3. **Current cash**
   - `currentCashBankClosing` = latest month’s `cash_and_bank_balance` from `MonthlyTrialBalanceSummary`, or if none, sum of `CurrentCashBalance` (live cash accounts).

4. **Runway**
   - If **&lt; 3 months** of snapshot data available → **“Insufficient data”** (no numeric runway).
   - If **currentCashBankClosing ≤ 0** → **runwayMonths = 0**, **“Critical”**.
   - If **avgNetCashChange6M ≥ 0** (or null) → **runwayMonths = null**, **“Growing”** (cash increasing).
   - If **avgNetCashChange6M &lt; 0** →  
     `runwayMonths = currentCashBankClosing / abs(avgNetCashChange6M)`  
     Status: **GREEN** if ≥ 6 months, **AMBER** if ≥ 3 and &lt; 6, **RED** if &lt; 3.

## Data source

- **Tables:** `monthly_trial_balance_summary` (field `cash_and_bank_balance`), optionally `current_cash_balances` for “current” cash when no snapshot exists.
- **No bank feeds:** Runway uses only accounting/snapshot data (trial balance ETL). No direct bank integration.

## Caveats

- **Cash vs P&L:** Runway is based on **cash and bank movement** (month-over-month change in cash + bank balance), not revenue minus expenses. Revenue/expenses are used elsewhere (e.g. Dashboard chart) but not for runway.
- **Available months:** Only months present in the snapshot table are used. No fixed calendar assumption beyond “last N available”.
- **Minimum data:** Fewer than 3 months of data → “Insufficient data”; no runway number is shown.
- **Positive average:** When cash is increasing on average, runway is not a number; the UI shows “Growing” (or “Cash increasing”).
- **Zero/negative cash:** Runway is set to 0 and status “Critical”.

## Explainability payload

`getRunway(companyId)` returns (in addition to runway outcome):

- **cashBase** — same as currentCashBankClosing (cash used for runway calculation).
- **avgNetCashChange6M** — average net Cash & Bank movement over the series.
- **runwaySeries** — up to 6 rows: `[{ month, netChange, closing }]` for the last available months. Used for “How calculated” and hover/tooltip on Dashboard.

Dashboard **cash position** uses this same **cashBase** when runway data is present so the number shown matches the cash used for runway (no inconsistency).

## Revenue/expense proxy (not cashflow)

Dashboard also exposes **revenueProxy3m** and **expenseProxy3m** (3‑month average revenue and average expense from P&L). These are **not** cash inflow/outflow. They are labeled “Revenue proxy (3m)” and “Expense proxy (3m)” in the UI. The chart is titled “Revenue vs Expense (3m avg)”. Legacy keys `avgMonthlyInflow` and `avgMonthlyOutflow` are still returned for backward compatibility but must not be labeled as inflow/outflow in the UI.

## Where it’s used

- **Dashboard:** Runway value, status (GREEN/AMBER/RED), and `statusLabel` (e.g. “Growing”, “Insufficient data”, “Critical”, or “X.X months”). Runway card has a “How calculated” tooltip and optional hover showing last 6 months’ net Cash & Bank change. Runway is a **triage** metric; it is not repeated on Cashflow or Working Capital.
- **Backend:** `runwayService.getRunway(companyId)` and `getCashBankSeries(companyId, lastN)` in `backend/src/services/runwayService.js`. Dashboard overview calls `runwayService.getRunway` and exposes runway (including `runwaySeries`, `cashBase`, `avgNetCashChange6M`) and revenue/expense proxy in the `runway` object.

## Tests

- Unit tests in `backend/test/runwayService.test.js` for:
  - Negative avg → numeric runway (GREEN/AMBER/RED by threshold)
  - Positive/zero avg → Growing
  - &lt; 3 months → Insufficient data
  - Zero/negative cash → Critical
- DB-dependent tests for `getRunway` (including `cashBase`, `runwaySeries` shape) and `getCashBankSeries` shape; they skip when the database is unavailable.

## Smoke test checklist (Layer-1 Runway)

- [ ] **Cash consistency:** Dashboard cash position value equals runway `cashBase` when runway data is present.
- [ ] **Runway card:** “How calculated” info icon/tooltip shows: “Based on last 6 months average Cash & Bank movement from accounting ledgers.”
- [ ] **Runway series:** When `runwaySeries` is returned, hover/tooltip on runway card shows last N months’ net Cash & Bank change (formatted).
- [ ] **Progress bar:** Runway progress bar appears only when `runwayMonths` is numeric (not for “Growing”, “Insufficient data”, “Critical” text).
- [ ] **Labels:** No “inflow” or “outflow” in Dashboard UI; KPI cards show “Revenue proxy (3m)” and “Expense proxy (3m)” with clarifying subtitles; chart is “Revenue vs Expense (3m avg)”.
- [ ] **API:** `/api/finance/overview` (or equivalent) returns `runway.runwaySeries`, `runway.cashBase`, `runway.avgNetCashChange6M`; legacy `avgMonthlyInflow` / `avgMonthlyOutflow` still present for compatibility.
- [ ] **Cashflow screen:** KPIs use Cash & Bank movement (see docs/CASHFLOW_SCREEN.md); no avg revenue/avg expenses on Cashflow page.
