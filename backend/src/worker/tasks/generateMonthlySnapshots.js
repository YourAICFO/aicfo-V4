const { recomputeSnapshots } = require('../../services/monthlySnapshotService');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const generateMonthlySnapshots = async ({ companyId, amendedMonth, debtors, creditors, currentBalances }) => {
  await assertTrialOrActive(companyId);
  return recomputeSnapshots(companyId, amendedMonth || null, new Date(), debtors || null, creditors || null, currentBalances || null);
};

module.exports = { generateMonthlySnapshots };
