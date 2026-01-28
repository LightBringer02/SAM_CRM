/**
 * CRM to PostgreSQL Sync Task
 * Syncs data from CRM state to PostgreSQL database
 * Works independently of Tally connection
 */

const { query, transaction } = require('../../sql/connection');
const { bulkUpsert, insert } = require('../../sql/sql_utils');

// Try to load backend config
let getBackendMode;
try {
  getBackendMode = require('../../../backend/config/systemConfig').getBackendMode;
} catch (err) {
  getBackendMode = () => 'LOCAL';
}

/**
 * Sync inventory items to PostgreSQL
 * @param {Array} items - Inventory items to sync
 */
async function syncInventory(items) {
  if (!items || items.length === 0) {
    return { synced: 0, message: 'No inventory items to sync' };
  }

  console.log(`[CRMtoPostgresTask] Syncing ${items.length} inventory items`);

  // Transform items for database schema
  const dbItems = items.map(item => ({
    name: item.name || item.NAME,
    alias: item.alias || item.ALIAS || null,
    item_group: item.group || item.item_group || item.PARENT || null,
    category: item.category || item.CATEGORY || null,
    hsn_code: item.hsn || item.hsn_code || item.HSNCODE || null,
    gst_rate: parseFloat(item.gst || item.gst_rate || 0),
    rate: parseFloat(item.rate || 0),
    quantity: parseFloat(item.quantity || 0),
    unit: item.unit || null,
    stock_value: parseFloat(item.stock || item.stock_value || 0),
    purchase_rate: parseFloat(item.purchase_rate || 0),
    selling_rate: parseFloat(item.selling_rate || 0),
    opening_balance: parseFloat(item.opening_balance || 0),
    opening_value: parseFloat(item.opening_value || 0),
    closing_value: parseFloat(item.closing_value || 0),
    tally_guid: item.guid || item.tally_guid || null,
    synced_at: new Date()
  }));

  const syncedCount = await bulkUpsert('inventory_items', dbItems, 'name');
  
  return { synced: syncedCount, message: `Synced ${syncedCount} inventory items` };
}

/**
 * Sync vouchers to PostgreSQL
 * @param {Array} vouchers - Vouchers to sync
 */
async function syncVouchers(vouchers) {
  if (!vouchers || vouchers.length === 0) {
    return { synced: 0, message: 'No vouchers to sync' };
  }

  console.log(`[CRMtoPostgresTask] Syncing ${vouchers.length} vouchers`);

  const dbVouchers = vouchers.map(v => ({
    voucher_number: v.voucher_number || v.number || v.VOUCHERNUMBER,
    voucher_type: v.voucher_type || v.type || v.VOUCHERTYPENAME,
    date: v.date || v.DATE,
    party_ledger: v.party_ledger || v.party || v.PARTYLEDGERNAME,
    amount: parseFloat(v.amount || v.AMOUNT || 0),
    narration: v.narration || v.NARRATION || null,
    reference: v.reference || null,
    due_date: v.due_date || null,
    is_paid: v.is_paid || false,
    paid_amount: parseFloat(v.paid_amount || 0),
    unpaid_amount: parseFloat(v.unpaid_amount || v.amount || 0),
    tally_guid: v.guid || v.tally_guid || v.GUID || null,
    tally_master_id: v.master_id || v.tally_master_id || v.MASTERID || null,
    synced_at: new Date()
  }));

  const syncedCount = await bulkUpsert('vouchers', dbVouchers, 'voucher_number');
  
  return { synced: syncedCount, message: `Synced ${syncedCount} vouchers` };
}

/**
 * Sync ledgers to PostgreSQL
 * @param {Array} ledgers - Ledgers to sync
 */
async function syncLedgers(ledgers) {
  if (!ledgers || ledgers.length === 0) {
    return { synced: 0, message: 'No ledgers to sync' };
  }

  console.log(`[CRMtoPostgresTask] Syncing ${ledgers.length} ledgers`);

  const dbLedgers = ledgers.map(l => ({
    name: l.name || l.NAME,
    alias: l.alias || null,
    parent_group: l.parent_group || l.parent || l.PARENT || null,
    opening_balance: parseFloat(l.opening_balance || l.OPENINGBALANCE || 0),
    closing_balance: parseFloat(l.closing_balance || l.CLOSINGBALANCE || 0),
    credit_period: parseInt(l.credit_period || 0),
    address: l.address || l.ADDRESS || null,
    state: l.state || l.STATENAME || null,
    country: l.country || l.COUNTRYNAME || 'India',
    gstin: l.gstin || l.GSTIN || null,
    pan: l.pan || null,
    contact_person: l.contact_person || null,
    phone: l.phone || null,
    email: l.email || l.EMAIL || null,
    tally_guid: l.guid || l.tally_guid || null,
    synced_at: new Date()
  }));

  const syncedCount = await bulkUpsert('ledgers', dbLedgers, 'name');
  
  return { synced: syncedCount, message: `Synced ${syncedCount} ledgers` };
}

