# Layer 1: Accounting Intelligence — Founder-grade Frontend Brief

**Purpose:** Define product goal, metric ownership, navigation, and execution plan so P&L Pack is the primary Monthly Review surface and other screens are focused drilldowns without duplicated KPIs.

**Context:** `/pl-pack` exists with month selector and enterprise P&L (MoM, YTD, last FY, drivers, remarks, AI). Dashboard, Revenue, Expenses, Cashflow, Working Capital, Debtors, Creditors, AI Insights also exist. This brief eliminates metric duplication and aligns UX.

---

## 1) PRODUCT GOAL (Layer 1)

**User journey**
- **Monthly review** → User opens app, lands on Dashboard or goes straight to **P&L Pack** (Review) for the latest (or chosen) month. Sees one place for Revenue, Opex, Gross Profit, Net Profit, YTD vs last FY, drivers, and optional AI narrative.
- **Drill down** → From Review or Dashboard, user clicks into **Revenue**, **Expenses**, **Working Capital**, or **Cash** for detail (breakdowns, trends, aging, concentration). These screens do **not** re-display the full P&L KPI set.
- **Take guidance** → From AI Insights or in-context “Explain” (click-to-explain), user gets recommendations; where relevant, explainability links to the **primary home** for that metric (e.g. P&L Pack for Revenue/Net Profit, Working Capital for Debtors/Creditors).

**Primary personas**
| Persona | Goal | Primary entry |
|--------|------|----------------|
| **Founder** | “How did we do this month and where do we stand?” | Dashboard → P&L Pack (Review); quick cash/runway at a glance. |
| **Finance Head** | “Monthly close view + deep-dives by line and working capital.” | P&L Pack as default Monthly Review; Revenue/Expenses/Working Capital for analysis. |
| **Practicing CA (multi-client)** | “Review each client’s P&L and key metrics without mixing them.” | Company switcher + P&L Pack per company; role-gated admin/control tower. |

---

## 2) DESIGN PRINCIPLES (practical)

- **Minimal but powerful** — One primary surface per job (review vs drilldown). No duplicate KPI strips across screens.
- **Modern, professional, responsive** — Use existing `Card`, `Button`, layout in `ModernLayout`; keep recharts for trends; ensure mobile-friendly nav and cards (current layout is desktop-first).
- **Explainability-first** — Every key number should be “click-to-explain” where possible (tooltip or icon opening drawer/modal with short blurb and link to **primary home** screen).
- **Low cognitive load** — Avoid clutter; avoid showing Revenue/Expenses/Net Profit in more than one “primary” way. Dashboard = at-a-glance + deep links only.
- **Consistent number formatting** — Single source for currency (INR), variance (₹ then %, null → “—”), dates (en-IN). Empty states when no data; for P&L Pack, month list from `/pl-months` so “no data” is rare.

---

## 3) SCREEN INVENTORY (what exists today)

| Screen | Route | Purpose (1 sentence) | Primary actions | Questions it answers |
|--------|--------|----------------------|------------------|----------------------|
| **Dashboard** | `/dashboard` | CFO Overview: cash, runway, inflow/outflow mix, sync status, AI insights teaser, quick actions. | Refresh sync, View Revenue/Cashflow/AI Insights. | “Is data ready? How’s cash and runway? What should I look at?” |
| **Revenue** | `/revenue` | Revenue trends and sources (3m); latest closed month total + growth + by category. | None (view only). | “What’s our revenue and growth? Which categories drive it?” |
| **Expenses** | `/expenses` | Expense trends and top items (3m); latest closed month total + trend + by category. | None (view only). | “What are we spending? Which categories and top expenses?” |
| **Cashflow** | `/cashflow` | Cash inflows/outflows and net (3m); avg net, inflow, outflow with deltas. | None (view only). | “How is cash moving? Inflow vs outflow trend?” |
| **Working Capital** | `/working-capital` | Working capital, CCC, receivable/payable days, loans, interest (CFOMetric snapshot). | None (view only). | “What’s working capital and debt position? AR/AP efficiency?” |
| **Debtors** | `/debtors` | Receivables summary: total, change vs prev, risk, top 10 (finance API). | None (view only). | “How much are we owed? Who are top debtors? Risk?” |
| **Creditors** | `/creditors` | Payables summary: total, change vs prev, risk, top 10 (finance API). | None (view only). | “How much do we owe? Who are top creditors? Risk?” |
| **P&L Pack** | `/pl-pack` | **Monthly Review:** selected month P&L, MoM variances + %, YTD vs last FY, drivers, remarks, AI narrative (on-demand). | Change month, Save remarks, Generate/Regenerate AI. | “How did we perform this month? What drove changes? What does AI suggest?” |
| **AI Insights** | `/ai-insights` | List of AI-generated insights/alerts; read/dismiss. | Mark read, Dismiss. | “What are the top alerts and recommendations?” |
| **AI Chat** | `/ai-chat` | Conversational Q&A (CFO questions). | Ask question. | “Ask a specific financial question.” |
| **Integrations** | `/integrations` | Connect accounting (Tally, Zoho, etc.). | Connect, Sync, Disconnect. | “How is the books connection?” |
| **Settings** | `/settings` | App/user settings. | Save. | “Preferences and notifications.” |

