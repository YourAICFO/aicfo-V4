const { MetricsDataAccess } = require('./dataAccess');
const { getMonthKeyOffset } = require('../utils/monthKeyUtils');

const WINDOWS = [3, 6, 9, 12, 18, 24];

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const pct = MetricsDataAccess.pctChange;
const mean = MetricsDataAccess.mean;
const stddev = MetricsDataAccess.stddev;
const trend = MetricsDataAccess.trend;

const rollingAverage = (dataAccess, measure, window, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const values = dataAccess.getWindowValues(measure, endMonth, window);
  return mean(values);
};

const rollingSum = (dataAccess, measure, window, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const values = dataAccess.getWindowValues(measure, endMonth, window);
  return values.length ? values.reduce((acc, value) => acc + Number(value || 0), 0) : null;
};

const rollingStd = (dataAccess, measure, window, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const values = dataAccess.getWindowValues(measure, endMonth, window);
  return stddev(values);
};

const rollingTrend = (dataAccess, measure, window, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const values = dataAccess.getWindowValues(measure, endMonth, window);
  return trend(values);
};

const latestVsPreviousPct = (dataAccess, measure, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const prevMonth = getMonthKeyOffset(endMonth, -1);
  return pct(dataAccess.getValue(measure, endMonth), dataAccess.getValue(measure, prevMonth));
};

const latestVsYearAgoPct = (dataAccess, measure, month = null) => {
  const endMonth = month || dataAccess.getLatestMonth();
  const yearAgoMonth = getMonthKeyOffset(endMonth, -12);
  return pct(dataAccess.getValue(measure, endMonth), dataAccess.getValue(measure, yearAgoMonth));
};

const metric = (definition) => definition;

