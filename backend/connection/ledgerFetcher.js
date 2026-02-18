/**
 * Ledger Fetcher - Redesigned Backend for Ledgers
 * 
 * Uses the proper Tally XML export format to fetch all ledger details
 * Correctly handles:
 * - Credit/Debit balances (negative = Dr for assets/expenses, Cr for liabilities/incomes)
 * - All ledger groups including Direct/Indirect Expenses and Incomes
 * - GST details, contact info, and mailing details
 * - Edge cases like Journal entries affecting ledgers
 */

const axios = require('axios');
const xml2js = require('xml2js');
const { getTallyUrl } = require('../config/systemConfig');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// XML request to fetch all ledgers with full details
const LEDGER_EXPORT_XML = `<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Ledger</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <EXPLODEFLAG>Yes</EXPLODEFLAG>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

// Alternative XML for detailed ledger data with GST
const LEDGER_DETAILS_XML = `<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Export Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <EXPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>List of Accounts</REPORTNAME>
        <STATICVARIABLES>
          <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
          <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

function cleanTallyXml(xml) {
  // Remove control characters that can break parsing
  return xml.replace(/&#(?:[0-9]|[1-2][0-9]|3[0-1]);/g, '');
}

function normalizeGroupName(name = '') {
  return name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const ASSET_GROUPS = [
  'sundry debtors',
  'cash-in-hand',
  'cash',
  'bank accounts',
  'bank',
  'bank occ a/c',
  'bank od a/c',
  'fixed assets',
  'current assets',
  'investments',
  'loans & advances',
  'loans & advances (asset)',
  'deposits',
  'deposits (asset)',
  'stock-in-hand'
].map(normalizeGroupName);

const EXPENSE_GROUPS = [
  'direct expenses',
  'direct expense',
  'expenses (direct)',
  'expense (direct)',
  'indirect expenses',
  'indirect expense',
  'expenses (indirect)',
  'expense (indirect)',
  'purchase accounts',
  'misc. expenses',
  'misc. expenses (asset)',
  'suspense',
  'suspense a/c'
].map(normalizeGroupName);

const LIABILITY_GROUPS = [
  'sundry creditors',
  'current liabilities',
  'loans (liability)',
  'secured loans',
  'unsecured loans',
  'provisions',
  'duties & taxes',
  'capital account',
  'reserves & surplus',
  'retained earnings'
].map(normalizeGroupName);

const INCOME_GROUPS = [
  'sales accounts',
  'direct incomes',
  'direct income',
  'income (direct)',
  'indirect incomes',
  'indirect income',
  'income (indirect)',
  'branch / divisions'
].map(normalizeGroupName);

const DR_POSITIVE_GROUPS = [...ASSET_GROUPS, ...EXPENSE_GROUPS];
const CR_POSITIVE_GROUPS = [...LIABILITY_GROUPS, ...INCOME_GROUPS];

// Helper: Get text value from xml2js parsed node
function getTextValue(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    if (val._ !== undefined) return String(val._).trim();
    if (val['#text'] !== undefined) return String(val['#text']).trim();
    if (Array.isArray(val)) return getTextValue(val[0]);
  }
  return '';
}

/**
 * Parse balance value from Tally XML
 * Tally stores balances as:
 * - Positive numbers for liabilities/incomes (Credit balances)
 * - Negative numbers for assets/expenses (Debit balances)
 * 
 * For display purposes, we invert this:
 * - Sundry Debtors: negative in Tally means "they owe us" (should show as positive/receivable)
 * - Sundry Creditors: positive in Tally means "we owe them" (should show as positive/payable)
 */
function parseBalance(val, parent) {
  const text = getTextValue(val);
  if (!text) return 0;
  
  // Extract numeric value
  const numericText = text.replace(/[^0-9.\-]/g, '');
  let value = parseFloat(numericText) || 0;
  
  return value;
}

/**
 * Get the correct display balance based on ledger group
 * In Tally:
 * - Assets (Debtors, Cash, Bank): Debit balance = positive, Credit balance = negative
 * - Liabilities (Creditors): Credit balance = positive, Debit balance = negative
 * - Expenses: Debit balance = positive (cost incurred)
 * - Incomes: Credit balance = positive (revenue earned)
 * 
 * IMPORTANT: Uses EXACT matching to avoid "indirect expenses" matching "direct expenses"
 */
function getDisplayBalance(rawBalance, parent) {
  const parentLower = normalizeGroupName(parent);

  if (ASSET_GROUPS.includes(parentLower) || EXPENSE_GROUPS.includes(parentLower)) {
    return -rawBalance;
  }
  if (LIABILITY_GROUPS.includes(parentLower) || INCOME_GROUPS.includes(parentLower)) {
    return rawBalance;
  }
  return rawBalance;
}

/**
 * Determine if this is a debit or credit balance
 * IMPORTANT: Uses EXACT matching to avoid group confusion
 */
function getBalanceType(displayBalance, parent) {
  const parentLower = normalizeGroupName(parent);

  if (DR_POSITIVE_GROUPS.includes(parentLower)) {
    return displayBalance >= 0 ? 'Dr' : 'Cr';
  }

  if (CR_POSITIVE_GROUPS.includes(parentLower)) {
    return displayBalance >= 0 ? 'Cr' : 'Dr';
  }
  
  // Default based on sign
  return displayBalance >= 0 ? 'Dr' : 'Cr';
}

/**
 * Parse the daybook.xml format ledger data
 */
async function parseLedgerXml(xml) {
  const ledgers = [];
  
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      preserveChildrenOrder: true
    });
    
    // Navigate to COLLECTION containing LEDGER elements
    let ledgerList = [];
    
    // Try different XML structures
    if (parsed.ENVELOPE?.BODY?.DATA?.COLLECTION?.LEDGER) {
      const l = parsed.ENVELOPE.BODY.DATA.COLLECTION.LEDGER;
      ledgerList = Array.isArray(l) ? l : [l];
    } else if (parsed.ENVELOPE?.BODY?.IMPORTDATA?.REQUESTDATA?.TALLYMESSAGE) {
      // Handle Import Data format
      const messages = parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA.TALLYMESSAGE;
      const msgArr = Array.isArray(messages) ? messages : [messages];
      for (const msg of msgArr) {
        if (msg.LEDGER) {
          const l = msg.LEDGER;
          ledgerList.push(...(Array.isArray(l) ? l : [l]));
        }
      }
    } else {
      // Deep search for LEDGER elements
      function findLedgers(node, items = []) {
        if (!node || typeof node !== 'object') return items;
        if (node.LEDGER) {
          const l = node.LEDGER;
          items.push(...(Array.isArray(l) ? l : [l]));
        }
        for (const key of Object.keys(node)) {
          if (typeof node[key] === 'object') {
            findLedgers(node[key], items);
          }
        }
        return items;
      }
      ledgerList = findLedgers(parsed);
    }
    
    console.log(`[LedgerFetcher] Found ${ledgerList.length} ledger entries in XML`);
    
    for (const item of ledgerList) {
      // Get name from NAME attribute or LANGUAGENAME.LIST
      let name = item.NAME || '';
      if (!name && item['LANGUAGENAME.LIST']?.['NAME.LIST']?.NAME) {
        const names = item['LANGUAGENAME.LIST']['NAME.LIST'].NAME;
        name = Array.isArray(names) ? getTextValue(names[0]) : getTextValue(names);
      }
      name = getTextValue(name);
      
      if (!name) continue;
      
      // Skip reserved/system ledgers
      if (item.RESERVEDNAME && item.RESERVEDNAME !== '') {
        // Still include Profit & Loss if needed
        if (!name.toLowerCase().includes('profit') && !name.toLowerCase().includes('loss')) {
          // Allow reserved ledgers but flag them
        }
      }
      
      // Get parent group
      const parent = getTextValue(item.PARENT) || 'Primary';
      
      // Parse balances
      const rawClosingBalance = parseBalance(item.CLOSINGBALANCE, parent);
      const rawOpeningBalance = parseBalance(item.LEDOPENINGBALANCE || item.OPENINGBALANCE, parent);
      const onAccountValue = parseBalance(item.ONACCOUNTVALUE, parent);
      
      // Get display balances (correctly signed for the ledger type)
      const closingBalance = getDisplayBalance(rawClosingBalance, parent);
      const openingBalance = getDisplayBalance(rawOpeningBalance, parent);
      
      // Determine balance type
      const balanceType = getBalanceType(closingBalance, parent);
      
      // Extract GST details (try multiple sources)
      let gstin = '';
      let gstType = '';
      let placeOfSupply = '';
      
      // Try LEDGSTREGDETAILS.LIST
      if (item['LEDGSTREGDETAILS.LIST']) {
        const gstList = item['LEDGSTREGDETAILS.LIST'];
        const gstObj = Array.isArray(gstList) ? gstList[0] : gstList;
        gstin = getTextValue(gstObj?.GSTIN) || '';
        gstType = getTextValue(gstObj?.GSTREGISTRATIONTYPE) || '';
        placeOfSupply = getTextValue(gstObj?.PLACEOFSUPPLY) || '';
      }
      
      // Fallback GST fields
      if (!gstin) gstin = getTextValue(item.GSTIN) || getTextValue(item.PARTYGSTIN) || getTextValue(item.LEDGSTIN) || '';
      if (!gstType) gstType = getTextValue(item.GSTREGISTRATIONTYPE) || getTextValue(item.LEDGSTREGISTRATIONTYPE) || '';
      if (!placeOfSupply) placeOfSupply = getTextValue(item.PLACEOFSUPPLY) || getTextValue(item.LEDPLACEOFSUPPLY) || '';
      
      // Extract mailing details
      let address = '';
      let state = '';
      let country = '';
      let pincode = '';
      let mailingName = '';
      
      if (item['LEDMAILINGDETAILS.LIST']) {
        const mailList = item['LEDMAILINGDETAILS.LIST'];
        const mailObj = Array.isArray(mailList) ? mailList[0] : mailList;
        mailingName = getTextValue(mailObj?.MAILINGNAME) || '';
        state = getTextValue(mailObj?.STATE) || '';
        country = getTextValue(mailObj?.COUNTRY) || '';
        pincode = getTextValue(mailObj?.PINCODE) || '';
        
        // Address from ADDRESS.LIST
        if (mailObj?.['ADDRESS.LIST']?.ADDRESS) {
          const addrs = mailObj['ADDRESS.LIST'].ADDRESS;
          if (Array.isArray(addrs)) {
            address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
          } else {
            address = getTextValue(addrs);
          }
        }
      }
      
      // Fallback address fields
      if (!address && item['LEDADDRESS.LIST']?.ADDRESS) {
        const addrs = item['LEDADDRESS.LIST'].ADDRESS;
        if (Array.isArray(addrs)) {
          address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
        } else {
          address = getTextValue(addrs);
        }
      }
      if (!state) state = getTextValue(item.LEDSTATENAME) || getTextValue(item.STATENAME) || getTextValue(item.PRIORSTATENAME) || '';
      if (!country) country = getTextValue(item.COUNTRYNAME) || getTextValue(item.COUNTRYOFRESIDENCE) || '';
      if (!pincode) pincode = getTextValue(item.PINCODE) || '';
      
      // Extract contact details
      let phone = '';
      let email = '';
      
      if (item['CONTACTDETAILS.LIST']) {
        const contactList = item['CONTACTDETAILS.LIST'];
        const contactObj = Array.isArray(contactList) ? contactList[0] : contactList;
        phone = getTextValue(contactObj?.PHONENUMBER) || '';
      }
      if (!phone) phone = getTextValue(item.LEDGERMOBILE) || getTextValue(item.PHONENUMBER) || getTextValue(item.LEDGERPHONE) || '';
      email = getTextValue(item.EMAIL) || getTextValue(item.LEDGEREMAIL) || '';
      
      // PAN
      const pan = getTextValue(item.INCOMETAXNUMBER) || getTextValue(item.LEDINCOMETAXNUMBER) || '';
      
      ledgers.push({
        name: name.trim(),
        parent,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        raw_closing_balance: rawClosingBalance,
        on_account_value: getDisplayBalance(onAccountValue, parent),
        balance_type: balanceType,
        is_debit: balanceType === 'Dr',
        is_credit: balanceType === 'Cr',
        gstin: gstin ? gstin.toUpperCase() : '',
        gst_type: gstType,
        place_of_supply: placeOfSupply || state,
        state,
        country,
        pincode,
        address,
        email,
        phone,
        pan,
        mailing_name: mailingName || name
      });
    }
    
  } catch (err) {
    console.error('[LedgerFetcher] Error parsing ledger XML:', err.message);
  }
  
  return ledgers;
}