**Data sources (current):**
- **Dashboard:** `dashboardApi.getOverview()` → cashPosition, runway, insights (dashboardService).
- **Revenue / Expenses / Cashflow:** `dashboardApi.getRevenue('3m')`, `getExpenses('3m')`, `getCashflow('3m')` (dashboardService; “latest closed” / 3m logic).
- **Working Capital:** `financeApi.getWorkingCapital()` → CFOMetric, CurrentLoan.
- **Debtors / Creditors:** `debtorsApi.getSummary()`, `creditorsApi.getSummary()` (finance routes).
- **P&L Pack:** `financeApi.getPlMonths()`, `getPlPack(month)`, `getPlRemarks(month)`, `generatePlAiExplanation(month)` (plPackService + snapshots).

---

## 4) METRIC OWNERSHIP MAP

**Rule:** Each metric has **one primary home**. Elsewhere it may appear only in **small form** (e.g. one number + link “See full picture in Review”).

| Metric | Primary Home Screen | Secondary Mentions Allowed | Data source | Explainability link target |
|--------|---------------------|----------------------------|-------------|----------------------------|
| **Revenue** (month total) | P&L Pack | Dashboard: optional 1-line “Revenue this month” + “View in Review”. Revenue screen: **no** duplicate month total as hero; show trends/breakdown only. | pl-pack / snapshot | P&L Pack (month in context) |
| **Expenses / Opex** (month total) | P&L Pack | Dashboard: optional 1-line. Expenses screen: **no** duplicate month total as hero; show trends/breakdown only. | pl-pack / snapshot | P&L Pack |
| **Gross Profit / GM%** | P&L Pack | None on other screens. | pl-pack | P&L Pack |
| **Net Profit** | P&L Pack | Dashboard: optional 1-line “Profit this month” + “View in Review”. | pl-pack / snapshot | P&L Pack |
| **EBITDA** | P&L Pack (if/when added) | None. | pl-pack / derived | P&L Pack |
| **Cash balance** | Dashboard (at-a-glance) | Cashflow: in context of inflow/outflow. Not on P&L Pack. | dashboard/overview, cash balances | Dashboard or Cashflow |
| **Runway** | Dashboard | None. | dashboard/overview | Dashboard |
| **Avg inflow / outflow / net cashflow** | Dashboard or Cashflow (choose one) | If Dashboard keeps “at-a-glance”, Cashflow owns detail; avoid same numbers in both as primary. | dashboard/overview, getCashflow | Dashboard (summary) → Cashflow (detail) |
| **Debtors (AR) total** | Working Capital or Debtors | Dashboard: optional 1-line + “Working Capital”. Debtors = drilldown. | finance/debtors, metrics | Working Capital or Debtors |
| **Creditors (AP) total** | Working Capital or Creditors | Same as Debtors. | finance/creditors, metrics | Working Capital or Creditors |
| **AR/AP aging** | Debtors / Creditors | Working Capital: days only (receivable_days, payable_days). | finance + metrics | Debtors / Creditors |
| **Concentration (top 10, risk)** | Debtors / Creditors | Working Capital: high-level risk if needed. | finance/debtors, creditors | Debtors / Creditors |
| **Working capital, CCC, loans, interest** | Working Capital | None. | finance/working-capital | Working Capital |
| **YTD / Last FY variance** | P&L Pack | None. | pl-pack | P&L Pack |
| **Drivers (MoM line-item)** | P&L Pack | None. | pl-pack | P&L Pack |