const LEGACY_METRICS = [
  metric({
    key: 'cash_balance_live',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'live',
    requiredInputs: ['current_cash_balances'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().cash
  }),
  metric({
    key: 'debtors_balance_live',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'live',
    requiredInputs: ['current_debtors'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().debtors
  }),
  metric({
    key: 'creditors_balance_live',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'live',
    requiredInputs: ['current_creditors'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().creditors
  }),
  metric({
    key: 'loans_balance_live',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'live',
    requiredInputs: ['current_loans'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().loans
  }),
  metric({
    key: 'working_capital',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'live',
    requiredInputs: ['current_cash_balances', 'current_debtors', 'current_creditors'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().working_capital
  }),
  metric({
    key: 'cash_runway_months',
    scope: 'latest',
    valueType: 'number',
    timeScope: 'live',
    requiredInputs: ['current_liquidity_metrics'],
    compute: async ({ dataAccess }) => toNumber(dataAccess.liquidity?.cash_runway_months)
  }),
  metric({
    key: 'avg_net_cash_outflow_3m',
    scope: 'latest',
    valueType: 'currency',
    timeScope: '3m',
    requiredInputs: ['current_liquidity_metrics'],
    compute: async ({ dataAccess }) => toNumber(dataAccess.liquidity?.avg_net_cash_outflow_3m)
  }),
  metric({
    key: 'cash_runway_change_mom',
    scope: 'latest',
    valueType: 'number',
    timeScope: 'mom',
    requiredInputs: ['monthly_trial_balance_summary', 'current_liquidity_metrics'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const prevMonth = getMonthKeyOffset(latestMonth, -1);
      const currentRunway = toNumber(dataAccess.liquidity?.cash_runway_months);
      const prevRunway = await dataAccess.getStoredMetric('cash_runway_months', 'live', prevMonth);
      if (currentRunway === null || prevRunway === null) return null;
      return currentRunway - Number(prevRunway || 0);
    }
  }),
  metric({
    key: 'revenue_last_closed',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'last_closed_month',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => dataAccess.getLatestRecord()?.revenue ?? null
  }),
  metric({
    key: 'expenses_last_closed',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'last_closed_month',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => dataAccess.getLatestRecord()?.expenses ?? null
  }),
  metric({
    key: 'net_profit_last_closed',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'last_closed_month',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => dataAccess.getLatestRecord()?.net_profit ?? null
  }),
  metric({
    key: 'revenue_mom_growth_pct',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'mom',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => latestVsPreviousPct(dataAccess, 'revenue')
  }),
  metric({
    key: 'expense_mom_growth_pct',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'mom',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => latestVsPreviousPct(dataAccess, 'expenses')
  }),
  metric({
    key: 'revenue_growth_3m',
    scope: 'latest',
    valueType: 'percent',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const latest = rollingAverage(dataAccess, 'revenue', 3);
      const prev = rollingAverage(dataAccess, 'revenue', 3, getMonthKeyOffset(dataAccess.getLatestMonth(), -3));
      return pct(latest, prev);
    }
  }),
  metric({
    key: 'expense_growth_3m',
    scope: 'latest',
    valueType: 'percent',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const latest = rollingAverage(dataAccess, 'expenses', 3);
      const prev = rollingAverage(dataAccess, 'expenses', 3, getMonthKeyOffset(dataAccess.getLatestMonth(), -3));
      return pct(latest, prev);
    }
  }),
  metric({
    key: 'expense_vs_revenue_growth_gap',
    scope: 'latest',
    valueType: 'percent',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const revenueGrowth = await LEGACY_METRICS.find((d) => d.key === 'revenue_growth_3m').compute({ dataAccess });
      const expenseGrowth = await LEGACY_METRICS.find((d) => d.key === 'expense_growth_3m').compute({ dataAccess });
      if (revenueGrowth === null || expenseGrowth === null) return null;
      return expenseGrowth - revenueGrowth;
    }
  }),
  ...['revenue', 'expense', 'net_profit'].flatMap((base) => {
    const measure = base === 'expense' ? 'expenses' : base;
    const prefix = base === 'expense' ? 'expense' : base;
    return [3, 6, 12].map((window) => metric({
      key: `${prefix}_avg_${window}m`,
      scope: 'latest',
      valueType: 'currency',
      timeScope: `${window}m`,
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess }) => rollingAverage(dataAccess, measure, window)
    }));
  }),
  metric({
    key: 'revenue_trend_direction',
    scope: 'latest',
    valueType: 'flag',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => rollingTrend(dataAccess, 'revenue', 3)
  }),
  metric({
    key: 'expense_trend_direction',
    scope: 'latest',
    valueType: 'flag',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => rollingTrend(dataAccess, 'expenses', 3)
  }),
  metric({
    key: 'revenue_volatility',
    scope: 'latest',
    valueType: 'percent',
    timeScope: '6m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const avg = rollingAverage(dataAccess, 'revenue', 6);
      const sd = rollingStd(dataAccess, 'revenue', 6);
      if (avg === null || avg === 0 || sd === null) return null;
      return sd / avg;
    }
  }),
  metric({
    key: 'revenue_stagnation_flag',
    scope: 'latest',
    valueType: 'flag',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const growth = await LEGACY_METRICS.find((d) => d.key === 'revenue_growth_3m').compute({ dataAccess });
      if (growth === null) return null;
      return Math.abs(growth) < 0.02 ? 1 : 0;
    }
  }),
  metric({
    key: 'net_margin_last_closed',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'last_closed_month',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => dataAccess.getLatestRecord()?.net_margin ?? null
  }),
  metric({
    key: 'net_margin_mom_change',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'mom',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => latestVsPreviousPct(dataAccess, 'net_margin')
  }),
  ...[
    { key: 'revenue_yoy_growth_pct', measure: 'revenue' },
    { key: 'expense_yoy_growth_pct', measure: 'expenses' },
    { key: 'net_profit_yoy_growth_pct', measure: 'net_profit' },
    { key: 'gross_margin_yoy_growth_pct', measure: 'net_margin' },
    { key: 'debtor_balance_yoy_change', measure: 'debtors' },
    { key: 'creditor_balance_yoy_change', measure: 'creditors' },
    { key: 'cash_balance_yoy_change', measure: 'cash_bank' }
  ].map((item) => metric({
    key: item.key,
    scope: 'latest',
    valueType: item.key.includes('_change') ? 'currency' : 'percent',
    timeScope: 'yoy',
    requiredInputs: ['monthly_trial_balance_summary', 'monthly_debtors', 'monthly_creditors'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const latest = dataAccess.getValue(item.measure, latestMonth);
      const prev = dataAccess.getValue(item.measure, getMonthKeyOffset(latestMonth, -12));
      if (item.key.includes('_change')) {
        if (latest === null || prev === null) return null;
        return Number(latest) - Number(prev);
      }
      return pct(latest, prev);
    }
  })),
  metric({
    key: 'debtors_concentration_ratio',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'live',
    requiredInputs: ['current_debtors'],
    compute: async ({ dataAccess }) => dataAccess.getTopShare('debtors', 5)
  }),
  metric({
    key: 'creditors_concentration_ratio',
    scope: 'latest',
    valueType: 'percent',
    timeScope: 'live',
    requiredInputs: ['current_creditors'],
    compute: async ({ dataAccess }) => dataAccess.getTopShare('creditors', 5)
  }),
  metric({
    key: 'creditors_cash_pressure',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_cash_balances', 'current_creditors'],
    compute: async ({ dataAccess }) => dataAccess.getCurrentTotals().creditors > dataAccess.getCurrentTotals().cash ? 1 : 0,
    severityRule: ({ value }) => value === 1 ? { severity: 'critical' } : { severity: 'good' }
  }),
  metric({
    key: 'debtor_days',
    scope: 'latest',
    valueType: 'number',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary', 'monthly_debtors'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const stored = dataAccess.getValue('debtor_days', latestMonth);
      if (stored !== null && stored !== undefined) return stored;
      const debtors = dataAccess.getValue('debtors', latestMonth);
      const revAvg3 = rollingAverage(dataAccess, 'revenue', 3);
      if (debtors === null || revAvg3 === null || revAvg3 === 0) return null;
      return (debtors / revAvg3) * 30;
    }
  }),
  metric({
    key: 'creditor_days',
    scope: 'latest',
    valueType: 'number',
    timeScope: '3m',
    requiredInputs: ['monthly_trial_balance_summary', 'monthly_creditors'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const stored = dataAccess.getValue('creditor_days', latestMonth);
      if (stored !== null && stored !== undefined) return stored;
      const creditors = dataAccess.getValue('creditors', latestMonth);
      const expAvg3 = rollingAverage(dataAccess, 'expenses', 3);
      if (creditors === null || expAvg3 === null || expAvg3 === 0) return null;
      return (creditors / expAvg3) * 30;
    }
  }),
  metric({
    key: 'cash_conversion_cycle',
    scope: 'latest',
    valueType: 'number',
    timeScope: '3m',
    requiredInputs: ['cfo_metrics'],
    compute: async ({ dataAccess }) => {
      const debtorDays = await LEGACY_METRICS.find((d) => d.key === 'debtor_days').compute({ dataAccess });
      const creditorDays = await LEGACY_METRICS.find((d) => d.key === 'creditor_days').compute({ dataAccess });
      if (debtorDays === null || creditorDays === null) return null;
      return debtorDays - creditorDays;
    }
  }),
  metric({
    key: 'debtor_balance_mom_change',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'mom',
    requiredInputs: ['monthly_debtors'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const prevMonth = getMonthKeyOffset(latestMonth, -1);
      const latest = dataAccess.getValue('debtors', latestMonth);
      const prev = dataAccess.getValue('debtors', prevMonth);
      if (latest === null || prev === null) return null;
      return Number(latest) - Number(prev);
    }
  }),
  metric({
    key: 'creditor_balance_mom_change',
    scope: 'latest',
    valueType: 'currency',
    timeScope: 'mom',
    requiredInputs: ['monthly_creditors'],
    compute: async ({ dataAccess }) => {
      const latestMonth = dataAccess.getLatestMonth();
      if (!latestMonth) return null;
      const prevMonth = getMonthKeyOffset(latestMonth, -1);
      const latest = dataAccess.getValue('creditors', latestMonth);
      const prev = dataAccess.getValue('creditors', prevMonth);
      if (latest === null || prev === null) return null;
      return Number(latest) - Number(prev);
    }
  }),
  metric({
    key: 'debtors_revenue_divergence',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'last_closed_month',
    requiredInputs: ['monthly_debtors', 'monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const debtorMom = await LEGACY_METRICS.find((d) => d.key === 'debtor_balance_mom_change').compute({ dataAccess });
      const revMomPct = await LEGACY_METRICS.find((d) => d.key === 'revenue_mom_growth_pct').compute({ dataAccess });
      if (debtorMom === null || revMomPct === null) return null;
      return debtorMom > 0 && revMomPct <= 0 ? 1 : 0;
    }
  })
];

