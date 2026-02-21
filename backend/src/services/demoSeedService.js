/**
 * Demo company seed: creates a company with is_demo=true and seeds normalized tables
 * for 6-12 closed months so Layer 1 can be tested without a connector.
 */
const { sequelize } = require('../config/database');
const {
  Company,
  MonthlyTrialBalanceSummary,
  MonthlyRevenueBreakdown,
  MonthlyExpenseBreakdown,
  LedgerMonthlyBalance,
  CFOLedgerClassification,
  CFOMetric,
  AccountingMonth
} = require('../models');
const { createTrialSubscription } = require('./subscriptionService');
const { normalizeMonth, listMonthKeysBetween, getMonthKeyOffset } = require('../utils/monthKeyUtils');

const DEMO_COMPANY_NAME = 'Demo Company';

function getLatestClosedMonthKey(now = new Date()) {
  const latestClosedStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return normalizeMonth(latestClosedStart);
}

/**
 * Create a demo company and seed realistic data for last 12 closed months.
 * @param {string} userId - owner user id
 * @returns {Promise<{ company: object }>}
 */
async function createDemoCompany(userId) {
  const t = await sequelize.transaction();
  try {
    const company = await Company.create(
      {
        name: DEMO_COMPANY_NAME,
        ownerId: userId,
        currency: 'INR',
        isDemo: true
      },
      { transaction: t }
    );
    const companyId = company.id;

    await createTrialSubscription(companyId);

    const latestClosedKey = getLatestClosedMonthKey();
    const startKey = getMonthKeyOffset(latestClosedKey, -11) || latestClosedKey;
    const monthKeys = listMonthKeysBetween(startKey, latestClosedKey);
    if (monthKeys.length === 0) {
      await t.commit();
      return { company };
    }

    const now = new Date();
    for (const month of monthKeys) {
      await AccountingMonth.findOrCreate({
        where: { companyId, month },
        defaults: { companyId, month, isClosed: true, sourceLastSyncedAt: now },
        transaction: t
      });
    }

    const revenueCategories = ['Sales', 'Service Income', 'Other Income', 'Interest', 'Rental'];
    const expenseCategories = ['Cost of goods sold', 'Salaries', 'Rent', 'Utilities', 'Marketing', 'Office expenses'];
    const cogsCategories = ['cost of goods sold'];

    let revBase = 800000;
    let expBase = 500000;
    for (const month of monthKeys) {
      revBase = Math.round(revBase * (0.98 + Math.random() * 0.06));
      expBase = Math.round(expBase * (0.97 + Math.random() * 0.06));
      const cash = Math.round(200000 + (revBase - expBase) * 0.3);
      const netProfit = revBase - expBase;
      await MonthlyTrialBalanceSummary.create(
        {
          companyId,
          month,
          cashAndBankBalance: cash,
          totalAssets: cash + 500000,
          totalLiabilities: 200000,
          totalEquity: cash + 300000,
          totalRevenue: revBase,
          totalExpenses: expBase,
          netProfit,
          netCashflow: netProfit,
          inventoryTotal: 150000
        },
        { transaction: t }
      );

      let revRemain = revBase;
      for (let i = 0; i < revenueCategories.length && revRemain > 0; i++) {
        const pct = i === revenueCategories.length - 1 ? 1 : 0.2 + Math.random() * 0.3;
        const amount = i === revenueCategories.length - 1 ? revRemain : Math.round(revBase * pct);
        revRemain -= amount;
        if (amount <= 0) continue;
        await MonthlyRevenueBreakdown.create(
          {
            companyId,
            month,
            revenueName: revenueCategories[i],
            normalizedRevenueCategory: revenueCategories[i].toLowerCase(),
            amount
          },
          { transaction: t }
        );
      }

      let expRemain = expBase;
      for (let i = 0; i < expenseCategories.length && expRemain > 0; i++) {
        const pct = i === expenseCategories.length - 1 ? 1 : 0.1 + Math.random() * 0.25;
        const amount = i === expenseCategories.length - 1 ? expRemain : Math.round(expBase * pct);
        expRemain -= amount;
        if (amount <= 0) continue;
        await MonthlyExpenseBreakdown.create(
          {
            companyId,
            month,
            expenseName: expenseCategories[i],
            normalizedExpenseCategory: expenseCategories[i].toLowerCase(),
            amount
          },
          { transaction: t }
        );
      }
    }

    const latestMonth = monthKeys[monthKeys.length - 1];
    const ledgerGuids = ['ledger-1', 'ledger-2', 'ledger-3', 'ledger-4', 'ledger-5'];
    const ledgerNames = ['Sales Account', 'Purchases', 'Debtors', 'Bank', 'Unclassified Ledger'];
    const categories = ['revenue', 'cost of goods sold', 'debtors', 'cash_and_bank', null];
    for (let i = 0; i < ledgerGuids.length; i++) {
      await CFOLedgerClassification.findOrCreate({
        where: { companyId, ledgerGuid: ledgerGuids[i] },
        defaults: {
          companyId,
          ledgerName: ledgerNames[i],
          ledgerGuid: ledgerGuids[i],
          parentGroup: 'Primary',
          cfoCategory: categories[i],
          lastSeenAt: now
        },
        transaction: t
      });
      await LedgerMonthlyBalance.create(
        {
          companyId,
          monthKey: latestMonth,
          ledgerGuid: ledgerGuids[i],
          ledgerName: ledgerNames[i],
          parentGroup: 'Primary',
          cfoCategory: categories[i] || 'unclassified',
          balance: i === 0 ? revBase : i === 1 ? expBase * 0.4 : 100000
        },
        { transaction: t }
      );
    }

    await CFOMetric.bulkCreate(
      [
        { companyId, metricKey: 'debtor_days', metricValue: 45, month: latestMonth, timeScope: '3m', computedAt: now, updatedAt: now },
        { companyId, metricKey: 'creditor_days', metricValue: 30, month: latestMonth, timeScope: '3m', computedAt: now, updatedAt: now },
        { companyId, metricKey: 'inventory_days', metricValue: 25, month: latestMonth, timeScope: '3m', computedAt: now, updatedAt: now },
        { companyId, metricKey: 'cash_conversion_cycle', metricValue: 40, month: latestMonth, timeScope: '3m', computedAt: now, updatedAt: now },
        { companyId, metricKey: 'cash_runway_months', metricValue: 8, month: latestMonth, timeScope: 'live', computedAt: now, updatedAt: now }
      ],
      { transaction: t }
    );

    await sequelize.query(
      `INSERT INTO data_sync_status (company_id, status, last_sync_completed_at, "updatedAt", "createdAt")
       VALUES (:companyId, 'completed', NOW(), NOW(), NOW())
       ON CONFLICT (company_id) DO UPDATE SET status = 'completed', last_sync_completed_at = NOW(), "updatedAt" = NOW()`,
      { replacements: { companyId }, transaction: t }
    );

    await t.commit();
    return { company: company.get({ plain: true }) };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

module.exports = {
  createDemoCompany,
  getLatestClosedMonthKey
};
