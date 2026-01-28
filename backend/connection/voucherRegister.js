/**
 * Voucher Register Parser - Complete Tally Voucher Parser
 * Fully Stable Parsing Version (Option B)
 * Supports all Tally LIST shapes, AMOUNT formats, and nested inventory/ledger structures.
 */

const axios = require('axios');
const xml2js = require('xml2js');
const { getTallyUrl } = require('../config/systemConfig');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// XML request template for voucher register
const VOUCHER_REGISTER_XML = `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Voucher Register</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
`;

// Clean invalid XML characters from Tally response
function cleanTallyXml(xml) {
  return xml.replace(/&#(?:[0-9]|[1-2][0-9]|3[0-1]);/g, '');
}

// ============================================================
// SAFE EXTRACTION HELPERS
// ============================================================

// Safely get text value from node
function getText(node, key) {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (typeof node === 'number') return String(node);

  // Handle dot notation for nested keys
  if (key && key.includes('.')) {
    const parts = key.split('.');
    let current = node;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return '';
      current = current[part];
    }
    return getText(current, null);
  }

  if (key && node[key] !== undefined) {
    const val = node[key];

    if (typeof val === 'string') return val.trim();
    if (typeof val === 'number') return String(val);

    // xml2js sometimes wraps values inside arrays
    if (Array.isArray(val)) {
      const first = val[0];
      if (typeof first === 'string') return first.trim();
      if (typeof first === 'object' && first._) return String(first._).trim();
      if (typeof first === 'object' && first['#text']) return String(first['#text']).trim();
      return '';
    }

    // xml2js object
    if (typeof val === 'object') {
      if (val._ !== undefined) return String(val._).trim();
      if (val['#text'] !== undefined) return String(val['#text']).trim();
      return '';
    }

    return '';
  }

  if (node._ !== undefined) return String(node._).trim();
  if (node['#text'] !== undefined) return String(node['#text']).trim();
  return '';
}

// ============================================================
// FIXED LIST PARSER
// ============================================================

function getList(node, key) {
  if (!node) return [];

  let val = key ? node[key] : node;
  if (!val) return [];

  // Always handle array correctly
  if (Array.isArray(val)) return val;

  // If xml2js collapses <TAG.LIST> into an object with multiple keys
  // Example: TAG.LIST: { FIELD1: [...], FIELD2: [...], ... }
  if (typeof val === 'object') {
    // Case: xml2js nested LIST format: { LIST: [...] }
    if (val.LIST) {
      const inner = val.LIST;
      return Array.isArray(inner) ? inner : [inner];
    }

    // Case: object with multiple children = treat as one LIST entry
    const keys = Object.keys(val);
    if (keys.length > 0 && !val._ && !val['#text']) {
      return [val];
    }

    // Default: wrap object as list
    return [val];
  }

  return [];
}

// ============================================================
// STABLE AMOUNT PARSER
// ============================================================

function parseAmount(val) {
  if (val === null || val === undefined) return 0;

  // Direct number
  if (typeof val === 'number') return val;

  // String form
  if (typeof val === 'string') {
    const cleaned = val.replace(/\s+/g, '').replace(/,/g, '');
    const match = cleaned.match(/-?\d*\.?\d+/);
    return match ? parseFloat(match[0]) : 0;
  }

  // xml2js frequently wraps AMOUNT like this:
  // AMOUNT: [ { _: "35000.00" } ]
  if (Array.isArray(val)) return parseAmount(val[0]);

  // Object form
  if (typeof val === 'object') {
    if (val._) return parseAmount(val._);
    if (val['#text']) return parseAmount(val['#text']);
    if (val.AMOUNT) return parseAmount(val.AMOUNT);
  }

  return 0;
}

// Extract unit from qty string like "10 Nos" -> "Nos"
function extractUnit(val) {
  if (!val || typeof val !== 'string') return '';
  const match = val.match(/[\d,.\-\s]+(.+)/);
  return match ? match[1].trim() : '';
}

