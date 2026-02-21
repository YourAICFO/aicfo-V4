# Layer 1 Closure — Block 2: Metric Ownership Final Audit

**Goal:** One home per metric; remove duplicate KPI tiles; dashboard = Command Center only; consistent latest-closed-month semantics; subtle contextual links.

## Smoke checklist

- [ ] Revenue page has no monthly total hero KPI; links to P&L Pack.
- [ ] Expenses page has no monthly total hero KPI; links to P&L Pack.
- [ ] Dashboard has no P&L KPIs (only Cash, Runway, Collections Risk, Payables Pressure, Profit signal + link, Alerts, Quick Actions, Data Ready badge).
- [ ] Working Capital owns CCC metrics and shows them consistently; has links to P&L Pack and Cashflow.
- [ ] Cashflow has no runway (inflow/outflow only).
- [ ] All non–P&L pages align on latest closed month semantics (backend uses `getLatestClosedMonthKey` / trailing 3 closed months).

## Changes applied (Block 2)

- **Revenue:** Removed "Latest Closed Month Revenue" hero card. Kept Growth Rate and Top Category. Added "See full monthly performance →" link to `/pl-pack`. Title/subtitle reframed to "Revenue breakdown and category trend."
- **Expenses:** Removed "Latest Closed Month Expenses" hero card. Kept Avg Monthly Spend and Top Category. Added "See full monthly performance →" link to `/pl-pack`. Title/subtitle reframed to "Expense breakdown and category trend."
- **Working Capital:** Added subtle header links: "P&L Pack →" and "Cashflow →". Subtitle clarified (NWC, CCC, DSO/DPO/DIO).
- **Cashflow:** No runway; no change. Already inflow/outflow only.
- **Dashboard:** Confirmed Command Center only; no P&L KPI strip; Profit Signal is the allowed one-line teaser with link to P&L Pack.
- **Backend:** No change; Revenue/Expenses/Cashflow already use latest closed month and trailing 3m consistently.
