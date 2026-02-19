/**
 * Billing/trial access: checkAccess, integrations, and flows that gate on subscription.
 * Ensures AI, finance, integrations, and connector flows respect UserBillingProfile + CompanySubscription (billing v1).
 * DB tests require DATABASE_URL and a reachable database; they skip on connection failure.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { v4: uuidv4 } = require('uuid');

const {
  User,
  Company,
  UserBillingProfile,
  CompanySubscription,
  sequelize
} = require('../src/models');
const { checkAccess } = require('../src/services/subscriptionService');
const integrationService = require('../src/services/integrationService');

const skipIfNoDb = (t, err) => {
  const msg = err?.message || String(err);
  if (!process.env.DATABASE_URL || /ENOTFOUND|ECONNREFUSED|connect/i.test(msg)) {
    t.skip('Database not available or not reachable');
  }
  throw err;
};

test('checkAccess allows when CompanySubscription status is active', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `billing-active-${uuidv4()}@example.com`;
  let companyId;

  try {
    await sequelize.transaction(async (trx) => {
      const user = await User.create(
        { email, passwordHash: 'hash', firstName: 'B', lastName: 'User' },
        { transaction: trx }
      );
      const company = await Company.create(
        { name: 'Billing Active Co', ownerId: user.id },
        { transaction: trx }
      );
      companyId = company.id;
      await CompanySubscription.create(
        {
          companyId: company.id,
          planCode: 'starter_5000',
          status: 'active',
          gateway: 'razorpay'
        },
        { transaction: trx }
      );
    });

    const access = await checkAccess(companyId);
    assert.equal(access.allowed, true, 'access should be allowed when CompanySubscription is active');

    await CompanySubscription.destroy({ where: { companyId } });
    await Company.destroy({ where: { id: companyId } });
    await User.destroy({ where: { email } });
  } catch (err) {
    skipIfNoDb(t, err);
  }
});

test('checkAccess denies when CompanySubscription status is canceled and no user trial', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `billing-canceled-${uuidv4()}@example.com`;
  let companyId;

  try {
    await sequelize.transaction(async (trx) => {
      const user = await User.create(
        { email, passwordHash: 'hash', firstName: 'C', lastName: 'User' },
        { transaction: trx }
      );
      const company = await Company.create(
        { name: 'Canceled Co', ownerId: user.id },
        { transaction: trx }
      );
      companyId = company.id;
      await CompanySubscription.create(
        {
          companyId: company.id,
          planCode: 'starter_5000',
          status: 'canceled',
          gateway: 'razorpay'
        },
        { transaction: trx }
      );
    });

    const access = await checkAccess(companyId);
    assert.equal(access.allowed, false);
    assert.ok(access.reason && access.reason.length > 0);

    await CompanySubscription.destroy({ where: { companyId } });
    await Company.destroy({ where: { id: companyId } });
    await User.destroy({ where: { email } });
  } catch (err) {
    skipIfNoDb(t, err);
  }
});

test('checkAccess allows when user has active trial (UserBillingProfile) even if no CompanySubscription', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `user-trial-${uuidv4()}@example.com`;
  let companyId;
  let userId;

  try {
    await sequelize.transaction(async (trx) => {
      const user = await User.create(
        { email, passwordHash: 'hash', firstName: 'T', lastName: 'User' },
        { transaction: trx }
      );
      userId = user.id;
      const company = await Company.create(
        { name: 'User Trial Co', ownerId: user.id },
        { transaction: trx }
      );
      companyId = company.id;
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await UserBillingProfile.create(
        {
          userId: user.id,
          trialStartedAt: new Date(),
          trialEndsAt: trialEnd,
          hasUsedTrial: true
        },
        { transaction: trx }
      );
    });

    const access = await checkAccess(companyId, userId);
    assert.equal(access.allowed, true, 'access should be allowed when user has active trial profile');

    await UserBillingProfile.destroy({ where: { userId } });
    await Company.destroy({ where: { id: companyId } });
    await User.destroy({ where: { email } });
  } catch (err) {
    skipIfNoDb(t, err);
  }
});

test('connectTally throws when checkAccess denies (billing v1)', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `no-access-${uuidv4()}@example.com`;
  let companyId;

  try {
    await sequelize.transaction(async (trx) => {
      const user = await User.create(
        { email, passwordHash: 'hash', firstName: 'N', lastName: 'User' },
        { transaction: trx }
      );
      const company = await Company.create(
        { name: 'No Access Co', ownerId: user.id },
        { transaction: trx }
      );
      companyId = company.id;
      await CompanySubscription.create(
        {
          companyId: company.id,
          planCode: 'starter_5000',
          status: 'canceled',
          gateway: 'razorpay'
        },
        { transaction: trx }
      );
    });

    await assert.rejects(
      async () =>
        integrationService.connectTally(
          companyId,
          { companyName: 'Test', serverUrl: 'http://localhost:9000' },
          null
        ),
      /trial has expired|Please upgrade|Subscription is canceled/
    );

    await CompanySubscription.destroy({ where: { companyId } });
    await Company.destroy({ where: { id: companyId } });
    await User.destroy({ where: { email } });
  } catch (err) {
    skipIfNoDb(t, err);
  }
});
