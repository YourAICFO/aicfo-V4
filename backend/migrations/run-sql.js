require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');

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
    { type: sequelize.QueryTypes.SELECT }
  );
  return new Set(rows.map((r) => r.filename));
};

const run = async () => {
  let appliedCount = 0;
  let skippedCount = 0;

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

    console.log(`Migrations complete. applied=${appliedCount} skipped=${skippedCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Migration runner failed:', error.message);
    process.exit(1);
  }
};

run();
