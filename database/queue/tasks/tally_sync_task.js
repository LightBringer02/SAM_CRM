/**
 * Tally Sync Task
 * Handles fetching data from Tally and storing in CRM database
 * Supports offline and dummy modes
 */

const axios = require('axios');
const { bulkUpsert } = require('../../sql/sql_utils');
const { query } = require('../../sql/connection');

// Try to load backend config
let getConfig, getBackendMode, getTallyUrl, isDummyMode;
try {
  const systemConfig = require('../../../backend/config/systemConfig');
  getConfig = systemConfig.getConfig;
  getBackendMode = systemConfig.getBackendMode;
  getTallyUrl = systemConfig.getTallyUrl;
  isDummyMode = systemConfig.isDummyMode;
} catch (err) {
  // Fallback defaults
  getConfig = () => ({ backendMode: 'LOCAL', tallyUrl: 'http://localhost:9000' });
  getBackendMode = () => 'LOCAL';
  getTallyUrl = () => 'http://localhost:9000';
  isDummyMode = () => false;
}

// Try to load dummy data
let getDummyInventory, getDummyVouchers, getDummyLedgers;
try {
  const dummyData = require('../../../backend/config/dummyData');
  getDummyInventory = dummyData.getDummyInventory;
  getDummyVouchers = dummyData.getDummyVouchers || (() => []);
  getDummyLedgers = dummyData.getDummyLedgers || (() => []);
} catch (err) {
  getDummyInventory = () => [];
  getDummyVouchers = () => [];
  getDummyLedgers = () => [];
}

/**
 * XML Request template for Tally
 */
function buildTallyRequest(collection, fields = []) {
  const fieldXml = fields.map(f => `<FIELD>${f}</FIELD>`).join('');
  
  return `
    <ENVELOPE>
      <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>${collection}</ID>
      </HEADER>
      <BODY>
        <DESC>
          <STATICVARIABLES>
            <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          </STATICVARIABLES>
          <TDL>
            <TDLMESSAGE>
              <COLLECTION NAME="${collection}">
                ${fieldXml}
              </COLLECTION>
            </TDLMESSAGE>
          </TDL>
        </DESC>
      </BODY>
    </ENVELOPE>
  `;
}

/**
 * Fetch data from Tally
 * @param {string} endpoint - Tally URL
 * @param {string} xmlRequest - XML request body
 */
async function fetchFromTally(endpoint, xmlRequest) {
  const response = await axios.post(endpoint, xmlRequest, {
    headers: { 'Content-Type': 'text/xml' },
    timeout: 30000,
    responseType: 'text'
  });
  
  return response.data;
}

/**
 * Parse XML response (simplified - use xml2js or fast-xml-parser in production)
 */
function parseXmlResponse(xml, tagName) {
  const items = [];
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, 'gs');
  let match;
  
  while ((match = regex.exec(xml)) !== null) {
    items.push(match[1]);
  }
  
  return items;
}

/**
 * Fetch inventory from Tally or dummy data
 */