---

## 5) NAVIGATION IA (information architecture)

**Proposed left nav (minimal):**

| Item | Route | Rationale |
|------|--------|-----------|
| **Review** | `/pl-pack` | Primary Monthly Review (P&L Pack). Rename from “P&L Pack” for founder-friendly language. |
| **Revenue** | `/revenue` | Drilldown: trends and breakdown; no duplicate P&L revenue hero. |
| **Expenses** | `/expenses` | Drilldown: trends and breakdown; no duplicate P&L expense hero. |
| **Working Capital** | `/working-capital` | AR/AP, CCC, loans. Consider folding Debtors/Creditors as tabs or sub-routes. |
| **Cash** | `/cashflow` | Cash flow detail (future: dedicated cash block). |
| **Insights** | `/ai-insights` | AI alerts and recommendations (optional: merge “AI Chat” under same section). |
| **Integrations** | `/integrations` | Connections and sync. |
| **Settings** | `/settings` | User/app settings. |
| **Admin** (role-gated) | `/admin`, `/admin/control-tower` | CA / internal admin only. |

**Dashboard placement:** Either (a) **default landing** = Dashboard (at-a-glance + deep links to Review, Cash, Working Capital, Insights), or (b) **default landing** = Review (P&L Pack) for power users. Recommend keeping Dashboard as landing and making “Review” the first nav item after it.

**Role gating:** Admin routes already behind `AdminRoute` (e.g. `AdminDashboard`, `AdminControlTower`). CA-specific features (e.g. multi-company comparison, bulk actions) can live under Admin or a “CA” section; no change to current gating in this brief.

**Current nav (ModernLayout):** Dashboard, Revenue, Expenses, Cashflow, Debtors, Creditors, Working Capital, P&L Pack, AI Insights, AI Chat, Integrations, [+ Admin]. Consolidate Debtors/Creditors under Working Capital (tabs or sub-pages) to reduce items.

---

## 6) UI LAYOUT BLUEPRINTS (high-level)

**Dashboard**
- **Header:** Title “CFO Overview”, subtitle “Your financial health at a glance”, Refresh, sync status.
- **KPI strip:** Only at-a-glance: Cash, Runway, (optional) one line “Revenue / Net Profit this month” with link “View in Review”. **Remove** full duplicate of Revenue/Expenses/Net Profit; remove hardcoded “↗ 12%” / “↗ 5%” (use real data or drop).
- **Main content:** Inflow vs outflow chart (keep), AI Insights teaser (keep), Quick Actions: “View Revenue”, “Check Cash”, “Review Alerts” → point to Review/Cashflow/Insights.
- **Drawer/modal:** Not used today; future: “Explain” on a KPI opens small drawer with blurb + “See full picture in Review”.
- **Mobile:** Stack cards; nav collapses to hamburger (current behavior).

**P&L Pack (Review)**
- **Header:** Title “P&L Review” (or “Monthly Review”), month dropdown (from `/pl-months`), disabled until loaded, default latest.
- **KPI strip:** Revenue, Opex, Net Profit (month), YTD Net Profit + last FY same period + variance (amount + %). Variance: ₹ then %; null → “—”.
- **Main content:** Drivers panel (revenue, opex, net profit top +/-); Remarks textarea + Save; AI Explanation block (cached text, Generate/Regenerate).
- **Drawer/modal:** Optional: “Explain” on a driver line → short blurb + source.
- **Mobile:** Single column; month selector full-width.

**One drilldown (e.g. Revenue)**
- **Header:** “Revenue”, subtitle “Trends and breakdown — for month totals see Review”.
- **KPI strip:** **Do not** repeat “Latest Closed Month Revenue” as hero. Option: single compact line “Month total in Review” with link to `/pl-pack?month=YYYY-MM`.
- **Main content:** Charts (monthly trend, by category), table or list of categories. No duplicate P&L KPI set.
- **Drawer/modal:** Optional explain on category.
- **Mobile:** Charts stack; tables scroll horizontally if needed.

