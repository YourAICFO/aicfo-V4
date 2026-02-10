const { recomputeSnapshots } = require('../../services/monthlySnapshotService');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const generateMonthlySnapshots = async ({ companyId, amendedMonth, debtors, creditors, currentBalances, chartOfAccounts }) => {
  await assertTrialOrActive(companyId);
  return recomputeSnapshots(
    companyId,
    amendedMonth || null,
    new Date(),
    debtors || null,
    creditors || null,
    currentBalances || null,
    chartOfAccounts || null
  );
};

module.exports = { generateMonthlySnapshots };
