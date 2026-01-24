const express = require('express');
const router = express.Router();
const { fetchInventory } = require('../connection/inventory');  // FIXED PATH

router.get('/', async (req, res) => {
  try {
    const data = await fetchInventory();

    const mapped = data.map((item, idx) => ({
      serial: idx + 1,
      name: item.name,
      alias: item.alias,
      group: item.group,
      category: item.category,
      hsn: item.hsn,
      gst: item.gst,
      rate: item.rate,
      quantity: item.quantity,
      unit: item.unit,
      stock: item.stock || 0,
      purchase_rate: item.purchase_rate || 0,
      selling_rate: item.selling_rate || 0,
      opening_balance: item.opening_balance || 0,
      opening_value: item.opening_value || 0,
      closing_value: item.closing_value || 0,
    }));

    res.json({ success: true, data: mapped });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
