const insightRules = [
  {
    code: 'LOW_CASH_RUNWAY_CRITICAL',
    title: 'Cash runway critically low',
    category: 'RUNWAY',
    requiredMetricKeys: ['cash_runway_months'],
    condition: (m) => Number(m.cash_runway_months) < 2,
    severity: 'critical',
    priorityRank: 1,
    recommendedAction: 'Reduce burn immediately and secure near-term liquidity.',
    evidenceKeys: ['cash_runway_months', 'cash_balance_live', 'avg_net_cash_outflow_3m']
  },
  {
    code: 'LOW_CASH_RUNWAY_HIGH',
    title: 'Cash runway below safe threshold',
    category: 'RUNWAY',
    requiredMetricKeys: ['cash_runway_months'],
    condition: (m) => Number(m.cash_runway_months) >= 2 && Number(m.cash_runway_months) < 4,
    severity: 'high',
    priorityRank: 2,
    recommendedAction: 'Tighten cash controls and monitor weekly runway trend.',
    evidenceKeys: ['cash_runway_months', 'cash_balance_live', 'avg_net_cash_outflow_3m']
  },
  {
    code: 'NEGATIVE_WORKING_CAPITAL',
    title: 'Working capital is negative',
    category: 'RISK',
    requiredMetricKeys: ['working_capital'],
    condition: (m) => Number(m.working_capital) < 0,
    severity: 'critical',
    priorityRank: 3,
    recommendedAction: 'Prioritize collections and renegotiate short-term obligations.',
    evidenceKeys: ['working_capital', 'debtors_balance_live', 'creditors_balance_live', 'cash_balance_live']
  },
  {
    code: 'DEBTOR_CONCENTRATION_HIGH',
    title: 'Debtor concentration is high',
    category: 'RISK',
    requiredMetricKeys: ['debtors_concentration_ratio'],
    condition: (m) => Number(m.debtors_concentration_ratio) > 0.6,
    severity: 'high',
    priorityRank: 4,
    recommendedAction: 'Reduce concentration risk by tightening exposure to top customers.',
    evidenceKeys: ['debtors_concentration_ratio', 'debtors_balance_live']
  },
  {
    code: 'DEBTOR_DAYS_ELEVATED',
    title: 'Debtor days are elevated',
    category: 'RISK',
    requiredMetricKeys: ['debtor_days'],
    condition: (m) => Number(m.debtor_days) > 75,
    severity: 'high',
    priorityRank: 5,
    recommendedAction: 'Escalate collections and enforce stricter payment terms.',
    evidenceKeys: ['debtor_days', 'debtors_balance_live', 'revenue_avg_3m']
  },
  {
    code: 'CREDITOR_CASH_PRESSURE',
    title: 'Creditors exceed available cash',
    category: 'CASHFLOW',
    requiredMetricKeys: ['creditors_cash_pressure', 'creditors_balance_live', 'cash_balance_live'],
    condition: (m) => Number(m.creditors_cash_pressure) === 1,
    severity: 'high',
    priorityRank: 6,
    recommendedAction: 'Re-phase payables and prioritize critical vendors by due date.',
    evidenceKeys: ['creditors_cash_pressure', 'creditors_balance_live', 'cash_balance_live']
  },
  {
    code: 'REVENUE_DROP_MOM',
    title: 'Revenue dropped month-over-month',
    category: 'REVENUE',
    requiredMetricKeys: ['revenue_mom_growth_pct'],
    condition: (m) => Number(m.revenue_mom_growth_pct) < -0.1,
    severity: 'high',
    priorityRank: 7,
    recommendedAction: 'Investigate demand decline and pipeline conversion leakage.',
    evidenceKeys: ['revenue_mom_growth_pct', 'revenue_last_closed']
  },
  {
    code: 'REVENUE_DROP_YOY',
    title: 'Revenue declined year-over-year',
    category: 'REVENUE',
    requiredMetricKeys: ['revenue_yoy_growth_pct'],
    condition: (m) => Number(m.revenue_yoy_growth_pct) < -0.05,
    severity: 'high',
    priorityRank: 8,
    recommendedAction: 'Revisit pricing, retention, and acquisition channels.',
    evidenceKeys: ['revenue_yoy_growth_pct', 'revenue_last_closed']
  },
  {
    code: 'EXPENSE_SPIKE_MOM',
    title: 'Expenses spiked month-over-month',
    category: 'EXPENSE',
    requiredMetricKeys: ['expense_mom_growth_pct'],
    condition: (m) => Number(m.expense_mom_growth_pct) > 0.15,
    severity: 'high',
    priorityRank: 9,
    recommendedAction: 'Identify cost drivers and cap discretionary spend.',
    evidenceKeys: ['expense_mom_growth_pct', 'expenses_last_closed']
  },
  {
    code: 'MARGIN_DROPPING',
    title: 'Net margin is deteriorating',
    category: 'RISK',
    requiredMetricKeys: ['net_margin_mom_change'],
    condition: (m) => Number(m.net_margin_mom_change) < -0.05,
    severity: 'high',
    priorityRank: 10,
    recommendedAction: 'Protect gross margin and reduce high-variance expenses.',
    evidenceKeys: ['net_margin_mom_change', 'net_margin_last_closed', 'expense_vs_revenue_growth_gap']
  },
  {
    code: 'LOAN_SERVICING_RISK',
    title: 'Loan servicing risk detected',
    category: 'RISK',
    requiredMetricKeys: ['flag_loan_servicing_risk', 'loans_balance_live'],
    condition: (m) => Number(m.flag_loan_servicing_risk) === 1,
    severity: 'critical',
    priorityRank: 11,
    recommendedAction: 'Review debt schedule and ensure coverage for upcoming obligations.',
    evidenceKeys: ['flag_loan_servicing_risk', 'loans_balance_live', 'interest_coverage', 'interest_expense_latest']
  },
  {
    code: 'LIQUIDITY_FLAG_RISK',
    title: 'Liquidity risk flag is active',
    category: 'RISK',
    requiredMetricKeys: ['flag_liquidity_risk'],
    condition: (m) => Number(m.flag_liquidity_risk) === 1,
    severity: 'critical',
    priorityRank: 12,
    recommendedAction: 'Move to a weekly liquidity command cadence until normalized.',
    evidenceKeys: ['flag_liquidity_risk', 'cash_runway_months', 'cash_balance_live']
  },
  {
    code: 'RUNWAY_FLAG_RISK',
    title: 'Runway risk flag is active',
    category: 'RUNWAY',
    requiredMetricKeys: ['flag_runway_risk'],
    condition: (m) => Number(m.flag_runway_risk) === 1,
    severity: 'high',
    priorityRank: 13,
    recommendedAction: 'Create 13-week cash view and execute on runway extension plan.',
    evidenceKeys: ['flag_runway_risk', 'cash_runway_months']
  },
  {
    code: 'CREDITOR_CONCENTRATION_HIGH',
    title: 'Creditor concentration is high',
    category: 'RISK',
    requiredMetricKeys: ['creditors_concentration_ratio'],
    condition: (m) => Number(m.creditors_concentration_ratio) > 0.6,
    severity: 'high',
    priorityRank: 14,
    recommendedAction: 'Diversify supplier dependence and secure alternate terms.',
    evidenceKeys: ['creditors_concentration_ratio', 'creditors_balance_live']
  },
  {
    code: 'CASH_CONVERSION_STRETCHED',
    title: 'Cash conversion cycle is stretched',
    category: 'CASHFLOW',
    requiredMetricKeys: ['cash_conversion_cycle'],
    condition: (m) => Number(m.cash_conversion_cycle) > 60,
    severity: 'high',
    priorityRank: 15,
    recommendedAction: 'Reduce receivable cycle and optimize payable timing.',
    evidenceKeys: ['cash_conversion_cycle', 'debtor_days', 'creditor_days']
  }
];

const severityRank = {
  critical: 3,
  high: 2,
  medium: 1,
  low: 0
};

module.exports = {
  insightRules,
  severityRank
};
