# P&L Pack — Drivers + AI on-demand (Deliverables)

## 1) Files changed

### Backend
- `backend/migrations/2026-02-20-pl-remarks.sql` — new: `pl_remarks` table
- `backend/src/models/PLRemarks.js` — new: Sequelize model
- `backend/src/models/index.js` — register PLRemarks + associations
- `backend/src/services/plPackService.js` — getPlPackWithDrivers, getPlMonths, getRemarks, upsertRemarks, getOrCreateAiExplanation; FY helpers (Apr–Mar), safePctChange, YTD last FY, variance %
- `backend/src/services/aiService.js` — generatePlPackNarrative (v2: MoM + YTD vs last FY in prompt)
- `backend/src/services/index.js` — export plPackService
- `backend/src/routes/finance.js` — GET /pl-months, GET /pl-pack, GET /pl-remarks, POST /pl-remarks, POST /pl-ai-explanation
- `backend/test/plPack.test.js` — unit tests (FY, safePct, drivers); DB-dependent tests skip when DB unavailable

### Frontend
- `frontend/src/services/api.ts` — financeApi: getPlMonths, getPlPack, getPlRemarks, savePlRemarks, generatePlAiExplanation
- `frontend/src/pages/PLPack.tsx` — month dropdown from pl-months (only available months), default latest; MoM variance %, YTD vs last FY; remarks + AI on-demand
- `frontend/src/App.tsx` — route `/pl-pack` + PLPack import
- `frontend/src/components/layout/ModernLayout.tsx` — nav link "P&L Pack" → `/pl-pack`

---

## 2) API paths (mounted under `/api/finance`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/finance/pl-months` | `{ months: string[], latest: string \| null }` — months with snapshot data (desc), for dropdown |
| GET | `/api/finance/pl-pack?month=YYYY-MM` | P&L totals, MoM variances (+ variancePct), current FY YTD, last FY YTD, ytdVarianceAmount/Pct, drivers |
| GET | `/api/finance/pl-remarks?month=YYYY-MM` | Manual text + cached aiDraftText, timestamps |
| POST | `/api/finance/pl-remarks` | Body: `{ month, text }` — upsert manual remarks |
| POST | `/api/finance/pl-ai-explanation` | Body: `{ month, forceRegenerate? }` — return cached or generate & cache (prompt includes MoM + YTD vs last FY) |

Tenant isolation: `companyId` from `req.companyId` (X-Company-Id / auth). Rate limit: per-user 10s cooldown on pl-ai-explanation.

---

## 3) Enterprise v2 contract (pl-pack response)

- **current / previous**: totalRevenue, totalExpenses, grossProfit, netProfit (month totals).
- **variances**: revenue, opex, grossProfit, netProfit (MoM delta amount); **revenuePct, opexPct, grossProfitPct, netProfitPct** (safe % change, null when prev = 0 → display as "—").
- **ytd**: totalRevenue, totalExpenses, grossProfit, netProfit — **current FY** (Indian FY Apr–Mar) from FY start to selected month.
- **ytdLastFy**: totalRevenue, totalExpenses, grossProfit, netProfit — **same period prior FY** (e.g. Apr–Jun this year vs Apr–Jun last year).
- **ytdVarianceAmount**: revenue, expenses, grossProfit, netProfit (current YTD − last FY YTD).
- **ytdVariancePct**: revenue, expenses, grossProfit, netProfit (safe % change vs last FY YTD; null when last FY = 0).
- **drivers**: unchanged (deltaAmount, topPositive, topNegative per category).

FY: April–March. Prior FY same period computed with year/month arithmetic (no timezone dependency).

---

## 4) How to run backend tests

```bash
cd backend
npm run migrate   # apply pl_remarks migration if not already
node --test test/plPack.test.js
```

- Pure unit tests (buildDriverLists, getFyStartMonthKey, getLastFySamePeriod, safePctChange) always run.
- DB-dependent tests (getPlPackWithDrivers shape, getRemarks, getPlMonths) run when `DATABASE_URL` is set and DB is reachable; they **auto-skip** when DB is not set or connection fails (e.g. ENOTFOUND / ECONNREFUSED).

---

## 5) Smoke test checklist

- [ ] **Month switch** — Change month dropdown → MoM numbers, variance %, YTD, YTD last FY and variance update (no AI call).
- [ ] **Months dropdown** — Only months with data appear; default is latest; dropdown disabled until months loaded.
- [ ] **Remarks** — Load per month; save updates only that month’s remarks.
- [ ] **AI** — Not generated on month change; on-demand only; cached per company+month; Regenerate forces new narrative.
- [ ] **Variance %** — MoM and YTD vs last FY show "—" when denominator is zero (or null).

## 6) Deterministic drivers — limitations and improvements

- **Source**: Drivers use `MonthlyTrialBalanceSummary` (totals) and `MonthlyRevenueBreakdown` / `MonthlyExpenseBreakdown` (line-level). Top drivers are computed from **MoM deltas** by `normalizedRevenueCategory` / `normalizedExpenseCategory` (or name fallback).
- **Limitations**:
  - If only summary rows exist (no breakdowns), driver lists are empty; only `deltaAmount` is still correct.
  - **Gross profit** has no COGS in the schema; `grossProfit` is currently revenue-based (same delta as revenue; drivers reused from revenue). To improve: add COGS in ETL/snapshot and split revenue vs COGS so GP drivers can be distinct.
  - Granularity is one level (category/name). For finer “top accounts” or sub-categories, add or use more granular breakdown tables and include them in the driver aggregation in `plPackService.getPlPackWithDrivers`.
- **Where to improve later**: (1) Add COGS to snapshot/breakdown and GP-specific drivers; (2) add or expose more granular revenue/expense line items (e.g. by account or sub-category) for richer topPositive/topNegative; (3) optional “contributor count” or configurable limit per category.
