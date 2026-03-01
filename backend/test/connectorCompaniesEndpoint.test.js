'use strict';

/**
 * Regression test: GET /api/connector/device/companies must return 200, not 500.
 * Root cause: ordering by attribute name 'createdAt' made Sequelize emit ORDER BY "createdAt",
 * but DB column is created_at. Fix: order by sequelize.col('created_at').
 * This test runs the exact query used by the route and asserts it does not throw.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  describe('connector device/companies endpoint regression', () => {
    it('SKIP: DATABASE_URL not set', () => {
      console.log('SKIP connectorCompaniesEndpoint — DATABASE_URL not set');
    });
  });
} else {
  describe('connector device/companies endpoint regression', () => {
    let sequelize;
    let Company;

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
      // Use app models so we test the same mapping and query as the route
      const models = require('../src/models');
      Company = models.Company;
    });

    after(async () => {
      if (sequelize) await sequelize.close();
    });

    it('companies table has created_at column', async () => {
      const rows = await sequelize.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'created_at'`,
        { type: QueryTypes.SELECT }
      );
      assert.ok(rows.length > 0, 'companies.created_at must exist (run db:migrate)');
    });

    it('raw SQL ORDER BY created_at does not throw', async () => {
      const rows = await sequelize.query(
        `SELECT id, name FROM companies ORDER BY created_at DESC LIMIT 5`,
        { type: QueryTypes.SELECT }
      );
      assert.ok(Array.isArray(rows), 'Expected array');
    });

    it('Company.findAll with order sequelize.col(created_at) does not throw (route-equivalent query)', async () => {
      // Exact pattern used by GET /api/connector/device/companies after fix
      const companies = await Company.findAll({
        where: { isDeleted: false, deletedAt: null },
        attributes: ['id', 'name'],
        order: [[sequelize.col('created_at'), 'DESC']],
        limit: 5,
      });
      assert.ok(Array.isArray(companies), 'Expected array');
      // If we get here, the query did not throw "column Company.createdAt does not exist"
    });

    it('returns all companies for same owner (user-scoped list)', async () => {
      const User = (require('../src/models')).User;
      const owner = await User.findOne({ attributes: ['id'], where: {} });
      if (!owner) {
        console.log('SKIP: no user in DB');
        return;
      }
      const ownerId = owner.id;
      const created = [];
      try {
        created.push(await Company.create({ name: 'Connector Test Co A', ownerId, isDeleted: false }));
        created.push(await Company.create({ name: 'Connector Test Co B', ownerId, isDeleted: false }));
        const list = await Company.findAll({
          where: { ownerId, isDeleted: false, deletedAt: null },
          attributes: ['id', 'name'],
          order: [[sequelize.col('created_at'), 'DESC']],
        });
        assert.ok(Array.isArray(list), 'Expected array');
        assert.ok(list.length >= 2, 'Expected at least 2 companies for owner (route returns user-scoped list)');
        const names = list.map((c) => c.name);
        assert.ok(names.includes('Connector Test Co A'), 'List must include test company A');
        assert.ok(names.includes('Connector Test Co B'), 'List must include test company B');
      } finally {
        for (const c of created) await c.destroy();
      }
    });
  });
}
