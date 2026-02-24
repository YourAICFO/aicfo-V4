/**
 * Single source of truth for plan capabilities.
 * Map BillingPlan.code / CompanySubscription.planCode to these keys.
 */

const PLAN_KEYS = ['TRIAL', 'STARTER', 'PRO', 'ENTERPRISE'];

const PLAN_CAPS = {
  TRIAL: {
    companyLimit: 1,
    aiExplanationLimit: 10,
    aiChatLimit: 50,
    reports: true,
    reportDownloadLimit: 10,
  },
  STARTER: {
    companyLimit: 1,
    aiExplanationLimit: 30,
    aiChatLimit: 200,
    reports: true,
    reportDownloadLimit: 30,
  },
  PRO: {
    companyLimit: 5,
    aiExplanationLimit: 200,
    aiChatLimit: 1000,
    reports: true,
    reportDownloadLimit: 200,
  },
  ENTERPRISE: {
    companyLimit: 999,
    aiExplanationLimit: 99999,
    aiChatLimit: 99999,
    reports: true,
    reportDownloadLimit: 99999,
  },
};

/**
 * Map BillingPlan.code or CompanySubscription.planCode to PLAN_CAPS key.
 * Unknown codes default to TRIAL.
 */
const CODE_TO_PLAN_KEY = {
  // Billing plans (billing_plans.code)
  starter_5000: 'STARTER',
  starter: 'STARTER',
  pro: 'PRO',
  professional: 'PRO',
  enterprise: 'ENTERPRISE',
};

/**
 * Map legacy Subscription.planType to PLAN_CAPS key.
 */
const LEGACY_PLAN_TYPE_TO_KEY = {
  FREE: 'TRIAL',
  STARTER: 'STARTER',
  PROFESSIONAL: 'PRO',
  ENTERPRISE: 'ENTERPRISE',
};

function planKeyFromCode(code) {
  if (!code || typeof code !== 'string') return 'TRIAL';
  const normalized = code.trim().toLowerCase().replace(/-/g, '_');
  return CODE_TO_PLAN_KEY[normalized] || CODE_TO_PLAN_KEY[normalized.replace(/\d+/g, '')] || 'TRIAL';
}

function planKeyFromLegacyPlanType(planType) {
  if (!planType) return 'TRIAL';
  return LEGACY_PLAN_TYPE_TO_KEY[planType] || 'TRIAL';
}

function getCaps(planKey) {
  return PLAN_CAPS[planKey] || PLAN_CAPS.TRIAL;
}

module.exports = {
  PLAN_KEYS,
  PLAN_CAPS,
  CODE_TO_PLAN_KEY,
  LEGACY_PLAN_TYPE_TO_KEY,
  planKeyFromCode,
  planKeyFromLegacyPlanType,
  getCaps,
};
