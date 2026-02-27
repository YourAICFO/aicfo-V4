#!/usr/bin/env bash
# Production verification script.
# Usage: BASE_URL=https://your-app.railway.app TOKEN=<admin-jwt> ./scripts/verify-prod.sh
set -euo pipefail

BASE="${BASE_URL:-http://localhost:5000}"
TOKEN="${TOKEN:-}"
PASS=0
FAIL=0

check() {
  local name="$1" url="$2" expect="$3" auth="${4:-}"
  local headers=(-s --max-time 10 -o /tmp/vp_body -w '%{http_code}')
  [ -n "$auth" ] && headers+=(-H "Authorization: Bearer $auth")
  local code
  code=$(curl "${headers[@]}" "$url" 2>/dev/null) || code="000"
  local body
  body=$(cat /tmp/vp_body 2>/dev/null) || body=""

  if [ "$code" = "$expect" ]; then
    echo "  ✅ $name  (HTTP $code)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name  (expected $expect, got $code)"
    [ -n "$body" ] && echo "     body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

check_body_contains() {
  local name="$1" url="$2" needle="$3" auth="${4:-}"
  local headers=(-s --max-time 10 -o /tmp/vp_body -w '%{http_code}')
  [ -n "$auth" ] && headers+=(-H "Authorization: Bearer $auth")
  local code
  code=$(curl "${headers[@]}" "$url" 2>/dev/null) || code="000"
  local body
  body=$(cat /tmp/vp_body 2>/dev/null) || body=""

  if echo "$body" | grep -q "$needle"; then
    echo "  ✅ $name  (HTTP $code, contains '$needle')"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name  (HTTP $code, missing '$needle')"
    echo "     body: $(echo "$body" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "═══ Production Verification Pack ═══"
echo "Base: $BASE"
echo ""

echo "── Core Health ──"
check "GET /health" "$BASE/health" "200"
check_body_contains "/health body" "$BASE/health" '"status":"ok"'

echo ""
echo "── Metrics ──"
check "GET /metrics" "$BASE/metrics" "200"
check_body_contains "/metrics has counters" "$BASE/metrics" "http_requests_total"
check_body_contains "/metrics has DLQ" "$BASE/metrics" "dlq_count"

echo ""
echo "── Auth (negative) ──"
check "GET /api/auth/me (no token)" "$BASE/api/auth/me" "401"

if [ -n "$TOKEN" ]; then
  echo ""
  echo "── Admin Queue Health ──"
  check "GET /api/admin/queue/health" "$BASE/api/admin/queue/health" "200" "$TOKEN"
  check_body_contains "queue health body" "$BASE/api/admin/queue/health" '"queueName"' "$TOKEN"
  check_body_contains "queue health DLQ" "$BASE/api/admin/queue/health" '"failedLastHour"' "$TOKEN"

  echo ""
  echo "── Companies (authed) ──"
  check "GET /api/companies" "$BASE/api/companies" "200" "$TOKEN"
else
  echo ""
  echo "  ⚠️  TOKEN not set — skipping admin + authed endpoint checks"
  echo "  Usage: TOKEN=<admin-jwt> $0"
fi

echo ""
echo "═══ Results: $PASS passed, $FAIL failed ═══"
[ "$FAIL" -eq 0 ] && echo "All checks passed." || echo "Some checks failed."
exit "$FAIL"
