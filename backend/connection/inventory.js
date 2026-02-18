const axios = require('axios');
const xml2js = require('xml2js');
const { getTallyUrl } = require('../config/systemConfig');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// Stock Items with Balance XML - This is the only XML we need for accurate closing quantities
const STOCK_ITEMS_XML = `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>StockItemsWithBalance</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="StockItemsWithBalance" ISMODIFY="No">
            <TYPE>StockItem</TYPE>
            <FETCH>NAME,PARENT,BASEUNITS,CLOSINGBALANCE,CLOSINGVALUE,CLOSINGRATE,OPENINGBALANCE,OPENINGVALUE,OPENINGRATE</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>
`;

const INVENTORY_XML = `
<ENVELOPE>
    <HEADER>
        <TALLYREQUEST>Export Data</TALLYREQUEST>
    </HEADER>
    <BODY>
        <EXPORTDATA>
            <REQUESTDESC>
                <REPORTNAME>List of Accounts</REPORTNAME>
                <STATICVARIABLES>
                    <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
                    <ACCOUNTTYPE>Stock Items</ACCOUNTTYPE>
                </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
                <COLLECTION NAME="StockItemCollection">
                    <TYPE>StockItem</TYPE>
                    <FETCH>
                        NAME,
                        BASEUNITS,
                        ALLNAMELIST,
                        HSNDETAILS.*,
                        GSTDETAILS.*,
                        FULLMRP.*,
                        OPENINGBALANCE,
                        OPENINGVALUE,
                        CLOSINGBALANCE,
                        CLOSINGVALUE,
                        STANDARDPRICE,
                        STANDARDSELLINGPRICE,
                        BATCHALLOCATIONS.LIST.*,
                        GODOWNWISEDETAILS.LIST.*
                    </FETCH>
                </COLLECTION>
            </REQUESTDATA>
        </EXPORTDATA>
    </BODY>
</ENVELOPE>
`;

function cleanTallyXml(xml) {
  // Remove control characters that can break parsing
  return xml.replace(/&#(?:[0-9]|[1-2][0-9]|3[0-1]);/g, '');
}

// Extract text value from xml2js parsed element
// Handles: string, object with _ (text content), or object with #text
function getTextValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    // xml2js puts text content in _ when there are attributes
    if (val._ !== undefined) return String(val._);
    if (val['#text'] !== undefined) return String(val['#text']);
    // Sometimes the value is nested
    if (val.TYPE !== undefined && Object.keys(val).length === 1) return '';
  }
  return '';
}