const GENERATED_MEASURES = [
  { name: 'revenue', valueType: 'currency' },
  { name: 'expenses', valueType: 'currency' },
  { name: 'net_profit', valueType: 'currency' },
  { name: 'debtors', valueType: 'currency' },
  { name: 'creditors', valueType: 'currency' },
  { name: 'working_capital', valueType: 'currency' }
];

const generatedRollingMetrics = () => {
  const defs = [];
  for (const measure of GENERATED_MEASURES) {
    for (const window of WINDOWS) {
      defs.push(metric({
        key: `catalog_${measure.name}_avg_${window}m`,
        scope: 'latest',
        valueType: measure.valueType,
        timeScope: 'live',
        requiredInputs: ['monthly_trial_balance_summary'],
        compute: async ({ dataAccess }) => rollingAverage(dataAccess, measure.name, window)
      }));
      defs.push(metric({
        key: `catalog_${measure.name}_sum_${window}m`,
        scope: 'latest',
        valueType: measure.valueType,
        timeScope: 'live',
        requiredInputs: ['monthly_trial_balance_summary'],
        compute: async ({ dataAccess }) => rollingSum(dataAccess, measure.name, window)
      }));
      defs.push(metric({
        key: `catalog_${measure.name}_stddev_${window}m`,
        scope: 'latest',
        valueType: measure.valueType,
        timeScope: 'live',
        requiredInputs: ['monthly_trial_balance_summary'],
        compute: async ({ dataAccess }) => rollingStd(dataAccess, measure.name, window)
      }));
      defs.push(metric({
        key: `catalog_${measure.name}_trend_${window}m`,
        scope: 'latest',
        valueType: 'flag',
        timeScope: 'live',
        requiredInputs: ['monthly_trial_balance_summary'],
        compute: async ({ dataAccess }) => rollingTrend(dataAccess, measure.name, window)
      }));
      defs.push(metric({
        key: `catalog_${measure.name}_mom_growth_${window}m`,
        scope: 'latest',
        valueType: 'percent',
        timeScope: 'live',
        requiredInputs: ['monthly_trial_balance_summary'],
        compute: async ({ dataAccess }) => {
          const latestMonth = dataAccess.getLatestMonth();
          if (!latestMonth) return null;
          const latestAvg = rollingAverage(dataAccess, measure.name, window, latestMonth);
          const prevAvg = rollingAverage(dataAccess, measure.name, window, getMonthKeyOffset(latestMonth, -1));
          return pct(latestAvg, prevAvg);
        }
      }));
    }
  }
  return defs;
};

