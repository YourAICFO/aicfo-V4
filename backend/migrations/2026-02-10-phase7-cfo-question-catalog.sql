-- Revenue performance
INSERT INTO cfo_questions (code, title, category, description) VALUES
('REV_LATEST_CLOSED', 'Latest closed month revenue', 'revenue', 'Revenue for latest closed month'),
('REV_MOM_GROWTH', 'Month-over-month revenue growth', 'revenue', 'MoM revenue change'),
('REV_AVG_3M', '3M average revenue', 'revenue', 'Average revenue over 3 closed months'),
('REV_AVG_6M', '6M average revenue', 'revenue', 'Average revenue over 6 closed months'),
('REV_AVG_12M', '12M average revenue', 'revenue', 'Average revenue over 12 closed months'),
('REV_TREND_DIRECTION', 'Revenue trend direction', 'revenue', 'Short-term revenue trend'),
('REV_VOLATILITY', 'Revenue volatility', 'revenue', 'Revenue volatility over 6 months'),
('REV_STAGNATION', 'Revenue stagnation detection', 'revenue', 'Flag for flat revenue')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_last_closed', 'last_closed_month' FROM cfo_questions WHERE code = 'REV_LATEST_CLOSED'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_mom_growth_pct', 'mom' FROM cfo_questions WHERE code = 'REV_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_avg_3m', '3m' FROM cfo_questions WHERE code = 'REV_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_avg_6m', '6m' FROM cfo_questions WHERE code = 'REV_AVG_6M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_avg_12m', '12m' FROM cfo_questions WHERE code = 'REV_AVG_12M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_trend_direction', '3m' FROM cfo_questions WHERE code = 'REV_TREND_DIRECTION'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_volatility', '6m' FROM cfo_questions WHERE code = 'REV_VOLATILITY'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_stagnation_flag', '3m' FROM cfo_questions WHERE code = 'REV_STAGNATION'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_last_closed":{"gte":0}}', 'good', 'Latest closed month revenue is ₹{{revenue_last_closed}}.'
FROM cfo_questions WHERE code = 'REV_LATEST_CLOSED'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_mom_growth_pct":{"lt":0}}', 'warning', 'Revenue declined by {{revenue_mom_growth_pct}} compared to last month.'
FROM cfo_questions WHERE code = 'REV_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_mom_growth_pct":{"gte":0}}', 'good', 'Revenue increased by {{revenue_mom_growth_pct}} compared to last month.'
FROM cfo_questions WHERE code = 'REV_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_avg_3m":{"gte":0}}', 'good', '3M average revenue is ₹{{revenue_avg_3m}}.'
FROM cfo_questions WHERE code = 'REV_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_avg_6m":{"gte":0}}', 'good', '6M average revenue is ₹{{revenue_avg_6m}}.'
FROM cfo_questions WHERE code = 'REV_AVG_6M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_avg_12m":{"gte":0}}', 'good', '12M average revenue is ₹{{revenue_avg_12m}}.'
FROM cfo_questions WHERE code = 'REV_AVG_12M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_trend_direction":{"gt":0}}', 'good', 'Revenue trend is improving over the last 3 months.'
FROM cfo_questions WHERE code = 'REV_TREND_DIRECTION'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_trend_direction":{"lt":0}}', 'warning', 'Revenue trend is declining over the last 3 months.'
FROM cfo_questions WHERE code = 'REV_TREND_DIRECTION'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_volatility":{"gt":0.2}}', 'warning', 'Revenue volatility is high ({{revenue_volatility}}).'
FROM cfo_questions WHERE code = 'REV_VOLATILITY'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_stagnation_flag":{"eq":1}}', 'warning', 'Revenue appears flat over the last 3 months.'
FROM cfo_questions WHERE code = 'REV_STAGNATION'
ON CONFLICT DO NOTHING;

