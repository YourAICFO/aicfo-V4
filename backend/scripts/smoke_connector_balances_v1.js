#!/usr/bin/env node
/**
 * Usage:
 *   API_BASE_URL=https://api.example.com \
 *   USER_JWT=... \
 *   COMPANY_ID=... \
 *   CONNECTOR_TOKEN=... \
 *   node backend/scripts/smoke_connector_balances_v1.js
 */

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const {
  IntegrationSyncRun,
  IntegrationSyncEvent,
  LedgerMonthlyBalance,
  PartyBalanceLatest,
  CurrentDebtor,
  CurrentCreditor,
  CurrentLoan,
  CFOMetric,
  sequelize
} = require('../src/models');

const API_BASE_URL = (process.env.API_BASE_URL || '').replace(/\/+$/, '');
const USER_JWT = process.env.USER_JWT || '';
const COMPANY_ID = process.env.COMPANY_ID || '';
const CONNECTOR_TOKEN = process.env.CONNECTOR_TOKEN || '';

if (!API_BASE_URL || !USER_JWT || !COMPANY_ID || !CONNECTOR_TOKEN) {
  console.error('Missing required env vars: API_BASE_URL, USER_JWT, COMPANY_ID, CONNECTOR_TOKEN');
  process.exit(1);
}

const fixturePath = path.join(__dirname, 'fixtures', 'connector_payload_sample.json');
const payload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

const request = async (method, urlPath, token, body, extraHeaders = {}) => {
  const response = await fetch(`${API_BASE_URL}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_err) {
    json = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${method} ${urlPath} failed (${response.status}): ${JSON.stringify(json)}`);
  }

  return json;
};

const runSingleSync = async (iteration) => {
  console.log(`[smoke] starting connector sync run #${iteration}...`);
  const start = await request('POST', '/api/connector/sync/start', CONNECTOR_TOKEN, {});
  const runId = start?.data?.runId;
  if (!runId) {
    throw new Error('No runId returned from /api/connector/sync/start');
  }
  console.log(`[smoke] runId=${runId}`);

  console.log(`[smoke] uploading balances payload #${iteration}...`);
  const syncResp = await request('POST', '/api/connector/sync', CONNECTOR_TOKEN, payload);
  console.log('[smoke] sync response:', JSON.stringify(syncResp?.data || syncResp));

  console.log(`[smoke] marking run complete #${iteration}...`);
  const completeResp = await request('POST', '/api/connector/sync/complete', CONNECTOR_TOKEN, {
    runId,
    status: 'partial_success',
    finishedAt: new Date().toISOString(),
    lastError: null,
    missingMonths: ['2024-11'],
    historicalMonthsRequested: 24,
    historicalMonthsSynced: 23
  });
  if (completeResp?.data?.status !== 'success') {
    throw new Error(`Expected completed run status=success, got=${completeResp?.data?.status || 'unknown'}`);
  }

  const persistedRun = await IntegrationSyncRun.findByPk(runId);
  if (!persistedRun || persistedRun.status !== 'success') {
    throw new Error(`Expected persisted run status=success, got=${persistedRun?.status || 'missing'}`);
  }
  console.log('[smoke] run persisted with status=success');

  const partialEvent = await IntegrationSyncEvent.findOne({
    where: { runId, event: 'SYNC_PARTIAL' },
    order: [['time', 'DESC']]
  });
  if (!partialEvent) {
    throw new Error('Expected SYNC_PARTIAL event but none found');
  }
  console.log(`[smoke] SYNC_PARTIAL event found #${iteration}`);

  const missingMonthsEvent = await IntegrationSyncEvent.findOne({
    where: { runId, event: 'SYNC_MISSING_MONTHS_REPORTED' },
    order: [['time', 'DESC']]
  });
  if (!missingMonthsEvent) {
    throw new Error('Expected SYNC_MISSING_MONTHS_REPORTED event but none found');
  }
  console.log(`[smoke] SYNC_MISSING_MONTHS_REPORTED event found #${iteration}`);
};

