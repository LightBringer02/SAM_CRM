const express = require('express');
const router = express.Router();
const { extractUser, requireAdmin } = require('../middleware/authMiddleware');

// In-memory storage (in production, use database)
let blacklistedLedgers = [];

// Load from file on startup
const fs = require('fs');
const path = require('path');
const BLACKLIST_FILE = path.join(__dirname, '../data/blacklisted_ledgers.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load blacklist from file
function loadBlacklist() {
  try {
    if (fs.existsSync(BLACKLIST_FILE)) {
      const data = fs.readFileSync(BLACKLIST_FILE, 'utf8');
      blacklistedLedgers = JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load blacklist:', err);
    blacklistedLedgers = [];
  }
}

// Save blacklist to file
function saveBlacklist() {
  try {
    fs.writeFileSync(BLACKLIST_FILE, JSON.stringify(blacklistedLedgers, null, 2));
    return true;
  } catch (err) {
    console.error('Failed to save blacklist:', err);
    return false;
  }
}

// Load on startup
loadBlacklist();

/**
 * GET /api/blacklist
 * Get all blacklisted ledgers (admin only)
 */
router.get('/', extractUser, requireAdmin, (req, res) => {
  res.json({
    success: true,
    ledgers: blacklistedLedgers,
    total: blacklistedLedgers.length
  });
});

/**
 * POST /api/blacklist/add
 * Add a ledger to blacklist (admin only)
 * Body: { ledgerName, ledgerId?, reason?, addedBy? }
 */
router.post('/add', extractUser, requireAdmin, (req, res) => {
  try {
    const { ledgerName, ledgerId, reason } = req.body;
    
    if (!ledgerName) {
      return res.status(400).json({ success: false, error: 'Ledger name is required' });
    }
    
    // Check if already blacklisted
    const exists = blacklistedLedgers.find(l => 
      l.name.toLowerCase() === ledgerName.toLowerCase()
    );
    
    if (exists) {
      return res.status(400).json({ 
        success: false, 
        error: 'Ledger is already blacklisted' 
      });
    }
    
    const entry = {
      id: Date.now().toString(),
      name: ledgerName,
      ledgerId: ledgerId || null,
      reason: reason || 'No reason provided',
      addedBy: req.user?.username || req.user?.id || 'admin',
      addedAt: new Date().toISOString()
    };
    
    blacklistedLedgers.push(entry);
    saveBlacklist();
    
    res.json({
      success: true,
      message: `${ledgerName} has been blacklisted`,
      entry
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/blacklist/remove/:id
 * Remove a ledger from blacklist (admin only)
 */
router.delete('/remove/:id', extractUser, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    
    const index = blacklistedLedgers.findIndex(l => l.id === id);
    
    if (index === -1) {
      return res.status(404).json({ 
        success: false, 
        error: 'Blacklist entry not found' 
      });
    }
    
    const removed = blacklistedLedgers.splice(index, 1)[0];
    saveBlacklist();
    
    res.json({
      success: true,
      message: `${removed.name} has been removed from blacklist`,
      removed
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/blacklist/check/:name
 * Check if a ledger is blacklisted (for order creation)
 * Available to all authenticated users
 */
router.get('/check/:name', extractUser, (req, res) => {
  try {
    const { name } = req.params;
    
    const found = blacklistedLedgers.find(l => 
      l.name.toLowerCase() === name.toLowerCase()
    );
    
    res.json({
      success: true,
      isBlacklisted: !!found,
      reason: found?.reason || null
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PUT /api/blacklist/update/:id
 * Update blacklist entry reason (admin only)
 */
router.put('/update/:id', extractUser, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    const entry = blacklistedLedgers.find(l => l.id === id);
    
    if (!entry) {
      return res.status(404).json({ 
        success: false, 
        error: 'Blacklist entry not found' 
      });
    }
    
    entry.reason = reason || entry.reason;
    entry.updatedAt = new Date().toISOString();
    entry.updatedBy = req.user?.username || req.user?.id || 'admin';
    
    saveBlacklist();
    
    res.json({
      success: true,
      message: 'Blacklist entry updated',
      entry
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
