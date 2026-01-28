/**
 * Fetch Service
 * Dedicated service for fetching data from Tally
 * Independent of UI logic, supports offline and dummy modes
 */

const axios = require('axios');
const { query } = require('./sql/connection');
const { insert } = require('./sql/sql_utils');
const { enqueueFetch } = require('./queue/queue_manager');

// Try to load backend config
let getConfig, getBackendMode, getTallyUrl, isDummyMode;
try {
  const systemConfig = require('../backend/config/systemConfig');
  getConfig = systemConfig.getConfig;
  getBackendMode = systemConfig.getBackendMode;
  getTallyUrl = systemConfig.getTallyUrl;
  isDummyMode = systemConfig.isDummyMode;
} catch (err) {
  getConfig = () => ({ backendMode: 'LOCAL', tallyUrl: 'http://localhost:9000' });
  getBackendMode = () => 'LOCAL';
  getTallyUrl = () => 'http://localhost:9000';
  isDummyMode = () => false;
}

// Try to load dummy data
let dummyData = {};
try {
  dummyData = require('../backend/config/dummyData');
} catch (err) {
  dummyData = {
    getDummyInventory: () => [],
    getDummyVouchers: () => [],
    getDummyLedgers: () => [],
    getDummyCompany: () => ({ name: 'Demo Company' })
  };
}

/**
 * Build XML request for Tally
 */
