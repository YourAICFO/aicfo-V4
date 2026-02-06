require('dotenv').config();
const { lockExpiredTrials } = require('../services/subscriptionService');

const run = async () => {
  try {
    await lockExpiredTrials();
    process.exit(0);
  } catch (error) {
    console.error('Lock expired trials job failed:', error);
    process.exit(1);
  }
};

run();