const generatedMonthlyMetrics = () => {
  const defs = [];
  for (const measure of GENERATED_MEASURES) {
    defs.push(metric({
      key: `catalog_${measure.name}_month_value`,
      scope: 'month',
      valueType: measure.valueType,
      timeScope: 'month',
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess, month }) => dataAccess.getValue(measure.name, month)
    }));
    defs.push(metric({
      key: `catalog_${measure.name}_month_mom_growth`,
      scope: 'month',
      valueType: 'percent',
      timeScope: 'month',
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess, month }) => latestVsPreviousPct(dataAccess, measure.name, month)
    }));
    defs.push(metric({
      key: `catalog_${measure.name}_month_yoy_growth`,
      scope: 'month',
      valueType: 'percent',
      timeScope: 'month',
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess, month }) => latestVsYearAgoPct(dataAccess, measure.name, month)
    }));
    defs.push(metric({
      key: `catalog_${measure.name}_month_spike_flag`,
      scope: 'month',
      valueType: 'flag',
      timeScope: 'month',
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess, month }) => {
        const value = dataAccess.getValue(measure.name, month);
        const baseline = rollingAverage(dataAccess, measure.name, 6, getMonthKeyOffset(month, -1));
        if (value === null || baseline === null || baseline === 0) return null;
        return Number(value) > baseline * 1.3 ? 1 : 0;
      }
    }));
    defs.push(metric({
      key: `catalog_${measure.name}_month_drop_flag`,
      scope: 'month',
      valueType: 'flag',
      timeScope: 'month',
      requiredInputs: ['monthly_trial_balance_summary'],
      compute: async ({ dataAccess, month }) => {
        const value = dataAccess.getValue(measure.name, month);
        const baseline = rollingAverage(dataAccess, measure.name, 6, getMonthKeyOffset(month, -1));
        if (value === null || baseline === null || baseline === 0) return null;
        return Number(value) < baseline * 0.7 ? 1 : 0;
      }
    }));
  }

  defs.push(
    metric({
      key: 'catalog_debtor_days_month_value',
      scope: 'month',
      valueType: 'number',
      timeScope: 'month',
      requiredInputs: ['cfo_metrics'],
      compute: async ({ dataAccess, month }) => dataAccess.getValue('debtor_days', month)
    }),
    metric({
      key: 'catalog_creditor_days_month_value',
      scope: 'month',
      valueType: 'number',
      timeScope: 'month',
      requiredInputs: ['cfo_metrics'],
      compute: async ({ dataAccess, month }) => dataAccess.getValue('creditor_days', month)
    }),
    metric({
      key: 'catalog_cash_conversion_cycle_month_value',
      scope: 'month',
      valueType: 'number',
      timeScope: 'month',
      requiredInputs: ['cfo_metrics'],
      compute: async ({ dataAccess, month }) => dataAccess.getValue('cash_conversion_cycle', month)
    })
  );

  return defs;
};

