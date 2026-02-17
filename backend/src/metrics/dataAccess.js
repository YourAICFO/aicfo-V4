const { Sequelize } = require('sequelize');
const {
  MonthlyTrialBalanceSummary,
  MonthlyDebtor,
  MonthlyCreditor,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CurrentLiquidityMetric,
  CFOMetric
} = require('../models');
const { listMonthKeysBetween, getMonthKeyOffset, normalizeMonth } = require('../utils/monthKeyUtils');

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const sum = (rows, field) => rows.reduce((acc, row) => acc + Number(row?.[field] || 0), 0);

class MetricsDataAccess {
  constructor({ companyId, transaction = null, monthsBack = 24 }) {
    this.companyId = companyId;
    this.transaction = transaction;
    this.monthsBack = Math.max(1, Number(monthsBack || 24));
    this.loaded = false;

    this.latestMonth = null;
    this.monthKeys = [];
    this.recordsByMonth = new Map();
    this.current = {
      cashRows: [],
      debtorsRows: [],
      creditorsRows: [],
      loanRows: [],
      cashTotal: 0,
      debtorsTotal: 0,
      creditorsTotal: 0,
      loansTotal: 0
    };
    this.liquidity = null;
    this.metricCache = new Map();
  }

  async load() {
    if (this.loaded) return;

    const latestSummary = await MonthlyTrialBalanceSummary.findOne({
      where: { companyId: this.companyId },
      attributes: ['month'],
      order: [['month', 'DESC']],
      raw: true,
      transaction: this.transaction
    });

    this.latestMonth = latestSummary?.month || null;
    if (this.latestMonth) {
      const startKey = getMonthKeyOffset(this.latestMonth, -(this.monthsBack - 1));
      this.monthKeys = listMonthKeysBetween(startKey, this.latestMonth);
    }

    if (this.monthKeys.length > 0) {
      const [summaries, debtorsAgg, creditorsAgg, debtorDaysRows, creditorDaysRows, cccRows] = await Promise.all([
        MonthlyTrialBalanceSummary.findAll({
          where: { companyId: this.companyId, month: { [Sequelize.Op.in]: this.monthKeys } },
          raw: true,
          transaction: this.transaction
        }),
        MonthlyDebtor.findAll({
          where: { companyId: this.companyId, month: { [Sequelize.Op.in]: this.monthKeys } },
          attributes: ['month', [Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
          group: ['month'],
          raw: true,
          transaction: this.transaction
        }),
        MonthlyCreditor.findAll({
          where: { companyId: this.companyId, month: { [Sequelize.Op.in]: this.monthKeys } },
          attributes: ['month', [Sequelize.fn('SUM', Sequelize.col('closing_balance')), 'total']],
          group: ['month'],
          raw: true,
          transaction: this.transaction
        }),
        CFOMetric.findAll({
          where: {
            companyId: this.companyId,
            metricKey: 'debtor_days',
            timeScope: '3m',
            month: { [Sequelize.Op.in]: this.monthKeys }
          },
          raw: true,
          transaction: this.transaction
        }),
        CFOMetric.findAll({
          where: {
            companyId: this.companyId,
            metricKey: 'creditor_days',
            timeScope: '3m',
            month: { [Sequelize.Op.in]: this.monthKeys }
          },
          raw: true,
          transaction: this.transaction
        }),
        CFOMetric.findAll({
          where: {
            companyId: this.companyId,
            metricKey: 'cash_conversion_cycle',
            timeScope: '3m',
            month: { [Sequelize.Op.in]: this.monthKeys }
          },
          raw: true,
          transaction: this.transaction
        })
      ]);

      const debtorsByMonth = new Map(debtorsAgg.map((row) => [row.month, toNumber(row.total) || 0]));
      const creditorsByMonth = new Map(creditorsAgg.map((row) => [row.month, toNumber(row.total) || 0]));
      const debtorDaysByMonth = new Map(debtorDaysRows.map((row) => [row.month, toNumber(row.metric_value)]));
      const creditorDaysByMonth = new Map(creditorDaysRows.map((row) => [row.month, toNumber(row.metric_value)]));
      const cccByMonth = new Map(cccRows.map((row) => [row.month, toNumber(row.metric_value)]));

      for (const month of this.monthKeys) {
        const summary = summaries.find((row) => row.month === month) || {};
        const revenue = toNumber(summary.total_revenue) || 0;
        const expenses = toNumber(summary.total_expenses) || 0;
        const netProfit = toNumber(summary.net_profit);
        const netProfitValue = netProfit === null ? revenue - expenses : netProfit;
        const cashBank = toNumber(summary.cash_and_bank_balance) || 0;
        const debtors = debtorsByMonth.get(month) || 0;
        const creditors = creditorsByMonth.get(month) || 0;

        this.recordsByMonth.set(month, {
          month,
          revenue,
          expenses,
          net_profit: netProfitValue,
          net_margin: revenue > 0 ? netProfitValue / revenue : null,
          cash_bank: cashBank,
          debtors,
          creditors,
          working_capital: cashBank + debtors - creditors,
          debtor_days: debtorDaysByMonth.get(month) ?? null,
          creditor_days: creditorDaysByMonth.get(month) ?? null,
          cash_conversion_cycle: cccByMonth.get(month) ?? null
        });
      }
    }

    const [cashRows, debtorsRows, creditorsRows, loanRows, liquidity] = await Promise.all([
      CurrentCashBalance.findAll({ where: { companyId: this.companyId }, raw: true, transaction: this.transaction }),
      CurrentDebtor.findAll({ where: { companyId: this.companyId }, raw: true, transaction: this.transaction }),
      CurrentCreditor.findAll({ where: { companyId: this.companyId }, raw: true, transaction: this.transaction }),
      CurrentLoan.findAll({ where: { companyId: this.companyId }, raw: true, transaction: this.transaction }),
      CurrentLiquidityMetric.findOne({ where: { companyId: this.companyId }, raw: true, transaction: this.transaction })
    ]);

    this.current = {
      cashRows,
      debtorsRows,
      creditorsRows,
      loanRows,
      cashTotal: sum(cashRows, 'balance'),
      debtorsTotal: sum(debtorsRows, 'balance'),
      creditorsTotal: sum(creditorsRows, 'balance'),
      loansTotal: sum(loanRows, 'balance')
    };
    this.liquidity = liquidity || null;

    this.loaded = true;
  }

  getLatestMonth() {
    return this.latestMonth;
  }

  getMonthKeys() {
    return [...this.monthKeys];
  }

  getRecord(month) {
    return this.recordsByMonth.get(month) || null;
  }

  getLatestRecord() {
    if (!this.latestMonth) return null;
    return this.getRecord(this.latestMonth);
  }

  getValue(measure, month) {
    const row = month ? this.getRecord(month) : this.getLatestRecord();
    if (!row) return null;
    return row[measure] ?? null;
  }

  getPreviousMonth(month) {
    return getMonthKeyOffset(month, -1);
  }

  getWindowValues(measure, endingMonth, window) {
    if (!endingMonth || !window || window < 1) return [];
    const start = getMonthKeyOffset(endingMonth, -(window - 1));
    const keys = listMonthKeysBetween(start, endingMonth);
    return keys
      .map((key) => this.getValue(measure, key))
      .filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)))
      .map(Number);
  }

  async getStoredMetric(metricKey, timeScope = 'live', month = null) {
    const cacheKey = `${metricKey}::${timeScope}::${month || 'latest'}`;
    if (this.metricCache.has(cacheKey)) return this.metricCache.get(cacheKey);

    const where = {
      companyId: this.companyId,
      metricKey,
      ...(timeScope ? { timeScope } : {})
    };
    if (month) where.month = month;

    const row = await CFOMetric.findOne({
      where,
      order: month ? undefined : [['updatedAt', 'DESC']],
      raw: true,
      transaction: this.transaction
    });

    const value = row
      ? (row.metric_value !== null && row.metric_value !== undefined ? toNumber(row.metric_value) : row.metric_text)
      : null;

    this.metricCache.set(cacheKey, value);
    return value;
  }

  getCurrentTotals() {
    return {
      cash: this.current.cashTotal,
      debtors: this.current.debtorsTotal,
      creditors: this.current.creditorsTotal,
      loans: this.current.loansTotal,
      working_capital: this.current.cashTotal + this.current.debtorsTotal - this.current.creditorsTotal
    };
  }

  getTopShare(type = 'debtors', topN = 5) {
    const rows = type === 'creditors' ? this.current.creditorsRows : this.current.debtorsRows;
    const total = type === 'creditors' ? this.current.creditorsTotal : this.current.debtorsTotal;
    if (!rows.length || total <= 0) return 0;
    const top = [...rows]
      .sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0))
      .slice(0, topN)
      .reduce((acc, row) => acc + Number(row.balance || 0), 0);
    return top / total;
  }

  static pctChange(currentValue, previousValue) {
    const currentNum = Number(currentValue);
    const prevNum = Number(previousValue);
    if (!Number.isFinite(currentNum) || !Number.isFinite(prevNum) || prevNum === 0) return null;
    return (currentNum - prevNum) / Math.abs(prevNum);
  }

  static mean(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values.reduce((acc, value) => acc + Number(value || 0), 0) / values.length;
  }

  static stddev(values) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const mean = MetricsDataAccess.mean(values);
    const variance = values.reduce((acc, value) => {
      const diff = Number(value || 0) - mean;
      return acc + diff * diff;
    }, 0) / values.length;
    return Math.sqrt(variance);
  }

  static trend(values) {
    if (!Array.isArray(values) || values.length < 2) return null;
    const first = Number(values[0]);
    const last = Number(values[values.length - 1]);
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null;
    if (last > first) return 1;
    if (last < first) return -1;
    return 0;
  }

  static monthToDate(monthKey) {
    if (!monthKey) return null;
    return normalizeMonth(`${monthKey}-01`) ? new Date(`${monthKey}-01T00:00:00.000Z`) : null;
  }
}

module.exports = {
  MetricsDataAccess
};
