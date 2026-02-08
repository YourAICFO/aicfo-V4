CREATE TABLE IF NOT EXISTS cfo_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfo_question_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES cfo_questions(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  time_scope TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfo_question_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES cfo_questions(id) ON DELETE CASCADE,
  condition JSONB NOT NULL,
  severity TEXT NOT NULL,
  insight_template TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cfo_question_results (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES cfo_questions(id) ON DELETE CASCADE,
  severity TEXT NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, question_id)
);

CREATE INDEX IF NOT EXISTS cfo_questions_code_idx ON cfo_questions(code);
CREATE INDEX IF NOT EXISTS cfo_question_metrics_question_id_idx ON cfo_question_metrics(question_id);
CREATE INDEX IF NOT EXISTS cfo_question_rules_question_id_idx ON cfo_question_rules(question_id);
CREATE UNIQUE INDEX IF NOT EXISTS cfo_question_metrics_unique_idx ON cfo_question_metrics(question_id, metric_key, time_scope);
CREATE UNIQUE INDEX IF NOT EXISTS cfo_question_rules_unique_idx ON cfo_question_rules(question_id, severity, insight_template);

-- Seed core questions
INSERT INTO cfo_questions (code, title, category, description)
VALUES
  ('CASH_RUNWAY_STATUS', 'Is my cash runway healthy?', 'cash', 'Assess runway based on live cash and 3M net cashflow'),
  ('PROFITABILITY_STATUS', 'Is profitability improving?', 'profitability', 'Evaluate latest closed month net profit'),
  ('REVENUE_GROWTH_3M', 'Is revenue growing over 3 months?', 'growth', '3M revenue trend vs prior 3M'),
  ('EXPENSE_GROWTH_3M', 'Are expenses rising too fast?', 'risk', '3M expense trend vs prior 3M'),
  ('DEBTORS_CONCENTRATION', 'Is debtor concentration risky?', 'debtors', 'Top debtor concentration risk'),
  ('CREDITORS_PRESSURE', 'Are creditors creating cash pressure?', 'creditors', 'Payables vs current cash'),
  ('DEBTORS_VS_REVENUE', 'Are debtors rising faster than revenue?', 'debtors', 'Receivables growth vs revenue growth')
ON CONFLICT (code) DO NOTHING;

-- Metrics mapping
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_runway_months', 'live' FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'cash_balance_live', 'live' FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'avg_net_cash_outflow_3m', '3m' FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'net_profit_last_closed', 'last_closed_month' FROM cfo_questions WHERE code = 'PROFITABILITY_STATUS'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'revenue_growth_3m', '3m' FROM cfo_questions WHERE code = 'REVENUE_GROWTH_3M'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'expense_growth_3m', '3m' FROM cfo_questions WHERE code = 'EXPENSE_GROWTH_3M'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtors_concentration_ratio', 'live' FROM cfo_questions WHERE code = 'DEBTORS_CONCENTRATION'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'creditors_cash_pressure', 'live' FROM cfo_questions WHERE code = 'CREDITORS_PRESSURE'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_metrics (question_id, metric_key, time_scope)
SELECT id, 'debtors_revenue_divergence', 'last_closed_month' FROM cfo_questions WHERE code = 'DEBTORS_VS_REVENUE'
ON CONFLICT DO NOTHING;

-- Rules
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_months":{"lt":3}}', 'critical', 'Your cash runway is {{cash_runway_months}} months, which is critically low. Current cash is ₹{{cash_balance_live}} and average net cash outflow is ₹{{avg_net_cash_outflow_3m}}.'
FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_months":{"lt":6}}', 'warning', 'Your cash runway is {{cash_runway_months}} months, which needs attention. Current cash is ₹{{cash_balance_live}} and average net cash outflow is ₹{{avg_net_cash_outflow_3m}}.'
FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"cash_runway_months":{"gte":6}}', 'good', 'Your cash runway is {{cash_runway_months}} months, which is healthy. Current cash is ₹{{cash_balance_live}}.'
FROM cfo_questions WHERE code = 'CASH_RUNWAY_STATUS'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_last_closed":{"lt":0}}', 'warning', 'Your latest closed month shows a net loss of ₹{{net_profit_last_closed}}. Review expenses and pricing.'
FROM cfo_questions WHERE code = 'PROFITABILITY_STATUS'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"net_profit_last_closed":{"gte":0}}', 'good', 'Your latest closed month shows a net profit of ₹{{net_profit_last_closed}}.'
FROM cfo_questions WHERE code = 'PROFITABILITY_STATUS'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_growth_3m":{"lt":0}}', 'warning', 'Revenue is declining over the last 3 closed months ({{revenue_growth_3m}}%).'
FROM cfo_questions WHERE code = 'REVENUE_GROWTH_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"revenue_growth_3m":{"gte":0}}', 'good', 'Revenue is growing over the last 3 closed months ({{revenue_growth_3m}}%).'
FROM cfo_questions WHERE code = 'REVENUE_GROWTH_3M'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_growth_3m":{"gt":0.15}}', 'warning', 'Expenses are rising faster than expected over the last 3 closed months ({{expense_growth_3m}}%).'
FROM cfo_questions WHERE code = 'EXPENSE_GROWTH_3M'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"expense_growth_3m":{"lte":0.15}}', 'good', 'Expense growth is within acceptable limits ({{expense_growth_3m}}%).'
FROM cfo_questions WHERE code = 'EXPENSE_GROWTH_3M'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtors_concentration_ratio":{"gt":0.5}}', 'warning', 'More than 50% of receivables are concentrated in top debtors ({{debtors_concentration_ratio}}).'
FROM cfo_questions WHERE code = 'DEBTORS_CONCENTRATION'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtors_concentration_ratio":{"lte":0.5}}', 'good', 'Receivables concentration is within a healthy range ({{debtors_concentration_ratio}}).'
FROM cfo_questions WHERE code = 'DEBTORS_CONCENTRATION'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditors_cash_pressure":{"eq":true}}', 'warning', 'Creditors outstanding exceed current cash balance, creating near-term pressure.'
FROM cfo_questions WHERE code = 'CREDITORS_PRESSURE'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"creditors_cash_pressure":{"eq":false}}', 'good', 'Current cash appears sufficient relative to creditors outstanding.'
FROM cfo_questions WHERE code = 'CREDITORS_PRESSURE'
ON CONFLICT DO NOTHING;

INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtors_revenue_divergence":{"eq":true}}', 'warning', 'Debtors are rising faster than revenue. This can strain cash collections.'
FROM cfo_questions WHERE code = 'DEBTORS_VS_REVENUE'
ON CONFLICT DO NOTHING;
INSERT INTO cfo_question_rules (question_id, condition, severity, insight_template)
SELECT id, '{"debtors_revenue_divergence":{"eq":false}}', 'good', 'Debtors growth is aligned with revenue growth.'
FROM cfo_questions WHERE code = 'DEBTORS_VS_REVENUE'
ON CONFLICT DO NOTHING;