/**
 * Fetch ledgers from Tally
 */
async function fetchLedgers() {
  const TALLY_URL = getActiveTallyUrl();
  
  try {
    console.log('[LedgerFetcher] Fetching ledgers from Tally:', TALLY_URL);
    
    // Try the primary XML format first
    const { data } = await axios.post(TALLY_URL, LEDGER_EXPORT_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });
    
    const cleanedXml = cleanTallyXml(data);
    let ledgers = await parseLedgerXml(cleanedXml);
    
    if (ledgers.length > 0) {
      console.log(`[LedgerFetcher] Successfully parsed ${ledgers.length} ledgers`);
      return ledgers;
    }
    
    // Try alternative format
    console.log('[LedgerFetcher] Trying alternative XML format...');
    const { data: altData } = await axios.post(TALLY_URL, LEDGER_DETAILS_XML, {
      headers: { 'Content-Type': 'text/xml' },
      timeout: 30000,
    });
    
    const cleanedAltXml = cleanTallyXml(altData);
    ledgers = await parseLedgerXml(cleanedAltXml);
    
    console.log(`[LedgerFetcher] Parsed ${ledgers.length} ledgers from alternative format`);
    return ledgers;
    
  } catch (err) {
    console.error('[LedgerFetcher] Tally fetch error:', err.message);
    throw err;
  }
}

/**
 * Get ledgers filtered by group
 */
async function fetchLedgersByGroup(groupNames) {
  const allLedgers = await fetchLedgers();
  const normalizedTargets = groupNames.map(normalizeGroupName);

  return allLedgers.filter(l => {
    const parent = normalizeGroupName(l.parent);
    return normalizedTargets.includes(parent);
  });
}

/**
 * Build a map for quick GST lookup
 */
async function buildLedgerGSTMap() {
  const ledgers = await fetchLedgers();
  const map = {};
  
  for (const l of ledgers) {
    map[l.name.toLowerCase()] = {
      name: l.name,
      gstin: l.gstin,
      gst_type: l.gst_type,
      place_of_supply: l.place_of_supply,
      state: l.state,
      country: l.country,
      address: l.address,
      email: l.email,
      phone: l.phone,
      pan: l.pan,
      mailing_name: l.mailing_name
    };
  }
  
  return map;
}

module.exports = {
  fetchLedgers,
  fetchLedgersByGroup,
  buildLedgerGSTMap,
  parseLedgerXml,
  getDisplayBalance,
  getBalanceType
};