// Parse Tally date format YYYYMMDD to YYYY-MM-DD
function parseTallyDate(dateStr) {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (str.length !== 8) return str;
  if (!/^\d{8}$/.test(str)) return str;
  return `${str.substring(0, 4)}-${str.substring(4, 6)}-${str.substring(6, 8)}`;
}

// ============================================================
// ITEM PARSER
// ============================================================
function parseInventoryItem(item) {
  if (!item) return null;

  const stockItem = getText(item, 'STOCKITEMNAME');

  const billedQtyRaw =
    getText(item, 'BILLEDQTY') ||
    getText(item, 'ACTUALQTY') ||
    getText(item, 'QTY');

  const rateRaw = getText(item, 'RATE');

  // Amount direct
  let amount = parseAmount(getText(item, 'AMOUNT'));

  // Support nested ACCOUNTINGALLOCATIONS.LIST for item amount
  if ((!amount || amount === 0) && item.ACCOUNTINGALLOCATIONS) {
    const allocs = getList(item, 'ACCOUNTINGALLOCATIONS.LIST');
    amount = allocs.reduce((sum, a) => sum + parseAmount(getText(a, 'AMOUNT')), 0);
  }

  const qty = Math.abs(parseAmount(billedQtyRaw));
  const qtyUnit = extractUnit(billedQtyRaw);

  let rate = 0;
  let per = '';

  if (rateRaw) {
    if (rateRaw.includes('/')) {
      const [rateVal, perVal] = rateRaw.split('/');
      rate = Math.abs(parseAmount(rateVal));
      per = perVal ? perVal.trim() : '';
    } else {
      rate = Math.abs(parseAmount(rateRaw));
      per = extractUnit(rateRaw) || qtyUnit;
    }
  }

  // HSN fallback chain
  const hsn =
    getText(item, 'GSTHSNNAME') ||
    getText(item, 'HSNSACCODE') ||
    getText(item, 'HSNITEMSOURCE') ||
    getText(item, 'HSNSTOCKGROUPSOURCE') ||
    getText(item, 'HSNCODE') ||
    getText(item, 'HSN') ||
    (item.HSN ? getText(item, 'HSN') : '');

  // GST rate details
  const gstDetails = getList(item, 'RATEDETAILS.LIST');
  let cgstRate = 0,
    sgstRate = 0,
    igstRate = 0;

  gstDetails.forEach((gst) => {
    const dutyHead = getText(gst, 'GSTRATEDUTYHEAD').toUpperCase();
    const gstRateVal = parseAmount(getText(gst, 'GSTRATE'));

    if (dutyHead.includes('CGST')) cgstRate = gstRateVal;
    else if (dutyHead.includes('SGST')) sgstRate = gstRateVal;
    else if (dutyHead.includes('IGST')) igstRate = gstRateVal;
  });

  // Batch allocations
  const batches = getList(item, 'BATCHALLOCATIONS.LIST').map((batch) => ({
    name: getText(batch, 'BATCHNAME') || getText(batch, 'GODOWNNAME'),
    qty: Math.abs(
      parseAmount(getText(batch, 'BILLEDQTY') || getText(batch, 'ACTUALQTY'))
    ),
    amount: Math.abs(parseAmount(getText(batch, 'AMOUNT')))
  }));

  return {
    name: stockItem,
    qty,
    per: per || qtyUnit,
    rate,
    amount,
    hsn,
    gst: { cgst: cgstRate, sgst: sgstRate, igst: igstRate },
    batches
  };
}

// ============================================================
// LEDGER PARSER
// ============================================================

