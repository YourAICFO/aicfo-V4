# UI Refinement V1 — Card Unification + Fintech Calm Palette

## What changed

- **Single card system:** All in-scope screens now use `src/components/ui/Card` with `CardContent`. Raw `rounded-lg border` divs and the `.card` class (from `index.css`) are no longer used for main layout surfaces on these screens.
- **New Card variants:** Added `subtle` (tinted surface: `bg-slate-50` / `dark:bg-slate-900/40`) and `critical` (error/alert blocks). Existing variants (default, gradient, warning, success, etc.) kept for ModernDashboard and elsewhere.
- **Calm palette:** Replaced bright gradient KPI cards (emerald/teal/violet/rose/amber) with calm “subtle” cards: title + KPI + optional subtitle. Severity is shown via **border-left** or a **small pill** only (e.g. net cash flow: green/red border-l; growth: pill).
- **Typography and spacing:** Page title row uses `text-2xl font-semibold`; one-line description uses `text-sm text-slate-500` (and dark mode). Section spacing uses `space-y-6` or `space-y-8`.
- **Theme tokens:** Added `frontend/src/lib/theme.ts` with a minimal token map: `surface`, `textMuted`, `border`, `severity` (critical/high/medium/low/neutral). Used for impact/alert/badge severity styling where colors were previously hardcoded (e.g. DataHealth impact list, PLPack executive summary).
- **Cleanup:** Removed redundant `border-gray-200` on blocks where Card already provides border; aligned dark mode variants on updated blocks (slate/gray for neutrals, semantic colors for severity).

## Screens updated

| Screen | Changes |
|--------|--------|
| **PLPack.tsx** | Error block → `Card variant="critical"`. Executive summary → `Card`; severity from `THEME.severity`. KPI strip → `Card variant="subtle"` + `CardContent p-4`. Drivers and Remarks → `Card` + `CardContent p-6`. Title/description typography and spacing. |
| **WorkingCapital.tsx** | Error → `Card variant="critical"`. All KPI cards → `Card variant="subtle"` + calm icons (slate). Data Sources → `Card variant="default"` + `CardContent p-6`. No gradients. |
| **Cashflow.tsx** | KPI cards → `Card variant="subtle"`; net cash flow uses border-l + pill. Chart sections → `Card variant="default"` + `CardContent p-6`. |
| **DataHealth.tsx** | Error → `Card variant="critical"`. Top row (Coverage, Latest month, Last sync) → `Card variant="subtle"`. “What’s missing”, “Impact”, “Suggested next steps” → `Card variant="default"`. Impact list uses `THEME.severity`. |
| **Revenue.tsx** | Summary cards → `Card variant="subtle"`; growth uses border-l + pill. Chart cards → `Card` + `CardContent p-6`. |
| **Expenses.tsx** | Summary cards → `Card variant="subtle"`; trend pill only. Chart and Top Expenses → `Card` + `CardContent p-6`. Table borders/rows use slate. |
| **Debtors.tsx** | All blocks → Card (subtle for KPIs, default for table, subtle for summary). Risk as pill. Typography and spacing. |
| **Creditors.tsx** | Same pattern as Debtors. |

## Before vs after principles

- **Before:** Mix of `.card` (index.css), raw `rounded-lg border` divs, and (on Dashboard) `Card` from ui. Strong gradient backgrounds (emerald, teal, violet, rose, amber) on KPI cards. Inconsistent borders and dark mode.  
- **After:** One Card system for app content: `Card` + `CardContent`. KPI surfaces are calm (`subtle` variant, slate-tinted). Severity/state = border-left or small pill. Typography: page title `text-2xl font-semibold`, description `text-sm text-slate-500`. Section spacing `space-y-6` / `space-y-8`. Shared severity styling via `THEME.severity` where it replaces scattered hardcoded colors.

## Smoke checklist

- [ ] **PLPack:** Page loads; month selector and report download work. Error state shows red Card with Retry. Executive summary, KPI strip, Drivers, Remarks/AI use Card; no raw bordered divs for main content. Severity bullets use left border (red/amber/blue).
- [ ] **WorkingCapital:** Six KPI cards and Data Sources use Card. No gradient backgrounds; icons are slate. Error state shows critical Card with Retry.
- [ ] **Cashflow:** Three KPI cards (Net cash flow, Avg inflow, Avg outflow) use subtle Card. Net cash flow has green/red border-l and “In surplus”/“Deficit” pill. Three chart sections in default Card with p-6.
- [ ] **DataHealth:** Coverage, Latest month, Last sync in subtle Cards. “What’s missing”, “Impact”, “Suggested next steps” in default Cards. Error state shows critical Card with Retry. Impact list uses THEME severity (border-l).
- [ ] **Revenue:** Two summary cards (Growth rate, Top category) use subtle Card; growth has border-l + pill. Two chart cards use Card + CardContent p-6.
- [ ] **Expenses:** Two summary cards (Avg spend, Top category) use subtle Card; trend pill. Charts and Top Expenses table in Card + CardContent.
- [ ] **Debtors:** Four KPI cards (Total, Change, Concentration, Risk) use subtle Card; Change has border-l; Risk is pill. Top 10 table and Summary use Card.
- [ ] **Creditors:** Same as Debtors.
- [ ] **Dark mode:** Toggle dark mode; all updated screens have consistent dark backgrounds and text (slate/gray, no missing dark: variants on new blocks).
- [ ] **ModernDashboard:** Unchanged; still uses existing Card variants (gradient, warning, success).

## Files changed (list)

- `frontend/src/lib/theme.ts` (new)
- `frontend/src/components/ui/Card.tsx` (added `subtle`, `critical`; dark mode for default/subtle and existing variants)
- `frontend/src/pages/PLPack.tsx`
- `frontend/src/pages/WorkingCapital.tsx`
- `frontend/src/pages/Cashflow.tsx`
- `frontend/src/pages/DataHealth.tsx`
- `frontend/src/pages/Revenue.tsx`
- `frontend/src/pages/Expenses.tsx`
- `frontend/src/pages/Debtors.tsx`
- `frontend/src/pages/Creditors.tsx`
- `docs/UI_REFINEMENT_V1.md` (this file)

## Constraints respected

- No backend changes.
- No metric or layout/route changes.
- Existing components (e.g. VarianceDisplay, DataReadyBadge, Recharts) kept; only surfaces refactored to Card and calm palette.