---

## 7) CONSISTENCY SPEC

- **Currency:** INR, `en-IN`, 0 decimal (e.g. ₹1,00,000). Use **single shared formatter** from `lib/utils.ts` (`formatCurrency`) everywhere; remove local redefinitions in Revenue, Expenses, Cashflow, WorkingCapital, Debtors, Creditors, PLPack, Transactions.
- **Variance:** Always “₹ amount” then “%” when available; null or undefined % → display “—”. Example: “+₹50,000 +10.2% vs prev” or “+₹50,000 — vs prev”. Align with P&L Pack’s `formatPct` (e.g. move to `lib/utils.ts` as `formatVariancePct`).
- **Date / month selectors:** Only on **P&L Pack** for now. Revenue/Expenses/Cashflow use backend’s “latest closed” or “3m” with no selector to avoid fragmentation; deep link from Review can pass month later if APIs support.
- **Empty states:** When no data, show message + action (e.g. “Connect accounting and sync”). P&L Pack: month list from `/pl-months` so empty = “No P&L data for this company yet”.

---

## 8) EXECUTION PLAN (phased, no code)

**Step 1: Align Dashboard to summary-only + deep links**
- **Scope:** `frontend/src/components/dashboard/ModernDashboard.tsx`.
- **Actions:** Remove any duplicate P&L-style KPIs (if present). Keep Cash, Runway, Inflow/Outflow mix, Sync status, Connector health, AI Insights teaser, Quick Actions. Replace hardcoded “↗ 12%” / “↗ 5%” with real variance or remove. Add explicit links: “Monthly review” → `/pl-pack`, “Revenue detail” → `/revenue`, “Cashflow” → `/cashflow`, “Working Capital” → `/working-capital`, “AI Insights” → `/ai-insights`. Optionally add one line “Revenue / Net Profit this month” with link to Review.
- **Files:** `ModernDashboard.tsx`, possibly `DashboardSkeleton.tsx`.

**Step 2: Standardize KPI components + drawer explainability**
- **Scope:** Shared components and `lib/utils.ts`.
- **Actions:** Introduce a small **KPI card** component (or reuse Card) that accepts value, label, variance (amount, pct), and optional “explain” callback. Use `formatCurrency` and `formatVariancePct` from `lib/utils.ts` everywhere; delete local `formatCurrency`/`formatPct` in pages. Add optional “Explain” icon/button that opens a drawer or modal with short text and “See in [Review/Working Capital/…]” link.
- **Files:** `lib/utils.ts` (add `formatVariancePct`), new `components/kpi/KpiCard.tsx` (or under `components/dashboard/`), drawer/modal in layout or shared component; then refactor Dashboard, PLPack, Revenue, Expenses, WorkingCapital to use shared formatters and optionally KpiCard.

**Step 3: Align Revenue/Expenses drilldowns to not duplicate P&L KPIs**
- **Scope:** `frontend/src/pages/Revenue.tsx`, `frontend/src/pages/Expenses.tsx`.
- **Actions:** Reframe hero as “Trends and breakdown” (or similar); remove or downplay “Latest Closed Month Revenue/Expenses” as the main KPI. Add one line: “Month total and drivers → see **Review**” with link to `/pl-pack`. Keep charts (monthly trend, by category) and tables. Ensure no second “source of truth” for Revenue/Expenses month total on these pages.
- **Files:** `Revenue.tsx`, `Expenses.tsx`.

**Step 4: Consistent typography and spacing**
- **Scope:** All Layer 1 pages and shared layout.
- **Actions:** Define page title (e.g. `text-2xl` or `text-3xl`), subtitle (`text-gray-600`), card grid gap (e.g. `gap-4`/`gap-6`), and section spacing (`space-y-6`) in one place (e.g. layout or design tokens). Apply to Dashboard, PLPack, Revenue, Expenses, Cashflow, WorkingCapital, Debtors, Creditors. Ensure mobile breakpoints are consistent.
- **Files:** `ModernLayout.tsx`, page components above; consider a `PageHeader` component.

---

## 9) RISKS / OPEN QUESTIONS

