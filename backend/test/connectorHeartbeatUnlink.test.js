'use strict';

/**
 * Connector heartbeat and unlink behavior.
 * - Heartbeat: updating ConnectorDevice by deviceId updates lastSeenAt (so status/v1 can show isOnline).
 * - Unlink: setting link isActive=false excludes it from active links (so status/v1 no longer lists it).
 * Skip when DATABASE_URL unset.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  describe('connector heartbeat and unlink', () => {
    it('SKIP: DATABASE_URL not set', () => {
      console.log('SKIP connectorHeartbeatUnlink — DATABASE_URL not set');
    });
  });
} else {
  describe('connector heartbeat and unlink', () => {
    let sequelize;
    let ConnectorDevice;
    let ConnectorCompanyLink;
    let Company;
    let User;
    let created;

    before(async () => {
      const isSSL =
        process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true';
      sequelize = new Sequelize(DATABASE_URL, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: isSSL
          ? { ssl: { require: true, rejectUnauthorized: false } }
          : {},
      });
      await sequelize.authenticate();
      const models = require('../src/models');
      ConnectorDevice = models.ConnectorDevice;
      ConnectorCompanyLink = models.ConnectorCompanyLink;
      Company = models.Company;
      User = models.User;
      created = [];
    });

    after(async () => {
      for (const c of created) {
        try {
          await c.destroy();
        } catch (_) {}
      }
      if (sequelize) await sequelize.close();
    });

    it('heartbeat: update by deviceId updates lastSeenAt', async () => {
      const user = await User.findOne({ attributes: ['id'], where: {} });
      if (!user) {
        console.log('SKIP: no user in DB');
        return;
      }
      const company = await Company.findOne({
        where: { ownerId: user.id },
        attributes: ['id']
      });
      if (!company) {
        console.log('SKIP: no company in DB');
        return;
      }
      const deviceId = `test-dev-${Date.now()}`;
      const oldSeen = new Date(Date.now() - 300000);
      const dev = await ConnectorDevice.create({
        companyId: company.id,
        userId: user.id,
        deviceId,
        deviceName: 'Test Device',
        lastSeenAt: oldSeen,
        status: 'active'
      });
      created.push(dev);

      const now = new Date();
      const [affected] = await ConnectorDevice.update(
        { lastSeenAt: now, deviceName: 'Test Device' },
        { where: { deviceId } }
      );
      assert.ok(affected >= 1, 'heartbeat should update at least one row by deviceId');

      const updated = await ConnectorDevice.findOne({ where: { deviceId }, raw: true });
      assert.ok(updated, 'device should exist');
      assert.ok(updated.lastSeenAt, 'lastSeenAt should be set');
      assert.ok(
        new Date(updated.lastSeenAt).getTime() >= now.getTime() - 2000,
        'lastSeenAt should be recent'
      );
    });

    it('unlink: link with isActive false is excluded from active links', async () => {
      const user = await User.findOne({ attributes: ['id'], where: {} });
      if (!user) {
        console.log('SKIP: no user in DB');
        return;
      }
      const company = await Company.findOne({
        where: { ownerId: user.id },
        attributes: ['id']
      });
      if (!company) {
        console.log('SKIP: no company in DB');
        return;
      }
      const link = await ConnectorCompanyLink.create({
        companyId: company.id,
        userId: user.id,
        tallyCompanyId: 'tally-1',
        tallyCompanyName: 'Tally Test',
        isActive: true
      });
      created.push(link);

      const activeBefore = await ConnectorCompanyLink.findAll({
        where: { companyId: company.id, isActive: true }
      });
      assert.ok(activeBefore.some((l) => l.id === link.id), 'link should be in active list');

      await link.update({ isActive: false });

      const activeAfter = await ConnectorCompanyLink.findAll({
        where: { companyId: company.id, isActive: true }
      });
      assert.ok(!activeAfter.some((l) => l.id === link.id), 'unlinked link should not be in active list');
    });
  });
}
