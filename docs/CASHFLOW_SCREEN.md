# Cashflow Screen

The **Cashflow** page (`/cashflow`) shows KPIs and charts based on **Cash & Bank movement** only (same source as runway). It does **not** use revenue/expense proxies.

## Data source

- **Backend:** `GET /api/dashboard/cashflow?period=6m` calls `dashboardService.getCashflowDashboard(companyId, period)`.
- **Series:** `runwayService.getCashBankSeries(companyId, lastN=6)` — same as runway. Each entry has `month`, `opening`, `closing`, `netChange` (closing − opening).

## Inflow / outflow

- **inflow** = max(netChange, 0)  
- **outflow** = max(−netChange, 0)

Averages over the series (last N months):

- **avgCashInflow** = average of inflow per month  
- **avgCashOutflow** = average of outflow per month  
- **netCashFlow** = avgCashInflow − avgCashOutflow (= average of netChange, aligned with runway’s avgNetCashChange6M)

If **&lt; 3 months** of series data: `avgCashInflow`, `avgCashOutflow`, and `netCashFlow` are returned as `null` (UI shows "—").

## API response shape

```json
{
  "success": true,
  "data": {
    "cashflow": {
      "months": [
        { "month": "2024-01", "opening": 100000, "closing": 150000, "netChange": 50000, "inflow": 50000, "outflow": 0 }
      ],
      "avgCashInflow": 45000,
      "avgCashOutflow": 30000,
      "netCashFlow": 15000
    },
    "monthlyCashflow": [
      { "month": "2024-01-01", "inflow": 50000, "outflow": 0, "net": 50000 }
    ],
    "cashHistory": []
  }
}
```

Charts use `monthlyCashflow` (same shape as before). KPIs use `cashflow.avgCashInflow`, `cashflow.avgCashOutflow`, `cashflow.netCashFlow`.

## UI

- **Subtitle:** "Based on Cash & Bank movement (last 6 months)".
- **KPI cards:** Avg cash inflow, Avg cash outflow, Net cash flow (no "avg revenue" or "avg expenses").
- **Nulls:** `formatCurrency(null)` → "—".

See **RUNWAY_LOGIC.md** for runway formula and **DASHBOARD_COMMAND_CENTER.md** for Quick Actions.