- **Data gaps:** Dashboard “↗ 12%” / “↗ 5%” are placeholders; backend may not expose MoM % for inflow/outflow. Either add from dashboardService or remove.
- **Revenue/Expenses period:** Currently “3m” and “latest closed month” from dashboard APIs; P&L Pack uses company-month from snapshots. Aligning “latest” with P&L Pack’s `latest` (from `/pl-months`) may require dashboard API to accept or return `latestSnapshotMonth` and use it for Revenue/Expenses teaser.
- **Debtors/Creditors vs Working Capital:** Working Capital shows CCC, receivable_days, payable_days; Debtors/Creditors show total, top 10, risk. Deciding “Primary home” for AR/AP total: either Working Capital (summary) with Debtors/Creditors as drilldown, or keep both and allow Working Capital to show summary + link to Debtors/Creditors. No API change required for ownership rule; only UX and optional consolidation (tabs under Working Capital).
- **Cashflow vs Dashboard:** Both show inflow/outflow. Decide single source: e.g. Dashboard = current cash + runway + one net number; Cashflow = full inflow/outflow trend and averages. Avoid same metric as hero in both.
- **Explainability links:** “Explain” drawer and “See in Review” require a shared mechanism (e.g. route + query or state). No backend change; frontend only.
- **API adjustments (do not implement now):** (1) Dashboard overview could return `latestSnapshotMonth` and optionally one-line P&L teaser (revenue, net profit) for that month. (2) Revenue/Expenses could accept `month` to align with Review when deep-linking. Document only.

---

## 10) METRIC DUPLICATION RULES (final)

1. **Revenue (month total)** is owned by P&L Pack only. No other screen may show it as the primary hero KPI.
2. **Expenses / Opex (month total)** is owned by P&L Pack only. No other screen may show it as the primary hero KPI.
3. **Net Profit (month total)** is owned by P&L Pack only. Dashboard may show a single “Profit this month” teaser with link to Review.
4. **Gross Profit / GM%** appear only on P&L Pack.
5. **YTD and YTD vs last FY** appear only on P&L Pack.
6. **Drivers (MoM line-item contributors)** appear only on P&L Pack.
7. **Cash balance and Runway** are owned by Dashboard (at-a-glance). Cashflow may show them in context of flows but not as the primary “current cash” hero.
8. **Debtors/Creditors totals and concentration** are owned by Debtors/Creditors (or Working Capital if consolidated). Dashboard may show one-line teaser with link.
9. **Working capital, CCC, receivable_days, payable_days, loans, interest** are owned by Working Capital only.
10. **Revenue/Expenses screens** show trends, breakdowns, and categories only; they do not re-display the monthly P&L totals as the main KPI.
11. **Variance presentation** is consistent: amount (₹) then percentage; null/undefined percentage is shown as “—”.
12. **One primary home per metric:** Before adding a KPI to a new screen, confirm its primary home in the Metric Ownership Map and add only as “secondary mention” with link if allowed.


---

## Block 2 changes (Metric Ownership Final Audit)

- **Revenue page:** No "Latest Closed Month Revenue" hero; page is drilldown only (revenue breakdown, category trend, growth). Link: "See full monthly performance →" to `/pl-pack`.
- **Expenses page:** No "Latest Closed Month Expenses" hero; drilldown only (expense breakdown, category trend, avg spend). Link to P&L Pack.
- **Dashboard:** Command Center only — Cash & Bank, Runway, Collections Risk, Payables Pressure, Profit Signal (one-line + link to P&L Pack), Alerts, Quick Actions, Data Ready badge. No P&L KPI strip.
- **Cashflow:** No runway; inflow/outflow visualizations only. Runway stays on Dashboard only.
- **Working Capital:** Owns NWC, CCC, DSO/DPO/DIO, liquidity, loans. Contextual links added: P&L Pack (performance), Cashflow (flows).
- **Month semantics:** Non–P&L screens use backend "latest closed" / "trailing 3 closed months"; P&L Pack remains the only month-switchable screen. Backend endpoints use getLatestClosedMonthKey consistently.
- **Audit doc:** docs/LAYER1_METRIC_OWNERSHIP_AUDIT.md. Smoke checklist: docs/LAYER1_CLOSURE_BLOCK2.md.
