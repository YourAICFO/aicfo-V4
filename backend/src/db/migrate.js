#!/usr/bin/env node
'use strict';

/**
 * Deterministic migration runner.
 *
 * 1. Ensures pgcrypto extension is available (for gen_random_uuid).
 * 2. On a completely blank database, bootstraps the schema from Sequelize
 *    models (equivalent of the old run.js) so that SQL migrations can layer
 *    on top.
 * 3. Applies SQL migration files from backend/migrations/ in lexical order,
 *    tracking them in a `schema_migrations` table.
 *
 * Usage:
 *   node src/db/migrate.js              # apply pending migrations
 *   node src/db/migrate.js --status     # show applied / pending
 *   node src/db/migrate.js --verify     # exit 0 if core tables exist, 1 otherwise
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required');
  process.exit(1);
}

const isSSL =
  process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: isSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

const MIGRATION_DIR = path.resolve(__dirname, '../../migrations');

const ensureExtensions = async () => {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
};

const ensureSchemaMigrations = async () => {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

const getAppliedMigrations = async () => {
  const rows = await sequelize.query(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC',
    { type: QueryTypes.SELECT }
  );
  return new Set(rows.map((r) => r.filename));
};

const getSqlFiles = () =>
  fs
    .readdirSync(MIGRATION_DIR)
    .filter((name) => name.endsWith('.sql') && name !== 'seed.sql')
    .sort((a, b) => a.localeCompare(b));

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = :tableName
     ) AS "exists"`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return Boolean(rows[0]?.exists);
};

const CORE_TABLES = ['users', 'companies', 'subscriptions', 'financial_transactions'];

const isBlankDatabase = async () => {
  for (const t of CORE_TABLES) {
    if (await tableExists(t)) return false;
  }
  return true;
};

const addUuidDefaults = async () => {
  const tables = [
    'cfo_questions',
    'cfo_question_metrics',
    'cfo_question_rules',
    'source_mapping_rules',
    'billing_plans',
    'account_head_dictionary',
  ];
  for (const t of tables) {
    if (await tableExists(t)) {
      try {
        await sequelize.query(
          `ALTER TABLE "${t}" ALTER COLUMN id SET DEFAULT gen_random_uuid()`
        );
      } catch (_) {
        // column may not be uuid type — ignore
      }
    }
  }
  if (await tableExists('account_head_dictionary')) {
    await sequelize.query(
      `ALTER TABLE account_head_dictionary ALTER COLUMN "createdAt" SET DEFAULT NOW()`
    ).catch(() => {});
    await sequelize.query(
      `ALTER TABLE account_head_dictionary ALTER COLUMN "updatedAt" SET DEFAULT NOW()`
    ).catch(() => {});
  }
  if (await tableExists('billing_plans')) {
    await sequelize.query(
      `ALTER TABLE billing_plans ALTER COLUMN created_at SET DEFAULT NOW()`
    ).catch(() => {});
  }
};

const canMarkApplied = async (filename) => {
  if (filename === '2026-02-11-system-logs-audit.sql') {
    return (await tableExists('app_logs')) && (await tableExists('audit_log'));
  }
  return false;
};

const bootstrapFromModels = async () => {
  console.log('BOOTSTRAP: blank database detected — syncing Sequelize models…');
  // Requiring models triggers all associations.
  const { sequelize: sq } = require('../models');
  await sq.sync({ force: false });
  console.log('BOOTSTRAP: Sequelize model sync complete.');
  await addUuidDefaults();
  console.log('BOOTSTRAP: UUID defaults patched.');
};

async function runMigrations() {
  let applied = 0;
  let skipped = 0;
  let markedApplied = 0;

  await sequelize.authenticate();
  await ensureExtensions();
  await ensureSchemaMigrations();

  if (await isBlankDatabase()) {
    await bootstrapFromModels();
  }

  await addUuidDefaults();

  const alreadyApplied = await getAppliedMigrations();
  const files = getSqlFiles();

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      skipped += 1;
      continue;
    }

    if (await canMarkApplied(file)) {
      await sequelize.query(
        'INSERT INTO schema_migrations(filename) VALUES (:filename) ON CONFLICT (filename) DO NOTHING',
        { replacements: { filename: file }, type: QueryTypes.INSERT }
      );
      markedApplied += 1;
      console.log(`MARKED_APPLIED  ${file}`);
      continue;
    }

    const sql = fs.readFileSync(path.join(MIGRATION_DIR, file), 'utf8');
    await sequelize.transaction(async (transaction) => {
      await sequelize.query(sql, { transaction });
      await sequelize.query(
        'INSERT INTO schema_migrations(filename) VALUES (:filename)',
        { replacements: { filename: file }, transaction }
      );
    });

    applied += 1;
    console.log(`APPLIED         ${file}`);
  }

  console.log(
    `Migrations complete: applied=${applied} marked=${markedApplied} skipped=${skipped}`
  );
}

async function printStatus() {
  await sequelize.authenticate();
  await ensureSchemaMigrations();

  const alreadyApplied = await getAppliedMigrations();
  const files = getSqlFiles();
  let pending = 0;

  for (const file of files) {
    const status = alreadyApplied.has(file) ? 'applied' : 'PENDING';
    if (status === 'PENDING') pending++;
    console.log(`  [${status}]  ${file}`);
  }
  console.log(`\nTotal: ${files.length}  Applied: ${alreadyApplied.size}  Pending: ${pending}`);
}

async function verify() {
  await sequelize.authenticate();
  for (const t of CORE_TABLES) {
    if (!(await tableExists(t))) {
      console.error(`VERIFY FAILED: table "${t}" does not exist`);
      process.exit(1);
    }
  }
  console.log('VERIFY OK — core tables exist');
}

async function main() {
  const arg = process.argv[2];
  try {
    if (arg === '--status') {
      await printStatus();
    } else if (arg === '--verify') {
      await verify();
    } else {
      await runMigrations();
    }
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Migration runner failed:', err.message);
    if (process.env.DEBUG_MIGRATIONS) console.error(err);
    try { await sequelize.close(); } catch (_) {}
    process.exit(1);
  }
}

main();
