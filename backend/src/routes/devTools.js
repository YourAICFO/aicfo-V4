const express = require('express');
const fs = require('fs');
const { authenticate, requireCompany } = require('../middleware/auth');
const { requireAdminEmail } = require('../middleware/requireAdminEmail');
const { z, validate, ValidationError } = require('../utils/validation');
const { parseDateStrict } = require('../utils/dates');
const { sequelize, LedgerMonthlyBalance } = require('../models');
const { mapLedgersToCFOTotals, upsertLedgerClassifications } = require('../services/cfoAccountMappingService');
const { getLatestClosedMonthKey } = require('../services/monthlySnapshotService');
const { normalizeMonth } = require('../utils/monthKeyUtils');
const { logUsageEvent } = require('../services/adminUsageService');

const router = express.Router();
const mockSyncSchema = z.object({
  asOfDate: z.string().optional()
});

const buildMockPayload = () => {
  const groups = [
    { name: 'Sundry Debtors', parent: 'Current Assets', type: 'Group' },
    { name: 'Sundry Creditors', parent: 'Current Liabilities', type: 'Group' },
    { name: 'Bank Accounts', parent: 'Current Assets', type: 'Group' },
    { name: 'Cash-in-Hand', parent: 'Current Assets', type: 'Group' },
    { name: 'Sales', parent: 'Income', type: 'Group' },
    { name: 'Indirect Expenses', parent: 'Expenses', type: 'Group' }
  ];

  const ledgers = [
    { guid: 'D1', name: 'ABC Retail Pvt Ltd', group: 'Sundry Debtors', type: 'Ledger', balance: 120000 },
    { guid: 'D2', name: 'XYZ Traders', group: 'Sundry Debtors', type: 'Ledger', balance: 80000 },
    { guid: 'C1', name: 'Raw Material Supplier A', group: 'Sundry Creditors', type: 'Ledger', balance: 60000 },
    { guid: 'C2', name: 'Packaging Vendor', group: 'Sundry Creditors', type: 'Ledger', balance: 25000 },
    { guid: 'B1', name: 'HDFC Bank Current', group: 'Bank Accounts', type: 'Ledger', balance: 210000 },
    { guid: 'CA1', name: 'Cash on Hand', group: 'Cash-in-Hand', type: 'Ledger', balance: 15000 },
    { guid: 'R1', name: 'Sales Domestic', group: 'Sales', type: 'Ledger', balance: 540000 },
    { guid: 'E1', name: 'Marketing Expense', group: 'Indirect Expenses', type: 'Ledger', balance: 90000 }
  ];

  return { groups, ledgers };
};

router.post('/mock-coa-sync', authenticate, requireCompany, requireAdminEmail, async (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_MOCK_ENABLED !== 'true') {
    return res.status(403).json({ success: false, error: 'Disabled in production' });
  }

  const companyId = req.company.id;
  let asOfOverride = null;
  try {
    const parsed = validate(mockSyncSchema, req.body || {});
    if (parsed.asOfDate) {
      asOfOverride = parseDateStrict(parsed.asOfDate).toISOString().slice(0, 10);
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({ success: false, error: 'Invalid payload', issues: error.issues, run_id: req.run_id || null });
    }
    return res.status(400).json({ success: false, error: 'Invalid payload', run_id: req.run_id || null });
  }

  const currentMonthKey = normalizeMonth(new Date());
  const latestClosedMonthKey = getLatestClosedMonthKey();
  const today = asOfOverride || new Date().toISOString().slice(0, 10);

  const { groups, ledgers } = buildMockPayload();
  const { classifications } = mapLedgersToCFOTotals(ledgers, groups);

  let balancesInserted = 0;

  try {
    await sequelize.transaction(async (transaction) => {
      await upsertLedgerClassifications(companyId, classifications);

      for (const row of classifications) {
        if (!row.ledgerGuid) continue;

        if (['debtors', 'creditors', 'cash_bank'].includes(row.category)) {
          await LedgerMonthlyBalance.upsert({
            companyId,
            monthKey: currentMonthKey,
            ledgerGuid: row.ledgerGuid,
            ledgerName: row.ledgerName || 'Unknown',
            parentGroup: row.parentGroup || null,
            cfoCategory: row.category,
            balance: Number(row.balance || 0),
            asOfDate: today
          }, { transaction });
          balancesInserted += 1;
        }

        if (latestClosedMonthKey && ['revenue', 'expenses'].includes(row.category)) {
          await LedgerMonthlyBalance.upsert({
            companyId,
            monthKey: latestClosedMonthKey,
            ledgerGuid: row.ledgerGuid,
            ledgerName: row.ledgerName || 'Unknown',
            parentGroup: row.parentGroup || null,
            cfoCategory: row.category,
            balance: Number(row.balance || 0),
            asOfDate: null
          }, { transaction });
          balancesInserted += 1;
        }
      }
    });

    await logUsageEvent({
      companyId,
      userId: req.user.id,
      eventType: 'dev_mock_sync',
      eventName: 'mock_coa_sync'
    });

    return res.json({
      success: true,
      inserted: {
        classifications: classifications.length,
        balances: balancesInserted
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Mock COA sync failed', run_id: req.run_id || null });
  }
});

router.get('/doctor-last', authenticate, requireCompany, requireAdminEmail, (req, res) => {
  if (process.env.NODE_ENV === 'production' && process.env.DEV_MOCK_ENABLED !== 'true') {
    return res.status(403).json({ success: false, error: 'Disabled in production', run_id: req.run_id || null });
  }

  const candidates = ['/tmp/doctor_report.txt', require('path').join(__dirname, '..', 'doctor_report.txt')];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) {
    return res.status(404).json({ success: false, error: 'Doctor report not found', run_id: req.run_id || null });
  }

  const content = fs.readFileSync(filePath, 'utf8');
  return res.json({ success: true, file: filePath, report: content, run_id: req.run_id || null });
});

module.exports = router;
