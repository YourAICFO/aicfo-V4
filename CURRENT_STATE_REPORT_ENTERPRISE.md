# AI CFO Platform — Complete Current State Report (Enterprise Phase 1)

**Generated:** Audit only. No code changes. No refactors.

---

## 1️⃣ REPOSITORY STRUCTURE

### Top-level folders
- `backend/` — Node.js/Express API, worker, migrations, docs
- `frontend/` — React (Vite + TypeScript) SPA
- `connector/` — Legacy connector (C# / .NET-style structure under `src/`)
- `connector-dotnet/` — .NET connector (Tray, Service, Shared, installer)
- `nodejs-connector/` — Node.js connector (scripts, src, test)
- Root: `railway.toml`, root `Dockerfile` (multi-stage monorepo)

### Backend structure
- `backend/src/` — config, controllers, cron, doctor.js, insights/, metrics/, middleware/, models/, routes/, services/, utils/, worker/
- `backend/src/railway-entrypoint.js` — single entrypoint for web vs worker
- `backend/migrations/` — SQL migrations (30+ files)
- `backend/docs/` — ETL_AND_STRICT_MODE.md, observability.md, CURRENT_STATE_REPORT.md, validation/, etc.
- `backend/test/` — billingTrialAccess.test.js, aiStrictMode.test.js, monthKeyUtils, tallyCoaAdapter, etc.
- `backend/scripts/` — run scripts
- `backend/downloads/` — static/download assets

### Frontend structure
- `frontend/src/` — App.tsx, main.tsx, index.css, components/, lib/, pages/, services/, store/, utils/
- `frontend/src/pages/` — Login, Register, Dashboard (ModernDashboard), Revenue, Expenses, Cashflow, AIInsights, AIChat, Integrations, Debtors, Creditors, WorkingCapital, CreateCompany, Settings, AdminDashboard, AdminControlTower, Download, etc.
- `frontend/src/components/` — Layout, Header, Sidebar, sync/, dashboard/, etc.

### Connector structure
- **connector-dotnet/** — Primary connector: AICFO.Connector.Tray, AICFO.Connector.Service, AICFO.Connector.Shared, installer (WiX), build.ps1, PENDING_UX_CHECKLIST.md, README.md
- **connector/** — Legacy: src/ (AICFOConnector, AICFOConnector.UI, AICFOConnector.Core)
- **nodejs-connector/** — Node.js variant: src/, scripts/, test/

### Dockerfile(s) location
- `backend/Dockerfile` — Used by Railway (multi-stage: frontend-builder + backend runtime; copies frontend dist to `/app/public`; CMD via `node src/railway-entrypoint.js`)
- `Dockerfile` (repo root) — Multi-stage monorepo (frontend-builder, backend-builder, production); not referenced by current railway.toml

### railway.toml
- **Exists** at repo root.
- `[build]` builder = "DOCKERFILE", dockerfilePath = "backend/Dockerfile"
- `[deploy]` startCommand = "node src/railway-entrypoint.js", restartPolicyType = "ON_FAILURE", restartPolicyMaxRetries = 10

---

## 2️⃣ DEPLOYMENT CONFIGURATION

- **Railway root directory:** Not set in railway.toml. Default is repo root; build context is typically repo root when dockerfilePath is `backend/Dockerfile`.
- **Dockerfile used:** `backend/Dockerfile`.
- **API start command:** Same as worker; entrypoint decides. For web: `node src/railway-entrypoint.js` → runs `node src/server.js` (when RAILWAY_PROCESS is not worker).
- **Worker start command:** Same image; when RAILWAY_PROCESS=worker (or WORKER), entrypoint runs `node src/worker/worker.js`.
- **root_dir:** Not set in railway.toml.
- **Multiple services:** Yes. One image; two logical services (web + worker) distinguished by env RAILWAY_PROCESS. Web and worker are separate Railway services sharing the same build; worker must set RAILWAY_PROCESS=worker and REDIS_URL (same as web).

---

## 3️⃣ DATA PIPELINE STATUS

- **Raw payload storage:** Exists. Connector sync payload is processed by `integrationService.processConnectorPayload`; raw data lands in `financial_transactions`, `source_ledgers`, and related tables. Chart of accounts and ledger data are normalized and stored; transactions are upserted (findOrCreate) with `normalizeMonth(transaction.date)`.
- **Normalization layer:** Exists. `sourceNormalizationService` (normalizeSourceLedger, upsertAccountingTermMapping), `tallyCoaAdapter` (normalizeCoaPayload), `accountHeadNormalizer`, `cfoAccountMappingService` (mapLedgersToCFOTotals, upsertLedgerClassifications). Migration `source-normalization-layer.sql` and `tally-source-mapping-rules-seed.sql`.
- **Snapshot generation:** Exists. `monthlySnapshotService` and worker job `generateMonthlySnapshots` write to `monthly_trial_balance_summary`, `monthly_revenue_breakdown`, `monthly_expense_breakdown`, `monthly_debtor`, `monthly_creditor`, `current_*` tables, `current_liquidity_metric`. `runCatalogMetrics` (and snapshot pipeline) writes to `cfo_metrics`.
- **Recompute logic:** Exists (partial). Snapshots and metrics are produced by ETL jobs. Backfill/recompute via `adminBackfillService` (backfill/company, backfill/status). No generic “recompute this month” API documented for end users; admin backfill exists.
- **Snapshot versioning:** Exists for validation only. Table `snapshot_validations` with `(company_id, snapshot_month, validation_version)` unique index; `snapshotValidator` service writes validation status/version. No version field on `monthly_trial_balance_summary` or other snapshot tables themselves.
- **Audit trail for recompute:** Partial. `app_logs` and admin usage events log some activity. No dedicated “recompute_audit” or “snapshot_generation_audit” table; snapshot_validations and IntegrationSyncRun/IntegrationSyncEvent provide sync/validation history.

---

## 4️⃣ METRICS & CALCULATION LOGIC

- **Where financial metrics are calculated:** ETL: `monthlySnapshotService`, `runCatalogMetrics` (metrics catalog in `src/metrics/metricsCatalog.js`), `dataAccess.js` (reads from DB for catalog). Request-time reads in `dashboardService`, `cfoQuestionService`, `cfoContextService`, `debtorsService`, `creditorsService`, `finance` routes — they read from CFOMetric, MonthlyTrialBalanceSummary, current_* tables, not from raw `financial_transactions` for KPIs (strict mode).
- **Central metrics service:** No single “metrics service” name. Metrics are defined in `src/metrics/metricsCatalog.js`; computation is in `runCatalogMetrics` and snapshot pipeline; read access in `src/metrics/dataAccess.js`. Dashboard and CFO logic use these plus CFOMetric model.
- **Unit tests for metrics:** No dedicated metrics unit tests. `backend/test/aiStrictMode.test.js` asserts dashboard/CFO use dataReady/snapshots and do not aggregate from FinancialTransaction; `monthKeyUtils.test.js`, `tallyCoaAdapter.test.js` exist. No `metricsCatalog.test.js` or equivalent.
- **metrics_spec.md:** Not present. No file named metrics_spec.md or similar in backend.
- **Variance calculations:** Implemented in narrow places. `monthlySnapshotService` has standard deviation (variance) over values; `dataAccess.js` has variance reduction for a metric. No product-level “variance column” (e.g. vs budget or prior period) in P&L UI.
- **Explanations:** AI insights have `explanation` (AIInsight model, buildInsights, generateAIInsights). CFO answers are template-based with metric substitution; no structured “explanation” object per metric in the API.

---

## 5️⃣ P&L IMPLEMENTATION STATUS

- **Does /api/financials/pl exist?** No. There is no route `/api/financials/pl` or `/api/finance/pl`. Finance routes expose `/api/finance/debtors/*`, `/api/finance/creditors/*`, `/api/finance/working-capital`. Dashboard and revenue/expense data come from dashboard and dashboard-related endpoints (e.g. overview, revenue, expense) backed by snapshot/CFO metrics.
- **P&L screen implemented?** Not as a single “P&L” screen. Revenue and Expenses are separate pages (Revenue.tsx, Expenses.tsx); Cashflow exists. No dedicated “Profit & Loss” or “P&L” page in App routes.
- **Responsive:** Frontend uses Tailwind and responsive patterns; Revenue, Expenses, and other app pages are responsive in the same way as the rest of the app.
- **Variance column implemented?** Not in the UI. Backend has variance in metrics/statistics code only; no variance column (e.g. vs budget or prior period) on a P&L or financial statement view.
- **Drill-down implemented?** Not as a dedicated P&L drill-down. Debtors/Creditors/Transactions and dashboard have detail views; no “drill from P&L line to transactions” flow documented.
- **Export implemented?** Download route exists (`/download`, `/api/download`); no specific “export P&L” or “export financials/pl” endpoint or button identified.

---

## 6️⃣ CLOSE / WORKFLOW STATUS

- **Close Month feature:** No user-facing “Close Month” feature. `AccountingMonth` model and `ensureAccountingMonth` in monthlySnapshotService support month state (isClosed, sourceLastSyncedAt). No API or UI for user-triggered “close month” or “reopen month”.
- **Issue model:** Not implemented. No `Issue` model in backend/src/models. No issue-tracking tables in migrations listed.
- **Task assignment:** Not implemented. No Task model or task-assignment flow found.
- **Approval system:** Not implemented. No approval workflow or approval model found.
- **Audit log:** Exists. `AuditLog` model; `app_logs` table (system logs migration); admin control tower and logging use them. No audit log specifically for “close” or “approval” actions.

---

## 7️⃣ CONNECTOR STATUS

- **Connector login automatic (email/password):** Yes. Device login flow exists: POST `/api/connector/device/login` (email, password, deviceId, deviceName) returns deviceToken. Tray supports email/password → login → fetch companies → dropdown → register device → save mapping (recommended flow). Legacy POST `/api/connector/login` (email/password) returns JWT token.
- **Manual companyId/API token:** Legacy path exists. Connector can use legacy token; “Legacy (not recommended)” is documented in tray. Register-device and device/companies, device/links use device token. So both automatic (device) and manual/legacy are supported.
- **Payload sent (sync):** POST `/api/connector/sync` body validated by `validateChartOfAccountsPayload`. Required: `chartOfAccounts` (object with `groups` array and `ledgers` non-empty array); each ledger: name, parent, guid. Optional: asOfDate, partyBalances, loans, interestSummary, metadata. Request also carries linkId (via auth context). `processConnectorPayload` uses chartOfAccounts, asOfDate, partyBalances, loans, interestSummary, metadata.
- **Fields included:** chartOfAccounts (groups, ledgers with name, parent, guid), asOfDate, partyBalances, loans, interestSummary, metadata. Sync start/complete/progress and heartbeat use linkId/runId as appropriate.

---

## 8️⃣ ADMIN / MULTI-COMPANY

- **Company dropdown:** Present. Header.tsx loads companies via companyApi.getAll(), shows selected company, dropdown when companies.length > 1; setSelectedCompany stores selectedCompanyId in auth store. X-Company-Id is sent on API requests via interceptor.
- **Create company button:** Present. Route `/create-company` and CreateCompany.tsx page exist. Backend POST to create company exists (companies route).
- **Delete company:** Implemented. Backend: companyService.deleteCompany, companies route DELETE (e.g. req.params.id); soft delete (is_deleted / deleted_at). Frontend: not verified in this audit for a dedicated “Delete company” button; backend supports it.
- **RBAC:** Implemented for admin. Admin routes use `requireAdmin` or `requireAdminApiKey` from middleware (adminAuth). AdminRoute protects /admin and /admin/control-tower. Admin API key can be sent via header for backfill/queue/mapping endpoints.

---

## 9️⃣ OBSERVABILITY

- **Structured logs:** Yes. Pino HTTP logger; request context (run_id, user_id, company_id); logs written as structured. Doc: backend/docs/observability.md.
- **Diagnostics page:** Admin Control Tower (AdminControlTower.tsx) acts as diagnostics: system health (DB, Redis, worker status, queue depth), connector status by mapping, business metrics, usage, AI quality, connector failures (recent_failures), accounting/risk metrics. “Copy Diagnostics” and “Refresh Status” on Status tab; “Copy Login Diagnostics” in tray. No separate “/diagnostics” public page.
- **Ingestion errors visible:** Yes. Admin control tower shows connector recent_failures (last_sync_error sanitized); sync status and last error per link/mapping. Integration and ConnectorCompanyLink have last_sync_error. integration_sync_events table exists for append-only sync event log; admin ingestion routes may expose event data.
- **Health endpoint:** Yes. GET `/health` returns JSON (status: 'ok', timestamp, environment). Used by Railway/Docker HEALTHCHECK.

---

## 10️⃣ OPEN RISKS / TECH DEBT

- **Known weak areas:** Redis required for worker queue; without it worker is “degraded” and background jobs do not run. CURRENT_STATE_REPORT.md notes empty financial data and missing monthly snapshots when pipeline is not fed. Mock integrations possible when ENABLE_MOCK_INTEGRATIONS=true and NODE_ENV !== 'production'.
- **Hardcoded values:** CORS default includes localhost:5173, 3000; rate limit defaults (auth 100/15min, etc.) in code; some model defaults (e.g. gpt-4o-mini) in aiService/worker. No exhaustive audit of all literals.
- **Security risks:** JWT and connector tokens must be set in production (JWT_SECRET enforced in production). Passwords/tokens must not be logged (documented). Admin API key sent in headers; rate limiting on auth/connector/AI. No audit of all endpoints for authorization.
- **Missing validation:** CoA payload validated for structure; not all business rules or idempotency keys audited. Subscription/trial checks (checkSubscriptionAccess) applied on many routes; not verified on every route.
- **Performance risks:** No pagination or limits verified on all list endpoints. Large payloads (e.g. connector sync) use 10mb body limit. Dashboard and metrics read from ETL tables (good); no N+1 or heavy request-time aggregation audited here.

---

*End of report. No code was changed.*
