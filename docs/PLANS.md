# Billing & Plans — Plan source of truth and limits

## Plan capabilities (source of truth)

Defined in `backend/src/config/plans.js`. Map `BillingPlan.code` / `CompanySubscription.planCode` to these keys.

| Plan        | Company limit | AI explanations/mo | AI chat messages/mo | Reports | Report downloads/mo |
|------------|----------------|----------------------|----------------------|---------|----------------------|
| **TRIAL**   | 1              | 10                   | 50                   | ✓       | 10                   |
| **STARTER**| 1              | 30                   | 200                  | ✓       | 30                   |
| **PRO**    | 5              | 200                  | 1000                 | ✓       | 200                  |
| **ENTERPRISE** | 999        | 99999                | 99999                | ✓       | 99999                |

- **Plan resolution**: `planService.getCompanyPlan(companyId)` uses `CompanySubscription` if present, else legacy `Subscription`; default **TRIAL** when missing.
- **User-level company limit**: `planService.getEffectivePlanForUser(userId)` returns the best plan among all companies owned by the user; company creation is checked against that plan’s `companyLimit`.

## Enforcement flags (defaults)

| Flag | Default | Effect |
|------|--------|--------|
| `ENFORCE_COMPANY_LIMITS` | `false` | When `true`: block company creation with 403 if user already has ≥ `companyLimit` companies. When `false`: only log a warning. |
| `ENFORCE_USAGE_LIMITS`   | `false` | When `true`: return 403 when monthly AI/report usage exceeds plan limits. When `false`: allow but send `X-Usage-Warning` when over limit. |

Set in environment (e.g. `.env`):

```bash
ENFORCE_COMPANY_LIMITS=false
ENFORCE_USAGE_LIMITS=false
```

## Rollout plan

- **During ingestion/testing**: Keep both flags **OFF** so behaviour is unchanged and you can test without hitting limits.
- **After pilots**: Turn **ON** one or both as needed:
  - `ENFORCE_COMPANY_LIMITS=true` — enforce “Trial/Starter = 1 company, Pro = 5”.
  - `ENFORCE_USAGE_LIMITS=true` — enforce monthly AI explanation, AI chat, and report download limits.

## Usage tracking

- **Table**: `ai_usage_daily` (`company_id`, `date`, `feature_key`, `count`).
- **Helpers**: `usageService.recordUsage(companyId, featureKey, inc)`, `usageService.getUsage(companyId, featureKey, currentMonth)`.
- **Feature keys**: `ai_pl_explanation`, `ai_chat_message`, `report_download`.

## Frontend

- On 403 for plan/limit errors (`PLAN_LIMIT_COMPANIES`, `USAGE_LIMIT`, or message containing “Upgrade”), the app shows an upgrade CTA modal with a link to **Settings → Billing** (`/settings?tab=billing`).

## Smoke checklist

- [ ] Create company with `ENFORCE_COMPANY_LIMITS=false`: existing behaviour (no 403).
- [ ] With limit already at cap, set `ENFORCE_COMPANY_LIMITS=true`: create company returns 403 and frontend shows upgrade modal.
- [ ] Call pl-ai-explanation / AI chat / monthly-report with `ENFORCE_USAGE_LIMITS=false`: over limit returns 200 with `X-Usage-Warning`.
- [ ] With `ENFORCE_USAGE_LIMITS=true`: over limit returns 403 and frontend shows upgrade modal.
- [ ] `getCompanyPlan(companyId)` returns TRIAL when no subscription; returns STARTER when `plan_code = 'starter_5000'` (or equivalent).
- [ ] Billing tab opens when navigating to `/settings?tab=billing` or from upgrade modal “Go to Billing”.
