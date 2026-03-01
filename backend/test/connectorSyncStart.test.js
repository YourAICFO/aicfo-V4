'use strict';

/**
 * Regression test: POST /api/connector/sync/start flow.
 * Verifies syncStatusService.createRun creates a run record (so trigger sync → run created).
 * Skip when DATABASE_URL unset.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  describe('connector sync/start regression', () => {
    it('SKIP: DATABASE_URL not set', () => {
      console.log('SKIP connectorSyncStart — DATABASE_URL not set');
    });
  });
} else {
  describe('connector sync/start regression', () => {
    let sequelize;
    let Company;
    let syncStatusService;

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
      Company = models.Company;
      syncStatusService = require('../src/services/syncStatusService');
    });

    after(async () => {
      if (sequelize) await sequelize.close();
    });

    it('createRun returns run with id (sync/start creates run)', async () => {
      const User = (require('../src/models')).User;
      const owner = await User.findOne({ attributes: ['id'], where: {} });
      if (!owner) {
        console.log('SKIP: no user in DB');
        return;
      }
      const company = await Company.findOne({
        where: { ownerId: owner.id },
        attributes: ['id']
      });
      if (!company) {
        console.log('SKIP: no company in DB');
        return;
      }
      const run = await syncStatusService.createRun(company.id, 'tally', null);
      assert.ok(run, 'createRun must return a run');
      assert.ok(run.id, 'run must have id');
      assert.strictEqual(run.companyId, company.id);
      assert.strictEqual(run.status, 'running');
      await run.destroy();
    });
  });
}
