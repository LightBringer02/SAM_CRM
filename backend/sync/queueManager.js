const { fetchInventory } = require('../connection/inventory');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { getTallyUrl, isDummyMode } = require('../config/systemConfig');

const INVENTORY_PATH = path.join(__dirname, '../connection/inventory_cache.json');
const SYNC_STATUS_PATH = path.join(__dirname, '../connection/sync_status.json');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

let queue = [];
let isSyncing = false;
let lastStatus = { connected: false, lastSync: null };

// ----------------------------
// Working Tally health check XML
// ----------------------------
const TALLY_PING_XML = `
<ENVELOPE>
    <HEADER>
        <VERSION>1</VERSION>
        <TALLYREQUEST>Export</TALLYREQUEST>
        <TYPE>Collection</TYPE>
        <ID>List of Companies</ID>
    </HEADER>
    <BODY>
        <DESC>
            <STATICVARIABLES>
                <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
            </STATICVARIABLES>
            <TDL>
                <TDLMESSAGE>
                    <COLLECTION NAME="List of Companies" ISINITIALIZE="Yes">
                        <TYPE>Company</TYPE>
                        <NATIVEMETHOD>Name, GUID</NATIVEMETHOD>
                    </COLLECTION>
                </TDLMESSAGE>
            </TDL>
        </DESC>
    </BODY>
</ENVELOPE>
`;

// ----------------------------
// HEALTH CHECK FUNCTION
// ----------------------------
async function pingTally() {
  // In dummy mode, always report as connected
  if (isDummyMode()) {
    lastStatus.connected = true;
    return true;
  }

  try {
    const TALLY_URL = getActiveTallyUrl();
    const { data } = await axios.post(TALLY_URL, TALLY_PING_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 3000
    });

    const str = typeof data === 'string' ? data : data.toString();

    const ok =
      str.includes('<COLLECTION') ||
      str.includes('<COMPANY') ||
      str.includes('<NAME>') ||
      str.includes('<GUID>');

    return ok;
  } catch {
    return false;
  }
}

// ----------------------------
// STATUS READER
// ----------------------------
function getSyncStatus() {
  try {
    const status = JSON.parse(fs.readFileSync(SYNC_STATUS_PATH, 'utf8'));
    lastStatus = {
      connected: status.connected,
      lastSync: status.lastSync
    };
  } catch {}
  return lastStatus;
}

// ----------------------------
// SYNC WORKER
// ----------------------------
async function doSync() {
  isSyncing = true;

  // STEP 1: Check Tally connection
  const connected = await pingTally();

  if (!connected) {
    const errorInfo = {
      connected: false,
      lastSync: lastStatus.lastSync,
      reason: "Tally not reachable",
      time: new Date().toISOString()
    };

    fs.writeFileSync(SYNC_STATUS_PATH, JSON.stringify(errorInfo, null, 2));

    lastStatus.connected = false;

    isSyncing = false;
    throw new Error("Tally not reachable");
  }

  // STEP 2: Fetch inventory only AFTER ping success
  try {
    const data = await fetchInventory();

    const timestamp = new Date().toISOString();

    fs.writeFileSync(INVENTORY_PATH, JSON.stringify(data, null, 2));
    fs.writeFileSync(
      SYNC_STATUS_PATH,
      JSON.stringify(
        {
          connected: true,
          lastSync: timestamp,
          time: timestamp
        },
        null,
        2
      )
    );

    lastStatus = { connected: true, lastSync: timestamp };
    isSyncing = false;

    return lastStatus;
  } catch (err) {
    const errorInfo = {
      connected: true,
      lastSync: lastStatus.lastSync,
      error: err.message,
      time: new Date().toISOString()
    };

    fs.writeFileSync(SYNC_STATUS_PATH, JSON.stringify(errorInfo, null, 2));

    isSyncing = false;
    throw err;
  }
}

// ----------------------------
// EXPOSED TRIGGER FUNCTION
// ----------------------------
async function triggerSync() {
  if (isSyncing) return lastStatus;

  try {
    return await doSync();
  } catch (err) {
    queue.push({ type: "sync", time: Date.now() });
    throw err;
  }
}

// ----------------------------
// QUEUE RETRY LOOP (1-minute)
// ----------------------------
setInterval(async () => {
  if (queue.length === 0 || isSyncing) return;

  try {
    await doSync();
    queue = [];
  } catch {
    // keep queued
  }
}, 60000);

module.exports = { getSyncStatus, triggerSync, getQueueLength: () => queue.length };