async function fetchInventory(payload = {}) {
  const mode = getBackendMode();
  const results = { items: [], source: mode, synced: 0 };

  console.log(`[TallySyncTask] Fetching inventory (mode: ${mode})`);

  if (isDummyMode()) {
    // Use dummy data
    const dummyItems = getDummyInventory();
    results.items = dummyItems;
    results.source = 'DUMMY_DATA';
    
  } else if (mode === 'OFFLINE') {
    // Offline mode - skip Tally, use existing DB data
    const dbResult = await query('SELECT * FROM inventory_items ORDER BY name');
    results.items = dbResult.rows;
    results.source = 'DATABASE';
    
  } else {
    // LOCAL or LIVE mode - fetch from Tally
    const tallyUrl = getTallyUrl();
    
    if (!tallyUrl) {
      throw new Error('No Tally URL configured');
    }

    try {
      const xmlRequest = buildTallyRequest('StockItemCollection', [
        'NAME', 'ALIAS', 'PARENT', 'CATEGORY', 'GSTAPPLICABLE', 'HSNCODE',
        'OPENINGBALANCE', 'OPENINGVALUE', 'CLOSINGBALANCE', 'CLOSINGVALUE'
      ]);

      const xmlResponse = await fetchFromTally(tallyUrl, xmlRequest);
      
      // Parse and transform items (simplified parsing)
      // In production, use proper XML parser
      const stockItems = parseXmlResponse(xmlResponse, 'STOCKITEM');
      
      results.items = stockItems.map((item, idx) => ({
        name: extractXmlValue(item, 'NAME') || `Item ${idx + 1}`,
        alias: extractXmlValue(item, 'ALIAS'),
        item_group: extractXmlValue(item, 'PARENT'),
        category: extractXmlValue(item, 'CATEGORY'),
        hsn_code: extractXmlValue(item, 'HSNCODE'),
        gst_rate: parseFloat(extractXmlValue(item, 'GSTAPPLICABLE') || '0'),
        opening_balance: parseFloat(extractXmlValue(item, 'OPENINGBALANCE') || '0'),
        opening_value: parseFloat(extractXmlValue(item, 'OPENINGVALUE') || '0'),
        closing_value: parseFloat(extractXmlValue(item, 'CLOSINGVALUE') || '0'),
        synced_at: new Date()
      }));
      
      results.source = 'TALLY';
      
    } catch (err) {
      console.error('[TallySyncTask] Tally fetch failed:', err.message);
      throw new Error(`Tally connection failed: ${err.message}`);
    }
  }

  // Store in database
  if (results.items.length > 0 && mode !== 'OFFLINE') {
    try {
      results.synced = await bulkUpsert('inventory_items', results.items, 'name');
    } catch (dbErr) {
      console.error('[TallySyncTask] Database sync failed:', dbErr.message);
      // Don't throw - we still fetched the data
      results.dbError = dbErr.message;
    }
  }

  console.log(`[TallySyncTask] Fetched ${results.items.length} inventory items from ${results.source}`);
  
  return results;
}

/**
 * Fetch vouchers from Tally or dummy data
 */
async function fetchVouchers(payload = {}) {
  const mode = getBackendMode();
  const results = { items: [], source: mode, synced: 0 };

  console.log(`[TallySyncTask] Fetching vouchers (mode: ${mode})`);

  if (isDummyMode()) {
    const dummyVouchers = getDummyVouchers({});
    results.items = Array.isArray(dummyVouchers) ? dummyVouchers : (dummyVouchers.vouchers || []);
    results.source = 'DUMMY_DATA';
    
  } else if (mode === 'OFFLINE') {
    const dbResult = await query('SELECT * FROM vouchers ORDER BY date DESC');
    results.items = dbResult.rows;
    results.source = 'DATABASE';
    
  } else {
    const tallyUrl = getTallyUrl();
    
    if (!tallyUrl) {
      throw new Error('No Tally URL configured');
    }

    try {
      const xmlRequest = buildTallyRequest('VoucherCollection', [
        'VOUCHERNUMBER', 'DATE', 'VOUCHERTYPENAME', 'PARTYLEDGERNAME',
        'AMOUNT', 'NARRATION', 'GUID', 'MASTERID'
      ]);

      const xmlResponse = await fetchFromTally(tallyUrl, xmlRequest);
      const vouchers = parseXmlResponse(xmlResponse, 'VOUCHER');
      
      results.items = vouchers.map((v, idx) => ({
        voucher_number: extractXmlValue(v, 'VOUCHERNUMBER') || `V${idx + 1}`,
        date: extractXmlValue(v, 'DATE'),
        voucher_type: extractXmlValue(v, 'VOUCHERTYPENAME'),
        party_ledger: extractXmlValue(v, 'PARTYLEDGERNAME'),
        amount: parseFloat(extractXmlValue(v, 'AMOUNT') || '0'),
        narration: extractXmlValue(v, 'NARRATION'),
        tally_guid: extractXmlValue(v, 'GUID'),
        tally_master_id: extractXmlValue(v, 'MASTERID'),
        synced_at: new Date()
      }));
      
      results.source = 'TALLY';
      
    } catch (err) {
      console.error('[TallySyncTask] Tally voucher fetch failed:', err.message);
      throw new Error(`Tally connection failed: ${err.message}`);
    }
  }

  // Store in database
  if (results.items.length > 0 && mode !== 'OFFLINE') {
    try {
      results.synced = await bulkUpsert('vouchers', results.items, 'voucher_number');
    } catch (dbErr) {
      results.dbError = dbErr.message;
    }
  }

  console.log(`[TallySyncTask] Fetched ${results.items.length} vouchers from ${results.source}`);
  
  return results;
}

