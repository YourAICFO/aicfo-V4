const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  sequelize
} = require('../models');
const { getLatestClosedMonthKey } = require('./monthlySnapshotService');
const { logUsageEvent } = require('./adminUsageService');

const VALIDATION_VERSION = 1;

const buildIssue = (code, severity, message, details = null) => ({
  code,
  severity,
  message,
  details
});

const upsertValidation = async (companyId, snapshotMonth, status, issues, transaction) => {
  const issuesJson = JSON.stringify(issues || []);
  await sequelize.query(
    `INSERT INTO snapshot_validations
      (company_id, snapshot_month, validation_version, status, issues_json, "createdAt", "updatedAt")
     VALUES (:companyId, :snapshotMonth, :version, :status, :issuesJson, NOW(), NOW())
     ON CONFLICT (company_id, snapshot_month, validation_version)
     DO UPDATE SET status = EXCLUDED.status, issues_json = EXCLUDED.issues_json, "updatedAt" = NOW()`,
    {
      replacements: {
        companyId,
        snapshotMonth,
        version: VALIDATION_VERSION,
        status,
        issuesJson
      },
      transaction
    }
  );
};

const updateSyncStatus = async (companyId, payload) => {
  const {
    status,
    lastSnapshotMonth,
    lastBalanceAsOfDate,
    errorMessage,
    lastSyncStartedAt,
    lastSyncCompletedAt
  } = payload;

  await sequelize.query(
    `INSERT INTO data_sync_status
      (company_id, status, last_snapshot_month, last_balance_asof_date, error_message, last_sync_started_at, last_sync_completed_at, "createdAt", "updatedAt")
     VALUES (:companyId, :status, :lastSnapshotMonth, :lastBalanceAsOfDate, :errorMessage, :lastSyncStartedAt, :lastSyncCompletedAt, NOW(), NOW())
     ON CONFLICT (company_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       last_snapshot_month = EXCLUDED.last_snapshot_month,
       last_balance_asof_date = EXCLUDED.last_balance_asof_date,
       error_message = EXCLUDED.error_message,
       last_sync_started_at = COALESCE(EXCLUDED.last_sync_started_at, data_sync_status.last_sync_started_at),
       last_sync_completed_at = COALESCE(EXCLUDED.last_sync_completed_at, data_sync_status.last_sync_completed_at),
       "updatedAt" = NOW(),
       updated_at = NOW()`,
    {
      replacements: {
        companyId,
        status,
        lastSnapshotMonth: lastSnapshotMonth || null,
        lastBalanceAsOfDate: lastBalanceAsOfDate || null,
        errorMessage: errorMessage || null,
        lastSyncStartedAt: lastSyncStartedAt || null,
        lastSyncCompletedAt: lastSyncCompletedAt || null
      }
    }
  );
};

const getLatestBalanceAsOfDate = async (companyId) => {
  const rows = await sequelize.query(
    `SELECT MAX("updatedAt") AS updated_at
     FROM current_cash_balances
     WHERE company_id = :companyId`,
    {
      replacements: { companyId },
      type: Sequelize.QueryTypes.SELECT
    }
  );
  const timestamp = rows?.[0]?.updated_at;
  if (!timestamp) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
};

const computeUnknownShare = async (Model, companyId, month, transaction) => {
  const totals = await Model.findAll({
    where: { companyId, month },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true,
    transaction
  });
  const total = Number(totals?.[0]?.total || 0);
  if (total <= 0) return 0;

  const unknown = await Model.findAll({
    where: {
      companyId,
      month,
      [Sequelize.Op.or]: [
        { canonicalType: null },
        { canonicalType: '' },
        { canonicalType: 'unknown' }
      ]
    },
    attributes: [[Sequelize.fn('SUM', Sequelize.col('amount')), 'total']],
    raw: true,
    transaction
  });
  const unknownTotal = Number(unknown?.[0]?.total || 0);
  return unknownTotal / total;
};

