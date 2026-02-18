const axios = require('axios');
const xml2js = require('xml2js');
const { getTallyUrl } = require('../config/systemConfig');

// Get Tally URL from system config (dynamic)
function getActiveTallyUrl() {
  return getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
}

// XML to fetch detailed GST information for all ledgers
const LEDGER_GST_DETAILS_XML = `
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
          <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <COLLECTION NAME="LedgerCollection">
          <TYPE>Ledger</TYPE>
          <FETCH>
            NAME,
            PARENT,
            GSTIN,
            PARTYGSTIN,
            GSTREGISTRATIONTYPE,
            GSTTYPE,
            GSTDUTYHEAD,
            STATENAME,
            LEDSTATENAME,
            COUNTRYNAME,
            PINCODE,
            INCOMETAXNUMBER,
            MAILINGNAME,
            ADDRESS.LIST,
            EMAIL,
            LEDGERMOBILE,
            PHONENUMBER,
            PLACEOFSUPPLY,
            OPENINGBALANCE,
            CLOSINGBALANCE,
            ISBILLWISEON,
            BILLALLOCATIONS.LIST.*
          </FETCH>
        </COLLECTION>
      </REQUESTDATA>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>
`;

// Alternative simpler XML for ledger GST details
const LEDGER_COLLECTION_XML = `
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
          <ACCOUNTTYPE>Ledgers</ACCOUNTTYPE>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <COLLECTION NAME="LedgerCollection">
          <TYPE>Ledger</TYPE>
          <FETCH>
            NAME,
            PARENT,
            GSTIN,
            PARTYGSTIN,
            GSTREGISTRATIONTYPE,
            GSTTYPE,
            GSTDUTYHEAD,
            STATENAME,
            LEDSTATENAME,
            COUNTRYNAME,
            PINCODE,
            INCOMETAXNUMBER,
            MAILINGNAME,
            ADDRESS.LIST,
            EMAIL,
            LEDGERMOBILE,
            PHONENUMBER,
            PLACEOFSUPPLY,
            OPENINGBALANCE,
            CLOSINGBALANCE,
            ISBILLWISEON,
            BILLALLOCATIONS.LIST.*
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

// Fetch all ledger GST details from Tally
async function fetchLedgerGSTDetails() {
  const TALLY_URL = getActiveTallyUrl();
  
  try {
    // Try TDL-based collection first
    const { data } = await axios.post(TALLY_URL, LEDGER_GST_DETAILS_XML, {
      headers: { "Content-Type": "text/xml" },
      timeout: 20000,
    });
    
    const cleanedXml = cleanTallyXml(data);
    const parsed = await parseLedgerGSTXml(cleanedXml);
    
    if (parsed.length > 0) {
      return parsed;
    }
    
    // Fallback to standard collection
    const { data: collectionData } = await axios.post(TALLY_URL, LEDGER_COLLECTION_XML, {
      headers: { "Content-Type": "text/xml" },
      timeout: 20000,
    });
    
    return await parseLedgerCollectionXml(cleanTallyXml(collectionData));
  } catch (err) {
    console.error("Ledger GST Details Fetch Error:", err.message);
    throw err;
  }
}

// Helper function to safely get text value from parsed XML node
function getTextValue(val) {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'number') return val.toString();
  if (typeof val === 'object') {
    // Handle arrays - take first element
    if (Array.isArray(val)) {
      return getTextValue(val[0]);
    }
    // Handle object with _ property (text content)
    if (val._) return val._.trim();
    // Handle object with text content
    if (val['#text']) return val['#text'].trim();
  }
  return '';
}

// Extract GST details from LEDGSTREGDETAILS.LIST
function extractGSTRegDetails(item) {
  let gstin = '';
  let gstType = '';
  let placeOfSupply = '';
  
  const gstRegList = item['LEDGSTREGDETAILS.LIST'];
  if (gstRegList) {
    const gstRegs = Array.isArray(gstRegList) ? gstRegList : [gstRegList];
    // Get the most recent/first valid GST registration
    for (const reg of gstRegs) {
      if (reg.GSTIN && !gstin) gstin = getTextValue(reg.GSTIN);
      if (reg.GSTREGISTRATIONTYPE && !gstType) gstType = getTextValue(reg.GSTREGISTRATIONTYPE);
      if (reg.PLACEOFSUPPLY && !placeOfSupply) placeOfSupply = getTextValue(reg.PLACEOFSUPPLY);
    }
  }
  
  // Fallback to direct fields if not found in LEDGSTREGDETAILS.LIST
  if (!gstin) gstin = getTextValue(item.LEDGSTIN) || getTextValue(item.PARTYGSTIN) || getTextValue(item.GSTIN) || '';
  if (!gstType) gstType = getTextValue(item.LEDGSTREGISTRATIONTYPE) || getTextValue(item.GSTREGISTRATIONTYPE) || '';
  if (!placeOfSupply) placeOfSupply = getTextValue(item.LEDPLACEOFSUPPLY) || getTextValue(item.PLACEOFSUPPLY) || '';
  
  return { gstin, gstType, placeOfSupply };
}

// Extract mailing details from LEDMAILINGDETAILS.LIST
function extractMailingDetails(item) {
  let address = '';
  let state = '';
  let country = '';
  let pincode = '';
  let mailingName = '';
  
  const mailingList = item['LEDMAILINGDETAILS.LIST'];
  if (mailingList) {
    const mailings = Array.isArray(mailingList) ? mailingList : [mailingList];
    // Get the most recent/first valid mailing details
    for (const mail of mailings) {
      if (!mailingName && mail.MAILINGNAME) mailingName = getTextValue(mail.MAILINGNAME);
      if (!state && mail.STATE) state = getTextValue(mail.STATE);
      if (!country && mail.COUNTRY) country = getTextValue(mail.COUNTRY);
      if (!pincode && mail.PINCODE) pincode = getTextValue(mail.PINCODE);
      
      // Extract address from ADDRESS.LIST
      if (!address && mail['ADDRESS.LIST']) {
        const addrList = mail['ADDRESS.LIST'];
        if (addrList.ADDRESS) {
          const addrs = Array.isArray(addrList.ADDRESS) ? addrList.ADDRESS : [addrList.ADDRESS];
          address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
        }
      }
    }
  }
  
  return { address, state, country, pincode, mailingName };
}

// Extract contact details (phone, email)
function extractContactDetails(item) {
  let phone = '';
  let email = '';
  
  // First try CONTACTDETAILS.LIST
  const contactList = item['CONTACTDETAILS.LIST'];
  if (contactList) {
    const contacts = Array.isArray(contactList) ? contactList : [contactList];
    for (const contact of contacts) {
      if (!phone && contact.PHONENUMBER) phone = getTextValue(contact.PHONENUMBER);
    }
  }
  
  // Fallback to direct fields
  if (!phone) phone = getTextValue(item.LEDGERMOBILE) || getTextValue(item.PHONENUMBER) || getTextValue(item.LEDGERPHONE) || '';
  if (!email) email = getTextValue(item.EMAIL) || '';
  
  return { phone, email };
}

// Parse Tally Import Data XML (daybook.xml format)
async function parseLedgerGSTXml(xml) {
  const ledgers = [];
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      preserveChildrenOrder: true
    });

    // Find all LEDGER nodes inside TALLYMESSAGE
    let tallyMessages = [];
    if (parsed.ENVELOPE && parsed.ENVELOPE.BODY && parsed.ENVELOPE.BODY.IMPORTDATA && parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA) {
      const reqData = parsed.ENVELOPE.BODY.IMPORTDATA.REQUESTDATA;
      tallyMessages = reqData.TALLYMESSAGE ? (Array.isArray(reqData.TALLYMESSAGE) ? reqData.TALLYMESSAGE : [reqData.TALLYMESSAGE]) : [];
    } else {
      // fallback for Export Data format
      tallyMessages = [parsed];
    }

    for (const msg of tallyMessages) {
      if (!msg.LEDGER) continue;
      const ledgersArr = Array.isArray(msg.LEDGER) ? msg.LEDGER : [msg.LEDGER];
      for (const item of ledgersArr) {
        const name = getTextValue(item.NAME);
        if (!name) continue;

        // Extract GST registration details from nested structure
        let { gstin, gstType, placeOfSupply } = extractGSTRegDetails(item);

        // Extract mailing details from nested structure
        let mailingDetails = extractMailingDetails(item);

        // Extract contact details
        let contactDetails = extractContactDetails(item);

        // Extract other direct fields
        let gstDutyHead = getTextValue(item.GSTDUTYHEAD) || '';
        let parent = getTextValue(item.PARENT) || '';
        let pan = getTextValue(item.INCOMETAXNUMBER) || '';

        // State and country - try multiple sources
        let state = mailingDetails.state || getTextValue(item.PRIORSTATENAME) || getTextValue(item.LEDSTATENAME) || getTextValue(item.STATENAME) || '';
        let country = mailingDetails.country || getTextValue(item.COUNTRYOFRESIDENCE) || getTextValue(item.COUNTRYNAME) || '';
        let pincode = mailingDetails.pincode || getTextValue(item.PINCODE) || '';
        let mailingName = mailingDetails.mailingName || getTextValue(item.MAILINGNAME) || name;
        let address = mailingDetails.address;

        // Also check LEDADDRESS.LIST for address
        if (!address && item['LEDADDRESS.LIST']) {
          const ledAddrList = item['LEDADDRESS.LIST'];
          if (ledAddrList.ADDRESS) {
            const addrs = Array.isArray(ledAddrList.ADDRESS) ? ledAddrList.ADDRESS : [ledAddrList.ADDRESS];
            address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
          }
        }

        // Deep search for GSTIN, PAN, STATE if missing
        function deepSearch(obj, keyMatch) {
          if (!obj || typeof obj !== 'object') return '';
          for (const key of Object.keys(obj)) {
            if (key.toLowerCase().includes(keyMatch)) {
              const val = getTextValue(obj[key]);
              if (val) return val;
            }
            if (typeof obj[key] === 'object') {
              const found = deepSearch(obj[key], keyMatch);
              if (found) return found;
            }
          }
          return '';
        }

        if (!gstin) gstin = deepSearch(item, 'gstin');
        if (!pan) pan = deepSearch(item, 'pan');
        if (!state) state = deepSearch(item, 'state');

        // Parse balances
        const openingBalance = parseBalance(item.OPENINGBALANCE);
        const closingBalance = parseBalance(item.CLOSINGBALANCE);

        // Determine balance type
        const isDebit = closingBalance > 0;
        const isCredit = closingBalance < 0;

        ledgers.push({
          name: name.trim(),
          parent,
          gstin: gstin ? gstin.toUpperCase() : '',
          gst_type: gstType,
          gst_duty_head: gstDutyHead,
          state,
          country,
          pincode,
          pan,
          place_of_supply: placeOfSupply,
          mailing_name: mailingName,
          address,
          email: contactDetails.email,
          phone: contactDetails.phone,
          opening_balance: openingBalance,
          closing_balance: closingBalance,
          balance_type: isDebit ? 'Dr' : isCredit ? 'Cr' : '',
          is_debit: isDebit,
          is_credit: isCredit
        });
      }
    }
  } catch (err) {
    console.warn("Failed to parse Tally ImportData ledger GST:", err.message);
  }
  return ledgers;
}

// Parse standard ledger collection XML
async function parseLedgerCollectionXml(xml) {
  const ledgers = [];
  
  try {
    const parsed = await xml2js.parseStringPromise(xml, {
      explicitArray: false,
      mergeAttrs: true,
      preserveChildrenOrder: true
    });
    
    // Find all LEDGER entries recursively
    function findLedgers(node, items = []) {
      if (!node || typeof node !== 'object') return items;
      
      if (node.LEDGER) {
        const ledgerItems = Array.isArray(node.LEDGER) ? node.LEDGER : [node.LEDGER];
        items.push(...ledgerItems);
      }
      
      for (const key of Object.keys(node)) {
        if (typeof node[key] === 'object') {
          findLedgers(node[key], items);
        }
      }
      
      return items;
    }
    
    const ledgerItems = findLedgers(parsed);
    
    for (const item of ledgerItems) {
      const name = getTextValue(item.NAME);
      if (!name) continue;
      
      // Extract GST registration details from nested structure
      const { gstin, gstType, placeOfSupply } = extractGSTRegDetails(item);
      
      // Extract mailing details from nested structure
      const mailingDetails = extractMailingDetails(item);
      
      // Extract contact details
      const contactDetails = extractContactDetails(item);
      
      // Extract other direct fields
      const gstDutyHead = getTextValue(item.GSTDUTYHEAD) || '';
      const parent = getTextValue(item.PARENT) || '';
      const pan = getTextValue(item.INCOMETAXNUMBER) || '';
      
      // State and country - try multiple sources
      let state = mailingDetails.state || getTextValue(item.PRIORSTATENAME) || getTextValue(item.LEDSTATENAME) || getTextValue(item.STATENAME) || '';
      let country = mailingDetails.country || getTextValue(item.COUNTRYOFRESIDENCE) || getTextValue(item.COUNTRYNAME) || '';
      let pincode = mailingDetails.pincode || getTextValue(item.PINCODE) || '';
      let mailingName = mailingDetails.mailingName || getTextValue(item.MAILINGNAME) || name;
      let address = mailingDetails.address;
      
      // Also check ADDRESS.LIST directly on item
      if (!address && item['ADDRESS.LIST']) {
        const addrList = item['ADDRESS.LIST'];
        if (addrList.ADDRESS) {
          const addrs = Array.isArray(addrList.ADDRESS) ? addrList.ADDRESS : [addrList.ADDRESS];
          address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
        }
      }
      
      // Also check LEDADDRESS.LIST for address
      if (!address && item['LEDADDRESS.LIST']) {
        const ledAddrList = item['LEDADDRESS.LIST'];
        if (ledAddrList.ADDRESS) {
          const addrs = Array.isArray(ledAddrList.ADDRESS) ? ledAddrList.ADDRESS : [ledAddrList.ADDRESS];
          address = addrs.map(a => getTextValue(a)).filter(a => a).join(', ');
        }
      }
      
      // Parse balances
      const openingBalance = parseBalance(item.OPENINGBALANCE);
      const closingBalance = parseBalance(item.CLOSINGBALANCE);
      
      // Determine balance type
      const isDebit = closingBalance > 0;
      const isCredit = closingBalance < 0;
      
      ledgers.push({
        name: name.trim(),
        parent,
        gstin: gstin ? gstin.toUpperCase() : '',
        gst_type: gstType,
        gst_duty_head: gstDutyHead,
        state,
        country,
        pincode,
        pan,
        place_of_supply: placeOfSupply,
        mailing_name: mailingName,
        address,
        email: contactDetails.email,
        phone: contactDetails.phone,
        opening_balance: openingBalance,
        closing_balance: closingBalance,
        balance_type: isDebit ? 'Dr' : isCredit ? 'Cr' : '',
        is_debit: isDebit,
        is_credit: isCredit
      });
    }
  } catch (err) {
    console.warn("Failed to parse ledger collection:", err.message);
  }
  
  return ledgers;
}

// Parse balance string to number (handles "100.00 Dr" or "-100.00 Cr" formats)
function parseBalance(balanceStr) {
  if (!balanceStr) return 0;
  
  if (typeof balanceStr === 'number') return balanceStr;
  
  const str = balanceStr.toString();
  const match = str.match(/(-?[\d.]+)/);
  if (!match) return 0;
  
  let value = parseFloat(match[1]);
  
  // Check for Cr suffix (credit = negative in Tally)
  if (str.toLowerCase().includes('cr')) {
    value = -Math.abs(value);
  } else if (str.toLowerCase().includes('dr')) {
    value = Math.abs(value);
  }
  
  return value / 100; // Divide by 100 as requested
}

// Get GST details for a specific ledger by name
async function getLedgerGSTByName(ledgerName) {
  const allLedgers = await fetchLedgerGSTDetails();
  return allLedgers.find(l => l.name.toLowerCase() === ledgerName.toLowerCase());
}

// Build a GST details map for quick lookup (for order autofill)
async function buildGSTDetailsMap() {
  const allLedgers = await fetchLedgerGSTDetails();
  const gstMap = {};
  
  for (const ledger of allLedgers) {
    gstMap[ledger.name.toLowerCase()] = {
      name: ledger.name,
      gstin: ledger.gstin,
      gst_type: ledger.gst_type,
      state: ledger.state,
      country: ledger.country,
      place_of_supply: ledger.place_of_supply,
      pan: ledger.pan,
      address: ledger.address,
      email: ledger.email,
      phone: ledger.phone,
      mailing_name: ledger.mailing_name
    };
  }
  
  return gstMap;
}

module.exports = {
  fetchLedgerGSTDetails,
  getLedgerGSTByName,
  buildGSTDetailsMap,
  parseLedgerGSTXml,
  parseLedgerCollectionXml
};
