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

// Create Sales Voucher in Tally
router.post('/create-voucher', async (req, res) => {
  try {
    const connected = await pingTally();
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Tally not connected' });
    }
    
    const voucher = req.body;
    const TALLY_URL = getActiveTallyUrl();
    
    // Build items XML
    let itemsXml = '';
    if (voucher.items && Array.isArray(voucher.items)) {
      voucher.items.forEach(item => {
        const amount = (item.qty || 1) * (item.rate || 0);
        itemsXml += `
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${item.name || ''}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <BILLEDQTY>${item.qty || 1} ${item.per || 'Nos'}</BILLEDQTY>
            <RATE>${item.rate || 0}/${item.per || 'Nos'}</RATE>
            <AMOUNT>-${amount}</AMOUNT>
            <ACTUALQTY>${item.qty || 1} ${item.per || 'Nos'}</ACTUALQTY>
          </ALLINVENTORYENTRIES.LIST>`;
      });
    }
    
    // Build voucher XML
    const voucherXml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC></DESC>
    <DATA>
      <TALLYMESSAGE>
        <VOUCHER VCHTYPE="${voucher.voucher_type || 'Sales'}" ACTION="Create">
          <DATE>${(voucher.date || new Date().toISOString().slice(0,10)).replace(/-/g, '')}</DATE>
          <NARRATION>${voucher.narration || ''}</NARRATION>
          <VOUCHERTYPENAME>${voucher.voucher_type || 'Sales'}</VOUCHERTYPENAME>
          <PARTYLEDGERNAME>${voucher.party_ledger || ''}</PARTYLEDGERNAME>
          <REFERENCE>${voucher.reference || ''}</REFERENCE>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${voucher.party_ledger || ''}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <AMOUNT>-${voucher.amount || 0}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <AMOUNT>${voucher.amount || 0}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          ${itemsXml}
        </VOUCHER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;

    const response = await axios.post(TALLY_URL, voucherXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000
    });
    
    const result = response.data;
    const success = typeof result === 'string' && (result.includes('CREATED="1"') || result.includes('ALTERED="1"'));
    
    if (success) {
      res.json({ success: true, message: 'Voucher created in Tally' });
    } else {
      res.json({ success: false, error: 'Failed to create voucher', details: result });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Ledger in Tally
router.post('/create-ledger', async (req, res) => {
  try {
    const connected = await pingTally();
    if (!connected) {
      return res.status(503).json({ success: false, error: 'Tally not connected' });
    }
    
    const ledger = req.body;
    const TALLY_URL = getActiveTallyUrl();
    
    // Build ledger XML
    const ledgerXml = `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>All Masters</ID>
  </HEADER>
  <BODY>
    <DESC></DESC>
    <DATA>
      <TALLYMESSAGE>
        <LEDGER NAME="${ledger.name || ''}" ACTION="Create">
          <NAME>${ledger.name || ''}</NAME>
          <PARENT>${ledger.group || 'Sundry Debtors'}</PARENT>
          <ADDRESS.LIST>
            <ADDRESS>${ledger.address || ''}</ADDRESS>
          </ADDRESS.LIST>
          <LEDGERPHONE>${ledger.phone || ''}</LEDGERPHONE>
          <LEDGERMOBILE>${ledger.mobile || ''}</LEDGERMOBILE>
          <EMAIL>${ledger.email || ''}</EMAIL>
          <PARTYGSTIN>${ledger.gstin || ''}</PARTYGSTIN>
          <GSTREGISTRATIONTYPE>${ledger.gst_type || 'Regular'}</GSTREGISTRATIONTYPE>
          <LEDSTATENAME>${ledger.state || ''}</LEDSTATENAME>
          <PINCODE>${ledger.pincode || ''}</PINCODE>
        </LEDGER>
      </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;

    const response = await axios.post(TALLY_URL, ledgerXml, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000
    });
    
    const result = response.data;
    const success = typeof result === 'string' && (result.includes('CREATED="1"') || result.includes('ALTERED="1"'));
    
    if (success) {
      res.json({ success: true, message: 'Ledger created in Tally', name: ledger.name });
    } else {
      res.json({ success: false, error: 'Failed to create ledger', details: result });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
