/**
 * Fetch Routes
 * REST API for Tally data fetching - ROOT only
 */

const express = require('express');
const router = express.Router();

// Import modules
const { extractUser, requireRoot, requireAdmin } = require('../../backend/middleware/authMiddleware');
const fetchService = require('../fetch_service');

// Apply auth middleware
router.use(extractUser);

/**
 * GET /api/fetch/status
 * Get Tally connection status (Admin+)
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const status = await fetchService.testTallyConnection();
    
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/fetch/history
 * Get fetch history (ROOT only)
 */
router.get('/history', requireRoot, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const history = await fetchService.getFetchHistory(parseInt(limit));
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fetch/all
 * Fetch all Tally data (ROOT only)
 */
router.post('/all', requireRoot, async (req, res) => {
  try {
    const { useQueue = false } = req.body;
    const result = await fetchService.fetchTallyData({ useQueue });
    
    res.json({
      success: true,
      message: useQueue ? 'Fetch job queued' : 'Fetch completed',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fetch/inventory
 * Fetch inventory from Tally (ROOT only)
 */
router.post('/inventory', requireRoot, async (req, res) => {
  try {
    const { useQueue = false, storeInDb = true } = req.body;
    const result = await fetchService.fetchInventory({ useQueue, storeInDb });
    
    res.json({
      success: true,
      message: useQueue ? 'Inventory fetch job queued' : 'Inventory fetch completed',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fetch/vouchers
 * Fetch vouchers from Tally (ROOT only)
 */
router.post('/vouchers', requireRoot, async (req, res) => {
  try {
    const { useQueue = false, storeInDb = true, fromDate, toDate } = req.body;
    const result = await fetchService.fetchVouchers({ 
      useQueue, 
      storeInDb, 
      fromDate, 
      toDate 
    });
    
    res.json({
      success: true,
      message: useQueue ? 'Voucher fetch job queued' : 'Voucher fetch completed',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fetch/ledgers
 * Fetch ledgers from Tally (ROOT only)
 */
router.post('/ledgers', requireRoot, async (req, res) => {
  try {
    const { useQueue = false, storeInDb = true } = req.body;
    const result = await fetchService.fetchLedgers({ useQueue, storeInDb });
    
    res.json({
      success: true,
      message: useQueue ? 'Ledger fetch job queued' : 'Ledger fetch completed',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/fetch/test
 * Test Tally connection (Admin+)
 */
router.post('/test', requireAdmin, async (req, res) => {
  try {
    const result = await fetchService.testTallyConnection();
    
    res.json({
      success: result.connected,
      message: result.connected ? 'Tally connection successful' : 'Tally connection failed',
      data: result
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
