# Database Bootstrap

## One-command setup

```bash
# From repo root — starts Postgres + runs all migrations
npm run db:up           # docker compose up -d postgres redis
npm run db:migrate      # bootstrap + apply SQL migrations
npm run db:seed         # (optional) create demo user
```

Or from `backend/`:
```bash
npm run db:bootstrap    # same as db:migrate — creates from scratch
```

## What happens on a blank database

1. `CREATE EXTENSION IF NOT EXISTS pgcrypto` (for gen_random_uuid)
2. Detect blank DB (no core tables) → Sequelize model sync (creates all tables)
3. Patch UUID defaults on tables that SQL migrations INSERT into
4. Apply all `backend/migrations/*.sql` in lexical order
5. Track applied migrations in `schema_migrations` table

## Available scripts

| Script (from `backend/`) | Description |
|--------------------------|-------------|
| `npm run db:bootstrap` | Create DB from scratch (idempotent) |
| `npm run db:migrate` | Apply pending SQL migrations |
| `npm run db:migrate:status` | Show applied/pending migrations |
| `npm run db:migrate:verify` | Exit 0 if core tables exist |
| `npm run db:check` | Verify 14 critical table.column pairs |

## Railway

- `prestart` hook runs `db:migrate` automatically on every deploy.
- For first deploy, the blank-DB bootstrap handles everything.
- To re-run manually: Railway console → `npm run db:bootstrap`.

## Troubleshooting

- **"relation X does not exist"**: Run `npm run db:bootstrap` (full bootstrap).
- **"UUID default missing"**: The migration runner patches these automatically.
- **Check schema**: `npm run db:check` verifies critical columns exist.
