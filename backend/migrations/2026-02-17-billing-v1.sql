CREATE TABLE IF NOT EXISTS billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  interval TEXT NOT NULL DEFAULT 'month',
  features_json JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  plan_code TEXT NOT NULL REFERENCES billing_plans(code),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled')),
  trial_ends_at TIMESTAMP NULL,
  current_period_start TIMESTAMP NULL,
  current_period_end TIMESTAMP NULL,
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_customer_id TEXT NULL,
  gateway_subscription_id TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS company_subscriptions_company_idx
  ON company_subscriptions(company_id);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  invoice_no TEXT UNIQUE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount INTEGER NOT NULL,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('issued', 'paid', 'void')),
  issued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMP NULL,
  gateway TEXT NOT NULL DEFAULT 'razorpay',
  gateway_payment_id TEXT NULL,
  gateway_invoice_id TEXT NULL,
  meta_json JSONB NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS invoices_company_issued_idx
  ON invoices(company_id, issued_at DESC);

CREATE TABLE IF NOT EXISTS usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  day DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, day)
);

INSERT INTO billing_plans (code, name, price_amount, currency, interval, features_json)
VALUES (
  'starter_5000',
  'Starter ₹5,000/month',
  500000,
  'INR',
  'month',
  '{"users":"unlimited","integrations":"all","ai":"enabled"}'::jsonb
)
ON CONFLICT (code) DO NOTHING;