function buildTallyXml(collection, staticVars = {}) {
  const varsXml = Object.entries(staticVars)
    .map(([key, value]) => `<${key}>${value}</${key}>`)
    .join('');

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
            ${varsXml}
          </STATICVARIABLES>
        </DESC>
      </BODY>
    </ENVELOPE>
  `;
}

/**
 * Send request to Tally
 */
async function sendToTally(xmlRequest) {
  const tallyUrl = getTallyUrl();
  
  if (!tallyUrl) {
    throw new Error('Tally URL not configured');
  }

  const response = await axios.post(tallyUrl, xmlRequest, {
    headers: { 'Content-Type': 'text/xml' },
    timeout: 30000,
    responseType: 'text'
  });

  return response.data;
}

/**
 * Record fetch operation in logs
 */
async function recordFetch(fetchType, status, itemsFetched = 0, error = null, metadata = {}) {
  try {
    await insert('fetch_logs', {
      fetch_type: fetchType,
      source: getBackendMode(),
      status,
      items_fetched: itemsFetched,
      completed_at: status !== 'pending' ? new Date() : null,
      error_message: error,
      metadata: JSON.stringify(metadata)
    });
  } catch (err) {
    console.warn('[FetchService] Could not record fetch log:', err.message);
  }
}

/**
 * Fetch inventory data
 * @param {Object} options - { storeInDb, useQueue }
 */
async function fetchInventory(options = {}) {
  const { storeInDb = true, useQueue = false } = options;
  const mode = getBackendMode();

  console.log(`[FetchService] Fetching inventory (mode: ${mode})`);

  if (useQueue) {
    const job = await enqueueFetch('inventory');
    return { queued: true, jobId: job.id };
  }

  let items = [];
  let source = mode;

  try {
    if (isDummyMode()) {
      items = dummyData.getDummyInventory();
      source = 'DUMMY_DATA';
      
    } else if (mode === 'OFFLINE') {
      const result = await query('SELECT * FROM inventory_items ORDER BY name');
      items = result.rows;
      source = 'DATABASE';
      
    } else {
      // Fetch from Tally
      const xml = buildTallyXml('Stock Item');
      const response = await sendToTally(xml);
      
      // Parse response (simplified - use proper XML parser in production)
      items = parseInventoryResponse(response);
      source = 'TALLY';
    }

    await recordFetch('inventory', 'completed', items.length, null, { source });
    
    return { success: true, items, count: items.length, source };

  } catch (err) {
    console.error('[FetchService] Inventory fetch failed:', err.message);
    await recordFetch('inventory', 'failed', 0, err.message);
    throw err;
  }
}

/**
 * Fetch vouchers data
 * @param {Object} options - { storeInDb, useQueue, fromDate, toDate }
 */
async function fetchVouchers(options = {}) {
  const { storeInDb = true, useQueue = false, fromDate, toDate } = options;
  const mode = getBackendMode();

  console.log(`[FetchService] Fetching vouchers (mode: ${mode})`);

  if (useQueue) {
    const job = await enqueueFetch('vouchers');
    return { queued: true, jobId: job.id };
  }

  let vouchers = [];
  let source = mode;

  try {
    if (isDummyMode()) {
      const dummyVouchers = dummyData.getDummyVouchers({});
      vouchers = Array.isArray(dummyVouchers) ? dummyVouchers : (dummyVouchers.vouchers || []);
      source = 'DUMMY_DATA';
      
    } else if (mode === 'OFFLINE') {
      let sql = 'SELECT * FROM vouchers';
      const params = [];
      
      if (fromDate) {
        sql += ' WHERE date >= $1';
        params.push(fromDate);
      }
      if (toDate) {
        sql += params.length ? ' AND' : ' WHERE';
        sql += ` date <= $${params.length + 1}`;
        params.push(toDate);
      }
      
      sql += ' ORDER BY date DESC';
      
      const result = await query(sql, params);
      vouchers = result.rows;
      source = 'DATABASE';
      
    } else {
      const xml = buildTallyXml('Voucher Register');
      const response = await sendToTally(xml);
      vouchers = parseVoucherResponse(response);
      source = 'TALLY';
    }

    await recordFetch('vouchers', 'completed', vouchers.length, null, { source });
    
    return { success: true, vouchers, count: vouchers.length, source };

  } catch (err) {
    console.error('[FetchService] Voucher fetch failed:', err.message);
    await recordFetch('vouchers', 'failed', 0, err.message);
    throw err;
  }
}

/**
 * Fetch ledgers data
 * @param {Object} options - { storeInDb, useQueue }
 */
async function fetchLedgers(options = {}) {
  const { storeInDb = true, useQueue = false } = options;
  const mode = getBackendMode();

  console.log(`[FetchService] Fetching ledgers (mode: ${mode})`);

  if (useQueue) {
    const job = await enqueueFetch('ledgers');
    return { queued: true, jobId: job.id };
  }

  let ledgers = [];
  let source = mode;

  try {
    if (isDummyMode()) {
      ledgers = dummyData.getDummyLedgers ? dummyData.getDummyLedgers() : [];
      source = 'DUMMY_DATA';
      
    } else if (mode === 'OFFLINE') {
      const result = await query('SELECT * FROM ledgers ORDER BY name');
      ledgers = result.rows;
      source = 'DATABASE';
      
    } else {
      const xml = buildTallyXml('Ledger');
      const response = await sendToTally(xml);
      ledgers = parseLedgerResponse(response);
      source = 'TALLY';
    }

    await recordFetch('ledgers', 'completed', ledgers.length, null, { source });
    
    return { success: true, ledgers, count: ledgers.length, source };

  } catch (err) {
    console.error('[FetchService] Ledger fetch failed:', err.message);
    await recordFetch('ledgers', 'failed', 0, err.message);
    throw err;
  }
}

/**
 * Fetch all Tally data
 * @param {Object} options - { useQueue }
 */
async function fetchTallyData(options = {}) {
  const { useQueue = false } = options;

  if (useQueue) {
    const job = await enqueueFetch('all');
    return { queued: true, jobId: job.id };
  }

  console.log('[FetchService] Fetching all Tally data');

  const results = {
    inventory: await fetchInventory({ storeInDb: true }),
    vouchers: await fetchVouchers({ storeInDb: true }),
    ledgers: await fetchLedgers({ storeInDb: true })
  };

  return {
    success: true,
    results,
    totalItems: 
      results.inventory.count + 
      results.vouchers.count + 
      results.ledgers.count
  };
}

/**
 * Get fetch history
 */
async function getFetchHistory(limit = 50) {
  try {
    const result = await query(`
      SELECT * FROM fetch_logs 
      ORDER BY started_at DESC 
      LIMIT $1
    `, [limit]);
    return result.rows;
  } catch (err) {
    return [];
  }
}

/**
 * Test Tally connection
 */
async function testTallyConnection() {
  const mode = getBackendMode();
  
  if (isDummyMode()) {
    return { connected: false, mode: 'DUMMY_DATA', message: 'Dummy mode - no Tally connection' };
  }

  if (mode === 'OFFLINE') {
    return { connected: false, mode: 'OFFLINE', message: 'Offline mode - Tally disabled' };
  }

  const tallyUrl = getTallyUrl();
  
  if (!tallyUrl) {
    return { connected: false, error: 'No Tally URL configured' };
  }

  try {
    const xml = buildTallyXml('List of Companies');
    await sendToTally(xml);
    return { connected: true, url: tallyUrl, mode };
  } catch (err) {
    return { connected: false, url: tallyUrl, error: err.message };
  }
}

// ============ RESPONSE PARSERS (Simplified) ============
// In production, use proper XML parser like xml2js or fast-xml-parser

function parseInventoryResponse(xml) {
  const items = [];
  const matches = xml.match(/<STOCKITEM[^>]*>[\s\S]*?<\/STOCKITEM>/g) || [];
  
  matches.forEach((match, idx) => {
    items.push({
      name: extractXml(match, 'NAME') || `Item ${idx + 1}`,
      alias: extractXml(match, 'ALIAS'),
      group: extractXml(match, 'PARENT'),
      hsn: extractXml(match, 'HSNCODE'),
      gst: parseFloat(extractXml(match, 'GSTRATE') || '0'),
      rate: parseFloat(extractXml(match, 'RATE') || '0'),
      quantity: parseFloat(extractXml(match, 'CLOSINGBALANCE') || '0')
    });
  });

  return items;
}

function parseVoucherResponse(xml) {
  const vouchers = [];
  const matches = xml.match(/<VOUCHER[^>]*>[\s\S]*?<\/VOUCHER>/g) || [];
  
  matches.forEach((match, idx) => {
    vouchers.push({
      voucher_number: extractXml(match, 'VOUCHERNUMBER') || `V${idx + 1}`,
      date: extractXml(match, 'DATE'),
      voucher_type: extractXml(match, 'VOUCHERTYPENAME'),
      party_ledger: extractXml(match, 'PARTYLEDGERNAME'),
      amount: parseFloat(extractXml(match, 'AMOUNT') || '0'),
      narration: extractXml(match, 'NARRATION')
    });
  });

  return vouchers;
}

function parseLedgerResponse(xml) {
  const ledgers = [];
  const matches = xml.match(/<LEDGER[^>]*>[\s\S]*?<\/LEDGER>/g) || [];
  
  matches.forEach((match, idx) => {
    ledgers.push({
      name: extractXml(match, 'NAME') || `Ledger ${idx + 1}`,
      parent_group: extractXml(match, 'PARENT'),
      opening_balance: parseFloat(extractXml(match, 'OPENINGBALANCE') || '0'),
      closing_balance: parseFloat(extractXml(match, 'CLOSINGBALANCE') || '0'),
      gstin: extractXml(match, 'GSTIN'),
      email: extractXml(match, 'EMAIL')
    });
  });

  return ledgers;
}

function extractXml(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

module.exports = {
  fetchTallyData,
  fetchInventory,
  fetchVouchers,
  fetchLedgers,
  testTallyConnection,
  getFetchHistory
};
