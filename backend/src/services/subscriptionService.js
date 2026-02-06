const { Subscription, sequelize } = require('../models');

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
    maxIntegrations: 0,
    features: {
      manualEntry: true,
      aiInsights: true,
      aiChat: true,
      tally: false,
      zoho: false,
      quickbooks: false,
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
    if (!existing.subscriptionStatus) {
      const inferredStatus = existing.planType && existing.planType !== 'FREE' ? 'active' : 'trial';
      await existing.update({ subscriptionStatus: inferredStatus });
    }
    return existing;
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

const checkAccess = async (companyId) => {
  const subscription = await ensureSubscription(companyId);
  const updated = await lockExpiredTrialIfNeeded(subscription);

  if (updated.accountLocked || updated.subscriptionStatus === 'expired') {
    return {
      allowed: false,
      reason: 'Your trial has expired. Please subscribe to continue.'
    };
  }

  return { allowed: true };
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
  lockExpiredTrials
};