function parseLedgerEntry(led) {
  if (!led) return null;

  const ledgerName = getText(led, 'LEDGERNAME');
  const amount = parseAmount(getText(led, 'AMOUNT'));

  // People often flip DR/CR in Tally; this gives stable inference
  const isDr =
    getText(led, 'ISPARTYLEDGER') === 'Yes' || amount > 0;

  const gstDetails = getList(led, 'RATEDETAILS.LIST');
  let cgstRate = 0,
    sgstRate = 0,
    igstRate = 0;

  gstDetails.forEach((gst) => {
    const dutyHead = getText(gst, 'GSTRATEDUTYHEAD').toUpperCase();
    const gstRateVal = parseAmount(getText(gst, 'GSTRATE'));

    if (dutyHead.includes('CGST')) cgstRate = gstRateVal;
    else if (dutyHead.includes('SGST')) sgstRate = gstRateVal;
    else if (dutyHead.includes('IGST')) igstRate = gstRateVal;
  });

  // Bill allocations
  const billAllocations = getList(led, 'BILLALLOCATIONS.LIST').map((bill) => ({
    name:
      getText(bill, 'NAME') ||
      getText(bill, 'BILLREFERENCE') ||
      getText(bill, 'REFERENCE'),
    BILLREFERENCE: getText(bill, 'BILLREFERENCE'),
    REFERENCE: getText(bill, 'REFERENCE'),
    type: getText(bill, 'BILLTYPE'),
    amount: Math.abs(parseAmount(getText(bill, 'AMOUNT')))
  }));

  // Bank allocations
  const bankAllocations = getList(led, 'BANKALLOCATIONS.LIST').map((bank) => ({
    date: parseTallyDate(
      getText(bank, 'DATE') || getText(bank, 'INSTRUMENTDATE')
    ),
    instrument_number:
      getText(bank, 'INSTRUMENTNUMBER') ||
      getText(bank, 'CHEQUENUMBER'),
    transaction_type: getText(bank, 'TRANSACTIONTYPE'),
    bank_name: getText(bank, 'BANKNAME'),
    amount: Math.abs(parseAmount(getText(bank, 'AMOUNT')))
  }));

  const upperName = (ledgerName || '').toUpperCase();
  const isCgst = upperName.includes('CGST');
  const isSgst = upperName.includes('SGST');
  const isIgst = upperName.includes('IGST');
  const isGstLedger = isCgst || isSgst || isIgst;

  return {
    name: ledgerName,
    amount: Math.abs(amount),
    is_debit: isDr,
    gst: { cgst: cgstRate, sgst: sgstRate, igst: igstRate },
    is_gst_ledger: isGstLedger,
    gst_type: isCgst ? 'CGST' : isSgst ? 'SGST' : isIgst ? 'IGST' : '',
    bill_allocations: billAllocations,
    bank_allocations: bankAllocations
  };
}
// ============================================================
// VOUCHER PARSER
// ============================================================

// Helper to extract address from Tally (can be array or string or object)
function extractAddress(voucher, ...keys) {
  for (const key of keys) {
    const val = voucher[key];
    if (!val) continue;

    if (typeof val === 'string') return val.trim();

    if (Array.isArray(val)) {
      return val.filter(v => v && typeof v === 'string').join(', ');
    }

    if (typeof val === 'object' && val.LIST) {
      const list = Array.isArray(val.LIST) ? val.LIST : [val.LIST];
      return list.filter(v => v && typeof v === 'string').join(', ');
    }
  }
  return '';
}

