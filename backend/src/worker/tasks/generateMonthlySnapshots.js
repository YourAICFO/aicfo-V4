const { recomputeSnapshots } = require('../../services/monthlySnapshotService');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const generateMonthlySnapshots = async ({ companyId, amendedMonth, debtors, creditors }) => {
  await assertTrialOrActive(companyId);
  return recomputeSnapshots(companyId, amendedMonth || null, new Date(), debtors || null, creditors || null);
};

module.exports = { generateMonthlySnapshots };
