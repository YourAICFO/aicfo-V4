# Layer 1 Closure — Block 3: Formatting Centralization + UI Consistency

**Goal:** Centralize number formatting, remove duplicate formatters, standardize null ("—") and negative (text-red-600) handling.

## Smoke checklist

- [ ] All numbers use shared format utilities (`lib/format.ts`).
- [ ] No inline `Intl.NumberFormat` left in Dashboard, P&L Pack, Working Capital, Revenue, Expenses, Cashflow, Debtors, Creditors, Transactions.
- [ ] Null always renders as "—".
- [ ] Negative values styled consistently (text-red-600).
- [ ] Variance display consistent across P&L and WC (VarianceDisplay component).
- [ ] No duplicated formatting logic in pages.

## Shared utilities (`frontend/src/lib/format.ts`)

| Function | Behavior |
|----------|----------|
| `formatCurrency(value)` | null/undefined/NaN → "—"; INR, no decimals; negative → "-₹X" |
| `formatNumber(value, suffix?)` | null/undefined/NaN → "—"; thousands separator; optional suffix (e.g. "d", " days") |
| `formatPercentage(value)` | null/undefined/NaN → "—"; 1 decimal max, append "%" |
| `formatVarianceAmount(value)` | null → "—"; positive prefixed "+"; negative as-is |
| `formatVariancePct(value)` | null → "—"; ± and 1 decimal, "%" |

## Component: `VarianceDisplay`

- **Props:** `amount`, `pct`, `suffix?`, `inverse?`, `className?`
- **Behavior:** Renders "₹X (Y%)" + suffix. Negative amount → text-red-600; inverse mode: positive amount → red (e.g. opex increase). Null → "—".

## Files changed

- **Added:** `frontend/src/lib/format.ts` — central format helpers.
- **Added:** `frontend/src/components/common/VarianceDisplay.tsx` — reusable variance line.
- **Updated:** `frontend/src/lib/utils.ts` — re-export `formatCurrency`, `formatNumber` from `format.ts`.
- **Updated:** `frontend/src/pages/PLPack.tsx` — use format.ts + VarianceDisplay; removed local formatCurrency, formatPct.
- **Updated:** `frontend/src/pages/WorkingCapital.tsx` — use format.ts; removed local formatCurrency, formatNumber; Data Sources value uses formatNumber (null → "—").
- **Updated:** `frontend/src/pages/Revenue.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Expenses.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Cashflow.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Debtors.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Creditors.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Transactions.tsx` — use formatCurrency from format.ts; removed local formatCurrency.
- **Updated:** `frontend/src/pages/Dashboard.tsx` — use formatCurrency from format.ts; removed local formatCurrency.

**Unchanged:** `ModernDashboard.tsx` already uses `formatCurrency` from `lib/utils` (which re-exports from format.ts).

## Removed inline formatters

- **PLPack:** `formatCurrency(amount)`, `formatPct(value)` (replaced by format.ts + VarianceDisplay).
- **WorkingCapital:** `formatCurrency(value)` ("Not available yet" → "—"), `formatNumber(value, suffix)`.
- **Revenue, Expenses, Cashflow:** Local `formatCurrency` using `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
- **Debtors, Creditors, Transactions:** Same local `formatCurrency`.
- **Dashboard:** Same local `formatCurrency`.

## Style consistency

- Null/undefined/NaN → "—" everywhere.
- No "0%" when denominator zero (formatVariancePct returns "—" for null).
- Negative amounts → text-red-600 (VarianceDisplay and existing P&L driver styling).
- Single shared formatter for INR (format.ts).
