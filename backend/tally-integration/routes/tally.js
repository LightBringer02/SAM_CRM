// backend/tally-integration/routes/tally.js
const express = require('express');
const router = express.Router();
const { fetchInventory } = require('../tally-connector');

// Route to import inventory data from Tally Prime
router.get('/inventory', async (req, res) => {
  try {
    const data = await fetchInventory();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
