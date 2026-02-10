const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCoaPayload } = require('../src/services/tallyCoaAdapter');

test('normalizeCoaPayload produces ledgers and balances', () => {
  const raw = {
    groups: [{ name: 'Sales Accounts', parent: 'Income' }],
    ledgers: [
      { name: 'ABC Ltd', parent: 'Sundry Debtors', guid: 'L1', closingBalance: 1000 }
    ],
    asOfDate: '2026-02-10'
  };
  const result = normalizeCoaPayload(raw, 'company-1');
  assert.ok(result.chartOfAccounts.ledgers.length > 0);
  assert.equal(result.chartOfAccounts.balances.current.items.length, 1);
});

test('normalizeCoaPayload generates deterministic guid if missing', () => {
  const raw = {
    groups: [{ name: 'Sales Accounts', parent: 'Income' }],
    ledgers: [
      { name: 'NoGuid', parent: 'Sales Accounts', closing_balance: 500 }
    ]
  };
  const result = normalizeCoaPayload(raw, 'company-1');
  const guid = result.chartOfAccounts.ledgers[0].guid;
  assert.ok(guid);
});
