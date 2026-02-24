const { Company, CompanySubscription, Subscription } = require('../models');
const {
  planKeyFromCode,
  planKeyFromLegacyPlanType,
  getCaps,
  PLAN_CAPS,
  PLAN_KEYS,
} = require('../config/plans');

const PLAN_ORDER = { TRIAL: 0, STARTER: 1, PRO: 2, ENTERPRISE: 3 };

/**
 * Resolve current plan for a company.
 * Uses CompanySubscription if present, else legacy Subscription; default TRIAL.
 * @param {string} companyId
 * @returns {Promise<{ planKey: string, caps: object, status: string, trialEndsAt: Date|null }>}
 */
async function getCompanyPlan(companyId) {
  const defaultResult = {
    planKey: 'TRIAL',
    caps: PLAN_CAPS.TRIAL,
    status: 'trialing',
    trialEndsAt: null,
  };

  const billingSub = await CompanySubscription.findOne({
    where: { companyId },
    order: [['updatedAt', 'DESC']],
    raw: true,
  });

  if (billingSub) {
    const planKey = planKeyFromCode(billingSub.plan_code);
    return {
      planKey,
      caps: getCaps(planKey),
      status: billingSub.status || 'trialing',
      trialEndsAt: billingSub.trial_ends_at || null,
    };
  }

  const legacySub = await Subscription.findOne({
    where: { companyId },
    attributes: ['planType', 'subscriptionStatus', 'trialEndDate'],
    raw: true,
  });

  if (legacySub) {
    const planKey = planKeyFromLegacyPlanType(legacySub.planType);
    const status =
      legacySub.subscriptionStatus === 'trial' || legacySub.subscriptionStatus === 'active'
        ? legacySub.subscriptionStatus === 'trial'
          ? 'trialing'
          : 'active'
        : 'canceled';
    return {
      planKey,
      caps: getCaps(planKey),
      status,
      trialEndsAt: legacySub.trialEndDate || null,
    };
  }

  return defaultResult;
}

/**
 * Get the best plan among all companies owned by the user (for company-limit enforcement).
 * @param {string} userId
 * @returns {Promise<{ planKey: string, caps: object, companyCount: number }>}
 */
async function getEffectivePlanForUser(userId) {
  const companies = await Company.findAll({
    where: { ownerId: userId, isDeleted: false },
    attributes: ['id'],
    raw: true,
  });
  const companyCount = companies.length;

  let bestKey = 'TRIAL';
  for (const c of companies) {
    const { planKey } = await getCompanyPlan(c.id);
    if (PLAN_ORDER[planKey] > PLAN_ORDER[bestKey]) {
      bestKey = planKey;
    }
  }

  return {
    planKey: bestKey,
    caps: getCaps(bestKey),
    companyCount,
  };
}

module.exports = {
  getCompanyPlan,
  getEffectivePlanForUser,
  PLAN_KEYS,
  PLAN_CAPS,
  getCaps,
};
