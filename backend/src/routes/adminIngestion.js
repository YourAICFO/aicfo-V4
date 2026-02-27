const express = require('express');
const { Op } = require('sequelize');
const { authenticate } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');
const {
  Company,
  ConnectorClient,
  IntegrationSyncRun,
  IntegrationSyncEvent,
  MonthlyTrialBalanceSummary,
  LedgerMonthlyBalance,
  CurrentCashBalance,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  AdminUsageEvent,
  CFOMetric,
  PartyBalanceLatest
} = require('../models');

const router = express.Router();

const toNumber = (value) => {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num : 0;
};

router.get('/health', authenticate, requireAdmin, async (req, res) => {
  try {
    const companyId = req.query?.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, error: 'companyId query parameter is required' });
    }

    // Company model exposes ownerId (mapped to owner_id in DB).
    const company = await Company.findOne({
      where: {
        id: companyId,
        ownerId: req.userId
      }
    });

    if (!company) {
      return res.status(403).json({ success: false, error: 'Access denied to this company' });
    }

    const [connectorClient, lastSyncRun, latestSnapshot] = await Promise.all([
      ConnectorClient.findOne({
        where: { companyId },
        order: [['lastSeenAt', 'DESC']]
      }),
      IntegrationSyncRun.findOne({
        where: { companyId },
        order: [['startedAt', 'DESC']]
      }),
      MonthlyTrialBalanceSummary.findOne({
        where: { companyId },
        order: [['month', 'DESC']]
      })
    ]);

    const lastEvent = lastSyncRun
      ? await IntegrationSyncEvent.findOne({
          where: { runId: lastSyncRun.id },
          order: [['time', 'DESC']]
        })
      : null;

    const markerEvents = await AdminUsageEvent.findAll({
      where: {
        companyId,
        eventType: {
          [Op.in]: ['snapshot_computed_from', 'current_balances_source']
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const latestSnapshotEvent = markerEvents.find((event) => (
      event.eventType === 'snapshot_computed_from'
      && latestSnapshot
      && event.metadata?.monthKey === latestSnapshot.month
    )) || null;

    const latestCurrentBalanceEvent = markerEvents.find((event) => event.eventType === 'current_balances_source');

    const coverageMonthKey = latestSnapshot?.month || null;

    const coverageRows = coverageMonthKey
      ? await LedgerMonthlyBalance.findAll({
          where: { companyId, monthKey: coverageMonthKey },
          raw: true
        })
      : [];

    const unclassifiedRows = coverageRows.filter((row) => {
      const category = String(row.cfoCategory || '').toLowerCase();
      return !category || category === 'unclassified' || category === 'unknown';
    });
    const classifiedLedgers = coverageRows.length - unclassifiedRows.length;
    const sortedUnclassified = [...unclassifiedRows]
      .sort((a, b) => Math.abs(toNumber(b.balance)) - Math.abs(toNumber(a.balance)))
      .slice(0, 5)
      .map((row) => ({
        name: row.ledgerName,
        parent: row.parentGroup,
        guid: row.ledgerGuid,
        balance: toNumber(row.balance)
      }));

    const [cashRows, debtorRows, creditorRows, loanRows, interestMetric, partyRows, missingMonthsEvent] = await Promise.all([
      CurrentCashBalance.findAll({ where: { companyId }, raw: true }),
      CurrentDebtor.findAll({ where: { companyId }, raw: true }),
      CurrentCreditor.findAll({ where: { companyId }, raw: true }),
      CurrentLoan.findAll({ where: { companyId }, raw: true }),
      CFOMetric.findOne({
        where: { companyId, metricKey: 'interest_expense_latest', timeScope: 'latest' },
        raw: true
      }),
      PartyBalanceLatest.findAll({
        where: { companyId },
        attributes: ['partyType'],
        raw: true
      }),
      lastSyncRun
        ? IntegrationSyncEvent.findOne({
            where: {
              runId: lastSyncRun.id,
              event: {
                [Op.in]: ['SYNC_PARTIAL', 'SYNC_MISSING_MONTHS_REPORTED']
              }
            },
            order: [['time', 'DESC']]
          })
        : Promise.resolve(null)
    ]);

    const cashTotal = cashRows.reduce((sum, row) => sum + toNumber(row.balance), 0);
    const debtorsTotal = debtorRows.reduce((sum, row) => sum + toNumber(row.balance), 0);
    const creditorsTotal = creditorRows.reduce((sum, row) => sum + toNumber(row.balance), 0);
    const loansTotal = loanRows.reduce((sum, row) => sum + toNumber(row.balance), 0);
    const debtorsPartyCount = partyRows.filter((row) => String(row.partyType).toLowerCase() === 'debtor').length;
    const creditorsPartyCount = partyRows.filter((row) => String(row.partyType).toLowerCase() === 'creditor').length;
    const missingMonths = Array.isArray(missingMonthsEvent?.data?.missingMonths)
      ? missingMonthsEvent.data.missingMonths
      : [];

    return res.json({
      success: true,
      data: {
        companyId,
        lastConnectorSeenAt: connectorClient?.lastSeenAt || null,
        lastSyncRun: lastSyncRun ? {
          id: lastSyncRun.id,
          status: lastSyncRun.status,
          startedAt: lastSyncRun.startedAt || null,
          completedAt: lastSyncRun.finishedAt || null,
          lastEventAt: lastEvent?.time || null
        } : null,
        latestSnapshot: latestSnapshot ? {
          monthKey: latestSnapshot.month,
          computedFrom: latestSnapshotEvent?.metadata?.computedFrom || null,
          updatedAt: latestSnapshot.updatedAt || null
        } : null,
        coverage: {
          monthKey: coverageMonthKey,
          totalLedgers: coverageRows.length,
          classifiedLedgers,
          unclassifiedLedgers: unclassifiedRows.length,
          classifiedPct: coverageRows.length > 0
            ? Number(((classifiedLedgers / coverageRows.length) * 100).toFixed(2))
            : 0,
          topUnclassifiedLedgers: sortedUnclassified
        },
        currentBalances: {
          cashTotal,
          debtorsTotal,
          creditorsTotal,
          loansTotal,
          asOfMonthKey: latestCurrentBalanceEvent?.metadata?.monthKey || coverageMonthKey,
          derivedFrom: latestCurrentBalanceEvent?.metadata?.source || null
        },
        missingMonths,
        interestLatest: interestMetric ? {
          amount: toNumber(interestMetric.metricValue),
          monthKey: interestMetric.month || null,
          updatedAt: interestMetric.updatedAt || null
        } : null,
        loansSummary: {
          loansTotal,
          loansCount: loanRows.length
        },
        partyCounts: {
          debtorsTotalCount: debtorsPartyCount,
          creditorsTotalCount: creditorsPartyCount
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
