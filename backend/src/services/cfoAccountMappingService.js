const { CFOLedgerClassification } = require('../models');

const GROUP_MAP = {
  revenue: [
    'Sales Accounts',
    'Direct Incomes',
    'Indirect Incomes',
    'Income',
    'Sales'
  ],
  expenses: [
    'Direct Expenses',
    'Indirect Expenses',
    'Purchase Accounts',
    'Expenses'
  ],
  debtors: [
    'Sundry Debtors',
    'Accounts Receivable'
  ],
  creditors: [
    'Sundry Creditors',
    'Accounts Payable'
  ],
  cash_bank: [
    'Cash-in-Hand',
    'Bank Accounts'
  ]
};

const CASH_BANK_EXCLUDE = ['Deposits', 'Investments', 'Loans & Advances'];

const normalize = (value) => (value || '').toString().trim().toLowerCase();

const buildGroupIndex = (groups = []) => {
  const parentByKey = new Map();
  const canonicalByKey = new Map();

  for (const group of groups || []) {
    const name = normalize(group.name || group.groupName || group.group_name || group.reservedName);
    const parent = normalize(group.parentName || group.parent || group.parentGroup || group.parent_group);

    if (name) {
      parentByKey.set(name, parent || null);
      canonicalByKey.set(name, name);
    }

    const reserved = normalize(group.reservedName);
    if (reserved) {
      parentByKey.set(reserved, parent || null);
      canonicalByKey.set(reserved, name || reserved);
    }
  }

  return { parentByKey, canonicalByKey };
};

const getGroupChain = (groupName, groupIndex) => {
  const chain = [];
  if (!groupName) return chain;

  let cursor = normalize(groupName);
  let safety = 0;
  while (cursor && safety < 25) {
    chain.push(cursor);
    cursor = groupIndex.parentByKey.get(cursor) || null;
    safety += 1;
  }
  return chain;
};

const isLedgerNode = (ledger) => {
  if (!ledger) return false;
  if (ledger.metadata?.type === 'Group') return false;
  if (ledger.type && ledger.type.toLowerCase() === 'group') return false;
  return ledger.isLedger === true || ledger.metadata?.type === 'Ledger' || ledger.type === 'Ledger' || !!ledger.ledgerName || !!ledger.name;
};

const classifyLedger = (ledger, groupIndex) => {
  if (!isLedgerNode(ledger)) return null;

  const groupName = ledger.groupName || ledger.parentGroup || ledger.parent_group || ledger.group || ledger.group_name;
  const chain = getGroupChain(groupName, groupIndex);
  if (chain.length === 0) return null;

  const cashExclude = CASH_BANK_EXCLUDE.map(normalize);
  if (chain.some((name) => cashExclude.includes(name))) {
    return null;
  }

  const normalizedMap = Object.entries(GROUP_MAP).reduce((acc, [category, names]) => {
    acc[category] = names.map(normalize);
    return acc;
  }, {});

  for (const category of Object.keys(normalizedMap)) {
    const matches = normalizedMap[category];
    if (chain.some((name) => matches.includes(name))) {
      if (category === 'cash_bank') {
        return 'cash_bank';
      }
      return category;
    }
  }

  return null;
};

const mapLedgersToCFOTotals = (ledgers = [], groups = []) => {
  const groupIndex = buildGroupIndex(groups);
  const totals = {
    revenue: 0,
    expenses: 0,
    debtors: 0,
    creditors: 0,
    cash_bank: 0
  };
  const counts = {
    revenue: 0,
    expenses: 0,
    debtors: 0,
    creditors: 0,
    cash_bank: 0,
    ignored: 0
  };
  const classifications = [];

  for (const ledger of ledgers || []) {
    if (!isLedgerNode(ledger)) {
      counts.ignored += 1;
      continue;
    }

    const category = classifyLedger(ledger, groupIndex);
    if (!category) {
      counts.ignored += 1;
      continue;
    }

    const balance = Number(
      ledger.closing_balance || ledger.balance || ledger.amount || ledger.closingBalance || ledger.opening_balance || 0
    );

    totals[category] += Number.isFinite(balance) ? balance : 0;
    counts[category] += 1;

    classifications.push({
      ledgerName: ledger.name || ledger.ledgerName || ledger.ledger_name,
      ledgerGuid: ledger.guid || ledger.ledgerGuid || ledger.ledger_guid || ledger.id || ledger.ledgerId || ledger.name || ledger.ledgerName,
      parentGroup: ledger.groupName || ledger.parentGroup || ledger.parent_group || ledger.group || ledger.group_name,
      category,
      balance
    });
  }

  return { totals, counts, classifications };
};

const upsertLedgerClassifications = async (companyId, classifications = []) => {
  if (!classifications.length) return;

  for (const row of classifications) {
    if (!row.ledgerGuid) continue;
    await CFOLedgerClassification.upsert({
      companyId,
      ledgerName: row.ledgerName || 'Unknown',
      ledgerGuid: row.ledgerGuid,
      parentGroup: row.parentGroup || null,
      cfoCategory: row.category || null,
      lastSeenAt: new Date()
    });
  }
};

module.exports = {
  GROUP_MAP,
  buildGroupIndex,
  classifyLedger,
  mapLedgersToCFOTotals,
  upsertLedgerClassifications,
  isLedgerNode
};
