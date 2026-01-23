// backend/sync.js
const { fetchInventory } = require('../connection/tally');
const fs = require('fs');
const path = require('path');

// This is a placeholder for a real database. Replace with DB logic as needed.
const INVENTORY_PATH = path.join(__dirname, 'inventory_cache.json');

async function syncInventory() {
  try {
    const data = await fetchInventory();
    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2));
    console.log('Inventory synced from TallyPrime.');
  } catch (err) {
    console.error('Sync error:', err.message);
  }
}

// Run every 1 minute
setInterval(syncInventory, 60 * 1000);

// Initial run
syncInventory();
