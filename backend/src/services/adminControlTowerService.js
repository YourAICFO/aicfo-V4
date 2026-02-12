const fs = require('fs');
const path = require('path');
const IORedis = require('ioredis');
const { Sequelize } = require('sequelize');
const { sequelize } = require('../models');

const CACHE_TTL_MS = 60 * 1000;
const cacheStore = new Map();

const asNumber = (value, fallback = 0) => {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toPercent = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 10000) / 100;
};

const fetchRows = async (sql, replacements = {}) => {
  return sequelize.query(sql, {
    type: Sequelize.QueryTypes.SELECT,
    replacements
  });
};

const fetchOne = async (sql, replacements = {}) => {
  const rows = await fetchRows(sql, replacements);
  return rows[0] || {};
};

const withCache = async (cacheKey, fn) => {
  const now = Date.now();
  const cached = cacheStore.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }
  const value = await fn();
  cacheStore.set(cacheKey, { value, expiresAt: now + CACHE_TTL_MS });
  return value;
};

const getPendingMigrationCount = async () => {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const files = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  let applied = new Set();
  try {
    const rows = await fetchRows('SELECT filename FROM schema_migrations');
    applied = new Set(rows.map((row) => row.filename));
  } catch (_) {
    return files.length;
  }
  return files.filter((file) => !applied.has(file)).length;
};

const getRedisAndQueueHealth = async () => {
  if (!process.env.REDIS_URL) {
    return {
      redis_status: 'missing_config',
      worker_status: 'unknown',
      queue_depth: 0,
      failed_jobs_24h: 0
    };
  }

  try {
    const { queue } = require('../worker/queue');
    const redis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      connectTimeout: 10000,
      lazyConnect: true
    });

    try {
      await redis.connect();
      await Promise.race([
        redis.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('REDIS_PING_TIMEOUT')), 10000))
      ]);
    } finally {
      redis.disconnect();
    }

    const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    let workers = [];
    try {
      workers = await queue.getWorkers();
    } catch (_) {
      workers = [];
    }

    return {
      redis_status: 'up',
      worker_status: workers.length > 0 ? 'up' : 'degraded',
      queue_depth: asNumber(counts.waiting) + asNumber(counts.active) + asNumber(counts.delayed),
      failed_jobs_24h: asNumber(counts.failed)
    };
  } catch (_) {
    return {
      redis_status: 'down',
      worker_status: 'down',
      queue_depth: 0,
      failed_jobs_24h: 0
    };
  }
};

const getSystemMetrics = async () => {
  return withCache('admin:system', async () => {
    let dbStatus = 'up';
    try {
      await sequelize.authenticate();
    } catch (_) {
      dbStatus = 'down';
    }

    const logStats = await fetchOne(`
      SELECT
        SUM(CASE WHEN level = 'error' THEN 1 ELSE 0 END) AS error_logs_24h,
        SUM(CASE WHEN level = 'warn' THEN 1 ELSE 0 END) AS warn_logs_24h,
        SUM(CASE WHEN event = 'worker_job_failed' THEN 1 ELSE 0 END) AS failed_jobs_24h
      FROM app_logs
      WHERE time >= NOW() - INTERVAL '24 hours'
    `).catch(() => ({}));

    const queueHealth = await getRedisAndQueueHealth();
    const pendingMigrations = await getPendingMigrationCount();

    return {
      db_status: dbStatus,
      redis_status: queueHealth.redis_status,
      worker_status: queueHealth.worker_status,
      queue_depth: queueHealth.queue_depth,
      failed_jobs_24h: asNumber(logStats.failed_jobs_24h, queueHealth.failed_jobs_24h),
      error_logs_24h: asNumber(logStats.error_logs_24h),
      warn_logs_24h: asNumber(logStats.warn_logs_24h),
      pending_migrations: pendingMigrations
    };
  });
};

