const express = require('express');
const router = express.Router();

// GET /api/dashboard
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard API working',
    data: {
      revenue: 120000,
      expenses: 45000,
      cashBalance: 75000
    }
  });
});

module.exports = router;
