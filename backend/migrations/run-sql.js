require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Sequelize, QueryTypes } = require('sequelize');

if (!process.env.DATABASE_URL) {
  console.error('Migration runner failed: DATABASE_URL is required');
  process.exit(1);
}

console.log('MIGRATE_MODE=db-only');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions:
    process.env.NODE_ENV === 'production'
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        }
      : {}
});

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

const tableExists = async (tableName) => {
  const rows = await sequelize.query(
    `SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = :tableName
    ) AS exists`,
    { replacements: { tableName }, type: QueryTypes.SELECT }
  );
  return Boolean(rows[0]?.exists);
};

const canMarkApplied = async (filename) => {
  if (filename === '2026-02-11-system-logs-audit.sql') {
    const [hasAppLogs, hasAuditLog] = await Promise.all([
      tableExists('app_logs'),
      tableExists('audit_log')
    ]);
    return hasAppLogs && hasAuditLog;
  }
  return false;
};

const run = async () => {
  let appliedCount = 0;
  let skippedCount = 0;
  let markedAppliedCount = 0;

  try {
    await sequelize.authenticate();
    await ensureSchemaMigrations();

    const migrationDir = path.join(__dirname);
    const files = fs
      .readdirSync(migrationDir)
      .filter((name) => name.endsWith('.sql') && name !== 'seed.sql')
      .sort((a, b) => a.localeCompare(b));

    const applied = await getAppliedMigrations();

    for (const file of files) {
      if (applied.has(file)) {
        skippedCount += 1;
        console.log(`SKIPPED ${file}`);
        continue;
      }

      if (await canMarkApplied(file)) {
        await sequelize.query(
          'INSERT INTO schema_migrations(filename) VALUES (:filename) ON CONFLICT (filename) DO NOTHING',
          { replacements: { filename: file }, type: QueryTypes.INSERT }
        );
        markedAppliedCount += 1;
        console.log(`MARKED_APPLIED (tables already exist): ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await sequelize.transaction(async (transaction) => {
        await sequelize.query(sql, { transaction });
        await sequelize.query(
          'INSERT INTO schema_migrations(filename) VALUES (:filename)',
          { replacements: { filename: file }, transaction }
        );
      });

      appliedCount += 1;
      console.log(`APPLIED ${file}`);
    }

    console.log(`Migrations complete. applied=${appliedCount} marked_applied=${markedAppliedCount} skipped=${skippedCount}`);
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration runner failed:', error.message);
    try {
      await sequelize.close();
    } catch (_) {
      // ignore close errors
    }
    process.exit(1);
  }
};

run();
