const { Subscription, CompanySubscription, Company, UserBillingProfile, sequelize } = require('../models');
const { logger } = require('../utils/logger');

const TRIAL_DAYS = 30;

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const createTrialSubscription = async (companyId) => {
  const now = new Date();
  const trialEnd = addDays(now, TRIAL_DAYS);

  const subscription = await Subscription.create({
    companyId,
    planType: 'FREE',
    status: 'ACTIVE',
    subscriptionStatus: 'trial',
    trialStartDate: now,
    trialEndDate: trialEnd,
    accountLocked: false,
    maxTransactions: 100,
    maxIntegrations: 10,
    features: {
      aiInsights: true,
      aiChat: true,
      tally: true,
      zoho: true,
      quickbooks: true,
      alerts: true,
      exports: true
    }
  });

  logger.info({ companyId, trialEnd: trialEnd.toISOString() }, 'Trial subscription created (legacy)');
  return subscription;
};

const getSubscription = async (companyId) => {
  return Subscription.findOne({ where: { companyId } });
};

const ensureSubscription = async (companyId) => {
  const existing = await getSubscription(companyId);
  if (existing) {
    const updates = {};
    if (!existing.subscriptionStatus) {
      updates.subscriptionStatus = existing.planType && existing.planType !== 'FREE' ? 'active' : 'expired';
    }

    if (updates.subscriptionStatus === 'trial' || existing.subscriptionStatus === 'trial') {
      if (!existing.trialStartDate) {
        updates.trialStartDate = new Date();
      }
      if (!existing.trialEndDate) {
        updates.trialEndDate = addDays(updates.trialStartDate || existing.trialStartDate || new Date(), TRIAL_DAYS);
      }
      if (existing.accountLocked === null || existing.accountLocked === undefined) {
        updates.accountLocked = false;
      }
    }

    if ((existing.planType && existing.planType !== 'FREE') && existing.subscriptionStatus !== 'active') {
      updates.subscriptionStatus = 'active';
      updates.accountLocked = false;
    }

    if (Object.keys(updates).length > 0) {
      await existing.update(updates);
    }
    return existing.reload();
  }
  return createTrialSubscription(companyId);
};

const lockExpiredTrialIfNeeded = async (subscription) => {
  if (!subscription) return null;

  if (subscription.subscriptionStatus === 'trial' && subscription.trialEndDate) {
    const now = new Date();
    if (now > subscription.trialEndDate) {
      await subscription.update({
        subscriptionStatus: 'expired',
        accountLocked: true
      });
      logger.info({ companyId: subscription.companyId }, 'Trial expired and locked');
      return subscription.reload();
    }
  }

  return subscription;
};

const resolveUserIdForAccess = async (companyId, userId) => {
  if (userId) return userId;
  const company = await Company.findByPk(companyId, { attributes: ['ownerId'] });
  return company?.ownerId || null;
};

const getUserTrialState = async (userId) => {
  if (!userId) {
    return { active: false, hasProfile: false, profile: null };
  }
  const profile = await UserBillingProfile.findOne({ where: { userId } });
  const active = Boolean(profile?.trialEndsAt && new Date(profile.trialEndsAt) > new Date());
  return { active, hasProfile: Boolean(profile), profile };
};

const backfillUserTrialProfileFromLegacy = async (userId, legacySubscription) => {
  if (!userId || !legacySubscription) return null;
  if (legacySubscription.subscriptionStatus !== 'trial' || !legacySubscription.trialEndDate || legacySubscription.accountLocked) {
    return null;
  }
  const now = new Date();
  if (now > new Date(legacySubscription.trialEndDate)) return null;
  return UserBillingProfile.create({
    userId,
    trialStartedAt: legacySubscription.trialStartDate || now,
    trialEndsAt: legacySubscription.trialEndDate,
    hasUsedTrial: true
  });
};

const checkAccess = async (companyId, userId = null) => {
  const resolvedUserId = await resolveUserIdForAccess(companyId, userId);
  let trialState = await getUserTrialState(resolvedUserId);

  const latestBillingSub = await CompanySubscription.findOne({
    where: { companyId },
    order: [['updatedAt', 'DESC']]
  });

  if (latestBillingSub) {
    if (latestBillingSub.status === 'active') {
      return { allowed: true };
    }
    if (latestBillingSub.status === 'trialing' && trialState.active) {
      return { allowed: true };
    }
    if (trialState.active) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: latestBillingSub.status === 'past_due'
        ? 'Billing is past due. Please update payment method.'
        : 'Subscription is canceled. Please subscribe to continue.'
    };
  }

  const subscription = await ensureSubscription(companyId);
  const updated = await lockExpiredTrialIfNeeded(subscription);

  if (!trialState.hasProfile) {
    await backfillUserTrialProfileFromLegacy(resolvedUserId, updated);
    trialState = await getUserTrialState(resolvedUserId);
  }

  if (trialState.active) {
    return { allowed: true };
  }

  // Legacy fallback: only active paid status should pass if no user-level trial is active.
  if (updated.subscriptionStatus === 'active' && !updated.accountLocked) {
    return { allowed: true };
  }

  if (updated.accountLocked || updated.subscriptionStatus === 'expired') {
    return {
      allowed: false,
      reason: 'Your free trial has expired. Please upgrade.'
    };
  }

  return {
    allowed: false,
    reason: 'Your free trial has expired. Please upgrade.'
  };
};

const assertTrialOrActive = async (companyId) => {
  const subscription = await ensureSubscription(companyId);
  const updated = await lockExpiredTrialIfNeeded(subscription);
  if (updated.accountLocked || updated.subscriptionStatus === 'expired') {
    throw new Error('Your free trial has expired. Please upgrade.');
  }
  return updated;
};

const getStatus = async (companyId, userId = null) => {
  const subscription = await ensureSubscription(companyId);
  const updated = await lockExpiredTrialIfNeeded(subscription);
  const resolvedUserId = await resolveUserIdForAccess(companyId, userId);
  const trialState = await getUserTrialState(resolvedUserId);

  const now = new Date();
  const effectiveTrialEndDate = trialState.active
    ? trialState.profile?.trialEndsAt
    : updated.trialEndDate;
  const trialEndsInDays = effectiveTrialEndDate
    ? Math.max(
        0,
        Math.ceil((new Date(effectiveTrialEndDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      )
    : null;
  const effectiveStatus = trialState.active ? 'trial' : updated.subscriptionStatus;

  return {
    status: effectiveStatus,
    trialEndDate: effectiveTrialEndDate,
    trialEndsInDays,
    accountLocked: trialState.active ? false : updated.accountLocked
  };
};

const lockExpiredTrials = async () => {
  const result = await sequelize.query(
    `UPDATE subscriptions
     SET account_locked = true,
         subscription_status = 'expired',
         updated_at = NOW()
     WHERE trial_end_date < NOW()
       AND subscription_status = 'trial'`
  );
  logger.info('Lock expired trials job executed');
  return result;
};

module.exports = {
  createTrialSubscription,
  getSubscription,
  ensureSubscription,
  checkAccess,
  getStatus,
  lockExpiredTrials,
  assertTrialOrActive
};
