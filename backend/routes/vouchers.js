const express = require('express');
const router = express.Router();
const { fetchVouchers, calculateUnpaidAmounts } = require('../connection/voucherRegister');
const { getCompanyDetails } = require('../connection/companyParser');
const { isDummyMode, getBackendMode } = require('../config/systemConfig');
const { getDummyVouchers, getDummyCompany, getDummyVoucherById } = require('../config/dummyData');

// Import sync service for database fallback
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available for vouchers:', err.message);
}

// GET /api/vouchers - fetch all voucher register entries with filtering
router.get('/', async (req, res) => {
  try {
    const mode = getBackendMode();
    
    // Check if dummy data mode is enabled
    if (isDummyMode()) {
      const dummyVouchers = getDummyVouchers(req.query);
      return res.json(dummyVouchers);
    }

    // Check if offline mode - fetch from database
    if (mode === 'OFFLINE') {
      if (tallySyncService) {
        // getVouchersFromDb now returns full voucher data from voucher_data JSON
        let vouchers = await tallySyncService.getVouchersFromDb();
        
        // Normalize field names for consistency (database may have party_name but frontend expects party_ledger)
        vouchers = vouchers.map(v => ({
          ...v,
          party_ledger: v.party_ledger || v.party_name || v.party || '',
          amount: Number(v.amount) || Number(v.totalAmount) || 0
        }));
        
        // Apply filters
        vouchers = applyVoucherFilters(vouchers, req.query);
        
        return res.json({ 
          success: true, 
          vouchers: vouchers, 
          total: vouchers.length,
          mode: 'OFFLINE',
          fromDatabase: true,
          message: 'Data loaded from database (Tally offline)'
        });
      }
      return res.json({ 
        success: true, 
        vouchers: [], 
        total: 0,
        mode: 'OFFLINE',
        message: 'Offline mode - no cached data available'
      });
    }

    let vouchers = [];
    let fromDatabase = false;
    
    try {
      vouchers = await fetchVouchers();
      
      // Calculate unpaid amounts for sales/purchase vouchers
      vouchers = calculateUnpaidAmounts(vouchers);
      
      // Sync FULL voucher data to database (including items, ledgers, GST, etc.)
      if (vouchers.length > 0 && tallySyncService) {
        // Pass full voucher objects - syncVouchersToDb will store them as JSON
        await tallySyncService.syncVouchersToDb(vouchers);
      }
    } catch (tallyErr) {
      console.warn('Tally voucher fetch failed, falling back to database:', tallyErr.message);
      
      // Fallback to database - returns full voucher data from voucher_data JSON
      if (tallySyncService) {
        vouchers = await tallySyncService.getVouchersFromDb();
        // Normalize field names
        vouchers = vouchers.map(v => ({
          ...v,
          party_ledger: v.party_ledger || v.party_name || v.party || '',
          amount: Number(v.amount) || Number(v.totalAmount) || 0
        }));
        fromDatabase = true;
      }
    }
    
    // Apply filters
    vouchers = applyVoucherFilters(vouchers, req.query);
    
    res.json({
      vouchers: vouchers,
      total: vouchers.length,
      mode: mode,
      fromDatabase,
      message: fromDatabase ? 'Data loaded from database (Tally offline)' : 'Data loaded from Tally'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vouchers', details: err.message });
  }
});

// Helper function to apply voucher filters
function applyVoucherFilters(vouchers, query) {
  const { from, to, search, type, party_ledger, daybook } = query;
  
  // Date filter (inclusive)
  if (from) {
    vouchers = vouchers.filter(v => v.date && v.date >= from);
  }
  if (to) {
    vouchers = vouchers.filter(v => v.date && v.date <= to);
  }
  
  // Daybook mode: filter to today only
  if (daybook === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    vouchers = vouchers.filter(v => v.date === today);
  }
  
  // Voucher type filter (case-insensitive, handle underscores vs spaces)
  if (type && type.toLowerCase() !== 'all') {
    // Normalize type: convert underscores to spaces for matching
    const normalizedType = type.toLowerCase().replace(/_/g, ' ');
    // Also create underscore version for matching
    const underscoreType = type.toLowerCase().replace(/ /g, '_');
    
    vouchers = vouchers.filter(v => {
      const vt = (v.voucher_type || '').toLowerCase();
      const vtNormalized = vt.replace(/_/g, ' ').replace(/ +/g, ' ').trim();
      const vtUnderscore = vt.replace(/ /g, '_');
      
      // Match against any variant
      return vtNormalized.includes(normalizedType) || 
             vtUnderscore.includes(underscoreType) ||
             vt.includes(type.toLowerCase());
    });
  }
  
  // Party ledger filter (case-insensitive)
  if (party_ledger) {
    vouchers = vouchers.filter(v => 
      (v.party_ledger || '').toLowerCase().includes(party_ledger.toLowerCase())
    );
  }
  
  // Search filter (searches voucher number, party ledger, amount, narration)
  if (search) {
    const s = search.toLowerCase();
    vouchers = vouchers.filter(v =>
      (v.voucher_number || '').toLowerCase().includes(s) ||
      (v.party_ledger || '').toLowerCase().includes(s) ||
      String(v.amount || '').toLowerCase().includes(s) ||
      (v.narration || '').toLowerCase().includes(s)
    );
  }
  
  return vouchers;
}

// GET /api/vouchers/company - fetch company details
router.get('/company', async (req, res) => {
  try {
    const mode = getBackendMode();
    
    // Check if dummy data mode is enabled
    if (isDummyMode()) {
      const dummyCompany = getDummyCompany();
      return res.json(dummyCompany);
    }

    // Try to get company details from Tally first
    let company = null;
    try {
      company = await getCompanyDetails();
      
      // If we got company details, cache them to database for offline use
      if (company && tallySyncService && tallySyncService.cacheCompanyDetails) {
        await tallySyncService.cacheCompanyDetails(company);
      }
    } catch (tallyErr) {
      console.warn('Failed to fetch company details from Tally:', tallyErr.message);
    }

    // If no company details from Tally (offline or error), try to get from cache/database
    if (!company) {
      if (tallySyncService && tallySyncService.getCachedCompanyDetails) {
        company = await tallySyncService.getCachedCompanyDetails();
      }
    }

    // If still no company, return fallback for offline mode
    if (!company) {
      return res.json({ 
        company_name: 'Company (Offline)',
        formal_name: 'Company (Offline)',
        address: '',
        gstin: '',
        mode: mode || 'OFFLINE',
        message: 'Company details not available - Tally offline'
      });
    }
    
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company details', details: err.message });
  }
});

// GET /api/vouchers/:id - fetch single voucher by ID/number
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const mode = getBackendMode();

    // Check if dummy data mode is enabled
    if (isDummyMode()) {
      const dummyVoucher = getDummyVoucherById(id);
      if (!dummyVoucher) {
        return res.status(404).json({ error: 'Voucher not found' });
      }
      return res.json(dummyVoucher);
    }

    // Check if offline mode
    if (mode === 'OFFLINE') {
      return res.status(404).json({ 
        error: 'Voucher lookup not available in offline mode',
        mode: 'OFFLINE'
      });
    }

    let vouchers = await fetchVouchers();
    vouchers = calculateUnpaidAmounts(vouchers);
    
    const voucher = vouchers.find(v => 
      v.voucher_number === id || 
      v.guid === id || 
      v.number === id
    );
    
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    res.json(voucher);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch voucher', details: err.message });
  }
});

module.exports = router;
