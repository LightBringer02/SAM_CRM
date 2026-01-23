const axios = require('axios');
const xml2js = require('xml2js');

const TALLY_URL = process.env.TALLY_URL || 'http://localhost:9000';

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
  return xml.replace(/&#(?:[0-9]|[1-2][0-9]|3[0-1]);/g, '');
}

async function fetchInventoryXML() {
  const { data } = await axios.post(TALLY_URL, INVENTORY_XML, {
    headers: { "Content-Type": "text/xml" },
    timeout: 15000,
  });

  return cleanTallyXml(data);
}

// Helper function to parse date strings from Tally (YYYYMMDD format)
function parseTallyDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return new Date(`${year}-${month}-${day}`);
}

// Helper function to get the most recent/applicable entry from dated lists
function getMostRecentEntry(list, fieldName) {
  if (!list) return null;
  
  const entries = Array.isArray(list) ? list : [list];
  
  // Sort by APPLICABLEFROM date (most recent first)
  const sorted = entries
    .filter(entry => entry[fieldName])
    .sort((a, b) => {
      const dateA = parseTallyDate(a.APPLICABLEFROM);
      const dateB = parseTallyDate(b.APPLICABLEFROM);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA; // Most recent first
    });
  
  return sorted.length > 0 ? sorted[0][fieldName] : null;
}

async function parseInventoryXml(xml) {
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
    preserveChildrenOrder: true
  });

  const inventory = [];
  const stockItems = [];

  // UNIVERSAL STOCKITEM FINDER
  function scan(node) {
    if (!node || typeof node !== "object") return;

    // If STOCKITEM exists here
    if (node.STOCKITEM) {
      const list = Array.isArray(node.STOCKITEM)
        ? node.STOCKITEM
        : [node.STOCKITEM];
      stockItems.push(...list);
    }

    for (const key of Object.keys(node)) {
      scan(node[key]);
    }
  }

  scan(parsed);

  // PROCESS ALL STOCK ITEMS
  for (const item of stockItems) {

    // 1. NAME + ALIAS
    let primary_name = "";
    let alias_name = "N/A";

    const lang = item["LANGUAGENAME.LIST"]?.["NAME.LIST"];
    if (lang?.NAME) {
      const names = Array.isArray(lang.NAME) ? lang.NAME : [lang.NAME];
      primary_name = names[0] || "";
      alias_name = names[1] || "N/A";
    } else {
      primary_name = item.NAME || "";
    }

    if (!primary_name) continue;

    // 2. GROUP
    let group_name = item.PARENT || "Primary";

    // 3. CATEGORY
    let category = item.CATEGORY || "N/A";
    if (category === "&#4; Not Applicable" || category.trim() === "") {
      category = "N/A";
    }

    // 4. UNIT - Handle compound units better
    let unit = item.BASEUNITS || "Nos";
    
    // Extract additional unit info if compound unit
    let unit_conversion = 1;
    if (item.CONVERSION && parseFloat(item.CONVERSION) > 0) {
      unit_conversion = parseFloat(item.CONVERSION);
    }

    // 5. HSN - Get most recent HSN entry
    let hsn = "N/A";
    const hsnCode = getMostRecentEntry(item["HSNDETAILS.LIST"], "HSNCODE");
    if (hsnCode) {
      hsn = hsnCode;
    }

    // 6. GST RATE
    let gst_rate = "0";
    const rateBlock =
      item["GSTDETAILS.LIST"]?.["STATEWISEDETAILS.LIST"]?.["RATEDETAILS.LIST"];

    if (rateBlock) {
      const arr = Array.isArray(rateBlock) ? rateBlock : [rateBlock];
      for (const r of arr) {
        if (r.GSTRATEDUTYHEAD === "IGST" && r.GSTRATE) {
          gst_rate = r.GSTRATE;
        }
      }
    }

    // 7. MRP - Get most recent MRP
    let rate = "";
    if (item["FULLMRP.LIST"]?.RATE) {
      rate = item["FULLMRP.LIST"].RATE;
    } else if (item["MRPDETAILS.LIST"]) {
      // Try to get from MRPDETAILS if FULLMRP not available
      const mrpDetail = Array.isArray(item["MRPDETAILS.LIST"]) 
        ? item["MRPDETAILS.LIST"][0] 
        : item["MRPDETAILS.LIST"];
      
      if (mrpDetail?.["MRPRATEDETAILS.LIST"]?.MRPRATE) {
        rate = mrpDetail["MRPRATEDETAILS.LIST"].MRPRATE;
      }
    }

    // 8. STOCK VALUES
    const closing_balance = item.CLOSINGBALANCE || 0;
    const closing_value = item.CLOSINGVALUE || 0;

    const opening_balance = item.OPENINGBALANCE || 0;
    const opening_value = item.OPENINGVALUE || 0;

    const purchase_rate = item.STANDARDPRICE || 0;
    const selling_rate = item.STANDARDSELLINGPRICE || 0;

    // 9. BATCH DETAILS (if available)
    let batch_info = [];
    if (item["BATCHALLOCATIONS.LIST"]) {
      const batches = Array.isArray(item["BATCHALLOCATIONS.LIST"])
        ? item["BATCHALLOCATIONS.LIST"]
        : [item["BATCHALLOCATIONS.LIST"]];
      
      batch_info = batches.map(b => ({
        godown: b.GODOWNNAME || "Main Location",
        batch: b.BATCHNAME || "Primary Batch",
        balance: b.OPENINGBALANCE || 0,
        value: b.OPENINGVALUE || 0,
        rate: b.OPENINGRATE || 0,
        mfg_date: b.MFDON || null
      }));
    }

    inventory.push({
      name: primary_name,
      alias: alias_name,
      group: group_name,
      category,
      hsn,
      gst: gst_rate,
      rate,
      unit,
      unit_conversion,

      quantity: closing_balance,
      stock: closing_balance,
      closing_value,
      opening_balance,
      opening_value,

      purchase_rate,
      selling_rate,
      
      // Additional useful fields
      batch_info: batch_info.length > 0 ? batch_info : null,
      guid: item.GUID || null,
    });
  }

  return inventory;
}

async function fetchInventory() {
  try {
    const xml = await fetchInventoryXML();
    return await parseInventoryXml(xml);
  } catch (err) {
    console.error("Tally Inventory Fetch Error:", err);
    throw err;
  }
}

module.exports = { fetchInventory, parseInventoryXml };