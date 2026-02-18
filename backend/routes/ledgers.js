const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getBackendMode, isDummyMode, getTallyUrl } = require('../config/systemConfig');

// Import sync service for database operations
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available for ledgers:', err.message);
}

// Import GST details service
let ledgerGSTService;
try {
  ledgerGSTService = require('../connection/ledgerGST');
} catch (err) {
  console.warn('LedgerGST service not available:', err.message);
}

// Ledger group mappings - All Tally groups
const LEDGER_GROUPS = {
  'sundry-debtors': ['Sundry Debtors'],
  'sundry-creditors': ['Sundry Creditors'],
  'cash': ['Cash-in-Hand', 'Cash'],
  'bank': ['Bank Accounts'],
  'bank-occ': ['Bank OCC A/c'],
  'bank-od': ['Bank OD A/c'],
  'capital-account': ['Capital Account'],
  'current-assets': ['Current Assets'],
  'current-liabilities': ['Current Liabilities'],
  'deposits': ['Deposits (Asset)'],
  'direct-expenses': ['Direct Expenses', 'Direct Expense', 'Expenses (Direct)', 'Expense (Direct)'],
  'direct-incomes': ['Direct Incomes', 'Direct Income', 'Income (Direct)'],
  'duties-taxes': ['Duties & Taxes', 'Duties and Taxes'],
  'indirect-expenses': ['Indirect Expenses', 'Indirect Expense', 'Expenses (Indirect)', 'Expense (Indirect)'],
  'indirect-incomes': ['Indirect Incomes', 'Indirect Income', 'Income (Indirect)'],
  'fixed-assets': ['Fixed Assets'],
  'investments': ['Investments'],
  'loans-advances': ['Loans & Advances (Asset)'],
  'loans-liability': ['Loans (Liability)'],
  'provisions': ['Provisions'],
  'purchase-accounts': ['Purchase Accounts'],
  'reserves-surplus': ['Reserves & Surplus'],
  'sales-accounts': ['Sales Accounts'],
  'secured-loans': ['Secured Loans'],
  'unsecured-loans': ['Unsecured Loans'],
  'suspense': ['Suspense A/c'],
  'stock-in-hand': ['Stock-in-Hand'],
  'branch-divisions': ['Branch / Divisions'],
  'misc-expenses': ['Misc. Expenses (ASSET)'],
  'retained-earnings': ['Retained Earnings']
};

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

/**
 * GET /api/ledgers/list/:group
 * Fetch ledgers by group (sundry-debtors, sundry-creditors, cash, bank)
 * Merges GST details from ledgerGSTService for complete compliance data
 */
