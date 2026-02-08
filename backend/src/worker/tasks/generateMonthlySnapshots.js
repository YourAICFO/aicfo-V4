const { recomputeSnapshots } = require('../../services/monthlySnapshotService');
const { assertTrialOrActive } = require('../../services/subscriptionService');

const generateMonthlySnapshots = async ({ companyId, amendedMonth }) => {
  await assertTrialOrActive(companyId);
  return recomputeSnapshots(companyId, amendedMonth || null, new Date());
};

module.exports = { generateMonthlySnapshots };
