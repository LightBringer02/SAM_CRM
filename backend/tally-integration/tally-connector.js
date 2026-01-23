// tally-connector.js
const axios = require('axios');
const xml2js = require('xml2js');

class TallyConnector {
  constructor(config = {}) {
    this.host = config.host || 'localhost';
    this.port = config.port || 9000;
    this.company = config.company || '';
    this.baseUrl = `http://${this.host}:${this.port}`;
  }

  // Helper method to send XML requests to Tally
  async sendRequest(xmlData) {
    try {
      const response = await axios.post(this.baseUrl, xmlData, {
        headers: { 'Content-Type': 'application/xml' },
        timeout: 30000
      });
      return response.data;
    } catch (error) {
      throw new Error(`Tally request failed: ${error.message}`);
    }
  }

  // Parse XML response to JSON
  async parseXML(xmlData) {
    const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
    try {
      return await parser.parseStringPromise(xmlData);
    } catch (error) {
      throw new Error(`XML parsing failed: ${error.message}`);
    }
  }

  // ==================== LEDGER OPERATIONS ====================

  // Create Ledger
  async createLedger(ledgerData) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <LEDGER NAME="${ledgerData.name}" ACTION="Create">
                  <NAME>${ledgerData.name}</NAME>
                  <PARENT>${ledgerData.parent || 'Sundry Debtors'}</PARENT>
                  <OPENINGBALANCE>${ledgerData.openingBalance || 0}</OPENINGBALANCE>
                  <COUNTRYNAME>${ledgerData.country || 'India'}</COUNTRYNAME>
                  <LEDSTATENAME>${ledgerData.state || ''}</LEDSTATENAME>
                  <PINCODE>${ledgerData.pincode || ''}</PINCODE>
                  <EMAIL>${ledgerData.email || ''}</EMAIL>
                  <MOBILE>${ledgerData.mobile || ''}</MOBILE>
                  <ADDRESS>${ledgerData.address || ''}</ADDRESS>
                  <GSTREGISTRATIONTYPE>${ledgerData.gstType || 'Regular'}</GSTREGISTRATIONTYPE>
                  <PARTYGSTIN>${ledgerData.gstin || ''}</PARTYGSTIN>
                </LEDGER>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Get Ledger
  async getLedger(ledgerName) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Ledger</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
                <LEDGERNAME>${ledgerName}</LEDGERNAME>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Get All Ledgers
  async getAllLedgers() {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>List of Accounts</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Update Ledger
  async updateLedger(ledgerName, updateData) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <LEDGER NAME="${ledgerName}" ACTION="Alter">
                  <NAME>${updateData.name || ledgerName}</NAME>
                  <PARENT>${updateData.parent || ''}</PARENT>
                  <EMAIL>${updateData.email || ''}</EMAIL>
                  <MOBILE>${updateData.mobile || ''}</MOBILE>
                  <ADDRESS>${updateData.address || ''}</ADDRESS>
                  <PARTYGSTIN>${updateData.gstin || ''}</PARTYGSTIN>
                </LEDGER>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Delete Ledger
  async deleteLedger(ledgerName) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <LEDGER NAME="${ledgerName}" ACTION="Delete">
                  <NAME>${ledgerName}</NAME>
                </LEDGER>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // ==================== STOCK ITEM OPERATIONS ====================

  // Create Stock Item
  async createStockItem(itemData) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <STOCKITEM NAME="${itemData.name}" ACTION="Create">
                  <NAME>${itemData.name}</NAME>
                  <PARENT>${itemData.category || 'Primary'}</PARENT>
                  <CATEGORY>${itemData.category || 'Primary'}</CATEGORY>
                  <BASEUNITS>${itemData.unit || 'Nos'}</BASEUNITS>
                  <OPENINGBALANCE>${itemData.openingQty || 0}</OPENINGBALANCE>
                  <OPENINGRATE>${itemData.openingRate || 0}</OPENINGRATE>
                  <OPENINGVALUE>${itemData.openingValue || 0}</OPENINGVALUE>
                  <GSTAPPLICABLE>${itemData.gstApplicable || 'Yes'}</GSTAPPLICABLE>
                  <HSN>${itemData.hsn || ''}</HSN>
                  <GSTTYPEOFSUPPLY>${itemData.gstSupplyType || 'Goods'}</GSTTYPEOFSUPPLY>
                  <IGSTRATE>${itemData.igstRate || 0}</IGSTRATE>
                  <CGSTRATE>${itemData.cgstRate || 0}</CGSTRATE>
                  <SGSTRATE>${itemData.sgstRate || 0}</SGSTRATE>
                </STOCKITEM>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Get Stock Item
  async getStockItem(itemName) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Stock Item</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
                <STOCKITEMNAME>${itemName}</STOCKITEMNAME>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Get All Stock Items
  async getAllStockItems() {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>List of Stock Items</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Update Stock Item
  async updateStockItem(itemName, updateData) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <STOCKITEM NAME="${itemName}" ACTION="Alter">
                  <NAME>${updateData.name || itemName}</NAME>
                  <BASEUNITS>${updateData.unit || ''}</BASEUNITS>
                  <HSN>${updateData.hsn || ''}</HSN>
                  <IGSTRATE>${updateData.igstRate || ''}</IGSTRATE>
                </STOCKITEM>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Delete Stock Item
  async deleteStockItem(itemName) {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>All Masters</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <STOCKITEM NAME="${itemName}" ACTION="Delete">
                  <NAME>${itemName}</NAME>
                </STOCKITEM>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // ==================== VOUCHER/ORDER OPERATIONS ====================

  // Create Sales Voucher (Order)
  async createSalesVoucher(voucherData) {
    const inventoryEntries = voucherData.items.map(item => `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${item.name}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
        <RATE>${item.rate}</RATE>
        <AMOUNT>${item.amount}</AMOUNT>
        <ACTUALQTY>${item.quantity}</ACTUALQTY>
        <BILLEDQTY>${item.quantity}</BILLEDQTY>
      </ALLINVENTORYENTRIES.LIST>
    `).join('');

    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Vouchers</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Sales" ACTION="Create">
                  <DATE>${voucherData.date || new Date().toISOString().split('T')[0].replace(/-/g, '')}</DATE>
                  <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
                  <VOUCHERNUMBER>${voucherData.voucherNumber || ''}</VOUCHERNUMBER>
                  <PARTYLEDGERNAME>${voucherData.partyName}</PARTYLEDGERNAME>
                  <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
                  <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>${voucherData.partyName}</LEDGERNAME>
                    <GSTCLASS/>
                    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                    <AMOUNT>-${voucherData.totalAmount}</AMOUNT>
                  </ALLLEDGERENTRIES.LIST>
                  <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>Sales</LEDGERNAME>
                    <GSTCLASS/>
                    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                    <AMOUNT>${voucherData.totalAmount}</AMOUNT>
                  </ALLLEDGERENTRIES.LIST>
                  ${inventoryEntries}
                </VOUCHER>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Create Purchase Voucher
  async createPurchaseVoucher(voucherData) {
    const inventoryEntries = voucherData.items.map(item => `
      <ALLINVENTORYENTRIES.LIST>
        <STOCKITEMNAME>${item.name}</STOCKITEMNAME>
        <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
        <RATE>${item.rate}</RATE>
        <AMOUNT>-${item.amount}</AMOUNT>
        <ACTUALQTY>-${item.quantity}</ACTUALQTY>
        <BILLEDQTY>-${item.quantity}</BILLEDQTY>
      </ALLINVENTORYENTRIES.LIST>
    `).join('');

    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Import Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <IMPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Vouchers</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
            <REQUESTDATA>
              <TALLYMESSAGE xmlns:UDF="TallyUDF">
                <VOUCHER REMOTEID="" VCHKEY="" VCHTYPE="Purchase" ACTION="Create">
                  <DATE>${voucherData.date || new Date().toISOString().split('T')[0].replace(/-/g, '')}</DATE>
                  <VOUCHERTYPENAME>Purchase</VOUCHERTYPENAME>
                  <VOUCHERNUMBER>${voucherData.voucherNumber || ''}</VOUCHERNUMBER>
                  <PARTYLEDGERNAME>${voucherData.partyName}</PARTYLEDGERNAME>
                  <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>${voucherData.partyName}</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
                    <AMOUNT>${voucherData.totalAmount}</AMOUNT>
                  </ALLLEDGERENTRIES.LIST>
                  <ALLLEDGERENTRIES.LIST>
                    <LEDGERNAME>Purchase</LEDGERNAME>
                    <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                    <AMOUNT>-${voucherData.totalAmount}</AMOUNT>
                  </ALLLEDGERENTRIES.LIST>
                  ${inventoryEntries}
                </VOUCHER>
              </TALLYMESSAGE>
            </REQUESTDATA>
          </IMPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    return await this.sendRequest(xml);
  }

  // Get Voucher
  async getVoucher(voucherNumber, voucherType = 'Sales') {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Voucher Register</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
                <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
                <VOUCHERNUMBER>${voucherNumber}</VOUCHERNUMBER>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Get All Vouchers
  async getAllVouchers(voucherType = 'Sales', fromDate = '', toDate = '') {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Voucher Register</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
                <VOUCHERTYPENAME>${voucherType}</VOUCHERTYPENAME>
                ${fromDate ? `<FROMDATE>${fromDate}</FROMDATE>` : ''}
                ${toDate ? `<TODATE>${toDate}</TODATE>` : ''}
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // ==================== INVENTORY REPORTS ====================

  // Get Stock Summary
  async getStockSummary() {
    const xml = `
      <ENVELOPE>
        <HEADER>
          <TALLYREQUEST>Export Data</TALLYREQUEST>
        </HEADER>
        <BODY>
          <EXPORTDATA>
            <REQUESTDESC>
              <REPORTNAME>Stock Summary</REPORTNAME>
              <STATICVARIABLES>
                <SVCURRENTCOMPANY>${this.company}</SVCURRENTCOMPANY>
              </STATICVARIABLES>
            </REQUESTDESC>
          </EXPORTDATA>
        </BODY>
      </ENVELOPE>
    `;
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }

  // Get Company Info
  async getCompanyInfo() {
    const xml = `
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
    const response = await this.sendRequest(xml);
    return await this.parseXML(response);
  }
}

// --- Inventory Import Functions (from connection/inventory.js) ---
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

function parseTallyDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);
  return new Date(`${year}-${month}-${day}`);
}

function getMostRecentEntry(list, fieldName) {
  if (!list) return null;
  const entries = Array.isArray(list) ? list : [list];
  const sorted = entries
    .filter(entry => entry[fieldName])
    .sort((a, b) => {
      const dateA = parseTallyDate(a.APPLICABLEFROM);
      const dateB = parseTallyDate(b.APPLICABLEFROM);
      if (!dateA && !dateB) return 0;
      if (!dateA) return 1;
      if (!dateB) return -1;
      return dateB - dateA;
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
  function scan(node) {
    if (!node || typeof node !== "object") return;
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
  for (const item of stockItems) {
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
    let group_name = item.PARENT || "Primary";
    let category = item.CATEGORY || "N/A";
    if (category === "&#4; Not Applicable" || category.trim() === "") {
      category = "N/A";
    }
    let unit = item.BASEUNITS || "Nos";
    let unit_conversion = 1;
    if (item.CONVERSION && parseFloat(item.CONVERSION) > 0) {
      unit_conversion = parseFloat(item.CONVERSION);
    }
    let hsn = "N/A";
    const hsnCode = getMostRecentEntry(item["HSNDETAILS.LIST"], "HSNCODE");
    if (hsnCode) {
      hsn = hsnCode;
    }
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
    let rate = "";
    if (item["FULLMRP.LIST"]?.RATE) {
      rate = item["FULLMRP.LIST"].RATE;
    } else if (item["MRPDETAILS.LIST"]) {
      const mrpDetail = Array.isArray(item["MRPDETAILS.LIST"]) 
        ? item["MRPDETAILS.LIST"][0] 
        : item["MRPDETAILS.LIST"];
      if (mrpDetail?.["MRPRATEDETAILS.LIST"]?.MRPRATE) {
        rate = mrpDetail["MRPRATEDETAILS.LIST"].MRPRATE;
      }
    }
    const closing_balance = item.CLOSINGBALANCE || 0;
    const closing_value = item.CLOSINGVALUE || 0;
    const opening_balance = item.OPENINGBALANCE || 0;
    const opening_value = item.OPENINGVALUE || 0;
    const purchase_rate = item.STANDARDPRICE || 0;
    const selling_rate = item.STANDARDSELLINGPRICE || 0;
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

module.exports = TallyConnector;
module.exports.fetchInventory = fetchInventory;
module.exports.parseInventoryXml = parseInventoryXml;