const test = require('node:test');
const assert = require('node:assert/strict');
const { v4: uuidv4 } = require('uuid');

const { User, Company, Subscription, sequelize } = require('../src/models');
const { createTrialSubscription, checkAccess, getStatus } = require('../src/services/subscriptionService');

test('trial creation and access allowed', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `trial-${uuidv4()}@example.com`;
  let company;

  await sequelize.transaction(async (trx) => {
    const user = await User.create({
      email,
      passwordHash: 'hash',
      firstName: 'Trial',
      lastName: 'User'
    }, { transaction: trx });

    company = await Company.create({
      name: 'Trial Co',
      ownerId: user.id
    }, { transaction: trx });
  });

  const subscription = await createTrialSubscription(company.id);
  assert.equal(subscription.subscriptionStatus, 'trial');

  const access = await checkAccess(company.id);
  assert.equal(access.allowed, true);

  const status = await getStatus(company.id);
  assert.equal(status.status, 'trial');

  await Subscription.destroy({ where: { companyId: company.id } });
  await Company.destroy({ where: { id: company.id } });
  await User.destroy({ where: { email } });
});

test('expired trial denies access', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL not set');
  }

  const email = `expired-${uuidv4()}@example.com`;
  let company;

  await sequelize.transaction(async (trx) => {
    const user = await User.create({
      email,
      passwordHash: 'hash',
      firstName: 'Expired',
      lastName: 'User'
    }, { transaction: trx });

    company = await Company.create({
      name: 'Expired Co',
      ownerId: user.id
    }, { transaction: trx });
  });

  const subscription = await createTrialSubscription(company.id);
  await subscription.update({ trialEndDate: new Date(Date.now() - 24 * 60 * 60 * 1000) });

  const access = await checkAccess(company.id);
  assert.equal(access.allowed, false);

  await Subscription.destroy({ where: { companyId: company.id } });
  await Company.destroy({ where: { id: company.id } });
  await User.destroy({ where: { email } });
});