router.get('/list/:group', async (req, res) => {
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
        
        // Filter by parent group - use EXACT matching to avoid mixing groups
        // e.g., "Indirect Expenses" should NOT match "Direct Expenses"
        const normalizedTargets = groupNames.map(g => normalizeGroupName(g));
        console.log(`[Ledgers] Filtering for group '${group}' with normalized targets:`, normalizedTargets);
        
        ledgers = allLedgers.filter(l => {
          const parent = normalizeGroupName(l.parent);
          const matches = normalizedTargets.includes(parent);
          if (matches && (group === 'direct-expenses' || group === 'indirect-expenses' || group === 'direct-incomes' || group === 'indirect-incomes')) {
            console.log(`  ✓ Matched: ${l.name} (parent: "${l.parent}" -> "${parent}")`);
          }
          return matches;
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
        // Use EXACT matching to avoid mixing groups
        const normalizedTargets = groupNames.map(g => normalizeGroupName(g));
        console.log(`[Ledgers DB] Filtering for group '${group}' with normalized targets:`, normalizedTargets);
        
        ledgers = allDbLedgers.filter(l => {
          const parent = normalizeGroupName(l.parent);
          const matches = normalizedTargets.includes(parent);
          if (matches && (group === 'direct-expenses' || group === 'indirect-expenses' || group === 'direct-incomes' || group === 'indirect-incomes')) {
            console.log(`  ✓ Matched: ${l.name} (parent: "${l.parent}" -> "${parent}")`);
          }
          return matches;
        });
        fromDatabase = true;
      }
    }
    
    // Merge GST details from ledgerGSTService for missing compliance fields
    if (ledgerGSTService && ledgers.length > 0) {
      try {
        const gstMap = await ledgerGSTService.buildGSTDetailsMap();
        ledgers = ledgers.map(ledger => {
          const gstDetails = gstMap[(ledger.name || '').toLowerCase()];
          if (gstDetails) {
            // Merge GST details only if missing in main ledger data
            return {
              ...ledger,
              gstin: ledger.gstin || gstDetails.gstin || '',
              gst_type: ledger.gst_type || gstDetails.gst_type || '',
              state: ledger.state || gstDetails.state || '',
              country: ledger.country || gstDetails.country || '',
              place_of_supply: ledger.place_of_supply || gstDetails.place_of_supply || '',
              pan: ledger.pan || gstDetails.pan || '',
              address: ledger.address || gstDetails.address || '',
              email: ledger.email || gstDetails.email || '',
              phone: ledger.phone || gstDetails.phone || '',
              mailing_name: ledger.mailing_name || gstDetails.mailing_name || ''
            };
          }
          return ledger;
        });
      } catch (gstErr) {
        console.warn('Failed to merge GST details:', gstErr.message);
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
 * GET /api/ledgers/summary
 * Get summary counts for all ledger groups
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
      // Use EXACT matching to avoid mixing groups like Direct/Indirect Expenses
      const normalizedTargets = groupNames.map(g => normalizeGroupName(g));
      const groupLedgers = allLedgers.filter(l => {
        const parent = normalizeGroupName(l.parent);
        return normalizedTargets.includes(parent);
      });
      
      if ((groupKey === 'direct-expenses' || groupKey === 'indirect-expenses' || groupKey === 'direct-incomes' || groupKey === 'indirect-incomes') && groupLedgers.length > 0) {
        console.log(`[Summary] ${groupKey}: ${groupLedgers.length} ledgers matched`);
        groupLedgers.forEach(l => console.log(`  - ${l.name} (parent: "${l.parent}")`));
      }
      
      // Deduplicate ledgers by name (case-insensitive)
      const uniqueLedgersMap = new Map();
      for (const ledger of groupLedgers) {
        const key = (ledger.name || '').toLowerCase().trim();
        if (key && !uniqueLedgersMap.has(key)) {
          uniqueLedgersMap.set(key, ledger);
        }
      }
      const uniqueLedgers = Array.from(uniqueLedgersMap.values());
      
      const totalOpening = uniqueLedgers.reduce((sum, l) => sum + (parseFloat(l.opening_balance) || 0), 0);
      const totalClosing = uniqueLedgers.reduce((sum, l) => sum + (parseFloat(l.closing_balance) || 0), 0);
      
      summary[groupKey] = {
        count: uniqueLedgers.length,
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
    console.error('Error fetching ledger summary:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ledgers
 * Search all ledgers by name
 */
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const mode = getBackendMode();
    let ledgers = [];
    let fromDatabase = false;
    
    // Try to fetch from Tally first if in LIVE mode
    if (mode === 'LIVE' && tallySyncService) {
      try {
        ledgers = await tallySyncService.fetchLedgersFromTally();
        
        // Sync to database for offline use
        if (ledgers.length > 0) {
          await tallySyncService.syncLedgersToDb(ledgers);
        }
      } catch (tallyErr) {
        console.warn('Tally ledgers fetch failed, falling back to database:', tallyErr.message);
        fromDatabase = true;
      }
    }
    
    // Fallback to database
    if (ledgers.length === 0 || fromDatabase || mode === 'OFFLINE') {
      if (tallySyncService) {
        ledgers = await tallySyncService.getLedgersFromDb();
        fromDatabase = true;
      }
    }
    
    // Apply search filter if provided
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      ledgers = ledgers.filter(l => 
        (l.name || '').toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      ledgers,
      total: ledgers.length,
      mode,
      fromDatabase
    });
  } catch (err) {
    console.error('Error searching ledgers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ledgers/detail/:name
 * Get details of a specific ledger by name
 * Merges GST details from ledgerGSTService for complete compliance data
 */
router.get('/detail/:name', async (req, res) => {
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
    
    // Merge GST details from ledgerGSTService for missing compliance fields
    if (ledgerGSTService) {
      try {
        const gstDetails = await ledgerGSTService.getLedgerGSTByName(name);
        if (gstDetails) {
          // Merge GST details only if missing in main ledger data
          ledger = {
            ...ledger,
            gstin: ledger.gstin || gstDetails.gstin || '',
            gst_type: ledger.gst_type || gstDetails.gst_type || '',
            state: ledger.state || gstDetails.state || '',
            country: ledger.country || gstDetails.country || '',
            place_of_supply: ledger.place_of_supply || gstDetails.place_of_supply || '',
            pan: ledger.pan || gstDetails.pan || '',
            address: ledger.address || gstDetails.address || '',
            email: ledger.email || gstDetails.email || '',
            phone: ledger.phone || gstDetails.phone || '',
            mailing_name: ledger.mailing_name || gstDetails.mailing_name || '',
            pincode: ledger.pincode || gstDetails.pincode || ''
          };
        }
      } catch (gstErr) {
        console.warn('Failed to merge GST details for ledger:', gstErr.message);
      }
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

/**
 * GET /api/ledgers/with-balances/:group
 * Fetch ledgers with current balances from DSP report
 */
router.get('/with-balances/:group', async (req, res) => {
  try {
    const { group } = req.params;
    const { search, page = 1, limit = 500 } = req.query;
    
    const groupNames = LEDGER_GROUPS[group];
    if (!groupNames) {
      return res.status(400).json({ 
        success: false, 
        error: `Invalid group: ${group}. Valid groups: ${Object.keys(LEDGER_GROUPS).join(', ')}` 
      });
    }
    
    const mode = getBackendMode();
    let ledgers = [];
    
    // Fetch ledgers with balances from Tally
    if (mode === 'LIVE' && tallySyncService) {
      try {
        ledgers = await tallySyncService.getLedgersWithBalances(groupNames);
      } catch (tallyErr) {
        console.warn('Tally ledgers with balances fetch failed:', tallyErr.message);
      }
    }
    
    // Fallback to regular ledgers from database
    if (ledgers.length === 0 && tallySyncService) {
      const allDbLedgers = await tallySyncService.getLedgersFromDb();
      // Use EXACT matching to avoid mixing groups like Direct/Indirect Expenses
      const normalizedTargets = groupNames.map(g => normalizeGroupName(g));
      ledgers = allDbLedgers.filter(l => {
        const parent = normalizeGroupName(l.parent);
        return normalizedTargets.includes(parent);
      }).map(l => ({
        ...l,
        drAmount: l.is_debit ? Math.abs(l.closing_balance || 0) : 0,
        crAmount: l.is_credit ? Math.abs(l.closing_balance || 0) : 0,
        currentBalance: l.closing_balance || 0,
        displayBalance: Math.abs(l.closing_balance || 0),
        // For Sundry Debtors: positive balance = receivable
        // For Sundry Creditors: positive balance = payable
        isReceivable: l.is_debit && (l.closing_balance || 0) > 0,
        isPayable: l.is_credit && (l.closing_balance || 0) > 0,
        balance_type: l.balance_type || (l.is_debit ? 'Dr' : 'Cr')
      }));
    }
    
    // Apply search filter
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      ledgers = ledgers.filter(l => 
        (l.name || '').toLowerCase().includes(searchLower) ||
        (l.address || '').toLowerCase().includes(searchLower) ||
        (l.phone || '').toLowerCase().includes(searchLower) ||
        (l.gstin || '').toLowerCase().includes(searchLower)
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
      mode
    });
  } catch (err) {
    console.error('Error fetching ledgers with balances:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/ledgers
 * Create a new ledger in Tally and database
 */
router.post('/', async (req, res) => {
  try {
    const mode = getBackendMode();
    const ledgerData = req.body;

    // Validate required fields
    if (!ledgerData.name || !ledgerData.name.trim()) {
      return res.status(400).json({ success: false, error: 'Ledger name is required' });
    }

    // Prepare ledger data
    const ledger = {
      name: ledgerData.name.trim(),
      parent: ledgerData.parent || ledgerData.group || 'Sundry Debtors',
      address: ledgerData.address || '',
      state: ledgerData.state || '',
      pincode: ledgerData.pincode || '',
      country: ledgerData.country || 'India',
      email: ledgerData.email || '',
      phone: ledgerData.phone || ledgerData.mobile || '',
      gstin: ledgerData.gstin || ledgerData.gst || '',
      gst_type: ledgerData.gstType || ledgerData.gst_type || 'Regular',
      pan: ledgerData.pan || '',
      opening_balance: parseFloat(ledgerData.openingBalance) || 0
    };

    // If in LIVE or LOCAL mode, try to create in Tally first
    if (mode === 'LIVE' || mode === 'LOCAL') {
      try {
        const tallyUrl = getTallyUrl() || 'http://localhost:9000';

        // Build Tally XML for creating ledger
        const xml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${ledger.name}" ACTION="Create">
            <NAME>${ledger.name}</NAME>
            <PARENT>${ledger.parent}</PARENT>
            <OPENINGBALANCE>${ledger.opening_balance}</OPENINGBALANCE>
            <COUNTRYNAME>${ledger.country}</COUNTRYNAME>
            <LEDSTATENAME>${ledger.state}</LEDSTATENAME>
            <PINCODE>${ledger.pincode}</PINCODE>
            <EMAIL>${ledger.email}</EMAIL>
            <LEDGERMOBILE>${ledger.phone}</LEDGERMOBILE>
            <ADDRESS.LIST>
              <ADDRESS>${ledger.address}</ADDRESS>
            </ADDRESS.LIST>
            <GSTREGISTRATIONTYPE>${ledger.gst_type}</GSTREGISTRATIONTYPE>
            <PARTYGSTIN>${ledger.gstin}</PARTYGSTIN>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

        console.log('Creating ledger in Tally:', ledger.name);
        console.log('Tally URL:', tallyUrl);

        const response = await axios.post(tallyUrl, xml, {
          headers: { 'Content-Type': 'text/xml' },
          timeout: 30000
        });

        // Check if creation was successful
        const responseText = response.data || '';
        console.log('Tally response:', responseText.substring(0, 500));
        
        if (responseText.includes('LINEERROR') || responseText.includes('<ERRORS>') ||
            (responseText.includes('CREATED') && responseText.includes('0'))) {
          const errorMatch = responseText.match(/<LINEERROR[^>]*>(.*?)<\/LINEERROR>/s) ||
                           responseText.match(/<ERROR[^>]*>(.*?)<\/ERROR>/s);
          const errorMsg = errorMatch ? errorMatch[1].trim() : 'Tally creation failed - check Tally is open with a company';
          throw new Error(errorMsg);
        }

        console.log('Ledger created in Tally successfully:', ledger.name);
      } catch (tallyErr) {
        console.error('Failed to create ledger in Tally:', tallyErr.message);
        return res.status(500).json({ 
          success: false, 
          error: `Tally creation failed: ${tallyErr.message}`,
          hint: 'Make sure Tally is running with a company open and Tally.NET Server is enabled'
        });
      }
    }

    // Save to database
    if (tallySyncService) {
      await tallySyncService.syncLedgersToDb([{
        name: ledger.name,
        parent: ledger.parent,
        address: ledger.address,
        state: ledger.state,
        pincode: ledger.pincode,
        country: ledger.country,
        email: ledger.email,
        phone: ledger.phone,
        gstin: ledger.gstin,
        gst_type: ledger.gst_type,
        pan: ledger.pan,
        opening_balance: ledger.opening_balance
      }]);
    }

    res.json({ 
      success: true, 
      message: 'Ledger created successfully',
      ledger,
      mode
    });

  } catch (err) {
    console.error('Error creating ledger:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ledgers/gst-details
 * Fetch all ledger GST details for autofill in orders
 */
router.get('/gst-details', async (req, res) => {
  try {
    if (!ledgerGSTService) {
      return res.status(500).json({ 
        success: false, 
        error: 'GST service not available' 
      });
    }
    
    const ledgers = await ledgerGSTService.fetchLedgerGSTDetails();
    
    res.json({
      success: true,
      ledgers,
      count: ledgers.length
    });
  } catch (err) {
    console.error('Error fetching GST details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ledgers/gst-details/:name
 * Fetch GST details for a specific ledger by name
 */
router.get('/gst-details/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!ledgerGSTService) {
      return res.status(500).json({ 
        success: false, 
        error: 'GST service not available' 
      });
    }
    
    const ledger = await ledgerGSTService.getLedgerGSTByName(name);
    
    if (!ledger) {
      return res.status(404).json({ 
        success: false, 
        error: 'Ledger not found' 
      });
    }
    
    res.json({
      success: true,
      ledger
    });
  } catch (err) {
    console.error('Error fetching ledger GST details:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ledgers/gst-map
 * Get a map of all ledger GST details for quick lookup
 */
router.get('/gst-map', async (req, res) => {
  try {
    if (!ledgerGSTService) {
      return res.status(500).json({ 
        success: false, 
        error: 'GST service not available' 
      });
    }
    
    const gstMap = await ledgerGSTService.buildGSTDetailsMap();
    
    res.json({
      success: true,
      gstMap,
      count: Object.keys(gstMap).length
    });
  } catch (err) {
    console.error('Error building GST map:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
