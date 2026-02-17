# Backend Ops Notes

## Ingestion Health Endpoint

Use this authenticated endpoint to verify balances-only ingestion and snapshot health without DB access:

`GET /api/admin/ingestion/health?companyId=<company_id>`

Auth:
- Header: `Authorization: Bearer <user_jwt>`
- Access rule: user must own the company.

Example:

```bash
curl -H "Authorization: Bearer $USER_JWT" \
  "https://<api-host>/api/admin/ingestion/health?companyId=$COMPANY_ID"
```

Healthy response signals:
- `lastConnectorSeenAt` is recent.
- `lastSyncRun.status` is `success` or `running`.
- `latestSnapshot.monthKey` is current/expected closed month.
- `latestSnapshot.computedFrom` is either `balances` or `transactions`.
- `coverage.classifiedPct` is high and `topUnclassifiedLedgers` is small.
- `currentBalances.cashTotal/debtorsTotal/creditorsTotal/loansTotal` are non-zero when expected.

## Connector Login Contract Check

Connector login endpoint expects camelCase keys:

```bash
curl -X POST "$API_BASE_URL/api/connector/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"x@y.com","password":"secret"}'
```