-- Expense control
INSERT INTO cfo_questions (code, title, category, description) VALUES
('EXP_LATEST_CLOSED', 'Latest closed month expenses', 'expense', 'Expenses for latest closed month'),
('EXP_MOM_GROWTH', 'Month-over-month expense growth', 'expense', 'MoM expense change'),
('EXP_AVG_3M', '3M average expenses', 'expense', 'Average expenses over 3 closed months'),
('EXP_VS_REV_GROWTH', 'Expenses growing faster than revenue', 'expense', 'Expense vs revenue growth gap')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expenses_last_closed', 'last_closed_month' FROM cfo_questions WHERE code = 'EXP_LATEST_CLOSED'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expense_mom_growth_pct', 'mom' FROM cfo_questions WHERE code = 'EXP_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expense_avg_3m', '3m' FROM cfo_questions WHERE code = 'EXP_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expense_vs_revenue_growth_gap', '3m' FROM cfo_questions WHERE code = 'EXP_VS_REV_GROWTH'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expenses_last_closed":{"gte":0}}', 'good', 'Latest closed month expenses are ₹{{expenses_last_closed}}.'
FROM cfo_questions WHERE code = 'EXP_LATEST_CLOSED'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_mom_growth_pct":{"gt":0}}', 'warning', 'Expenses increased by {{expense_mom_growth_pct}} compared to last month.'
FROM cfo_questions WHERE code = 'EXP_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_mom_growth_pct":{"lte":0}}', 'good', 'Expenses decreased by {{expense_mom_growth_pct}} compared to last month.'
FROM cfo_questions WHERE code = 'EXP_MOM_GROWTH'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_avg_3m":{"gte":0}}', 'good', '3M average expenses are ₹{{expense_avg_3m}}.'
FROM cfo_questions WHERE code = 'EXP_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_vs_revenue_growth_gap":{"gt":0.05}}', 'warning', 'Expenses are growing faster than revenue. Gap: {{expense_vs_revenue_growth_gap}}.'
FROM cfo_questions WHERE code = 'EXP_VS_REV_GROWTH'
ON CONFLICT DO NOTHING;

-- Profitability
INSERT INTO cfo_questions (code, title, category, description) VALUES
('PROFIT_LATEST', 'Latest closed month net profit', 'profitability', 'Net profit for latest closed month'),
('PROFIT_AVG_3M', '3M average net profit', 'profitability', 'Average net profit over 3 closed months'),
('MARGIN_LATEST', 'Latest net margin', 'profitability', 'Net margin for latest closed month'),
('MARGIN_MOM', 'Net margin change month over month', 'profitability', 'MoM margin change')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_profit_last_closed', 'last_closed_month' FROM cfo_questions WHERE code = 'PROFIT_LATEST'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_profit_avg_3m', '3m' FROM cfo_questions WHERE code = 'PROFIT_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_margin_last_closed', 'last_closed_month' FROM cfo_questions WHERE code = 'MARGIN_LATEST'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_margin_mom_change', 'mom' FROM cfo_questions WHERE code = 'MARGIN_MOM'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_last_closed":{"gte":0}}', 'good', 'Latest closed month net profit is ₹{{net_profit_last_closed}}.'
FROM cfo_questions WHERE code = 'PROFIT_LATEST'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_avg_3m":{"gte":0}}', 'good', '3M average net profit is ₹{{net_profit_avg_3m}}.'
FROM cfo_questions WHERE code = 'PROFIT_AVG_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_margin_last_closed":{"gte":0}}', 'good', 'Latest net margin is {{net_margin_last_closed}}.'
FROM cfo_questions WHERE code = 'MARGIN_LATEST'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_margin_mom_change":{"lt":0}}', 'warning', 'Net margin declined by {{net_margin_mom_change}} compared to last month.'
FROM cfo_questions WHERE code = 'MARGIN_MOM'
ON CONFLICT DO NOTHING;

-- Cash & runway
INSERT INTO cfo_questions (code, title, category, description) VALUES
('CASH_BALANCE_LIVE', 'Current cash and bank balance', 'cash', 'Live cash balance'),
('NET_CASHFLOW_3M', '3M average net cashflow', 'cash', 'Average net cashflow over 3 closed months'),
('RUNWAY_CHANGE', 'Cash runway change month over month', 'cash', 'MoM runway change')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_balance_live', 'live' FROM cfo_questions WHERE code = 'CASH_BALANCE_LIVE'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'avg_net_cash_outflow_3m', '3m' FROM cfo_questions WHERE code = 'NET_CASHFLOW_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_runway_change_mom', 'mom' FROM cfo_questions WHERE code = 'RUNWAY_CHANGE'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_balance_live":{"gte":0}}', 'good', 'Current cash and bank balance is ₹{{cash_balance_live}}.'
FROM cfo_questions WHERE code = 'CASH_BALANCE_LIVE'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"avg_net_cash_outflow_3m":{"gte":0}}', 'good', '3M average net cashflow is ₹{{avg_net_cash_outflow_3m}}.'
FROM cfo_questions WHERE code = 'NET_CASHFLOW_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_change_mom":{"lt":0}}', 'warning', 'Cash runway declined by {{cash_runway_change_mom}} months compared to last month.'
FROM cfo_questions WHERE code = 'RUNWAY_CHANGE'
ON CONFLICT DO NOTHING;

