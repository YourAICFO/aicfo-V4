const test = require('node:test');
const assert = require('node:assert/strict');
const { validateChartOfAccountsPayload } = require('../src/services/coaPayloadValidator');

test('valid payload returns ok', () => {
  const payload = {
    chartOfAccounts: {
      groups: [{ name: 'Sales Accounts', parent: 'Income', type: 'Group' }],
      ledgers: [{ name: 'ABC Ltd', parent: 'Sundry Debtors', guid: 'L1', type: 'Ledger', closing_balance: 100 }]
    },
    asOfDate: '2026-02-10'
  };
  const result = validateChartOfAccountsPayload(payload);
  assert.equal(result.ok, true);
  assert.equal(result.chartOfAccounts.ledgers.length, 1);
});

test('missing ledgers fails', () => {
  const payload = { chartOfAccounts: { groups: [] } };
  const result = validateChartOfAccountsPayload(payload);
  assert.equal(result.ok, false);
});

test('closing_balance field is accepted', () => {
  const payload = {
    chartOfAccounts: {
      groups: [],
      ledgers: [{ name: 'XYZ', parent: 'Sales Accounts', guid: 'L2', closing_balance: 500 }]
    }
  };
  const result = validateChartOfAccountsPayload(payload);
  assert.equal(result.ok, true);
});
