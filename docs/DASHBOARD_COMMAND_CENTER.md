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
- **Response:** Up to 5 alerts, sorted by severity (critical → high → medium). Each: `id`, `ruleKey`, `severity`, `title`, `message`, `link`, `isSnoozed`, `snoozedUntil`, `isDismissed`.

## Alert fatigue controls

To avoid repeated alerts annoying users while keeping critical warnings:

- **Persistence:** Table `alert_states` (per company, per `rule_key`): `snoozed_until`, `dismissed_at`, `last_condition_hash`, `updated_at`.
- **Condition hash:** Each alert has a stable `conditionHash` (e.g. `ruleKey|month|bucket`). When the condition changes materially (e.g. new month or different severity bucket), the same rule can produce a new hash and the alert can re-appear after being dismissed.
- **Filtering:** `getAlerts` loads states and:
  - Filters out alerts that are **snoozed** (`snoozed_until` &gt; now).
  - Filters out alerts that are **dismissed** and whose `conditionHash` equals the stored `last_condition_hash` (same occurrence). If the hash changes, the alert is shown again.
- **Endpoints (tenant-isolated via `req.companyId`):**
  - `POST /api/finance/alerts/snooze` — body: `{ ruleKey, days: 7|30 }`. Snooze until now + days; clears dismissal.
  - `POST /api/finance/alerts/dismiss` — body: `{ ruleKey }`. Sets `dismissed_at` and `last_condition_hash` to current condition so this occurrence stays hidden until condition changes.
  - `POST /api/finance/alerts/clear` — body: `{ ruleKey }`. Clears snooze and dismissal for that rule.
- **Frontend:** Each alert row has a kebab menu (⋮) with **Snooze 7d**, **Snooze 30d**, **Dismiss**. After action, alerts are refetched and the list updates. Existing `/api/finance/alerts` consumers still receive the same shape (max 5 items; state fields added).

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
- [ ] **GET /api/finance/alerts:** Returns `{ success: true, data: Array }` with up to 5 items; each has `severity`, `title`, `message`, `link`, `isSnoozed`, `snoozedUntil`, `isDismissed`.
- [ ] **Quick Actions:** P&L Pack, Cashflow, Working Capital buttons present and navigate correctly.
- [ ] **Collections Risk / Payables / Profit Signal:** “Working capital →” and “P&L Pack →” links work.
- [ ] **Alert fatigue — snooze:** Snoozed alerts disappear from the list until snooze period ends (7d or 30d). Each alert row has a kebab menu with Snooze 7d, Snooze 30d, Dismiss; after Snooze, list refetches and that alert is no longer shown.
- [ ] **Alert fatigue — dismiss:** Dismissed alerts disappear; the same alert (same condition hash) stays hidden. If the condition changes materially (e.g. new month or different value bucket), the alert can re-appear.
- [ ] **Alert fatigue — critical still shown:** Critical alerts (e.g. runway &lt; 4 months) still appear when not snoozed or dismissed; after snooze/dismiss they are filtered like others.