-- Debtors / receivables
INSERT INTO cfo_questions (code, title, category, description) VALUES
('DEBTORS_TOTAL', 'Total debtor balance', 'debtors', 'Live debtor balance'),
('DEBTORS_MOM', 'Debtor balance MoM change', 'debtors', 'MoM debtor change'),
('DEBTOR_DAYS_Q', 'Debtor days', 'debtors', 'Receivable days estimate')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtors_balance_live', 'live' FROM cfo_questions WHERE code = 'DEBTORS_TOTAL'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtor_balance_mom_change', 'mom' FROM cfo_questions WHERE code = 'DEBTORS_MOM'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtor_days', '3m' FROM cfo_questions WHERE code = 'DEBTOR_DAYS_Q'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtors_balance_live":{"gte":0}}', 'good', 'Total debtor balance is ₹{{debtors_balance_live}}.'
FROM cfo_questions WHERE code = 'DEBTORS_TOTAL'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtor_balance_mom_change":{"gt":0}}', 'warning', 'Debtor balance increased by ₹{{debtor_balance_mom_change}} compared to last month.'
FROM cfo_questions WHERE code = 'DEBTORS_MOM'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtor_days":{"gte":0}}', 'good', 'Debtor days are approximately {{debtor_days}} days.'
FROM cfo_questions WHERE code = 'DEBTOR_DAYS_Q'
ON CONFLICT DO NOTHING;

-- Creditors / payables
INSERT INTO cfo_questions (code, title, category, description) VALUES
('CREDITORS_TOTAL', 'Total creditor balance', 'creditors', 'Live creditor balance'),
('CREDITORS_MOM', 'Creditor balance MoM change', 'creditors', 'MoM creditor change'),
('CREDITOR_DAYS_Q', 'Creditor days', 'creditors', 'Payable days estimate')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'creditors_balance_live', 'live' FROM cfo_questions WHERE code = 'CREDITORS_TOTAL'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'creditor_balance_mom_change', 'mom' FROM cfo_questions WHERE code = 'CREDITORS_MOM'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'creditor_days', '3m' FROM cfo_questions WHERE code = 'CREDITOR_DAYS_Q'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditors_balance_live":{"gte":0}}', 'good', 'Total creditor balance is ₹{{creditors_balance_live}}.'
FROM cfo_questions WHERE code = 'CREDITORS_TOTAL'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditor_balance_mom_change":{"gt":0}}', 'warning', 'Creditor balance increased by ₹{{creditor_balance_mom_change}} compared to last month.'
FROM cfo_questions WHERE code = 'CREDITORS_MOM'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditor_days":{"gte":0}}', 'good', 'Creditor days are approximately {{creditor_days}} days.'
FROM cfo_questions WHERE code = 'CREDITOR_DAYS_Q'
ON CONFLICT DO NOTHING;

-- Working capital & strategic
INSERT INTO cfo_questions (code, title, category, description) VALUES
('WORKING_CAPITAL_Q', 'Working capital level', 'working_capital', 'Working capital health'),
('CASH_CONVERSION_Q', 'Cash conversion cycle', 'working_capital', 'Cash conversion cycle estimate'),
('BUSINESS_SAFETY_Q', 'Is the business financially safe?', 'strategic', 'Safety based on runway')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'working_capital', 'live' FROM cfo_questions WHERE code = 'WORKING_CAPITAL_Q'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_conversion_cycle', '3m' FROM cfo_questions WHERE code = 'CASH_CONVERSION_Q'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_runway_months', 'live' FROM cfo_questions WHERE code = 'BUSINESS_SAFETY_Q'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"working_capital":{"gte":0}}', 'good', 'Working capital is ₹{{working_capital}}.'
FROM cfo_questions WHERE code = 'WORKING_CAPITAL_Q'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_conversion_cycle":{"gte":0}}', 'good', 'Cash conversion cycle is {{cash_conversion_cycle}} days.'
FROM cfo_questions WHERE code = 'CASH_CONVERSION_Q'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_months":{"lt":3}}', 'warning', 'Cash runway is below 3 months.'
FROM cfo_questions WHERE code = 'BUSINESS_SAFETY_Q'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_months":{"gte":3}}', 'good', 'Cash runway is {{cash_runway_months}} months.'
FROM cfo_questions WHERE code = 'BUSINESS_SAFETY_Q'
ON CONFLICT DO NOTHING;