/**
 * Record sync history
 */
async function recordSyncHistory(syncType, results) {
  const history = {
    sync_type: syncType,
    source: 'CRM',
    destination: 'POSTGRES',
    status: results.error ? 'failed' : 'completed',
    items_synced: results.totalSynced || 0,
    errors_count: results.errors || 0,
    started_at: results.startTime,
    completed_at: new Date(),
    error_message: results.error || null,
    metadata: JSON.stringify(results)
  };

  await insert('sync_history', history);
}

/**
 * Execute full CRM to PostgreSQL sync
 * @param {Object} payload - { inventory, vouchers, ledgers, forceSync }
 */
async function execute(payload = {}) {
  const startTime = Date.now();
  const mode = getBackendMode();

  console.log(`[CRMtoPostgresTask] Starting CRM → PostgreSQL sync (mode: ${mode})`);

  const results = {
    startTime: new Date(),
    mode,
    inventory: { synced: 0 },
    vouchers: { synced: 0 },
    ledgers: { synced: 0 },
    totalSynced: 0,
    errors: 0,
    duration: 0
  };

  try {
    // Sync inventory if provided or fetch from payload
    if (payload.inventory && Array.isArray(payload.inventory)) {
      results.inventory = await syncInventory(payload.inventory);
    }

    // Sync vouchers if provided
    if (payload.vouchers && Array.isArray(payload.vouchers)) {
      results.vouchers = await syncVouchers(payload.vouchers);
    }

    // Sync ledgers if provided
    if (payload.ledgers && Array.isArray(payload.ledgers)) {
      results.ledgers = await syncLedgers(payload.ledgers);
    }

    // If no specific data provided, this was a trigger without data
    // Just log that sync was triggered
    if (!payload.inventory && !payload.vouchers && !payload.ledgers) {
      console.log('[CRMtoPostgresTask] No data provided in payload, sync trigger recorded');
      results.message = 'Sync triggered but no data provided in payload';
    }

    results.totalSynced = 
      results.inventory.synced + 
      results.vouchers.synced + 
      results.ledgers.synced;

    results.duration = Date.now() - startTime;

    // Record sync history
    await recordSyncHistory('full_sync', results);

    console.log(`[CRMtoPostgresTask] Sync completed: ${results.totalSynced} items in ${results.duration}ms`);

  } catch (err) {
    console.error('[CRMtoPostgresTask] Sync failed:', err.message);
    results.error = err.message;
    results.errors = 1;
    
    await recordSyncHistory('full_sync', results);
    throw err;
  }

  return results;
}

/**
 * Sync only inventory
 */
async function syncInventoryOnly(items) {
  const results = await syncInventory(items);
  await recordSyncHistory('inventory_sync', { 
    totalSynced: results.synced,
    inventory: results 
  });
  return results;
}

/**
 * Sync only vouchers
 */
async function syncVouchersOnly(vouchers) {
  const results = await syncVouchers(vouchers);
  await recordSyncHistory('vouchers_sync', { 
    totalSynced: results.synced,
    vouchers: results 
  });
  return results;
}

/**
 * Sync only ledgers
 */
async function syncLedgersOnly(ledgers) {
  const results = await syncLedgers(ledgers);
  await recordSyncHistory('ledgers_sync', { 
    totalSynced: results.synced,
    ledgers: results 
  });
  return results;
}

/**
 * Get sync history
 * @param {Object} filters - { limit, status, syncType }
 */
async function getSyncHistory(filters = {}) {
  const { limit = 50, status, syncType } = filters;
  
  let sql = 'SELECT * FROM sync_history WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    sql += ` AND status = $${paramIndex++}`;
    params.push(status);
  }

  if (syncType) {
    sql += ` AND sync_type = $${paramIndex++}`;
    params.push(syncType);
  }

  sql += ` ORDER BY started_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await query(sql, params);
  return result.rows;
}

module.exports = {
  execute,
  syncInventory,
  syncVouchers,
  syncLedgers,
  syncInventoryOnly,
  syncVouchersOnly,
  syncLedgersOnly,
  getSyncHistory
};