/**
 * Fetch ledgers from Tally or dummy data
 */
async function fetchLedgers(payload = {}) {
  const mode = getBackendMode();
  const results = { items: [], source: mode, synced: 0 };

  console.log(`[TallySyncTask] Fetching ledgers (mode: ${mode})`);

  if (isDummyMode()) {
    results.items = getDummyLedgers();
    results.source = 'DUMMY_DATA';
    
  } else if (mode === 'OFFLINE') {
    const dbResult = await query('SELECT * FROM ledgers ORDER BY name');
    results.items = dbResult.rows;
    results.source = 'DATABASE';
    
  } else {
    const tallyUrl = getTallyUrl();
    
    if (!tallyUrl) {
      throw new Error('No Tally URL configured');
    }

    try {
      const xmlRequest = buildTallyRequest('LedgerCollection', [
        'NAME', 'PARENT', 'OPENINGBALANCE', 'CLOSINGBALANCE',
        'ADDRESS', 'STATENAME', 'COUNTRYNAME', 'GSTIN', 'EMAIL'
      ]);

      const xmlResponse = await fetchFromTally(tallyUrl, xmlRequest);
      const ledgers = parseXmlResponse(xmlResponse, 'LEDGER');
      
      results.items = ledgers.map((l, idx) => ({
        name: extractXmlValue(l, 'NAME') || `Ledger ${idx + 1}`,
        parent_group: extractXmlValue(l, 'PARENT'),
        opening_balance: parseFloat(extractXmlValue(l, 'OPENINGBALANCE') || '0'),
        closing_balance: parseFloat(extractXmlValue(l, 'CLOSINGBALANCE') || '0'),
        address: extractXmlValue(l, 'ADDRESS'),
        state: extractXmlValue(l, 'STATENAME'),
        country: extractXmlValue(l, 'COUNTRYNAME') || 'India',
        gstin: extractXmlValue(l, 'GSTIN'),
        email: extractXmlValue(l, 'EMAIL'),
        synced_at: new Date()
      }));
      
      results.source = 'TALLY';
      
    } catch (err) {
      console.error('[TallySyncTask] Tally ledger fetch failed:', err.message);
      throw new Error(`Tally connection failed: ${err.message}`);
    }
  }

  // Store in database
  if (results.items.length > 0 && mode !== 'OFFLINE') {
    try {
      results.synced = await bulkUpsert('ledgers', results.items, 'name');
    } catch (dbErr) {
      results.dbError = dbErr.message;
    }
  }

  console.log(`[TallySyncTask] Fetched ${results.items.length} ledgers from ${results.source}`);
  
  return results;
}

/**
 * Execute full Tally sync (all data types)
 */
async function execute(payload = {}) {
  const startTime = Date.now();
  
  console.log('[TallySyncTask] Starting full Tally sync');

  const results = {
    inventory: await fetchInventory(payload),
    vouchers: await fetchVouchers(payload),
    ledgers: await fetchLedgers(payload),
    duration: 0
  };

  results.duration = Date.now() - startTime;
  
  console.log(`[TallySyncTask] Full sync completed in ${results.duration}ms`);
  
  return results;
}

/**
 * Helper to extract value from XML string
 */
function extractXmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

module.exports = {
  execute,
  fetchInventory,
  fetchVouchers,
  fetchLedgers
};
