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

    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').optional(),

    REDIS_URL: z.string().url().optional(),
    QUEUE_RESILIENT_MODE: boolStr.default('false'),

    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    FRONTEND_URL: z.string().optional(),
    CORS_ORIGIN: z.string().optional(),

    ENFORCE_COMPANY_LIMITS: boolStr.default('false'),
    ENFORCE_USAGE_LIMITS: boolStr.default('false'),

    OPENAI_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    GIT_SHA: z.string().optional(),
    WORKER_CONCURRENCY: z.coerce.number().int().positive().default(4),
    ALLOW_SEQUELIZE_SYNC: boolStr.default('false'),
    DISABLE_WORKER: boolStr.default('false'),

    DB_SSL: boolStr.default('false'),
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
  return _env;
}

module.exports = { loadEnv, envSchema: schema };
