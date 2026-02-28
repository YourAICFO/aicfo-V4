'use strict';

/**
 * Regression test: ensures companies table has created_at and updated_at columns.
 * Root cause: Sequelize Company model has timestamps:true mapped to created_at/updated_at.
 * Without these columns, GET /api/connector/device/companies returns 500.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    // Skip gracefully when no DB is available (local dev without DB).
    describe('companies timestamps regression', () => {
        it('SKIP: DATABASE_URL not set', () => {
            console.log('SKIP companiesTimestamps — DATABASE_URL not set');
        });
    });
} else {
    describe('companies timestamps regression', () => {
        let sequelize;

        before(async () => {
            const isSSL =
                process.env.NODE_ENV === 'production' || process.env.DB_SSL === 'true';
            sequelize = new Sequelize(DATABASE_URL, {
                dialect: 'postgres',
                logging: false,
                dialectOptions: isSSL
                    ? { ssl: { require: true, rejectUnauthorized: false } }
                    : {}
            });
            await sequelize.authenticate();
        });

        after(async () => {
            if (sequelize) await sequelize.close();
        });

        const requiredColumns = [
            { table: 'companies', column: 'created_at' },
            { table: 'companies', column: 'updated_at' }
        ];

        for (const { table, column } of requiredColumns) {
            it(`${table}.${column} exists (prevents 500 on /device/companies)`, async () => {
                const rows = await sequelize.query(
                    `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name   = :table
               AND column_name  = :column
           ) AS "exists"`,
                    { replacements: { table, column }, type: QueryTypes.SELECT }
                );
                const exists = Boolean(rows[0]?.exists);
                assert.ok(
                    exists,
                    `SCHEMA DRIFT: column "${table}.${column}" is missing. ` +
                    `Run migration 2026-02-28-companies-timestamps.sql or npm run db:bootstrap.`
                );
            });
        }

        it('Company.findAll ordered by created_at does not throw', async () => {
            // Verifies the actual Sequelize query used by /device/companies works.
            const rows = await sequelize.query(
                `SELECT id, name FROM companies ORDER BY created_at DESC LIMIT 1`,
                { type: QueryTypes.SELECT }
            );
            // Success is simply not throwing — column must exist.
            assert.ok(Array.isArray(rows), 'Expected array result');
        });
    });
}
