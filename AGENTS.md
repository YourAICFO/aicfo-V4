# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

AI CFO is a financial intelligence platform with two main services:
- **Backend** (`backend/`): Node.js 22 + Express + PostgreSQL (Sequelize ORM) on port 5000
- **Frontend** (`frontend/`): React 18 + Vite + TypeScript + Tailwind CSS on port 5173

Full infrastructure docs: `docs/INFRA_SETUP.md`

### Starting services

1. **Docker daemon** (Cloud VM only): `sudo dockerd &>/tmp/dockerd.log &`
2. **Databases**: `npm run db:up` (or `sudo docker compose up -d postgres redis`)
3. **Migrations**: `npm run db:migrate` — fully automated, handles blank DB bootstrap + SQL migrations + UUID default patching
4. **Backend**: `npm run dev:backend` (port 5000). Requires `backend/.env` — copy from `backend/.env.example` and set `DATABASE_URL=postgresql://aicfo:aicfo123@127.0.0.1:5432/aicfo` and a valid `JWT_SECRET` (32+ chars).
5. **Frontend**: `npm run dev:frontend` (port 5173). Set `VITE_API_URL=http://localhost:5000/api` in `frontend/.env`.

Or all at once: `npm run dev` (starts DB containers + both servers).

### Database

- `npm run db:migrate` handles everything: blank-DB bootstrap from Sequelize models, UUID default patching, and SQL migration application. No manual ALTER TABLE steps needed.
- Seed demo data: `npm run db:seed` (creates user `demo@aicfo.com` / `demo123456`)
- `sequelize.sync()` is gated behind `ALLOW_SEQUELIZE_SYNC=true` and only runs in `NODE_ENV=development`

### Lint / Test / Build

- **Frontend typecheck**: `npm run typecheck` — 3 pre-existing TS6133 warnings (unused React imports)
- **Frontend build**: `npm run build`
- **Backend tests**: `npm test` (Node.js built-in test runner). Requires PostgreSQL running. ~100/108 pass; 8 failures are pre-existing.

### Environment variables

- Env validation runs on startup via `backend/src/config/env.js` (zod). Missing vars produce a clear error.
- `JWT_SECRET` is required in ALL environments (min 32 chars). No fallback secrets exist anywhere in the codebase.
- `ALLOWED_ORIGINS` is required in production/staging (comma-separated CORS origins).
- `ENABLE_CONNECTOR_DEV_ROUTES=true` must be set alongside `NODE_ENV=development` to enable connector dev routes. These also require admin auth.
- `QUEUE_RESILIENT_MODE=true` in `backend/.env` allows running without Redis.
- `OPENAI_API_KEY` is optional; AI features degrade gracefully without it.
- Docker-compose credentials: user=`aicfo`, password=`aicfo123`, db=`aicfo`.
