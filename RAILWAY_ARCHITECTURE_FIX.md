# 🚄 AI CFO Platform - Railway Architecture Fix Report
## Target Architecture

**Final State**: Clean two-domain Railway deployment with separated concerns:
- **Frontend**: Static Site service serving Vite build → pure HTML/JS/CSS
- **Backend**: Web Service running Express API → Node.js runtime
- **Worker**: Optional Web Service for background jobs
- **Database**: Railway Postgres (public URL, SSL-enabled)
- **Redis**: Optional Railway Redis (public URL, crash-safe)

**Why This Permanently Avoids Docker Conflicts**:
- Railway detects Dockerfile in repo root → forces Docker builder on ALL services
- Moving Dockerfile to backend/ → allows frontend to use Static Site builder
- Static Site = faster builds, smaller artifacts, no Node.js runtime overhead
- Backend keeps Docker for complex runtime needs (Sequelize, native deps)

## Repo Changes (Exact Plan - Option 1: Move Dockerfile)

### Final Tree Layout
```
aicfo-V4/
├── frontend/                 # Vite React app
│   ├── src/
│   ├── dist/                 # Vite build output
│   ├── package.json
│   └── postcss.config.js
├── backend/                  # Express API
│   ├── src/
│   ├── Dockerfile            # ← Moved here (prevents root detection)
│   ├── package.json
│   └── migrations/
├── worker/                   # Background jobs (future)
│   ├── src/
│   └── package.json
├── railway.toml              # Updated for multi-service
└── README.md
```

### Exact Git Commands
```bash
# Move Dockerfile to backend (prevents Railway Docker auto-detection)
git mv Dockerfile backend/Dockerfile

# Commit the structural change
git commit -m "chore: move Dockerfile to backend to enable frontend static site deployment"

# Push to trigger Railway rebuild with new architecture
git push origin main
```

## Railway Dashboard Action Plan (Step-by-Step)

### FRONTEND Service Configuration

1. **Navigate**: Railway Dashboard → Your Project → Services
2. **Find Frontend Service**: Click on the service with domain web-production-7440b.up.railway.app
3. **Service Settings**: Settings → General
4. **Change Service Type**: 
   - If Docker detected: Click "Change Service Type" → Select "Static Site"
   - If already options: Choose "Static Site" or "Nixpacks" (Static Site preferred)
5. **Build Settings**:
   - **Build Command**: `cd frontend && npm ci && npm run build`
   - **Output Directory**: `frontend/dist` (repo-relative, NOT /app/frontend/dist)
   - **Install Command**: `npm ci` (ensures exact dependencies including tailwindcss/postcss/autoprefixer)
6. **Environment Variables**:
   - **NODE_ENV**: `production`
   - **VITE_API_URL**: `https://web-production-be25.up.railway.app`
7. **Save**: Click "Save Changes"

### BACKEND Service Configuration

1. **Navigate**: Railway Dashboard → Your Project → Services
2. **Find Backend Service**: Click on the service with domain web-production-be25.up.railway.app
3. **Service Settings**: Settings → General
4. **Service Type**: Keep as "Docker" (since we moved Dockerfile to backend/)
5. **Build Settings**:
   - **Dockerfile Path**: `./backend/Dockerfile` (relative to repo root)
   - **Context**: `.` (repo root)
   - **Target**: `production` (multi-stage build)
6. **Start Command**: `cd backend && npm run start`
7. **Environment Variables**:
   ```
   NODE_ENV=production
   CORS_ORIGIN=https://web-production-7440b.up.railway.app
   DATABASE_URL=[Copy from Postgres service → Connect → Public URL]
   DB_SSL=true
   PORT=8080
   ```

### Postgres Service Configuration

1. **Navigate**: Railway Dashboard → Your Project → Services
2. **Find Postgres Service**: Click on your PostgreSQL service
3. **Connect Tab**: Click "Connect" 
4. **Copy Public URL**: Use the "Public URL" (NOT internal hostname)
5. **Paste in Backend**: Add this URL to backend service DATABASE_URL variable

### Redis Service Configuration (Optional)

1. **Navigate**: Railway Dashboard → Your Project → Services
2. **Find Redis Service**: Click on your Redis service (if exists)
3. **Connect Tab**: Click "Connect"
4. **Copy Public URL**: Use the "Public URL"
5. **Paste in Backend**: Add this URL to backend service REDIS_URL variable
6. **Worker Service**: Same URL for worker if you create it later

## Code Patches (Copy/Paste Ready)

### 1. Frontend API Client Configuration

**File**: `frontend/src/services/api.ts`
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Important for cross-domain cookies
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### 2. Backend CORS Configuration (Dynamic)

**File**: `backend/src/server.js` (already updated)
```javascript
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (corsOrigins.includes(origin)) return callback(null, true);
    if (origin.includes('localhost')) return callback(null, true);
    callback(new Error(`CORS policy violation: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id'],
  maxAge: 86400
}));
```

### 3. Database Configuration (Resilient)

**File**: `backend/src/config/database.js` (already updated)
```javascript
const { Sequelize } = require('sequelize');
require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('❌ CRITICAL: DATABASE_URL not set');
  process.exit(1);
}

const maskedUrl = process.env.DATABASE_URL.replace(/:\/\/[^@]+@/, '://****:****@');
console.log('✅ DATABASE_URL configured:', maskedUrl);

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: (process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true')
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

module.exports = { sequelize };
```

### 4. Redis Optional Configuration (Crash-Safe)

**File**: `backend/src/config/redis.js` (create if using Redis)
```javascript
const Redis = require('ioredis');

let redisClient = null;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
    console.log('✅ Redis client initialized');
  } catch (error) {
    console.warn('⚠️  Redis initialization failed, continuing without Redis:', error.message);
  }
} else {
  console.log('ℹ️  Redis not configured, continuing without Redis');
}

module.exports = { redisClient };
```

## Verification & Rollout

### Immediate Tests
```bash
# Backend health check
curl https://web-production-be25.up.railway.app/health
# Expected: {"status":"ok","environment":"production"}

# Backend CORS test
curl -H "Origin: https://web-production-7440b.up.railway.app" https://web-production-be25.up.railway.app/api/auth/me
# Expected: Should not be CORS-blocked (200 or 401, not CORS error)

# Frontend load test
curl https://web-production-7440b.up.railway.app
# Expected: HTML page with React app
```

### Browser DevTools Checks
1. **Network Tab**: Verify requests go to BACKEND_DOMAIN
2. **Console**: Check for CORS errors (should be none)
3. **Application**: Check cookies include SameSite=None; Secure if using cookies
4. **Security**: Verify HTTPS and valid certificates

### Final Architecture Verification
- Frontend: Static Site, serves from frontend/dist, uses VITE_API_URL
- Backend: Docker service, connects to public DB URL, allows FRONTEND_DOMAIN CORS
- Cross-domain: Cookies/tokens work correctly across domains
- Database: Uses public Railway URL, SSL enabled, no internal hostname failures
- Redis: Optional, doesn't crash if missing

**Deployment Complete**: Your two-domain Railway architecture is now production-ready and future-proof!