const snapshotCounts = async () => {
  const [ledgerCount, partyCount, loanCount, metricCount] = await Promise.all([
    LedgerMonthlyBalance.count({ where: { companyId: COMPANY_ID } }),
    PartyBalanceLatest.count({ where: { companyId: COMPANY_ID } }),
    CurrentLoan.count({ where: { companyId: COMPANY_ID } }),
    CFOMetric.count({
      where: {
        companyId: COMPANY_ID,
        metricKey: { [Op.in]: ['interest_expense_latest', 'loans_balance_live'] }
      }
    })
  ]);
  return { ledgerCount, partyCount, loanCount, metricCount };
};

const run = async () => {
  await runSingleSync(1);

  const countsAfterFirst = await snapshotCounts();
  console.log('[smoke] counts after first run:', countsAfterFirst);

  await runSingleSync(2);

  const countsAfterSecond = await snapshotCounts();
  console.log('[smoke] counts after second run:', countsAfterSecond);

  if (countsAfterFirst.ledgerCount !== countsAfterSecond.ledgerCount) {
    throw new Error(`ledger_monthly_balances count changed across idempotent runs (${countsAfterFirst.ledgerCount} -> ${countsAfterSecond.ledgerCount})`);
  }
  if (countsAfterFirst.partyCount !== countsAfterSecond.partyCount) {
    throw new Error(`party_balances_latest count changed across idempotent runs (${countsAfterFirst.partyCount} -> ${countsAfterSecond.partyCount})`);
  }
  if (countsAfterFirst.loanCount !== countsAfterSecond.loanCount) {
    throw new Error(`current_loans count changed across idempotent runs (${countsAfterFirst.loanCount} -> ${countsAfterSecond.loanCount})`);
  }
  if (countsAfterFirst.metricCount !== countsAfterSecond.metricCount) {
    throw new Error(`cfo_metrics count for interest/loan keys changed across idempotent runs (${countsAfterFirst.metricCount} -> ${countsAfterSecond.metricCount})`);
  }
  console.log('[smoke] idempotency counts stable across repeated sync');

  const [partyRows, debtors, creditors, loans, interestMetric] = await Promise.all([
    PartyBalanceLatest.findAll({ where: { companyId: COMPANY_ID } }),
    CurrentDebtor.findAll({ where: { companyId: COMPANY_ID } }),
    CurrentCreditor.findAll({ where: { companyId: COMPANY_ID } }),
    CurrentLoan.findAll({ where: { companyId: COMPANY_ID } }),
    CFOMetric.findOne({
      where: {
        companyId: COMPANY_ID,
        metricKey: 'interest_expense_latest',
        timeScope: 'latest'
      }
    })
  ]);
  if (partyRows.length === 0 && debtors.length === 0 && creditors.length === 0) {
    throw new Error('Expected party balances in party_balances_latest or current_debtors/current_creditors');
  }
  if (loans.length === 0) {
    throw new Error('Expected current_loans to be populated from optional loans block');
  }
  if (!interestMetric) {
    throw new Error('Expected cfo_metrics row for interest_expense_latest');
  }
  console.log('[smoke] optional blocks persisted: party balances, loans, interest metric');

  console.log('[smoke] checking sync status...');
  const status = await request(
    'GET',
    '/api/sync/status',
    USER_JWT,
    null,
    { 'x-company-id': COMPANY_ID }
  );
  console.log('[smoke] /api/sync/status:', JSON.stringify(status?.data || status, null, 2));

  console.log('[smoke] checking dashboard overview...');
  const overview = await request(
    'GET',
    '/api/dashboard/overview',
    USER_JWT,
    null,
    { 'x-company-id': COMPANY_ID }
  );
  console.log('[smoke] /api/dashboard/overview:', JSON.stringify(overview?.data || overview, null, 2));

  console.log('[smoke] done');
};

run()
  .then(async () => {
    await sequelize.close();
  })
  .catch(async (err) => {
    console.error('[smoke] failed:', err.message);
    try {
      await sequelize.close();
    } catch (_closeErr) {}
    process.exit(1);
  });
