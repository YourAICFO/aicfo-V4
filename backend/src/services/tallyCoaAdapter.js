/**
 * Tally implementation of the Accounting Source Adapter.
 * Implements normalizeChartOfAccounts (via normalizeCoaPayload) and embeds
 * normalizeMonthlyBalances in the same output (chartOfAccounts.balances).
 * See docs/SOURCE_ADAPTER_ARCHITECTURE.md and backend/src/contracts/AccountingSourceAdapter.js.
 */
const crypto = require('crypto');
const { normalizeMonth, getCurrentMonthKey } = require('../utils/monthKeyUtils');

const toArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const normalizeText = (value) => (value || '').toString().trim();

const hashGuid = (companyId, name, groupPath) => {
  const input = `${companyId || 'company'}|${name || 'ledger'}|${(groupPath || []).join('>')}`;
  return crypto.createHash('sha256').update(input).digest('hex');
};

const extractGroups = (payload) => {
  return toArray(payload.groups || payload.Groups || payload.GROUPS || payload.groupList || payload.masterGroups || payload.MASTERGROUPS);
};

const extractLedgers = (payload) => {
  return toArray(payload.ledgers || payload.Ledgers || payload.LEDGERS || payload.ledgerList || payload.masterLedgers || payload.MASTERLEDGERS);
};

const getField = (obj, keys) => {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return null;
};

const parseBalance = (ledger) => {
  const raw = getField(ledger, ['closingBalance', 'closing_balance', 'balance', 'ClosingBalance', 'CLOSINGBALANCE']);
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
};

const normalizeCoaPayload = (raw, companyId) => {
  if (!raw) return null;

  const groups = extractGroups(raw).map((g) => ({
    name: normalizeText(getField(g, ['name', 'Name', 'GROUPNAME', 'groupName'])),
    parent: normalizeText(getField(g, ['parent', 'Parent', 'PARENT', 'parentName', 'PARENTNAME', 'parentGroup'])),
    reservedName: normalizeText(getField(g, ['reservedName', 'RESERVEDNAME', 'ReservedName'])),
    guid: normalizeText(getField(g, ['guid', 'GUID', 'id', 'Id'])),
    type: 'Group'
  })).filter((g) => g.name);

  const ledgersRaw = extractLedgers(raw);
  const ledgers = ledgersRaw.map((l) => {
    const name = normalizeText(getField(l, ['name', 'Name', 'LEDGERNAME', 'ledgerName']));
    const parent = normalizeText(getField(l, ['parent', 'Parent', 'PARENT', 'parentName', 'PARENTNAME', 'group', 'groupName', 'parentGroup']));
    const guid = normalizeText(getField(l, ['guid', 'GUID', 'id', 'Id', 'ledgerGuid']));
    const groupPath = parent ? [parent] : [];
    const stableGuid = guid || hashGuid(companyId, name, groupPath);
    return {
      guid: stableGuid,
      name,
      parent,
      groupName: parent,
      type: 'Ledger'
    };
  }).filter((l) => l.name && l.parent);

  const asOfDate = normalizeText(getField(raw, ['asOfDate', 'as_of_date', 'ASOFDATE'])) || null;
  const monthKey = normalizeMonth(asOfDate || new Date()) || getCurrentMonthKey();

  const currentItems = [];
  ledgersRaw.forEach((l) => {
    const name = normalizeText(getField(l, ['name', 'Name', 'LEDGERNAME', 'ledgerName']));
    const parent = normalizeText(getField(l, ['parent', 'Parent', 'PARENT', 'parentName', 'PARENTNAME', 'group', 'groupName', 'parentGroup']));
    const guid = normalizeText(getField(l, ['guid', 'GUID', 'id', 'Id', 'ledgerGuid'])) || hashGuid(companyId, name, parent ? [parent] : []);
    const balance = parseBalance(l);
    if (name && parent && balance !== null) {
      currentItems.push({ ledgerGuid: guid, balance });
    }
  });

  const closedMonths = toArray(raw.closedMonths || raw.closed_months || []).map((entry) => {
    const key = normalizeMonth(getField(entry, ['monthKey', 'month', 'MONTH'])) || null;
    const items = toArray(entry.items || entry.ledgers || []).map((item) => ({
      ledgerGuid: getField(item, ['ledgerGuid', 'guid', 'GUID', 'id']),
      balance: Number(getField(item, ['balance', 'closingBalance', 'closing_balance'])) || 0
    })).filter((i) => i.ledgerGuid);
    return key ? { monthKey: key, items } : null;
  }).filter(Boolean);

  return {
    chartOfAccounts: {
      source: 'tally',
      generatedAt: new Date().toISOString(),
      groups,
      ledgers,
      balances: {
        current: {
          monthKey,
          asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
          items: currentItems
        },
        closedMonths
      }
    },
    asOfDate: asOfDate || new Date().toISOString().slice(0, 10)
  };
};

module.exports = { normalizeCoaPayload };
