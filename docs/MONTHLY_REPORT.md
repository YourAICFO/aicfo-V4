# Monthly Financial Intelligence Report (Phase 1.8)

## Overview

The Monthly Financial Intelligence Report is a **PDF report** generated from existing deterministic and AI-cached data. No new financial logic is introduced; it aggregates data from existing services.

## Report structure

The report JSON (and PDF) includes:

| Section | Description |
|--------|-------------|
| **company** | Company metadata (id, name, industry, currency). |
| **month** | Report month key (YYYY-MM). |
| **generatedAt** | ISO timestamp when the report was built. |
| **executiveSummary** | Array of deterministic bullets (key, severity, text). |
| **performance** | `current`, `previous`, `variances`, `ytd` (revenue, expenses, gross profit, net profit). |
| **drivers** | Revenue and opex driver blocks (deltaAmount, topPositive, topNegative). |
| **workingCapital** | Inventory total/delta, inventory days, cash conversion cycle (CCC), cash gap ex inventory. Null CCC/DIO shown as "—". |
| **liquidity** | Cash/bank closing, runway months, status. |
| **runway** | Runway months, status, avg net cash change (6M). |
| **alerts** | Array of alert objects (ruleKey, severity, title, message, etc.). |
| **aiNarrative** | Optional; present only when cached AI narrative exists in `pl_remarks.aiDraftText`. |

## Data sources

| Report field | Source |
|-------------|--------|
| company | `Company.findByPk(companyId)` |
| month, performance, drivers, executiveSummary, workingCapital | `plPackService.getPlPackWithDrivers(companyId, monthKey)` |
| runway, liquidity | `runwayService.getRunway(companyId)` |
| (debtors used inside pl-pack for executive summary) | `debtorCreditorService.getDebtorsSummary(companyId)` (called inside getPlPackWithDrivers) |
| alerts | `alertsService.getAlerts(companyId)` |
| aiNarrative | `plPackService.getRemarks(companyId, monthKey).aiDraftText` |

## API

- **Endpoint:** `GET /api/finance/monthly-report?month=YYYY-MM`
- **Auth:** Required (same as other finance routes: `authenticate`, `requireCompany`, `checkSubscriptionAccess`).
- **Response:** PDF file streamed as attachment.
- **Filename:** `CompanyName-Monthly-Report-YYYY-MM.pdf` (company name sanitized for filename).

## Null handling

- **CCC (cash conversion cycle)** and **DIO (inventory days)** when null or not finite are represented as `"—"` in the report JSON and in the PDF.
- **Cash gap ex inventory** when null is also shown as "—".

## Smoke checklist

1. **API call**  
   - With a valid token and `X-Company-Id`, call `GET /api/finance/monthly-report?month=YYYY-MM` for a company/month that has P&L data.  
   - Expect `200` and `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="..."`.

2. **PDF opens**  
   - Save the response as a `.pdf` file and open in a viewer. The document should open without errors.

3. **Sections present**  
   - Cover (company name, month, title).  
   - Executive Summary (if any bullets).  
   - Performance table (current vs previous, variance %).  
   - Drivers (revenue, opex).  
   - Working Capital (inventory, CCC, DIO, cash gap).  
   - Liquidity / runway.  
   - Alerts (if any).  
   - AI Narrative only if cached for that company/month.

4. **Null CCC/DIO**  
   - For a company/month where CCC or inventory days are not available, the PDF should show "—" in those cells (no "null" or empty crash).

5. **Frontend**  
   - On the P&L Pack page, "Download Report" button is visible.  
   - Selecting a month and clicking it triggers download of a PDF with the correct filename and loading state during the request.