// Parse quantity string like " 110 pcs" to number
function parseQty(val) {
  const text = getTextValue(val);
  if (!text) return 0;
  const match = text.trim().match(/(-?[\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Parse rate string like "6500.00/pcs" to number
function parseRate(val) {
  const text = getTextValue(val);
  if (!text) return 0;
  const match = text.trim().match(/(-?[\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

// Parse amount string like "-654594.83" to positive number
function parseAmount(val) {
  const text = getTextValue(val);
  if (!text) return 0;
  const match = text.trim().match(/(-?[\d.]+)/);
  return match ? Math.abs(parseFloat(match[1])) : 0;
}

/**
 * Parse the STOCKITEM response from Tally TDL Collection
 * Handles format: <STOCKITEM NAME="Chra"> with child elements
 */
async function parseStockItemsXml(xml) {
  const inventory = [];
  
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      preserveChildrenOrder: true
    });

    // Find all STOCKITEM elements recursively
    function findStockItems(node, items = []) {
      if (!node || typeof node !== 'object') return items;
      
      if (node.STOCKITEM) {
        const stockItems = Array.isArray(node.STOCKITEM) ? node.STOCKITEM : [node.STOCKITEM];
        items.push(...stockItems);
      }
      
      for (const key of Object.keys(node)) {
        if (typeof node[key] === 'object') {
          findStockItems(node[key], items);
        }
      }
      
      return items;
    }

    const stockItems = findStockItems(parsed);
    console.log(`[Inventory] Found ${stockItems.length} stock items in Tally response`);

    for (const item of stockItems) {
      // Get name - can be from NAME attribute or child element
      let name = item.NAME || '';
      if (!name && item['LANGUAGENAME.LIST']?.['NAME.LIST']?.NAME) {
        const names = item['LANGUAGENAME.LIST']['NAME.LIST'].NAME;
        name = Array.isArray(names) ? names[0] : names;
      }
      if (!name || name.trim() === '') continue;

      // Get alias from LANGUAGENAME.LIST if available
      let alias = 'N/A';
      if (item['LANGUAGENAME.LIST']?.['NAME.LIST']?.NAME) {
        const names = item['LANGUAGENAME.LIST']['NAME.LIST'].NAME;
        if (Array.isArray(names) && names.length > 1) {
          alias = names[1] || 'N/A';
        }
      }

      // Get parent/group - use getTextValue helper
      let group = getTextValue(item.PARENT) || 'Primary';

      // Get unit - use getTextValue helper
      let unit = getTextValue(item.BASEUNITS) || 'Nos';
      // Handle "&#4; Not Applicable" case
      if (unit.includes('Not Applicable') || unit.includes('&#4;')) {
        unit = 'N/A';
      }

      // --- Extract category, HSN, GST details ---
      // Category: try to get from CATEGORY or GROUP or PARENT
      let category = getTextValue(item.CATEGORY) || group || 'N/A';

      // HSN: try to get from HSNDETAILS.LIST.HSNCODE or HSNDETAILS.LIST[0].HSNCODE
      let hsn = 'N/A';
      if (item['HSNDETAILS.LIST']) {
        const hsnDetails = item['HSNDETAILS.LIST'];
        if (Array.isArray(hsnDetails)) {
          hsn = getTextValue(hsnDetails[0]?.HSNCODE) || 'N/A';
        } else if (typeof hsnDetails === 'object') {
          hsn = getTextValue(hsnDetails.HSNCODE) || 'N/A';
        }
      }

      // GST: try to get from GSTDETAILS.LIST.GSTRATE or GSTDETAILS.LIST[0].GSTRATE
      let gst = 0;
      if (item['GSTDETAILS.LIST']) {
        const gstDetails = item['GSTDETAILS.LIST'];
        let gstRate = null;
        if (Array.isArray(gstDetails)) {
          gstRate = gstDetails[0]?.GSTRATE;
        } else if (typeof gstDetails === 'object') {
          gstRate = gstDetails.GSTRATE;
        }
        if (gstRate) {
          // GSTRATE can be a string like "18%" or "18"
          const gstText = getTextValue(gstRate);
          const match = gstText.match(/([\d.]+)/);
          if (match) gst = parseFloat(match[1]);
        }
      }

      // Parse all numeric values
      const closingQty = parseQty(item.CLOSINGBALANCE);
      const closingValue = parseAmount(item.CLOSINGVALUE);
      const closingRate = parseRate(item.CLOSINGRATE);
      const openingQty = parseQty(item.OPENINGBALANCE);
      const openingValue = parseAmount(item.OPENINGVALUE);
      const openingRate = parseRate(item.OPENINGRATE);

      // Use closing rate as primary rate, fallback to opening rate
      const rate = closingRate > 0 ? closingRate : openingRate;

      inventory.push({
        name: name.trim(),
        alias,
        group,
        category,
        hsn,
        gst,
        rate,
        unit,
        quantity: closingQty,
        stock: closingQty > 0 ? 'In Stock' : 'Out of Stock',
        closing_value: closingValue,
        opening_balance: openingQty,
        opening_value: openingValue,
        purchase_rate: openingRate,
        selling_rate: closingRate,
      });
    }
  } catch (err) {
    console.error('[Inventory] Error parsing stock items XML:', err.message);
  }

  return inventory;
}

/**
 * Parse the INVENTORY_XML response to extract HSN, GST, Category details
 */
async function parseInventoryDetailsXml(xml) {
  const detailsMap = new Map();
  
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      preserveChildrenOrder: true
    });

    // Find all STOCKITEM elements recursively
    function findStockItems(node, items = []) {
      if (!node || typeof node !== 'object') return items;
      
      if (node.STOCKITEM) {
        const stockItems = Array.isArray(node.STOCKITEM) ? node.STOCKITEM : [node.STOCKITEM];
        items.push(...stockItems);
      }
      
      for (const key of Object.keys(node)) {
        if (typeof node[key] === 'object') {
          findStockItems(node[key], items);
        }
      }
      
      return items;
    }

    const stockItems = findStockItems(parsed);
    console.log(`[Inventory] Found ${stockItems.length} items in details XML`);

    for (const item of stockItems) {
      let name = item.NAME || '';
      if (!name && item['LANGUAGENAME.LIST']?.['NAME.LIST']?.NAME) {
        const names = item['LANGUAGENAME.LIST']['NAME.LIST'].NAME;
        name = Array.isArray(names) ? names[0] : names;
      }
      if (!name || name.trim() === '') continue;

      // --- CATEGORY ---
      // In daybook.xml: <CATEGORY>Chra</CATEGORY> is direct child of STOCKITEM
      let category = getTextValue(item.CATEGORY) || getTextValue(item.STOCKCATEGORY) || getTextValue(item.PARENT) || 'N/A';

      // --- HSN ---
      // In daybook.xml: HSNDETAILS.LIST > HSNCODE: "6352"
      // Also available in GSTDETAILS.LIST > HSNCODE as backup
      let hsn = 'N/A';
      
      // Try HSNDETAILS.LIST first
      if (item['HSNDETAILS.LIST']) {
        const hsnDetails = item['HSNDETAILS.LIST'];
        if (Array.isArray(hsnDetails)) {
          hsn = getTextValue(hsnDetails[0]?.HSNCODE) || 'N/A';
        } else if (typeof hsnDetails === 'object') {
          hsn = getTextValue(hsnDetails.HSNCODE) || 'N/A';
        }
      }
      
      // Fallback to GSTDETAILS.LIST > HSNCODE
      if (hsn === 'N/A' && item['GSTDETAILS.LIST']) {
        const gstDetails = item['GSTDETAILS.LIST'];
        const gstObj = Array.isArray(gstDetails) ? gstDetails[0] : gstDetails;
        if (gstObj && gstObj.HSNCODE) {
          hsn = getTextValue(gstObj.HSNCODE) || 'N/A';
        }
      }

      // --- GST ---
      // In daybook.xml structure:
      // GSTDETAILS.LIST > STATEWISEDETAILS.LIST > RATEDETAILS.LIST (array)
      // Each RATEDETAILS.LIST has: GSTRATEDUTYHEAD (CGST/SGST/IGST) and GSTRATE
      let gst = 0;
      if (item['GSTDETAILS.LIST']) {
        const gstDetails = item['GSTDETAILS.LIST'];
        const gstObj = Array.isArray(gstDetails) ? gstDetails[0] : gstDetails;
        
        // Navigate to STATEWISEDETAILS.LIST
        let statewiseDetails = gstObj?.['STATEWISEDETAILS.LIST'];
        if (!statewiseDetails) statewiseDetails = gstObj?.STATEWISEDETAILS;
        
        if (statewiseDetails) {
          const stateObj = Array.isArray(statewiseDetails) ? statewiseDetails[0] : statewiseDetails;
          
          // Get RATEDETAILS.LIST - this is an array of rate entries
          let rateDetailsList = stateObj?.['RATEDETAILS.LIST'];
          if (!rateDetailsList) rateDetailsList = stateObj?.RATEDETAILS;
          
          let igst = 0, cgst = 0, sgst = 0;
          if (rateDetailsList) {
            const rates = Array.isArray(rateDetailsList) ? rateDetailsList : [rateDetailsList];
            for (const rate of rates) {
              const duty = getTextValue(rate.GSTRATEDUTYHEAD).toUpperCase();
              const rateVal = parseFloat(getTextValue(rate.GSTRATE)) || 0;
              
              if (duty.includes('IGST')) igst = rateVal;
              else if (duty.includes('CGST')) cgst = rateVal;
              else if (duty.includes('SGST') || duty.includes('UTGST')) sgst = rateVal;
            }
          }
          // Use IGST if available, otherwise sum CGST + SGST
          gst = igst > 0 ? igst : (cgst + sgst);
        }
      }

      // Extract MRP from FULLMRP.LIST
      let mrp = 0;
      if (item['FULLMRP.LIST']) {
        const mrpDetails = item['FULLMRP.LIST'];
        if (Array.isArray(mrpDetails)) {
          mrp = parseAmount(mrpDetails[0]?.RATE);
        } else if (typeof mrpDetails === 'object') {
          mrp = parseAmount(mrpDetails.RATE);
        }
      }

      console.log(`[Inventory] Parsed details for ${name}: HSN=${hsn}, GST=${gst}%, Category=${category}`);
      detailsMap.set(name.trim(), { hsn, gst, category, mrp });
    }
  } catch (err) {
    console.error('[Inventory] Error parsing details XML:', err.message);
  }

  return detailsMap;
}

/**
 * Fetch inventory from Tally using both XMLs:
 * - STOCK_ITEMS_XML for accurate closing quantities
 * - INVENTORY_XML for HSN, GST, Category details
 */
async function fetchInventory() {
  const TALLY_URL = getActiveTallyUrl();
  
  try {
    console.log('[Inventory] Fetching stock items from Tally:', TALLY_URL);
    
    // Fetch quantities from TDL Collection
    const { data: stockData } = await axios.post(TALLY_URL, STOCK_ITEMS_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 15000,
    });

    const cleanedStockXml = cleanTallyXml(stockData);
    const inventory = await parseStockItemsXml(cleanedStockXml);
    
    console.log(`[Inventory] Successfully parsed ${inventory.length} items with quantities`);

    // Fetch HSN, GST, Category details from INVENTORY_XML
    try {
      const { data: detailsData } = await axios.post(TALLY_URL, INVENTORY_XML, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 15000,
      });

      const cleanedDetailsXml = cleanTallyXml(detailsData);
      const detailsMap = await parseInventoryDetailsXml(cleanedDetailsXml);

      // Merge details into inventory
      for (const item of inventory) {
        const details = detailsMap.get(item.name);
        if (details) {
          item.hsn = details.hsn !== 'N/A' ? details.hsn : item.hsn;
          item.gst = details.gst > 0 ? details.gst : item.gst;
          item.category = details.category !== 'N/A' ? details.category : item.category;
          if (details.mrp > 0) item.mrp = details.mrp;
        }
      }
      console.log(`[Inventory] Merged HSN/GST/Category details for ${detailsMap.size} items`);
    } catch (detailsErr) {
      console.warn('[Inventory] Could not fetch HSN/GST details:', detailsErr.message);
      // Continue with basic inventory data
    }

    return inventory;
    
  } catch (err) {
    console.error('[Inventory] Tally Fetch Error:', err.message);
    throw err;
  }
}

module.exports = { fetchInventory, parseStockItemsXml };
