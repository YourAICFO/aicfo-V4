const { Subscription, CompanySubscription, Company, UserBillingProfile, sequelize } = require('../models');

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

  console.log(`[trial] created for company=${companyId} ends=${trialEnd.toISOString()}`);
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
      console.log(`[trial] expired company=${subscription.companyId}`);
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

const isUserTrialActive = async (userId) => {
  if (!userId) return false;
  const profile = await UserBillingProfile.findOne({ where: { userId } });
  if (!profile?.trialEndsAt) return false;
  return new Date(profile.trialEndsAt) > new Date();
};

const checkAccess = async (companyId, userId = null) => {
  const resolvedUserId = await resolveUserIdForAccess(companyId, userId);
  const trialActive = await isUserTrialActive(resolvedUserId);

  const latestBillingSub = await CompanySubscription.findOne({
    where: { companyId },
    order: [['updatedAt', 'DESC']]
  });

  if (latestBillingSub) {
    if (latestBillingSub.status === 'active') {
      return { allowed: true };
    }
    if (latestBillingSub.status === 'trialing' && trialActive) {
      return { allowed: true };
    }
    if (trialActive) {
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

  if (trialActive) {
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

const getStatus = async (companyId) => {
  const subscription = await ensureSubscription(companyId);
  const updated = await lockExpiredTrialIfNeeded(subscription);

  const now = new Date();
  let trialEndsInDays = null;
  if (updated.trialEndDate) {
    trialEndsInDays = Math.max(
      0,
      Math.ceil((updated.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  return {
    status: updated.subscriptionStatus,
    trialEndDate: updated.trialEndDate,
    trialEndsInDays,
    accountLocked: updated.accountLocked
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
  console.log('[trial] lock job executed');
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
