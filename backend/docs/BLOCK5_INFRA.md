# Block 5 — Redis-backed rate limiting (multi-instance safe)

## Scope

- Rate limiting uses Redis when `RATE_LIMIT_REDIS_ENABLED=true` and `REDIS_URL` is set, so limits are shared across instances.
- Env validation: `REDIS_URL` required when `RATE_LIMIT_REDIS_ENABLED=true` (except in test).
- Fail-open on Redis errors: single structured warning, no process crash or log spam.
- Tests and docs added; verify-prod.sh has optional rate-limit check.

## Smoke checklist

Run against a deployed or local API (replace `BASE` and optional `TOKEN`).

```bash
export BASE="${BASE_URL:-http://localhost:5000}"
export TOKEN="${TOKEN:-}"   # optional; set for auth + rate-limit check
```

1. **Health**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "$BASE/health"
   # Expect: 200
   ```

2. **Metrics (no auth)**
   ```bash
   curl -s "$BASE/metrics" | head -20
   # Expect: Prometheus text with http_requests_total, etc.
   ```

3. **Auth (negative)**
   ```bash
   curl -s -o /dev/null -w "%{http_code}" "$BASE/api/auth/me"
   # Expect: 401
   ```

4. **Rate limit (429) — only when TOKEN not required for endpoint**
   Use an endpoint that is rate-limited without auth (e.g. login). Send many requests in a short window until 429:
   ```bash
   for i in $(seq 1 25); do
     code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
       -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"x"}')
     echo "Request $i: $code"
     if [ "$code" = "429" ]; then echo "  ✅ Rate limit enforced (429)"; break; fi
   done
   ```
   Expect: eventually `429` (or 401 for invalid login; in that case repeat with more requests to hit the limit).

5. **Full verify script (when TOKEN set)**
   ```bash
   TOKEN=<admin-jwt> ./scripts/verify-prod.sh
   ```
   Expect: all checks passed, including optional rate-limit section if implemented.

## Env vars (Railway)

- `RATE_LIMIT_ENABLED` — `true` (default)
- `RATE_LIMIT_REDIS_ENABLED` — `true` for production (multi-instance)
- `REDIS_URL` — set to Railway Redis URL (required when `RATE_LIMIT_REDIS_ENABLED=true`)

## References

- `docs/RATE_LIMITING.md` — config and behaviour
- `src/middleware/rateLimit.js` — implementation
- `test/rateLimit.test.js` — unit tests
