# Demo Mode (Layer 1 Block 4)

Demo mode lets you test or demo Layer 1 without connecting accounting software. A **demo company** is created with `is_demo=true` and seeded with realistic data for the last 12 closed months.

## What gets seeded

- **Company:** Name "Demo Company", `is_demo=true`, trial subscription.
- **MonthlyTrialBalanceSummary:** 12 closed months with cash, revenue, expenses, net profit, inventory.
- **MonthlyRevenueBreakdown:** 3–6 categories per month (Sales, Service Income, Other Income, etc.).
- **MonthlyExpenseBreakdown:** COGS proxy + opex categories (Cost of goods sold, Salaries, Rent, etc.).
- **AccountingMonth:** Each month marked closed.
- **CFOLedgerClassification + LedgerMonthlyBalance:** A few sample ledgers (classified and one unclassified) for latest month so Data Health shows coverage examples.
- **CFOMetric:** debtor_days, creditor_days, inventory_days, cash_conversion_cycle, cash_runway_months for latest month.
- **data_sync_status:** One row with `status=completed` so Data Health does not show "sync failed".

Month keys use the same **latest closed month** semantics as the rest of the app (previous calendar month).

## How to run

### Backend

1. Run migrations (adds `is_demo` to companies and critical indexes):
   - `backend/migrations/2026-02-19-companies-is-demo.sql`
   - `backend/migrations/2026-02-19-critical-indexes.sql`
2. Ensure the server is running.

### Frontend

1. Log in.
2. Go to **Create Company** (e.g. from onboarding or `/create-company`).
3. Click **Create Demo Company**.
4. The app switches to the new demo company and navigates to the dashboard.

### API

- **POST /api/companies/demo** (authenticated)
  - Creates a demo company for the current user.
  - **Limit:** At most one demo company per user. If the user already has a demo company, returns 400 with message "You already have a demo company...".
  - Returns `{ success: true, data: company }`.

## Smoke checklist

- [ ] Migration `2026-02-19-companies-is-demo.sql` applied; `companies.is_demo` exists.
- [ ] Migration `2026-02-19-critical-indexes.sql` applied (indexes created if not exists).
- [ ] POST /api/companies/demo creates a company with `is_demo: true`.
- [ ] After creation, dashboard shows Command Center with cash, runway, profit signal (seeded data).
- [ ] P&L Pack shows months; selecting a month shows revenue/expense and drivers.
- [ ] Data Health shows coverage %, impact messages, and no "sync failed" when data_sync_status is completed.
- [ ] Working Capital shows NWC, CCC, DSO/DPO (from seeded CFOMetric).
- [ ] Creating a second demo company for the same user returns 400.

## Tests

- **Unit:** `backend/test/demoSeedService.test.js` — asserts createDemoCompany return shape and seed structure (skips DB if unreachable).
- **Migration:** Run SQL files against a dev DB and confirm no errors and columns/indexes present.
