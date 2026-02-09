INSERT INTO cfo_questions (code, title, category, description)
VALUES
  ('REVENUE_YOY_TREND', 'How has revenue changed compared to the same month last year?', 'growth', 'Year-over-year revenue change'),
  ('EXPENSE_YOY_TREND', 'Have expenses increased or decreased compared to last year?', 'risk', 'Year-over-year expense change'),
  ('PROFIT_YOY_TREND', 'Is profit improving or declining compared to last year?', 'profitability', 'Year-over-year net profit change'),
  ('DEBTOR_YOY_TREND', 'How has debtor balance changed Year-over-Year?', 'debtors', 'YoY debtor balance change'),
  ('CREDITOR_YOY_TREND', 'How has creditor balance changed Year-over-Year?', 'creditors', 'YoY creditor balance change')
ON CONFLICT (code) DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_yoy_growth_pct', 'yoy' FROM cfo_questions WHERE code = 'REVENUE_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expense_yoy_growth_pct', 'yoy' FROM cfo_questions WHERE code = 'EXPENSE_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_profit_yoy_growth_pct', 'yoy' FROM cfo_questions WHERE code = 'PROFIT_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtor_balance_yoy_change', 'yoy' FROM cfo_questions WHERE code = 'DEBTOR_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'creditor_balance_yoy_change', 'yoy' FROM cfo_questions WHERE code = 'CREDITOR_YOY_TREND'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_yoy_growth_pct":{"lt":0}}', 'warning', 'Revenue for {{month}} declined by {{revenue_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'REVENUE_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_yoy_growth_pct":{"gte":0}}', 'good', 'Revenue for {{month}} increased by {{revenue_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'REVENUE_YOY_TREND'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_yoy_growth_pct":{"gt":0}}', 'warning', 'Expenses for {{month}} increased by {{expense_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'EXPENSE_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_yoy_growth_pct":{"lte":0}}', 'good', 'Expenses for {{month}} decreased by {{expense_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'EXPENSE_YOY_TREND'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_yoy_growth_pct":{"lt":0}}', 'warning', 'Net profit for {{month}} declined by {{net_profit_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'PROFIT_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_yoy_growth_pct":{"gte":0}}', 'good', 'Net profit for {{month}} increased by {{net_profit_yoy_growth_pct}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'PROFIT_YOY_TREND'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtor_balance_yoy_change":{"lt":0}}', 'good', 'Debtor balances reduced by ₹{{debtor_balance_yoy_change}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'DEBTOR_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtor_balance_yoy_change":{"gte":0}}', 'warning', 'Debtor balances increased by ₹{{debtor_balance_yoy_change}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'DEBTOR_YOY_TREND'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditor_balance_yoy_change":{"lt":0}}', 'good', 'Creditor balances reduced by ₹{{creditor_balance_yoy_change}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'CREDITOR_YOY_TREND'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditor_balance_yoy_change":{"gte":0}}', 'warning', 'Creditor balances increased by ₹{{creditor_balance_yoy_change}} compared to {{month_last_year}}.'
FROM cfo_questions WHERE code = 'CREDITOR_YOY_TREND'
ON CONFLICT DO NOTHING;
