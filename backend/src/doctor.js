require('dotenv').config();
const fs = require('fs');
const path = require('path');
const IORedis = require('ioredis');
const { Sequelize } = require('sequelize');
const { sequelize } = require('./models');

const report = [];
let criticalFail = false;

const line = (text = '') => report.push(text);
const section = (title) => {
  line('');
  line(title);
};

const safeHostFromDbUrl = () => {
  try {
    const url = new URL(process.env.DATABASE_URL);
    return `${url.protocol}//${url.hostname}:${url.port || ''}${url.pathname}`;
  } catch (_) {
    return 'unavailable';
  }
};

const run = async () => {
  const now = new Date().toISOString();
  const gitSha = process.env.GIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown';

  section('[A] System');
  line(`timestamp: ${now}`);
  line(`node: ${process.version}`);
  line(`env: ${process.env.NODE_ENV || 'development'}`);
  line(`git_sha: ${gitSha}`);

  section('[B] DB Connectivity');
  let allTables = [];
  try {
    await sequelize.authenticate();
    line('db_connect: OK');
    line(`db_dialect: ${sequelize.getDialect()}`);
    line(`db_host: ${safeHostFromDbUrl()}`);
    allTables = await sequelize.getQueryInterface().showAllTables();
    const normalized = allTables.map((t) => (typeof t === 'string' ? t : t.tableName || String(t))).map((t) => t.toLowerCase());
    line(`table_count: ${normalized.length}`);
    const mustHave = ['companies', 'users', 'accounting_months', 'monthly_trial_balance_summary', 'app_logs', 'audit_log'];
    for (const key of mustHave) {
      line(`${key}: ${normalized.some((t) => t.includes(key)) ? 'OK' : 'MISSING'}`);
    }
    if (!normalized.some((t) => t.includes('app_logs'))) {
      criticalFail = true;
    }
  } catch (error) {
    criticalFail = true;
    line(`db_connect: FAIL (${error.message})`);
  }

  section('[C] Migration Status');
  try {
    const applied = await sequelize.query(
      'SELECT filename, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10',
      { type: Sequelize.QueryTypes.SELECT }
    );
    line(`applied_recent_count: ${applied.length}`);
    for (const row of applied) {
      line(`applied: ${row.filename} @ ${row.applied_at}`);
    }

    const migrationDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationDir).filter((f) => f.endsWith('.sql') && f !== 'seed.sql').sort();
    const appliedSet = new Set((await sequelize.query('SELECT filename FROM schema_migrations', { type: Sequelize.QueryTypes.SELECT })).map((r) => r.filename));
    const pending = files.filter((f) => !appliedSet.has(f));
    line(`pending_count: ${pending.length}`);
    pending.slice(0, 20).forEach((p) => line(`pending: ${p}`));

    if ((process.env.NODE_ENV || '').toLowerCase() === 'production' && pending.length > 0) {
      criticalFail = true;
    }
  } catch (error) {
    line(`migration_status: SKIPPED (${error.message})`);
  }

  section('[D] Worker / Queue Health');
  const { REDIS_URL, connection: redisConnection, isQueueResilientMode } = require('./config/redis');
  if (isQueueResilientMode()) {
    line('redis_ping: SKIPPED (QUEUE_RESILIENT_MODE=true)');
  } else {
    const redis = new IORedis(REDIS_URL, { ...redisConnection, lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      const pong = await redis.ping();
      line(`redis_ping: ${pong}`);
    } catch (error) {
      line(`redis_ping: FAIL (${error.message})`);
    } finally {
      redis.disconnect();
    }
  }

  section('[E] Latest Errors Summary');
  try {
    const errors = await sequelize.query(
      `SELECT message, run_id, error_stack
       FROM app_logs
       WHERE level = 'error' AND time >= NOW() - INTERVAL '24 hours'
       ORDER BY time DESC
       LIMIT 50`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    const grouped = new Map();
    for (const row of errors) {
      const firstStack = (row.error_stack || '').split('\n')[0] || '';
      const key = `${row.message} | ${firstStack}`;
      const current = grouped.get(key) || { count: 0, run_id: row.run_id || null };
      current.count += 1;
      grouped.set(key, current);
    }

    const top = [...grouped.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    line(`error_groups: ${top.length}`);
    top.forEach(([key, value]) => line(`error_group: count=${value.count} run_id=${value.run_id || '-'} key=${key}`));

    const warns = await sequelize.query(
      `SELECT message, run_id
       FROM app_logs
       WHERE level = 'warn' AND time >= NOW() - INTERVAL '24 hours'
       ORDER BY time DESC
       LIMIT 10`,
      { type: Sequelize.QueryTypes.SELECT }
    );
    line(`warn_last_10: ${warns.length}`);
    warns.forEach((w) => line(`warn: run_id=${w.run_id || '-'} msg=${w.message}`));
  } catch (error) {
    line(`errors_summary: SKIPPED (${error.message})`);
  }

  section('[F] Finance Invariants Quick Checks');
  try {
    const closedMonths = await sequelize.query(
      `SELECT month
       FROM accounting_months
       WHERE is_closed = true
       ORDER BY month DESC
       LIMIT 3`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    if (closedMonths.length === 0) {
      line('closed_months: SKIPPED (none found)');
    } else {
      for (const row of closedMonths) {
        const cnt = await sequelize.query(
          `SELECT COUNT(*)::int AS count FROM monthly_trial_balance_summary WHERE month = :month`,
          { replacements: { month: row.month }, type: Sequelize.QueryTypes.SELECT }
        );
        line(`monthly_summary_exists[${row.month}]: ${Number(cnt[0]?.count || 0) > 0 ? 'OK' : 'MISSING'}`);
      }
    }

    const companyRows = await sequelize.query('SELECT id FROM companies LIMIT 50', { type: Sequelize.QueryTypes.SELECT });
    for (const c of companyRows) {
      const cash = await sequelize.query('SELECT COUNT(*)::int AS count FROM current_cash_balances WHERE company_id=:id', { replacements: { id: c.id }, type: Sequelize.QueryTypes.SELECT });
      const debtors = await sequelize.query('SELECT COUNT(*)::int AS count FROM current_debtors WHERE company_id=:id', { replacements: { id: c.id }, type: Sequelize.QueryTypes.SELECT });
      const creditors = await sequelize.query('SELECT COUNT(*)::int AS count FROM current_creditors WHERE company_id=:id', { replacements: { id: c.id }, type: Sequelize.QueryTypes.SELECT });
      line(`company ${c.id}: cash=${cash[0].count} debtors=${debtors[0].count} creditors=${creditors[0].count}`);
    }
  } catch (error) {
    line(`finance_checks: SKIPPED (${error.message})`);
  }

  const output = report.join('\n');
  console.log(output);

  const candidates = ['/tmp/doctor_report.txt', path.join(__dirname, '..', 'doctor_report.txt')];
  let writtenPath = null;
  for (const candidate of candidates) {
    try {
      fs.writeFileSync(candidate, output, 'utf8');
      writtenPath = candidate;
      break;
    } catch (_) {
      // try next
    }
  }
  line('');
  line(`report_file: ${writtenPath || 'not_written'}`);

  if (writtenPath) {
    fs.writeFileSync(writtenPath, report.join('\n'), 'utf8');
  }

  process.exit(criticalFail ? 2 : 0);
};

run();