function parseVoucher(voucher) {
  if (!voucher) return null;

  const date = parseTallyDate(getText(voucher, 'DATE'));
  const number =
    getText(voucher, 'VOUCHERNUMBER') ||
    getText(voucher, 'VCHNO') ||
    getText(voucher, 'NUMBER');

  const type =
    getText(voucher, 'VOUCHERTYPENAME') ||
    getText(voucher, 'VCHTYPE') ||
    getText(voucher, 'TYPE');

  const party =
    getText(voucher, 'PARTYLEDGERNAME') ||
    getText(voucher, 'PARTYNAME');

  const narration = getText(voucher, 'NARRATION');
  const guid = getText(voucher, 'GUID');

  const reference = getText(voucher, 'REFERENCE');

  // Supplier invoice numbers
  const supplierInvoiceNo = getText(voucher, 'SUPPLIERINVOICENO');
  const basicInvoiceNo = getText(voucher, 'BASICINVOICENO');
  const basicShippingInvoiceNo = getText(voucher, 'BASICSHIPPINGINVOICENO');

  const partyGstin =
    getText(voucher, 'PARTYGSTIN') ||
    getText(voucher, 'GSTIN');

  const partyState =
    getText(voucher, 'PARTYSTATENAME') ||
    getText(voucher, 'CONSIGNEESTATENAME') ||
    getText(voucher, 'PLACEOFSUPPLY');

  const partyAddress = extractAddress(
    voucher,
    'BASICBUYERADDRESS',
    'PARTYADDRESS',
    'ADDRESS'
  );

  const placeofsupply = getText(voucher, 'PLACEOFSUPPLY');
  const companyGstin = getText(voucher, 'CMPGSTIN');

  // ============================================================
  // FIXED: Collect all inventory entries
  // ============================================================

  let itemsRaw = [];

  // ALLINVENTORYENTRIES.LIST
  const allInventory = voucher['ALLINVENTORYENTRIES.LIST'];
  if (allInventory) {
    const list = Array.isArray(allInventory) ? allInventory : [allInventory];
    itemsRaw = itemsRaw.concat(list);
  }

  // INVENTORYENTRIESIN.LIST
  const inventoryIn = voucher['INVENTORYENTRIESIN.LIST'];
  if (inventoryIn) {
    const list = Array.isArray(inventoryIn) ? inventoryIn : [inventoryIn];
    itemsRaw = itemsRaw.concat(list);
  }

  // INVENTORYENTRIESOUT.LIST
  const inventoryOut = voucher['INVENTORYENTRIESOUT.LIST'];
  if (inventoryOut) {
    const list = Array.isArray(inventoryOut) ? inventoryOut : [inventoryOut];
    itemsRaw = itemsRaw.concat(list);
  }

  // ACCOUNTINGALLOCATIONS under inventory nodes
  let accountingAllocItems = [];
  itemsRaw.forEach(inv => {
    const alloc = inv?.ACCOUNTINGALLOCATIONS;
    if (alloc) {
      const arr = getList(inv, 'ACCOUNTINGALLOCATIONS.LIST');
      accountingAllocItems = accountingAllocItems.concat(arr);
    }
  });

  const items = itemsRaw.map(parseInventoryItem).filter(Boolean);

  // ============================================================
  // LEDGER PARSING
  // ============================================================

  let ledgersRaw = [];

  const ledgerEntries = voucher['LEDGERENTRIES.LIST'];
  if (ledgerEntries) {
    const list = Array.isArray(ledgerEntries) ? ledgerEntries : [ledgerEntries];
    ledgersRaw = ledgersRaw.concat(list);
  }

  const allLedgerEntries = voucher['ALLLEDGERENTRIES.LIST'];
  if (allLedgerEntries) {
    const list = Array.isArray(allLedgerEntries)
      ? allLedgerEntries
      : [allLedgerEntries];
    ledgersRaw = ledgersRaw.concat(list);
  }

  const ledgers = ledgersRaw.map(parseLedgerEntry).filter(Boolean);

  // ============================================================
  // SUMMATION + GST
  // ============================================================

  let subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  let allocTotal = accountingAllocItems.reduce(
    (sum, a) => sum + parseAmount(getText(a, 'AMOUNT')),
    0
  );

  let cgstAmount = 0,
    sgstAmount = 0,
    igstAmount = 0;

  ledgers.forEach((led) => {
    if (led.is_gst_ledger) {
      if (led.gst_type === 'CGST') cgstAmount += led.amount;
      else if (led.gst_type === 'SGST') sgstAmount += led.amount;
      else if (led.gst_type === 'IGST') igstAmount += led.amount;
    }
  });

  let totalAmount = parseAmount(getText(voucher, 'AMOUNT'));

  // For receipt/payment, use only the main party ledger's amount (with sign)
  const typeUpper = (type || '').toUpperCase();
  if (typeUpper === 'RECEIPT' || typeUpper === 'PAYMENT') {
    // Find the party ledger (ISPARTYLEDGER = Yes or name matches party)
    let partyLedger = ledgers.find(l => l.name && (
      l.name === party || l.is_party_ledger || l.isPartyLedger || l.is_party === true
    ));
    if (!partyLedger && ledgers.length === 2) {
      // Fallback: in 2-ledger case, pick the one with negative amount for payment, positive for receipt
      if (typeUpper === 'PAYMENT') {
        partyLedger = ledgers.find(l => l.amount < 0) || ledgers[0];
      } else {
        partyLedger = ledgers.find(l => l.amount > 0) || ledgers[0];
      }
    }
    if (partyLedger && typeof partyLedger.amount === 'number') {
      totalAmount = Math.abs(partyLedger.amount);
    }
  }

  if (!totalAmount || isNaN(totalAmount) || totalAmount === 0) {
    totalAmount = allocTotal || subtotal;
    if (!totalAmount || isNaN(totalAmount)) {
      totalAmount = ledgers.reduce((sum, l) => sum + (l.amount || 0), 0);
    }
  }

  totalAmount = Math.abs(totalAmount);

  // ============================================================
  // PAYMENT / RECEIPT LOGIC
  // ============================================================

  // (removed duplicate declaration of typeUpper)

  let payType = '';
  let checkNumber = '';
  let bankLedger = '';
  let billsApplied = [];

  if (typeUpper === 'RECEIPT' || typeUpper === 'PAYMENT') {
    // First priority: Check bank allocations which are definitive
    let hasBankAllocation = false;
    let hasCashLedger = false;
    let hasBankLedger = false;
    let cashLedgerAmount = 0;
    let bankLedgerAmount = 0;

    ledgers.forEach((led) => {
      // Check for bank allocations (most reliable indicator)
      if (led.bank_allocations?.length > 0) {
        const bankAlloc = led.bank_allocations[0];
        checkNumber = bankAlloc.instrument_number || '';
        payType = bankAlloc.transaction_type || 'Bank';
        bankLedger = led.name;
        hasBankAllocation = true;
      }

      const upperName = (led.name || '').toUpperCase();
      const ledAmount = Math.abs(parseFloat(led.amount) || 0);
      
      // Check if it's a Cash ledger (Cash-in-hand, Petty Cash, etc.)
      if (upperName.includes('CASH') && !upperName.includes('CASHBACK')) {
        hasCashLedger = true;
        cashLedgerAmount = Math.max(cashLedgerAmount, ledAmount);
      }
      
      // Check if it's a Bank ledger
      if (
        upperName.includes('BANK') ||
        upperName.includes('ICICI') ||
        upperName.includes('HDFC') ||
        upperName.includes('SBI') ||
        upperName.includes('AXIS') ||
        upperName.includes('KOTAK') ||
        upperName.includes('BOB') ||
        upperName.includes('PNB') ||
        upperName.includes('CANARA') ||
        upperName.includes('UNION BANK')
      ) {
        hasBankLedger = true;
        bankLedgerAmount = Math.max(bankLedgerAmount, ledAmount);
        if (!bankLedger) bankLedger = led.name;
      }

      if (led.bill_allocations?.length > 0) {
        billsApplied.push(...led.bill_allocations);
      }
    });

    // Determine pay_type based on collected info
    if (!payType) {
      if (hasBankAllocation) {
        payType = 'Bank';
      } else if (hasCashLedger && !hasBankLedger) {
        // Only Cash ledger present
        payType = 'Cash';
      } else if (hasBankLedger && !hasCashLedger) {
        // Only Bank ledger present
        payType = 'Bank';
      } else if (hasCashLedger && hasBankLedger) {
        // Both present - use the one with higher amount
        payType = cashLedgerAmount >= bankLedgerAmount ? 'Cash' : 'Bank';
      } else {
        // Default to Cash if no clear indicator
        payType = 'Cash';
      }
    }
  }

  return {
    date,
    number,
    type,
    party,
    guid,
    reference,
    narration,
    voucher_number: number,
    voucher_type: type,
    party_ledger: party,
    amount: totalAmount,
    party_gstin: partyGstin,
    party_state: partyState,
    party_address: partyAddress,
    place_of_supply: placeofsupply,
    company_gstin: companyGstin,
    items,
    ledgers,
    gst_breakup: { cgst: cgstAmount, sgst: sgstAmount, igst: igstAmount },
    subtotal,
    totalAmount,
    pay_type: payType,
    check_number: checkNumber,
    bank_ledger: bankLedger,
    bills_applied: billsApplied,
    SUPPLIERINVOICENO: supplierInvoiceNo,
    BASICINVOICENO: basicInvoiceNo,
    BASICSHIPPINGINVOICENO: basicShippingInvoiceNo,
    raw: voucher
  };
}

