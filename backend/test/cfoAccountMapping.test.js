const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildGroupIndex,
  classifyLedger,
  mapLedgersToCFOTotals
} = require('../src/services/cfoAccountMappingService');

const groups = [
  { name: 'Sales Accounts', parentName: 'Income' },
  { name: 'Indirect Expenses', parentName: 'Expenses' },
  { name: 'Sundry Debtors', parentName: 'Current Assets' },
  { name: 'Bank Accounts', parentName: 'Current Assets' },
  { name: 'Stock-in-Hand', parentName: 'Current Assets' },
  { name: 'Deposits', parentName: 'Current Assets' }
];

const groupIndex = buildGroupIndex(groups);

const ledger = (name, groupName, balance = 100) => ({
  name,
  groupName,
  balance,
  isLedger: true
});

test('Ledger under Sales Accounts maps to revenue', () => {
  const cat = classifyLedger(ledger('Product Sales', 'Sales Accounts'), groupIndex);
  assert.equal(cat, 'revenue');
});

test('Ledger under Indirect Expenses maps to expenses', () => {
  const cat = classifyLedger(ledger('Office Rent', 'Indirect Expenses'), groupIndex);
  assert.equal(cat, 'expenses');
});

test('Ledger under Sundry Debtors maps to debtors', () => {
  const cat = classifyLedger(ledger('ABC Traders', 'Sundry Debtors'), groupIndex);
  assert.equal(cat, 'debtors');
});

test('Ledger under Bank Accounts maps to cash_bank', () => {
  const cat = classifyLedger(ledger('HDFC Current', 'Bank Accounts'), groupIndex);
  assert.equal(cat, 'cash_bank');
});

test('Ledger under Stock-in-Hand maps to inventory', () => {
  const cat = classifyLedger(ledger('Raw materials', 'Stock-in-Hand'), groupIndex);
  assert.equal(cat, 'inventory');
});

test('Group node is ignored', () => {
  const cat = classifyLedger({ name: 'Sales Accounts', type: 'Group' }, groupIndex);
  assert.equal(cat, null);
});

test('Ledger under Deposits is excluded from cash_bank', () => {
  const cat = classifyLedger(ledger('FD Deposit', 'Deposits'), groupIndex);
  assert.equal(cat, null);
});

test('Mixed case group names match', () => {
  const cat = classifyLedger(ledger('Sales A', 'sales accounts'), groupIndex);
  assert.equal(cat, 'revenue');
});

test('mapLedgersToCFOTotals aggregates only ledgers', () => {
  const { totals, counts } = mapLedgersToCFOTotals([
    ledger('A', 'Sales Accounts', 200),
    ledger('B', 'Indirect Expenses', 50),
    { name: 'Group', type: 'Group' }
  ], groups);

  assert.equal(totals.revenue, 200);
  assert.equal(totals.expenses, 50);
  assert.equal(counts.ignored >= 1, true);
});