const PRIORITY_FLAGS = [
  metric({
    key: 'flag_liquidity_risk',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_liquidity_metrics'],
    compute: async ({ dataAccess }) => {
      const runway = toNumber(dataAccess.liquidity?.cash_runway_months);
      if (runway === null) return null;
      return runway < 3 ? 1 : 0;
    },
    severityRule: ({ value }) => value === 1 ? { severity: 'critical', title: 'Liquidity risk' } : { severity: 'good' }
  }),
  metric({
    key: 'flag_runway_risk',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_liquidity_metrics'],
    compute: async ({ dataAccess }) => {
      const runway = toNumber(dataAccess.liquidity?.cash_runway_months);
      if (runway === null) return null;
      return runway < 6 ? 1 : 0;
    }
  }),
  metric({
    key: 'flag_debtor_concentration_risk',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_debtors'],
    compute: async ({ dataAccess }) => dataAccess.getTopShare('debtors', 5) > 0.6 ? 1 : 0
  }),
  metric({
    key: 'flag_creditor_concentration_risk',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_creditors'],
    compute: async ({ dataAccess }) => dataAccess.getTopShare('creditors', 5) > 0.6 ? 1 : 0
  }),
  metric({
    key: 'flag_revenue_drop',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const growth = latestVsPreviousPct(dataAccess, 'revenue');
      if (growth === null) return null;
      return growth < -0.1 ? 1 : 0;
    }
  }),
  metric({
    key: 'flag_expense_spike',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['monthly_trial_balance_summary'],
    compute: async ({ dataAccess }) => {
      const growth = latestVsPreviousPct(dataAccess, 'expenses');
      if (growth === null) return null;
      return growth > 0.15 ? 1 : 0;
    }
  }),
  metric({
    key: 'flag_loan_servicing_risk',
    scope: 'latest',
    valueType: 'flag',
    timeScope: 'live',
    requiredInputs: ['current_loans', 'cfo_metrics'],
    compute: async ({ dataAccess }) => {
      const loans = dataAccess.getCurrentTotals().loans;
      const interestCoverage = await dataAccess.getStoredMetric('interest_coverage', 'latest');
      if (loans <= 0) return 0;
      if (interestCoverage === null || interestCoverage === undefined) return null;
      return Number(interestCoverage) < 1.5 ? 1 : 0;
    }
  })
];

const metricsCatalog = [
  ...LEGACY_METRICS,
  ...generatedRollingMetrics(),
  ...generatedMonthlyMetrics(),
  ...PRIORITY_FLAGS
];

const metricsCatalogCount = metricsCatalog.length;

module.exports = {
  metricsCatalog,
  metricsCatalogCount
};
