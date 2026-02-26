# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

AI CFO is a financial intelligence platform with two main services:
- **Backend** (`backend/`): Node.js 22 + Express + PostgreSQL (Sequelize ORM) on port 5000
- **Frontend** (`frontend/`): React 18 + Vite + TypeScript + Tailwind CSS on port 5173

### Prerequisites

- **Docker** is required for PostgreSQL (via `docker-compose.yml` in repo root)
- Node.js 22.x (pre-installed in the VM)

### Starting services

1. **PostgreSQL**: `sudo dockerd &>/tmp/dockerd.log &` then `sudo docker compose up -d postgres` from `/workspace`
2. **Backend**: `cd /workspace/backend && npm run dev` (port 5000). Requires `backend/.env` — copy from `backend/.env.example` and set `DATABASE_URL=postgresql://aicfo:aicfo123@127.0.0.1:5432/aicfo` and a valid `JWT_SECRET` (32+ chars).
3. **Frontend**: `cd /workspace/frontend && npx vite --host 0.0.0.0 --port 5173` (port 5173). Set `VITE_API_URL=http://localhost:5000/api` in `frontend/.env`.

### Database setup gotchas

- The database must be initialized in two steps: first `node migrations/run.js` (Sequelize sync to create base tables), then `npm run migrate` (SQL migrations on top). Running SQL migrations alone on an empty database will fail because they reference tables not yet created.
- After `run.js`, several tables need `gen_random_uuid()` defaults added before SQL migrations can INSERT rows. Run these ALTER commands against the database:
  ```sql
  ALTER TABLE cfo_questions ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE cfo_question_metrics ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE cfo_question_rules ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE source_mapping_rules ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE billing_plans ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE account_head_dictionary ALTER COLUMN id SET DEFAULT gen_random_uuid();
  ALTER TABLE account_head_dictionary ALTER COLUMN "createdAt" SET DEFAULT NOW();
  ALTER TABLE account_head_dictionary ALTER COLUMN "updatedAt" SET DEFAULT NOW();
  ALTER TABLE billing_plans ALTER COLUMN created_at SET DEFAULT NOW();
  ```
- Seed demo data with `node migrations/seed.js` (creates user `demo@aicfo.com` / `demo123456`)

### Lint / Test / Build

- **Frontend lint**: `npm run lint` (ESLint not configured; use `npm run typecheck` for TS validation)
- **Frontend typecheck**: `npm run typecheck` — 3 pre-existing TS6133 warnings (unused React imports)
- **Frontend build**: `npm run build`
- **Backend tests**: `npm test` (Node.js built-in test runner). 100/108 pass; 8 failures are pre-existing.

### Environment variables

- `QUEUE_RESILIENT_MODE=true` in `backend/.env` allows running without Redis
- `OPENAI_API_KEY` is optional; AI features degrade gracefully without it
- Docker-compose credentials: user=`aicfo`, password=`aicfo123`, db=`aicfo`
