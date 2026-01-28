const express = require('express');
const router = express.Router();
const { fetchInventory } = require('../connection/inventory');  // FIXED PATH
const { isDummyMode, isOfflineMode, getBackendMode } = require('../config/systemConfig');
const { getDummyInventory } = require('../config/dummyData');

// Import sync service for database fallback
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available for inventory:', err.message);
}

router.get('/', async (req, res) => {
  try {
    const mode = getBackendMode();
    
    // Check if dummy data mode is enabled
    if (isDummyMode()) {
      const dummyData = getDummyInventory();
      return res.json({ success: true, data: dummyData, mode: 'DUMMY_DATA' });
    }

    // Check if offline mode - fetch from database
    if (mode === 'OFFLINE') {
      if (tallySyncService) {
        const dbData = await tallySyncService.getStockItemsFromDb();
        // Filter out items with empty names
        const filtered = dbData.filter(item => item.name && item.name.trim() !== '');
        const mapped = filtered.map((item, idx) => ({
          serial: idx + 1,
          name: item.name,
          alias: item.alias || 'N/A',
          group: item.parent || '',
          category: item.category || '',
          hsn: item.hsn_code || '',
          gst: item.gst_rate || 0,
          rate: item.closing_rate || 0,
          quantity: item.closing_qty || 0,
          unit: item.unit || '',
          stock: item.closing_value || 0,
          purchase_rate: item.opening_rate || 0,
          selling_rate: item.closing_rate || 0,
          opening_balance: item.opening_qty || 0,
          opening_value: item.opening_value || 0,
          closing_value: item.closing_value || 0,
        }));
        return res.json({ 
          success: true, 
          data: mapped, 
          mode: 'OFFLINE',
          message: 'Data loaded from database (Tally offline)',
          fromDatabase: true
        });
      }
      return res.json({ 
        success: true, 
        data: [], 
        mode: 'OFFLINE',
        message: 'Offline mode - no cached data available'
      });
    }

    // Try to fetch from Tally first
    let data = [];
    let fromDatabase = false;
    
    try {
      data = await fetchInventory();
      
      // If we got data from Tally, sync it to database
      if (data.length > 0 && tallySyncService) {
        // Convert to sync format and store
        const stockItems = data.map(item => ({
          name: item.name,
          alias: item.alias || '',
          parent: item.group,
          category: item.category,
          opening_qty: item.opening_balance || 0,
          opening_rate: item.purchase_rate || 0,
          opening_value: item.opening_value || 0,
          closing_qty: item.quantity || 0,
          closing_rate: item.rate || 0,
          closing_value: item.closing_value || 0,
          unit: item.unit,
          gst_rate: item.gst || 0,
          hsn_code: item.hsn
        }));
        await tallySyncService.syncStockItemsToDb(stockItems);
      }
    } catch (tallyErr) {
      console.warn('Tally fetch failed, falling back to database:', tallyErr.message);
      
      // Fallback to database
      if (tallySyncService) {
        const dbData = await tallySyncService.getStockItemsFromDb();
        // Filter out items with empty names
        const filtered = dbData.filter(item => item.name && item.name.trim() !== '');
        data = filtered.map(item => ({
          name: item.name,
          alias: item.alias || 'N/A',
          group: item.parent || '',
          category: item.category || '',
          hsn: item.hsn_code || '',
          gst: item.gst_rate || 0,
          rate: item.closing_rate || 0,
          quantity: item.closing_qty || 0,
          unit: item.unit || '',
          stock: item.closing_value || 0,
          purchase_rate: item.opening_rate || 0,
          selling_rate: item.closing_rate || 0,
          opening_balance: item.opening_qty || 0,
          opening_value: item.opening_value || 0,
          closing_value: item.closing_value || 0,
        }));
        fromDatabase = true;
      }
    }

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

    res.json({ 
      success: true, 
      data: mapped,
      mode: mode,
      fromDatabase,
      message: fromDatabase ? 'Data loaded from database (Tally offline)' : 'Data loaded from Tally'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
