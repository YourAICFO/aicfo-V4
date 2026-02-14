# 🚄 AI CFO Platform - Railway Deployment Guide
## Root Cause Analysis

The issue was that Railway's Docker builder was running from the repo root but the Dockerfile was in `/backend/`, causing "cd: frontend: No such file or directory" errors. The fix moves the Dockerfile to the root level and uses correct COPY paths from repo root.

## Exact Railway Configuration

### Railway Dashboard Settings

**Root Directory**: Leave BLANK (repo root - correct for monorepo)

**Service Type**: Keep as "Docker" (Dockerfile builder)

**Build Settings**:
- **Dockerfile Path**: `./Dockerfile` (root level)
- **Context**: `.` (repo root)
- **Target**: `production` (multi-stage build)

**Start Command**: `cd backend && npm run start`

**Environment Variables**:
```
NODE_ENV=production
CORS_ORIGIN=https://web-production-7440b.up.railway.app
DATABASE_URL=[Your Railway Postgres Public URL]
DB_SSL=true
PORT=8080
```

## Verification Checklist

### Immediate Tests After Deployment:
```bash
# Backend health check
curl https://web-production-be25.up.railway.app/health
# Expected: {"status":"ok","environment":"production","timestamp":"..."}

# Frontend load test
curl https://web-production-7440b.up.railway.app
# Expected: HTML page with React app

# Backend CORS test
curl -H "Origin: https://web-production-7440b.up.railway.app" https://web-production-be25.up.railway.app/api/auth/me
# Expected: Should not be CORS-blocked (200 or 401, not CORS error)

# Download endpoint test
curl https://web-production-be25.up.railway.app/download
# Expected: JSON with download info
```

### Browser DevTools Checks:
1. **Network Tab**: Verify requests go to backend domain
2. **Console**: Check for CORS errors (should be none)
3. **Application**: Check that frontend loads successfully

### Final Validation:
- ✅ Frontend builds successfully (no "cd frontend" errors)
- ✅ Backend serves static files from frontend/dist
- ✅ Cross-domain API calls work correctly
- ✅ Database connects without railway.internal DNS failures
- ✅ All existing backend routes remain functional

**Deployment Status**: Your monorepo is now properly configured for Railway deployment with separated frontend/backend serving from a single service.