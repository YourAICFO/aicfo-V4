# Layer 1 — Metric Ownership Audit (Block 2)

**Purpose:** Identify which screens show which top-level totals and flag duplicates that violate one-home-per-metric.

## Top-level metrics

| Metric | Primary home | Rule |
|--------|--------------|------|
| Revenue (month total) | P&L Pack | No other screen may show as hero KPI |
| Expenses (month total) | P&L Pack | No other screen may show as hero KPI |
| Net Profit | P&L Pack | Dashboard may show one-line "Profit signal" + link |
| Gross Profit / GM% | P&L Pack | None elsewhere |
| Cash balance | Dashboard | Cashflow may show in context of flows |
| Runway | Dashboard | None elsewhere (not on Cashflow) |
| WC (NWC, CCC, DSO/DPO/DIO, etc.) | Working Capital | Dashboard: Collections/Payables teaser + link |
| Debtors/Creditors totals | Debtors / Creditors (or Working Capital) | Dashboard: teaser + link |

---

## Screen-by-screen audit (pre–Block 2)

### ModernDashboard.tsx
- **Shows:** Cash & Bank, Runway, Collections Risk (debtors), Payables Pressure (creditors), Profit Signal (net profit, link to P&L Pack), Alerts, Quick Actions, Data Ready badge, Connector Health, Sync status.
- **Verdict:** Compliant. No duplicate Revenue/Expenses hero; Profit Signal is the allowed one-line teaser with link to P&L Pack. No P&L KPI strip.

### Revenue.tsx
- **Shows:** "Latest Closed Month Revenue" (hero card), Growth Rate, Top Category; charts: Trailing 3 months, Revenue by category.
- **Duplicate:** "Latest Closed Month Revenue" is a **violation** — month total belongs to P&L Pack only.
- **Action:** Remove hero revenue total; keep breakdown/trend only; add link "See full monthly performance → P&L Pack".

### Expenses.tsx
- **Shows:** "Latest Closed Month Expenses" (hero card), Avg Monthly Spend, Top Category; charts and top expenses table.
- **Duplicate:** "Latest Closed Month Expenses" is a **violation** — month total belongs to P&L Pack only.
- **Action:** Remove hero expense total; keep breakdown/trend only; add link to P&L Pack.

### Cashflow.tsx
- **Shows:** Avg Net Cashflow (3m), Avg Revenue (3m), Avg Expenses (3m) as flow proxies; Monthly Cashflow bar chart; Net Cashflow area chart; Cash Balance History.
- **Runway:** Not shown. Compliant.
- **Note:** "Avg Revenue" / "Avg Expenses" here are inflow/outflow proxies for the period, not the single-month P&L totals. Allowed. No change required for runway; focus is inflow/outflow.

### WorkingCapital.tsx
- **Shows:** NWC, Liquidity (Cash + NWC), Inventory (with DIO/CCC), CCC (with Recv/Pay days), Loans, Interest; Data Sources.
- **Verdict:** Owns WC metrics. Cash appears only as part of "Liquidity (Cash + NWC)" — supporting number. No runway. Compliant. Add contextual links to P&L Pack and Cashflow.

### Debtors.tsx
- **Shows:** Total Debtors, Change vs prev, Risk, Top 10.
- **Verdict:** Owns AR total and concentration. No duplicate of P&L or runway.

### Creditors
- (Same pattern as Debtors; owns AP total.)

### AI Insights (AIInsights.tsx)
- **Shows:** List of AI insights; no KPI totals (Revenue, Expenses, Cash, etc.).
- **Verdict:** No duplication.

### P&L Pack
- **Shows:** Month selector; Revenue, Opex, Net Profit, YTD, drivers, remarks, AI. Primary home for P&L totals.

---

## Duplicates removed (Block 2)

1. **Revenue page:** Removed "Latest Closed Month Revenue" hero card. Kept Growth Rate and Top Category; added "Revenue breakdown" framing and link to P&L Pack.
2. **Expenses page:** Removed "Latest Closed Month Expenses" hero card. Kept Avg Monthly Spend and Top Category; added link to P&L Pack.

---

## Month semantics

- **Backend:** `dashboardService` (getRevenue, getExpenses, getCashflow) and `dataHealthService` use `getLatestClosedMonthKey()` or equivalent (e.g. `getClosedRange` with latest closed start). Revenue/Expenses/Cashflow APIs use "trailing 3 closed months" and latest closed month consistently.
- **P&L Pack:** Only screen with month selector; uses `/pl-months` and selected month.
- **Non–P&L screens:** Rely on backend "latest closed" / "3m"; no month selector. Aligned.
