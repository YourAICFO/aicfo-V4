const express = require('express');
const router = express.Router();

/* ===============================
   Health / sanity route
================================ */
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Auth API is live',
  });
});

/* ===============================
   Auth routes (examples)
================================ */
// router.post('/login', ...)
// router.post('/register', ...)

module.exports = router;
