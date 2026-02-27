# Infrastructure Setup

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22.x | Runtime |
| Docker + Compose | Latest | Local Postgres & Redis |
| Git | Any | Version control |

## Quick Start (one command)

```bash
# 1. Install all dependencies
npm run install:all

# 2. Copy env template and fill in values
cp backend/.env.example backend/.env
# Edit backend/.env — set DATABASE_URL, JWT_SECRET

# 3. Start DB services, run migrations, seed, launch dev servers
npm run db:up
npm run db:migrate
npm run db:seed        # optional: creates demo user (demo@aicfo.com / demo123456)
npm run dev            # starts backend (port 5000) + frontend (port 5173)
```

## Available Scripts

All scripts run from the repo root.

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Postgres/Redis + backend + frontend in parallel |
| `npm run dev:backend` | Start only the backend (nodemon, port 5000) |
| `npm run dev:frontend` | Start only the frontend (Vite, port 5173) |
| `npm run db:up` | `docker compose up -d postgres redis` |
| `npm run db:down` | `docker compose down` |
| `npm run db:migrate` | Run all pending migrations |
| `npm run db:migrate:status` | Show applied/pending migrations |
| `npm run db:seed` | Seed demo data |
| `npm run test` | Run backend tests (node --test) |
| `npm run typecheck` | Run frontend TypeScript checks |
| `npm run build` | Build frontend for production |
| `npm run install:all` | Install backend + frontend deps |

## Database

### Docker Compose (local dev)

```yaml
# Defaults (override via env vars or .env file in repo root)
POSTGRES_USER=aicfo
POSTGRES_PASSWORD=aicfo123
POSTGRES_DB=aicfo
```

Matching `DATABASE_URL`:
```
postgresql://aicfo:aicfo123@127.0.0.1:5432/aicfo
```

### Migrations

Migrations live in `backend/migrations/*.sql` and are tracked in a
`schema_migrations` table. The runner (`backend/src/db/migrate.js`):

1. On a **blank database**, bootstraps all tables from Sequelize models
   (equivalent of the old `sequelize.sync()`).
2. Applies SQL migration files in lexical (date-prefix) order, skipping
   already-applied ones.

```bash
# Apply migrations
npm run db:migrate

# Check status
npm run db:migrate:status

# Verify core tables exist
cd backend && npm run db:migrate:verify
```

### Production / Railway

- `sequelize.sync()` is **disabled** in staging/production.
- Schema changes must go through SQL migration files.
- The `prestart` hook in `backend/package.json` runs `db:migrate`
  automatically on deploy.
- Set `ALLOW_SEQUELIZE_SYNC=true` only in development if you need
  model-driven schema updates.

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | ≥32 character signing key |
| `NODE_ENV` | `development` / `test` / `staging` / `production` |

### Required in staging/production

| Variable | Description |
|----------|-------------|
| `REDIS_URL` | Redis connection string (unless `QUEUE_RESILIENT_MODE=true`) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend listen port |
| `QUEUE_RESILIENT_MODE` | `true` (dev) | Skip Redis requirement |
| `ALLOW_SEQUELIZE_SYNC` | `false` | Allow model sync in dev |
| `OPENAI_API_KEY` | — | AI features (degrades without) |
| `SENTRY_DSN` | — | Error tracking |
| `CORS_ORIGIN` | `localhost:5173,3000` | Comma-separated origins |

Env validation runs on every startup via `backend/src/config/env.js` (zod).
Missing or invalid values produce a clear error listing all issues.

## CI / GitHub Actions

The `.github/workflows/ci.yml` workflow runs on every PR and push to main:

| Job | What it checks |
|-----|----------------|
| `backend-check` | `npm ci` → `db:migrate` → `npm test` (with Postgres service) |
| `frontend-check` | `npm ci` → `typecheck` → `build` |
| `migration-sanity` | Runs `db:migrate` on blank Postgres, verifies core tables, smoke-tests `/health` |

The `migration-sanity` job is the most important — it catches broken
migrations before they reach staging/production.
