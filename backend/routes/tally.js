const express = require('express');
const router = express.Router();
const axios = require('axios');
const { fetchInventory } = require('../connection/inventory');
const { getTallyUrl, isDummyMode } = require('../config/systemConfig');

// Global sync state
let lastSynced = null;
let tallyConnected = false;

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// Minimal Tally health-check XML (TDL collection)
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

// Helper function to check connection
async function pingTally() {
  // In dummy mode, always report as connected
  if (isDummyMode()) {
    tallyConnected = true;
    return true;
  }

  try {
    const TALLY_URL = getActiveTallyUrl();
    const { data } = await axios.post(TALLY_URL, TALLY_PING_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 4000,
    });

    const str = typeof data === 'string' ? data : data.toString();

    // True success conditions
    tallyConnected =
      str.includes('<COLLECTION') ||
      str.includes('<COMPANY') ||
      str.includes('<NAME>') ||
      str.includes('<GUID>');

  } catch (err) {
    tallyConnected = false;
  }

  return tallyConnected;
}

// Health check endpoint
router.get('/status', async (req, res) => {
  await pingTally();
  res.json({ connected: tallyConnected, lastSynced });
});

// Manual Sync endpoint
router.post('/sync', async (req, res) => {
  const connected = await pingTally();
  if (!connected) {
    return res.json({
      success: false,
      connected: false,
      queued: true,
      lastSynced
    });
  }

  // Perform full sync
  try {
    await fetchInventory();
    lastSynced = new Date().toISOString();

    return res.json({
      success: true,
      connected: true,
      lastSynced
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      connected: true,
      error: err.message,
      lastSynced
    });
  }
});

module.exports = router;
