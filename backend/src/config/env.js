'use strict';

require('dotenv').config();
const { z } = require('zod');

const boolStr = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'staging', 'production'])
      .default('development'),

    PORT: z.coerce.number().int().positive().default(5000),

    // ── Database ──
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').optional(),
    DB_SSL: boolStr.default('false'),

    // ── Redis / Queue ──
    REDIS_URL: z.string().optional(),
    QUEUE_RESILIENT_MODE: boolStr.default('false'),
    WORKER_QUEUE_NAME: z.string().default('ai-cfo-jobs'),

    // ── Auth (required — no fallback) ──
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    // ── CORS ──
    ALLOWED_ORIGINS: z.string().optional(),

    // ── Feature flags ──
    ENFORCE_COMPANY_LIMITS: boolStr.default('false'),
    ENFORCE_USAGE_LIMITS: boolStr.default('false'),
    ALLOW_SEQUELIZE_SYNC: boolStr.default('false'),
    DISABLE_WORKER: boolStr.default('false'),
    ENABLE_CONNECTOR_DEV_ROUTES: boolStr.default('false'),

    // ── AI (optional — degrades gracefully) ──
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),

    // ── Observability (optional) ──
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    GIT_SHA: z.string().optional(),

    // ── Worker ──
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),

    // ── Billing (optional — warns if missing in prod) ──
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // ── Admin ──
    ADMIN_EMAILS: z.string().optional(),
    ADMIN_API_KEY: z.string().optional(),

    // ── Connector ──
    CONNECTOR_DOWNLOAD_URL: z.string().optional(),

    // ── Deprecated / unused (kept for .env.example compat) ──
    FRONTEND_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV !== 'test' && !data.DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL is required when NODE_ENV is not "test"',
      });
    }

    const isProdLike = data.NODE_ENV === 'staging' || data.NODE_ENV === 'production';

    if (isProdLike && !data.REDIS_URL && !data.QUEUE_RESILIENT_MODE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['REDIS_URL'],
        message:
          'REDIS_URL is required in staging/production unless QUEUE_RESILIENT_MODE=true',
      });
    }

    if (isProdLike && !data.ALLOWED_ORIGINS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ALLOWED_ORIGINS'],
        message:
          'ALLOWED_ORIGINS should be set in staging/production (comma-separated list of allowed CORS origins)',
      });
    }
  });

let _env;

function loadEnv() {
  if (_env) return _env;

  const result = schema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`
    );
    console.error('');
    console.error('╔══════════════════════════════════════════════╗');
    console.error('║  ENVIRONMENT VALIDATION FAILED — ABORTING    ║');
    console.error('╚══════════════════════════════════════════════╝');
    console.error('');
    console.error('Missing or invalid environment variables:');
    console.error(issues.join('\n'));
    console.error('');
    console.error('Hint: copy backend/.env.example → backend/.env and fill in values.');
    console.error('');
    process.exit(1);
  }

  _env = Object.freeze(result.data);

  // Runtime warnings for optional-but-important vars in production
  const isProdLike = _env.NODE_ENV === 'staging' || _env.NODE_ENV === 'production';
  if (isProdLike) {
    const warnings = [];
    if (!_env.SENTRY_DSN) warnings.push('SENTRY_DSN not set — error tracking disabled');
    if (!_env.OPENAI_API_KEY) warnings.push('OPENAI_API_KEY not set — AI features will degrade');
    if (!_env.RAZORPAY_KEY_ID) warnings.push('RAZORPAY_KEY_ID not set — billing endpoints will fail');
    if (!_env.ADMIN_EMAILS) warnings.push('ADMIN_EMAILS not set — admin access disabled');
    if (warnings.length > 0) {
      console.warn('');
      console.warn('⚠  Environment warnings (non-fatal):');
      warnings.forEach((w) => console.warn(`   - ${w}`));
      console.warn('');
    }
  }

  return _env;
}

module.exports = { loadEnv, envSchema: schema };