const validateCompanySnapshot = async (companyId, snapshotMonth, transaction = null) => {
  const issues = [];
  const latestClosedKey = getLatestClosedMonthKey();
  const isClosedMonth = snapshotMonth && latestClosedKey && snapshotMonth <= latestClosedKey;

  if (isClosedMonth) {
    const summary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId, month: snapshotMonth },
      raw: true,
      transaction
    });

    if (!summary) {
      issues.push(buildIssue('MISSING_SNAPSHOT', 'invalid', `Missing snapshot for ${snapshotMonth}`));
    } else {
      const revenue = Number(summary.total_revenue ?? summary.totalRevenue ?? 0);
      const expenses = Number(summary.total_expenses ?? summary.totalExpenses ?? 0);

      if (!Number.isFinite(revenue)) {
        issues.push(buildIssue('MISSING_REVENUE', 'invalid', `Revenue missing for ${snapshotMonth}`));
      }
      if (!Number.isFinite(expenses)) {
        issues.push(buildIssue('MISSING_EXPENSES', 'invalid', `Expenses missing for ${snapshotMonth}`));
      }
      if (revenue < 0) {
        issues.push(buildIssue('REVENUE_NEGATIVE', 'warning', `Revenue is negative for ${snapshotMonth}`));
      }
      if (expenses < 0) {
        issues.push(buildIssue('EXPENSES_NEGATIVE', 'warning', `Expenses are negative for ${snapshotMonth}`));
      }

      const revenueUnknownShare = await computeUnknownShare(MonthlyRevenueBreakdown, companyId, snapshotMonth, transaction);
      if (revenueUnknownShare > 0.05) {
        issues.push(buildIssue('UNMAPPED_REVENUE_HEADS', 'warning', `Unmapped revenue heads exceed 5% for ${snapshotMonth}`, { share: revenueUnknownShare }));
      }

      const expenseUnknownShare = await computeUnknownShare(MonthlyExpenseBreakdown, companyId, snapshotMonth, transaction);
      if (expenseUnknownShare > 0.05) {
        issues.push(buildIssue('UNMAPPED_EXPENSE_HEADS', 'warning', `Unmapped expense heads exceed 5% for ${snapshotMonth}`, { share: expenseUnknownShare }));
      }
    }
  }

  if (!snapshotMonth || (latestClosedKey && snapshotMonth > latestClosedKey)) {
    issues.push(buildIssue('PENDING_CLOSE', 'warning', `Snapshot month ${snapshotMonth} is not closed yet`));
  }

  const cashRows = await CurrentCashBalance.findAll({ where: { companyId }, raw: true, transaction });
  if (!cashRows || cashRows.length === 0) {
    issues.push(buildIssue('MISSING_CASH', 'warning', 'Cash/bank balances missing'));
  }

  const debtorsRows = await CurrentDebtor.findAll({ where: { companyId }, raw: true, transaction });
  if (!debtorsRows || debtorsRows.length === 0) {
    issues.push(buildIssue('MISSING_DEBTORS', 'warning', 'Debtors balances missing'));
  }

  const creditorsRows = await CurrentCreditor.findAll({ where: { companyId }, raw: true, transaction });
  if (!creditorsRows || creditorsRows.length === 0) {
    issues.push(buildIssue('MISSING_CREDITORS', 'warning', 'Creditors balances missing'));
  }

  const hasInvalid = issues.some((issue) => issue.severity === 'invalid');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const status = hasInvalid ? 'invalid' : hasWarning ? 'warning' : 'valid';

  await upsertValidation(companyId, snapshotMonth, status, issues, transaction);

  if (status === 'invalid') {
    logUsageEvent({
      companyId,
      userId: null,
      eventType: 'snapshot_invalid',
      eventName: 'snapshot_validation',
      metadata: { snapshotMonth, issues }
    });
  } else if (status === 'warning') {
    logUsageEvent({
      companyId,
      userId: null,
      eventType: 'snapshot_warning',
      eventName: 'snapshot_validation',
      metadata: { snapshotMonth, issues }
    });
  }

  return { status, issues };
};

const getSyncStatus = async (companyId) => {
  const rows = await sequelize.query(
    `SELECT status, last_sync_completed_at, last_snapshot_month, last_balance_asof_date, error_message
     FROM data_sync_status
     WHERE company_id = :companyId`,
    {
      replacements: { companyId },
      type: Sequelize.QueryTypes.SELECT
    }
  );
  return rows?.[0] || null;
};

const getValidationForMonth = async (companyId, snapshotMonth) => {
  const rows = await sequelize.query(
    `SELECT status, issues_json, snapshot_month, validation_version, "updatedAt"
     FROM snapshot_validations
     WHERE company_id = :companyId AND snapshot_month = :snapshotMonth
     ORDER BY validation_version DESC
     LIMIT 1`,
    {
      replacements: { companyId, snapshotMonth },
      type: Sequelize.QueryTypes.SELECT
    }
  );
  return rows?.[0] || null;
};

module.exports = {
  validateCompanySnapshot,
  updateSyncStatus,
  getSyncStatus,
  getValidationForMonth,
  getLatestBalanceAsOfDate
};
