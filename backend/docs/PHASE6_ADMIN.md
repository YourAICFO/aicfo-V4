# Phase 6 Admin Analytics

## Env setup
Set `ADMIN_EMAILS` as a comma-separated list of admin emails.

## Quick self-test (curl)
Replace BACKEND_URL and TOKEN.

```
curl -H "Authorization: Bearer TOKEN" \
  https://BACKEND_URL/api/admin/metrics/summary
```

Expected:
- 200 for admins
- 403 for non-admin emails

```
curl -H "Authorization: Bearer TOKEN" \
  https://BACKEND_URL/api/admin/metrics/usage?months=12
```

```
curl -H "Authorization: Bearer TOKEN" \
  https://BACKEND_URL/api/admin/metrics/ai?months=12
```

```
curl -H "Authorization: Bearer TOKEN" \
  https://BACKEND_URL/api/admin/metrics/customers
```
