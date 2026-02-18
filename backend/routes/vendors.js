const express = require('express');
const router = express.Router();
const { getBackendMode, isDummyMode } = require('../config/systemConfig');

// Import sync service for database operations
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available for vendors:', err.message);
}

// Ledger group mappings
const LEDGER_GROUPS = {
  'sundry-debtors': ['Sundry Debtors'],
  'sundry-creditors': ['Sundry Creditors'],
  'cash': ['Cash-in-Hand', 'Cash'],
  'bank': ['Bank Accounts', 'Bank OD A/c', 'Bank OCC A/c']
};

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * GET /api/vendors/ledgers/:group
 * Fetch ledgers by group (sundry-debtors, sundry-creditors, cash, bank)
 */
router.get('/ledgers/:group', async (req, res) => {
  try {
    const { group } = req.params;
    const { search, page = 1, limit = 50 } = req.query;
    
    const groupNames = LEDGER_GROUPS[group];
    if (!groupNames) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid group: ${group}. Valid groups: ${Object.keys(LEDGER_GROUPS).join(', ')}` 
      });
    }
    
    const mode = getBackendMode();
    let ledgers = [];
    let fromDatabase = false;
    
    // Try to fetch from Tally first if in LIVE mode
    if (mode === 'LIVE' && tallySyncService) {
      try {
        const allLedgers = await tallySyncService.fetchLedgersFromTally();
        
        // Filter by parent group - use EXACT matching
        ledgers = allLedgers.filter(l => {
          const parent = normalizeGroupName(l.parent);
          return groupNames.some(g => parent === normalizeGroupName(g));
        });
        
        // Sync to database for offline use
        if (allLedgers.length > 0) {
          await tallySyncService.syncLedgersToDb(allLedgers);
        }
      } catch (tallyErr) {
        console.warn('Tally ledgers fetch failed, falling back to database:', tallyErr.message);
        fromDatabase = true;
      }
    }
    
    // Fallback to database
    if (ledgers.length === 0 || fromDatabase || mode === 'OFFLINE') {
      if (tallySyncService) {
        const allDbLedgers = await tallySyncService.getLedgersFromDb();
        ledgers = allDbLedgers.filter(l => {
          const parent = normalizeGroupName(l.parent);
          return groupNames.some(g => parent === normalizeGroupName(g));
        });
        fromDatabase = true;
      }
    }
    
    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      ledgers = ledgers.filter(l => 
        (l.name || '').toLowerCase().includes(searchLower) ||
        (l.address || '').toLowerCase().includes(searchLower) ||
        (l.phone || '').toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by name
    ledgers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    
    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLedgers = ledgers.slice(offset, offset + parseInt(limit));
    
    res.json({
      success: true,
      ledgers: paginatedLedgers,
      total: ledgers.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(ledgers.length / parseInt(limit)),
      group,
      groupNames,
      mode,
      fromDatabase
    });
  } catch (err) {
    console.error('Error fetching ledgers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/vendors/summary
 * Get summary counts for all vendor groups
 */
router.get('/summary', async (req, res) => {
  try {
    const mode = getBackendMode();
    let allLedgers = [];
    let fromDatabase = false;
    
    // Try to fetch from Tally first if in LIVE mode
    if (mode === 'LIVE' && tallySyncService) {
      try {
        allLedgers = await tallySyncService.fetchLedgersFromTally();
        
        // Sync to database for offline use
        if (allLedgers.length > 0) {
          await tallySyncService.syncLedgersToDb(allLedgers);
        }
      } catch (tallyErr) {
        console.warn('Tally ledgers fetch failed, falling back to database:', tallyErr.message);
        fromDatabase = true;
      }
    }
    
    // Fallback to database
    if (allLedgers.length === 0 || fromDatabase || mode === 'OFFLINE') {
      if (tallySyncService) {
        allLedgers = await tallySyncService.getLedgersFromDb();
        fromDatabase = true;
      }
    }
    
    // Calculate totals for each group
    const summary = {};
    for (const [groupKey, groupNames] of Object.entries(LEDGER_GROUPS)) {
      const groupLedgers = allLedgers.filter(l => {
        const parent = normalizeGroupName(l.parent);
        return groupNames.some(g => parent === normalizeGroupName(g));
      });
      
      const totalOpening = groupLedgers.reduce((sum, l) => sum + (parseFloat(l.opening_balance) || 0), 0);
      const totalClosing = groupLedgers.reduce((sum, l) => sum + (parseFloat(l.closing_balance) || 0), 0);
      
      summary[groupKey] = {
        count: groupLedgers.length,
        openingBalance: totalOpening,
        closingBalance: totalClosing,
        groupNames
      };
    }
    
    res.json({
      success: true,
      summary,
      totalLedgers: allLedgers.length,
      mode,
      fromDatabase
    });
  } catch (err) {
    console.error('Error fetching vendor summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/vendors/ledger/:name
 * Get details of a specific ledger by name
 */
router.get('/ledger/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const mode = getBackendMode();
    let ledger = null;
    let fromDatabase = false;
    
    // Try to fetch from Tally first if in LIVE mode
    if (mode === 'LIVE' && tallySyncService) {
      try {
        const allLedgers = await tallySyncService.fetchLedgersFromTally();
        ledger = allLedgers.find(l => l.name.toLowerCase() === name.toLowerCase());
      } catch (tallyErr) {
        console.warn('Tally ledger fetch failed, falling back to database:', tallyErr.message);
        fromDatabase = true;
      }
    }
    
    // Fallback to database
    if (!ledger || fromDatabase || mode === 'OFFLINE') {
      if (tallySyncService) {
        const allDbLedgers = await tallySyncService.getLedgersFromDb();
        ledger = allDbLedgers.find(l => l.name.toLowerCase() === name.toLowerCase());
        fromDatabase = true;
      }
    }
    
    if (!ledger) {
      return res.status(404).json({ success: false, error: 'Ledger not found' });
    }
    
    res.json({
      success: true,
      ledger,
      mode,
      fromDatabase
    });
  } catch (err) {
    console.error('Error fetching ledger:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
