# Phase 5.1 YoY Metrics

## Overview
This phase adds deterministic Year-over-Year (YoY) comparisons based on **latest closed month** data and precomputed metrics stored in `cfo_metrics`.

## YoY Logic
For any metric that uses YoY growth:

```
YoY_growth_pct = (current_closed - same_month_last_year) / abs(same_month_last_year)
```

- If last year data is missing or zero, store `null`.
- YoY comparisons always use **closed months**.

## New YoY Metrics
Stored in `cfo_metrics` with `time_scope = 'yoy'` and `month = latest_closed_month`:

- revenue_yoy_growth_pct
- expense_yoy_growth_pct
- net_profit_yoy_growth_pct
- gross_margin_yoy_growth_pct
- cash_balance_yoy_change
- debtor_balance_yoy_change
- creditor_balance_yoy_change

## Snapshot Retention
The system retains **25 months** of snapshot history:
- 24 most recent closed months
- current open month

Older months are trimmed safely for all monthly snapshot tables and `cfo_metrics` entries with month.

## YoY Questions
New question codes using YoY metrics:
- REVENUE_YOY_TREND
- EXPENSE_YOY_TREND
- PROFIT_YOY_TREND
- DEBTOR_YOY_TREND
- CREDITOR_YOY_TREND

Templates reference:
- `{{month}}` (latest closed month)
- `{{month_last_year}}`

## Notes
AI does not compute any metrics. It only rewrites explanations when `AI_REWRITE_ENABLED=true`.
