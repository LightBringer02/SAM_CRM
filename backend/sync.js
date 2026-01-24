// backend/sync.js
const { fetchInventory } = require('../connection/inventory');
const fs = require('fs');
const path = require('path');

// This is a placeholder for a real database. Replace with DB logic as needed.
const INVENTORY_PATH = path.join(__dirname, 'inventory_cache.json');
const SYNC_STATUS_PATH = path.join(__dirname, 'sync_status.json');

async function syncInventory() {
  try {
    const data = await fetchInventory();
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2));
    fs.writeFileSync(SYNC_STATUS_PATH, JSON.stringify({ status: 'connected', time: new Date().toISOString() }, null, 2));
    console.log('Inventory synced from TallyPrime.');
  } catch (err) {
    fs.writeFileSync(SYNC_STATUS_PATH, JSON.stringify({ status: 'not connected', time: new Date().toISOString(), error: err.message }, null, 2));
    console.error('Sync error:', err.message);
  }
}

// Run every 1 minute
setInterval(syncInventory, 60 * 1000);

// Initial run
syncInventory();
