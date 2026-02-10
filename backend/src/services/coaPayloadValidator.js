const parseDateOnly = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const validateChartOfAccountsPayload = (payloadOrChartOfAccounts) => {
  if (!payloadOrChartOfAccounts) {
    return { ok: false, error: 'chartOfAccounts missing' };
  }

  const chartOfAccounts = payloadOrChartOfAccounts.chartOfAccounts || payloadOrChartOfAccounts;
  const asOfDate = parseDateOnly(payloadOrChartOfAccounts.asOfDate || payloadOrChartOfAccounts.as_of_date || chartOfAccounts.asOfDate || chartOfAccounts.as_of_date);

  if (!chartOfAccounts) {
    return { ok: false, error: 'chartOfAccounts missing' };
  }

  const groups = Array.isArray(chartOfAccounts.groups) ? chartOfAccounts.groups : null;
  const ledgers = Array.isArray(chartOfAccounts.ledgers) ? chartOfAccounts.ledgers : null;

  if (!groups) {
    return { ok: false, error: 'groups must be an array' };
  }
  if (!ledgers || ledgers.length === 0) {
    return { ok: false, error: 'ledgers must be a non-empty array' };
  }

  for (const ledger of ledgers) {
    const name = ledger.name || ledger.ledgerName || ledger.ledger_name;
    const parent = ledger.parent || ledger.parentGroup || ledger.parent_group || ledger.group || ledger.group_name;
    const guid = ledger.guid || ledger.ledgerGuid || ledger.ledger_guid || ledger.id;
    if (!name || !parent || !guid) {
      return { ok: false, error: 'ledger must include name, parent, guid' };
    }
  }

  return { ok: true, chartOfAccounts: { groups, ledgers }, asOfDate };
};

module.exports = { validateChartOfAccountsPayload };