// ============================================================
// MAIN PARSER FUNCTION
// ============================================================

async function parseTallyVouchers(xml) {
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: true, // FIXED
    mergeAttrs: true,
    preserveChildrenOrder: true
  });

  function findTallyMessages(node, result = []) {
    if (!node || typeof node !== 'object') return result;

    if (node.TALLYMESSAGE) {
      const msgs = Array.isArray(node.TALLYMESSAGE)
        ? node.TALLYMESSAGE
        : [node.TALLYMESSAGE];
      result.push(...msgs);
    }

    for (const key of Object.keys(node)) {
      if (key !== 'TALLYMESSAGE' && typeof node[key] === 'object') {
        findTallyMessages(node[key], result);
      }
    }

    return result;
  }

  const tallyMessages = findTallyMessages(parsed);
  const vouchers = [];

  for (const msg of tallyMessages) {
    if (!msg.VOUCHER) continue;

    const vList = Array.isArray(msg.VOUCHER) ? msg.VOUCHER : [msg.VOUCHER];

    for (const voucher of vList) {
      const parsedVoucher = parseVoucher(voucher);
      if (parsedVoucher) vouchers.push(parsedVoucher);
    }
  }

  return vouchers;
}

// ============================================================
// FETCH FUNCTIONS
// ============================================================

