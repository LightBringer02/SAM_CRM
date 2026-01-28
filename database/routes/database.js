// database/routes/database.js
const express = require('express');
const { reinitializePool, testConnection } = require('../sql/connection');
const { extractUser, requireRoot } = require('../../backend/middleware/authMiddleware');

const router = express.Router();

// POST /api/database/reload - ROOT only
router.post('/reload', extractUser, requireRoot, async (req, res) => {
  try {
    const result = await reinitializePool();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/database/status - ROOT only
router.get('/status', extractUser, requireRoot, async (req, res) => {
  try {
    const result = await testConnection();
    res.json(result);
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

module.exports = router;