const getBusinessMetrics = async () => {
  return withCache('admin:business', async () => {
    const summary = await fetchOne(`
      SELECT
        COUNT(*) AS total_companies,
        SUM(CASE WHEN c.subscription_status = 'trial' THEN 1 ELSE 0 END) AS trial_companies,
        SUM(CASE WHEN c.subscription_status = 'active' THEN 1 ELSE 0 END) AS paying_companies
      FROM companies c
    `);

    const active = await fetchOne(`
      SELECT COUNT(DISTINCT company_id) AS active_companies
      FROM admin_usage_events
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
        AND company_id IS NOT NULL
    `);

    const perMonth = await fetchRows(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
        COUNT(*)::int AS count
      FROM companies
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY 1
      ORDER BY 1
    `);

    const trialCompanies = asNumber(summary.trial_companies);
    const payingCompanies = asNumber(summary.paying_companies);
    const conversionBase = trialCompanies + payingCompanies;

    return {
      total_companies: asNumber(summary.total_companies),
      active_companies: asNumber(active.active_companies),
      trial_companies: trialCompanies,
      paying_companies: payingCompanies,
      companies_created_per_month: perMonth,
      conversion_trial_to_paid: toPercent(payingCompanies, conversionBase)
    };
  });
};

const getUsageMetrics = async () => {
  return withCache('admin:usage', async () => {
    const users = await fetchOne(`
      SELECT
        COUNT(DISTINCT CASE WHEN "createdAt" >= NOW() - INTERVAL '1 day' THEN user_id END) AS dau,
        COUNT(DISTINCT CASE WHEN "createdAt" >= NOW() - INTERVAL '7 days' THEN user_id END) AS wau,
        COUNT(DISTINCT CASE WHEN "createdAt" >= NOW() - INTERVAL '30 days' THEN user_id END) AS mau
      FROM admin_usage_events
      WHERE user_id IS NOT NULL
    `);

    const qpu = await fetchOne(`
      SELECT
        COUNT(*)::float AS total_questions,
        COUNT(DISTINCT user_id)::float AS users
      FROM admin_ai_questions
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    `);

    const reports = await fetchOne(`
      SELECT COUNT(*) AS reports_generated
      FROM financial_reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `);

    const snapshots = await fetchOne(`
      SELECT COUNT(*) AS snapshot_runs
      FROM app_logs
      WHERE time >= NOW() - INTERVAL '30 days'
        AND event IN ('snapshot_recompute_success', 'snapshot_generated', 'monthly_snapshot_generated')
    `).catch(() => ({ snapshot_runs: 0 }));

    const totalQuestions = asNumber(qpu.total_questions);
    const totalUsers = asNumber(qpu.users);

    return {
      DAU: asNumber(users.dau),
      WAU: asNumber(users.wau),
      MAU: asNumber(users.mau),
      questions_per_user: totalUsers > 0 ? Math.round((totalQuestions / totalUsers) * 100) / 100 : 0,
      reports_generated: asNumber(reports.reports_generated),
      snapshot_runs: asNumber(snapshots.snapshot_runs)
    };
  });
};

const getAIMetrics = async () => {
  return withCache('admin:ai', async () => {
    const totals = await fetchOne(`
      SELECT
        COUNT(*) AS ai_questions_total,
        SUM(CASE WHEN success = false THEN 1 ELSE 0 END) AS unanswered_questions,
        SUM(CASE WHEN detected_question_key IS NOT NULL THEN 1 ELSE 0 END) AS deterministic_hits
      FROM admin_ai_questions
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    `);

    const fallbacks = await fetchOne(`
      SELECT COUNT(*) AS llm_fallback
      FROM admin_usage_events
      WHERE event_type = 'ai_chat'
        AND "createdAt" >= NOW() - INTERVAL '30 days'
        AND COALESCE((metadata->>'usedRewrite')::boolean, false) = true
    `);

    const answerTime = await fetchOne(`
      SELECT AVG((metadata->>'answerMs')::numeric) AS avg_answer_time
      FROM admin_usage_events
      WHERE event_type = 'ai_chat'
        AND "createdAt" >= NOW() - INTERVAL '30 days'
        AND metadata ? 'answerMs'
    `);

    const topUnanswered = await fetchRows(`
      SELECT question, COUNT(*)::int AS count
      FROM admin_ai_questions
      WHERE success = false
        AND "createdAt" >= NOW() - INTERVAL '30 days'
      GROUP BY question
      ORDER BY count DESC
      LIMIT 10
    `);

    const totalQuestions = asNumber(totals.ai_questions_total);
    const deterministicHits = asNumber(totals.deterministic_hits);
    const fallbackCount = asNumber(fallbacks.llm_fallback);

    return {
      ai_questions_total: totalQuestions,
      unanswered_questions: asNumber(totals.unanswered_questions),
      deterministic_hit_rate: toPercent(deterministicHits, totalQuestions),
      llm_fallback_rate: toPercent(fallbackCount, totalQuestions),
      avg_answer_time: Math.round(asNumber(answerTime.avg_answer_time)),
      top_unanswered_questions: topUnanswered
    };
  });
};

const getAccountingMetrics = async () => {
  return withCache('admin:accounting', async () => {
    const totals = await fetchOne(`
      SELECT
        (SELECT COUNT(*) FROM source_ledgers) AS ledgers_total,
        (SELECT COUNT(DISTINCT source_term) FROM accounting_term_mapping) AS ledgers_mapped,
        (SELECT COUNT(DISTINCT month) FROM accounting_months) AS months_ingested,
        (SELECT COUNT(DISTINCT month) FROM monthly_trial_balance_summary) AS months_snapshotted,
        (SELECT COUNT(*) FROM monthly_trial_balance_summary) AS snapshot_row_counts
    `);

    const lastSyncPerCompany = await fetchRows(`
      SELECT
        i.company_id AS "companyId",
        c.name AS "companyName",
        MAX(i.last_synced_at) AS "lastSyncedAt"
      FROM integrations i
      JOIN companies c ON c.id = i.company_id
      GROUP BY i.company_id, c.name
      ORDER BY "lastSyncedAt" DESC NULLS LAST
      LIMIT 200
    `);

    const ledgersTotal = asNumber(totals.ledgers_total);
    const ledgersMapped = asNumber(totals.ledgers_mapped);

    return {
      ledgers_total: ledgersTotal,
      ledgers_mapped: ledgersMapped,
      mapping_coverage_percent: toPercent(ledgersMapped, ledgersTotal),
      months_ingested: asNumber(totals.months_ingested),
      months_snapshotted: asNumber(totals.months_snapshotted),
      last_sync_per_company: lastSyncPerCompany,
      snapshot_row_counts: asNumber(totals.snapshot_row_counts)
    };
  });
};

const getRiskMetrics = async () => {
  return withCache('admin:risk', async () => {
    const rows = await fetchOne(`
      WITH companies_base AS (
        SELECT id FROM companies
      ),
      mapped_companies AS (
        SELECT DISTINCT sl.company_id
        FROM source_ledgers sl
        JOIN accounting_term_mapping atm
          ON LOWER(atm.source_term) = LOWER(sl.source_ledger_name)
      ),
      snapshotted_companies AS (
        SELECT DISTINCT company_id FROM monthly_trial_balance_summary
      ),
      stale_sync AS (
        SELECT DISTINCT c.id
        FROM companies c
        LEFT JOIN integrations i ON i.company_id = c.id
        GROUP BY c.id
        HAVING COALESCE(MAX(i.last_synced_at), TIMESTAMPTZ 'epoch') < NOW() - INTERVAL '7 days'
      ),
      anomaly AS (
        SELECT DISTINCT company_id
        FROM cfo_alerts
        WHERE severity IN ('high', 'critical')
          AND generated_at >= NOW() - INTERVAL '30 days'
      )
      SELECT
        (SELECT COUNT(*) FROM companies_base cb WHERE cb.id NOT IN (SELECT company_id FROM mapped_companies)) AS companies_no_mapping,
        (SELECT COUNT(*) FROM companies_base cb WHERE cb.id NOT IN (SELECT company_id FROM snapshotted_companies)) AS companies_no_snapshots,
        (SELECT COUNT(*) FROM stale_sync) AS stale_sync_companies,
        (SELECT COUNT(*) FROM anomaly) AS anomaly_companies
    `);

    return {
      companies_no_mapping: asNumber(rows.companies_no_mapping),
      companies_no_snapshots: asNumber(rows.companies_no_snapshots),
      stale_sync_companies: asNumber(rows.stale_sync_companies),
      anomaly_companies: asNumber(rows.anomaly_companies)
    };
  });
};

module.exports = {
  getSystemMetrics,
  getBusinessMetrics,
  getUsageMetrics,
  getAIMetrics,
  getAccountingMetrics,
  getRiskMetrics
};