async function fetchVoucherRegisterXML() {
  const TALLY_URL = getActiveTallyUrl();
  const { data } = await axios.post(TALLY_URL, VOUCHER_REGISTER_XML, {
    headers: { 'Content-Type': 'text/xml' },
    timeout: 30000
  });

  return cleanTallyXml(data);
}

async function fetchVouchers() {
  try {
    const xml = await fetchVoucherRegisterXML();
    return await parseTallyVouchers(xml);
  } catch (err) {
    console.error('Tally Voucher Fetch Error:', err.message);
    throw err;
  }
}

// ============================================================
// UNPAID AMOUNT CALCULATOR
// ============================================================

function calculateUnpaidAmounts(vouchers) {
  const salesVouchers = vouchers.filter((v) =>
    ['SALES', 'PURCHASE'].includes((v.voucher_type || '').toUpperCase())
  );

  const receiptVouchers = vouchers.filter(
    (v) => (v.voucher_type || '').toUpperCase() === 'RECEIPT'
  );

  const receiptsByBill = {};

  receiptVouchers.forEach((receipt) => {
    (receipt.bills_applied || []).forEach((bill) => {
      const keys = [
        bill.name,
        bill.BILLREFERENCE,
        bill.REFERENCE,
        receipt.voucher_number,
        receipt.reference
      ].filter(Boolean);

      keys.forEach((key) => {
        if (!receiptsByBill[key]) receiptsByBill[key] = [];
        receiptsByBill[key].push({
          receipt_number: receipt.voucher_number,
          receipt_date: receipt.date,
          amount: bill.amount
        });
      });
    });
  });

  salesVouchers.forEach((sale) => {
    const billKeys = [sale.voucher_number, sale.number, sale.reference].filter(
      Boolean
    );

    let receipts = [];
    billKeys.forEach((key) => {
      if (receiptsByBill[key]) receipts = receipts.concat(receiptsByBill[key]);
    });

    const totalReceived = receipts.reduce((s, r) => s + r.amount, 0);

    sale.unpaid_amount = Math.max(0, sale.amount - totalReceived);
    sale.receipts_applied = receipts;

    if (totalReceived >= sale.amount) sale.payment_status = 'Paid';
    else if (totalReceived > 0) sale.payment_status = 'Partial';
    else sale.payment_status = 'Pending';
  });

  return vouchers;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  fetchVouchers,
  parseTallyVouchers,
  parseVoucher,
  parseInventoryItem,
  parseLedgerEntry,
  calculateUnpaidAmounts,
  getText,
  getList,
  parseTallyDate
};
