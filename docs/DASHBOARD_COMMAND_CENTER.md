# Dashboard Command Center (Layer-1)

## Purpose

The Dashboard is a **Command Center** for safety and attention only. It does **not** duplicate P&L KPIs; the P&L Pack owns performance metrics.

## Layout (simplified)

1. **Cash & Bank** — Current cash + bank balance (same source as runway cashBase when available).
2. **Runway** — Cash runway from last 6 months Cash & Bank movement; status GREEN/AMBER/RED; “How calculated” tooltip.
3. **Collections Risk** — Debtors outstanding (proxy for >90 days when ageing not available). Links to Working Capital.
4. **Payables Pressure** — Creditors outstanding. Links to Working Capital.
5. **Profit Signal** — One-line net profit (latest closed month). Links to P&L Pack.
6. **Alerts** — Deterministic Red Flag list (max 5). Click navigates to relevant screen (pl-pack or working capital).
7. **Quick Actions** — P&L Pack, Cashflow, Working Capital.

Removed from Dashboard: full KPI strip, Revenue/EBITDA/Net Profit cards, Revenue vs Expense chart, AI Insights block (replaced by deterministic alerts).

## Red Flag engine (alertsService)

- **Service:** `backend/src/services/alertsService.js`
- **Endpoint:** `GET /api/finance/alerts` (uses `req.companyId`; no query param required).
- **Rules (deterministic, no AI):**
  - Runway &lt; 4 months → **critical**, link dashboard.
  - Net profit drop &gt; 30% MoM → **high**, link pl-pack.
  - Revenue drop &gt; 20% MoM → **high**, link pl-pack.
  - Debtors outstanding increased &gt; 25% MoM → **medium**, link working-capital (collections risk proxy; when >90 days ageing exists, rule can be refined).
- **Response:** Up to 5 alerts, sorted by severity (critical → high → medium). Each: `id`, `ruleKey`, `severity`, `title`, `message`, `link`.

## Data sources

- **Cash / Runway:** `runwayService.getRunway`, `dashboardService` cash position aligned with runway cashBase.
- **Collections / Payables:** `commandCenter.collectionsRisk`, `commandCenter.payablesPressure` from overview (debtors/creditors totals).
- **Profit Signal:** `commandCenter.profitSignal` from latest closed month net profit.
- **Alerts:** `alertsService.getAlerts(companyId)` via `GET /api/finance/alerts`.

## Smoke test checklist

- [ ] **Command Center title:** Dashboard shows “Command Center” and “Safety and attention at a glance”.
- [ ] **Five cards:** Cash & Bank, Runway, Collections Risk, Payables Pressure, Profit Signal visible when data is ready.
- [ ] **No P&L KPI duplication:** No Revenue/EBITDA/Net Profit cards or Revenue vs Expense chart on Dashboard.
- [ ] **Alerts:** Alerts section shows “No alerts” or a compact list; each alert has severity color (critical=red, high=amber, medium=blue); click navigates to `link` (pl-pack or working-capital or dashboard).
- [ ] **GET /api/finance/alerts:** Returns `{ success: true, data: Array }` with up to 5 items; each has `severity`, `title`, `message`, `link`.
- [ ] **Quick Actions:** P&L Pack, Cashflow, Working Capital buttons present and navigate correctly.
- [ ] **Collections Risk / Payables / Profit Signal:** “Working capital →” and “P&L Pack →” links work.
