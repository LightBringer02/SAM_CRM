const express = require('express');
const router = express.Router();
const axios = require('axios');
const { fetchInventory } = require('../connection/inventory');  // FIXED PATH
const { isDummyMode, isOfflineMode, getBackendMode, getTallyUrl } = require('../config/systemConfig');
const { getDummyInventory } = require('../config/dummyData');

// Import sync service for database fallback
let tallySyncService;
try {
  tallySyncService = require('../services/tallySyncService');
} catch (err) {
  console.warn('TallySyncService not available for inventory:', err.message);
}

router.get('/', async (req, res) => {
  try {
    const mode = getBackendMode();
    
    // Check if dummy data mode is enabled
    if (isDummyMode()) {
      const dummyData = getDummyInventory();
      return res.json({ success: true, data: dummyData, mode: 'DUMMY_DATA' });
    }

    // Check if offline mode - fetch from database
    if (mode === 'OFFLINE') {
      if (tallySyncService) {
        const dbData = await tallySyncService.getStockItemsFromDb();
        // Filter out items with empty names
        const filtered = dbData.filter(item => item.name && item.name.trim() !== '');
        const mapped = filtered.map((item, idx) => ({
          serial: idx + 1,
          name: item.name,
          alias: item.alias || 'N/A',
          group: item.parent || '',
          category: item.category || '',
          hsn: item.hsn_code || '',
          gst: item.gst_rate || 0,
          rate: item.closing_rate || 0,
          quantity: item.closing_qty || 0,
          unit: item.unit || '',
          stock: item.closing_value || 0,
          purchase_rate: item.opening_rate || 0,
          selling_rate: item.closing_rate || 0,
          opening_balance: item.opening_qty || 0,
          opening_value: item.opening_value || 0,
          closing_value: item.closing_value || 0,
        }));
        return res.json({ 
          success: true, 
          data: mapped, 
          mode: 'OFFLINE',
          message: 'Data loaded from database (Tally offline)',
          fromDatabase: true
        });
      }
      return res.json({ 
        success: true, 
        data: [], 
        mode: 'OFFLINE',
        message: 'Offline mode - no cached data available'
      });
    }

    // Try to fetch from Tally first
    let data = [];
    let fromDatabase = false;
    
    try {
      data = await fetchInventory();
      
      // If we got data from Tally, sync it to database
      if (data.length > 0 && tallySyncService) {
        // Convert to sync format and store
        const stockItems = data.map(item => ({
          name: item.name,
          alias: item.alias || '',
          parent: item.group,
          category: item.category,
          opening_qty: item.opening_balance || 0,
          opening_rate: item.purchase_rate || 0,
          opening_value: item.opening_value || 0,
          closing_qty: item.quantity || 0,
          closing_rate: item.rate || 0,
          closing_value: item.closing_value || 0,
          unit: item.unit,
          gst_rate: item.gst || 0,
          hsn_code: item.hsn
        }));
        await tallySyncService.syncStockItemsToDb(stockItems);
      }
    } catch (tallyErr) {
      console.warn('Tally fetch failed, falling back to database:', tallyErr.message);
      
      // Fallback to database
      if (tallySyncService) {
        const dbData = await tallySyncService.getStockItemsFromDb();
        // Filter out items with empty names
        const filtered = dbData.filter(item => item.name && item.name.trim() !== '');
        data = filtered.map(item => ({
          name: item.name,
          alias: item.alias || 'N/A',
          group: item.parent || '',
          category: item.category || '',
          hsn: item.hsn_code || '',
          gst: item.gst_rate || 0,
          rate: item.closing_rate || 0,
          quantity: item.closing_qty || 0,
          unit: item.unit || '',
          stock: item.closing_value || 0,
          purchase_rate: item.opening_rate || 0,
          selling_rate: item.closing_rate || 0,
          opening_balance: item.opening_qty || 0,
          opening_value: item.opening_value || 0,
          closing_value: item.closing_value || 0,
        }));
        fromDatabase = true;
      }
    }

    const mapped = data.map((item, idx) => ({
      serial: idx + 1,
      name: item.name,
      alias: item.alias,
      group: item.group,
      category: item.category,
      hsn: item.hsn,
      gst: item.gst,
      rate: item.rate,
      quantity: item.quantity,
      unit: item.unit,
      stock: item.stock || 0,
      purchase_rate: item.purchase_rate || 0,
      selling_rate: item.selling_rate || 0,
      opening_balance: item.opening_balance || 0,
      opening_value: item.opening_value || 0,
      closing_value: item.closing_value || 0,
    }));

    res.json({ 
      success: true, 
      data: mapped,
      mode: mode,
      fromDatabase,
      message: fromDatabase ? 'Data loaded from database (Tally offline)' : 'Data loaded from Tally'
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/inventory
 * Create a new stock item OR add stock to existing item in Tally and database
 */
router.post('/', async (req, res) => {
  try {
    const mode = getBackendMode();
    const itemData = req.body;
    const addToExisting = itemData.addToExisting === true;

    // Validate required fields
    if (!itemData.name || !itemData.name.trim()) {
      return res.status(400).json({ success: false, error: 'Item name is required' });
    }

    // Prepare stock item data
    // Note: Parent should be empty or a valid stock group that exists in Tally
    const opening_qty = parseFloat(itemData.openingQty) || 0;
    const opening_rate = parseFloat(itemData.openingRate) || parseFloat(itemData.rate) || 0;
    
    const stockItem = {
      name: itemData.name.trim(),
      parent: itemData.group || itemData.parent || '',  // Empty = Primary (default in Tally)
      category: itemData.category || '',
      unit: itemData.unit || 'Nos',
      opening_qty: opening_qty,
      opening_rate: opening_rate,
      opening_value: opening_qty * opening_rate, // Calculate opening value
      gst_rate: parseFloat(itemData.gstRate) || parseFloat(itemData.gst) || 0,
      hsn_code: itemData.hsnCode || itemData.hsn || '',
      alias: itemData.alias || ''
    };

    // If in LIVE or LOCAL mode, send to Tally
    if (mode === 'LIVE' || mode === 'LOCAL') {
      try {
        const tallyUrl = getTallyUrl() || 'http://localhost:9000';

        let xml;
        
        if (addToExisting) {
          // Adding stock to existing item
          // First, fetch current stock quantity from Tally
          const fetchXml = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
        <REPORTNAME>Stock Summary</REPORTNAME>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

          let currentQty = 0;
          try {
            const fetchResponse = await axios.post(tallyUrl, fetchXml, {
              headers: { 'Content-Type': 'text/xml' },
              timeout: 15000
            });
            
            // Try to parse current quantity for this item
            const responseText = fetchResponse.data || '';
            // Look for the item and its closing balance
            const itemRegex = new RegExp(`<STOCKITEM[^>]*>\\s*<STOCKITEMNAME>${stockItem.name}</STOCKITEMNAME>.*?<CLOSINGBALANCE>([\\d.-]+)`, 'si');
            const match = responseText.match(itemRegex);
            if (match) {
              currentQty = parseFloat(match[1]) || 0;
            }
            console.log(`Current stock for ${stockItem.name}: ${currentQty}`);
          } catch (fetchErr) {
            console.warn('Could not fetch current stock, will just set new quantity:', fetchErr.message);
          }

          // Calculate new total quantity
          const newTotalQty = currentQty + stockItem.opening_qty;
          console.log(`Adding ${stockItem.opening_qty} to existing stock item: ${stockItem.name} (${currentQty} + ${stockItem.opening_qty} = ${newTotalQty})`);
          
          // For ALTER, we need to use REPLACE mode to update the opening balance
          xml = `<?xml version="1.0" encoding="utf-8"?>
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
          <STOCKITEM NAME="${stockItem.name}" REPLACE="Yes">
            <NAME>${stockItem.name}</NAME>
            <OPENINGBALANCE>${newTotalQty} ${stockItem.unit}</OPENINGBALANCE>
            <OPENINGRATE>${stockItem.opening_rate}</OPENINGRATE>
            <OPENINGVALUE>${newTotalQty * stockItem.opening_rate}</OPENINGVALUE>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
        } else {
          // Creating new stock item
          // Parent is optional - if empty, item goes to default Primary group
          const parentTag = stockItem.parent ? `<PARENT>${stockItem.parent}</PARENT>` : '';
          
          console.log('Stock item data for creation:', JSON.stringify(stockItem, null, 2));
          
          xml = `<?xml version="1.0" encoding="utf-8"?>
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
          <STOCKITEM NAME="${stockItem.name}" ACTION="Create">
            <NAME>${stockItem.name}</NAME>
            ${parentTag}
            <BASEUNITS>${stockItem.unit}</BASEUNITS>
            <ADDITIONALUNITS/>
            <OPENINGBALANCE>${stockItem.opening_qty} ${stockItem.unit}</OPENINGBALANCE>
            <OPENINGRATE>${stockItem.opening_rate}/${stockItem.unit}</OPENINGRATE>
            <OPENINGVALUE>${stockItem.opening_value}</OPENINGVALUE>
            <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
            <GSTTYPEOFSUPPLY>&#4; Goods</GSTTYPEOFSUPPLY>
            <HSNCODE>${stockItem.hsn_code}</HSNCODE>
            <GSTDETAILS.LIST>
              <APPLICABLEFROM>20170701</APPLICABLEFROM>
              <HSNCODE>${stockItem.hsn_code}</HSNCODE>
              <TAXABILITY>Taxable</TAXABILITY>
              <STATEWISEDETAILS.LIST>
                <RATEDETAILS.LIST>
                  <GSTRATE>${stockItem.gst_rate}</GSTRATE>
                </RATEDETAILS.LIST>
              </STATEWISEDETAILS.LIST>
            </GSTDETAILS.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
        }

        console.log(addToExisting ? 'Adding stock to existing item:' : 'Creating stock item in Tally:', stockItem.name);
        console.log('Tally URL:', tallyUrl);
        
        const response = await axios.post(tallyUrl, xml, {
          headers: { 'Content-Type': 'text/xml' },
          timeout: 30000
        });

        // Check if operation was successful
        const responseText = response.data || '';
        console.log('Tally response:', responseText.substring(0, 500));
        
        // Check for various error patterns in Tally response
        if (responseText.includes('LINEERROR') || responseText.includes('<ERRORS>') || 
            (responseText.includes('CREATED') && responseText.includes('0') && !addToExisting) ||
            (responseText.includes('ALTERED') && responseText.includes('0') && addToExisting)) {
          const errorMatch = responseText.match(/<LINEERROR[^>]*>(.*?)<\/LINEERROR>/s) ||
                           responseText.match(/<ERROR[^>]*>(.*?)<\/ERROR>/s);
          const errorMsg = errorMatch ? errorMatch[1].trim() : 'Tally operation failed - check Tally is open with a company';
          throw new Error(errorMsg);
        }

        console.log(addToExisting ? 'Stock added successfully:' : 'Stock item created in Tally successfully:', stockItem.name);
      } catch (tallyErr) {
        console.error('Failed to create in Tally:', tallyErr.message);
        // Return error so user knows it failed
        return res.status(500).json({ 
          success: false, 
          error: `Tally creation failed: ${tallyErr.message}`,
          hint: 'Make sure Tally is running with a company open and Tally.NET Server is enabled'
        });
      }
    }

    // Save to database
    if (tallySyncService) {
      await tallySyncService.syncStockItemsToDb([{
        name: stockItem.name,
        alias: stockItem.alias,
        parent: stockItem.parent,
        category: stockItem.category,
        opening_qty: stockItem.opening_qty,
        opening_rate: stockItem.opening_rate,
        opening_value: stockItem.opening_value,
        closing_qty: stockItem.opening_qty,
        closing_rate: stockItem.opening_rate,
        closing_value: stockItem.opening_value,
        unit: stockItem.unit,
        gst_rate: stockItem.gst_rate,
        hsn_code: stockItem.hsn_code
      }]);
    }

    res.json({ 
      success: true, 
      message: addToExisting ? 'Stock added successfully' : 'Stock item created successfully',
      item: stockItem,
      mode,
      addedToExisting: addToExisting
    });

  } catch (err) {
    console.error('Error creating stock item:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
