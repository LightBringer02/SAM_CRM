/**
 * Tally Sync Service
 * Handles bidirectional sync between Tally and PostgreSQL
 * - When Tally is LIVE: Fetches data from Tally and stores in PostgreSQL
 * - When Tally is OFFLINE: Serves data from PostgreSQL, queues writes
 * - Auto-reconnects and processes queue when Tally comes back online
 */

const axios = require('axios');

const normalizeGroupName = (name = '') =>
  name
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// Import config to get Tally URL dynamically
let getTallyUrl;
try {
  const { getTallyUrl: getTallyUrlFn } = require('../config/systemConfig');
  getTallyUrl = getTallyUrlFn;
} catch (err) {
  console.warn('SystemConfig not available, using default Tally URL');
  getTallyUrl = () => process.env.TALLY_URL || 'http://localhost:9000';
}

// Try to load database connection
let dbQuery, dbTransaction, testDbConnection;
try {
  const db = require('../../database/sql/connection');
  dbQuery = db.query;
  dbTransaction = db.transaction;
  testDbConnection = db.testConnection;
} catch (err) {
  console.warn('Database connection module not available:', err.message);
  dbQuery = async () => ({ rows: [], rowCount: 0 });
  dbTransaction = async (cb) => cb({ query: async () => ({ rows: [] }) });
  testDbConnection = async () => ({ connected: false, error: 'Module not loaded' });
}

class TallySyncService {
  constructor() {
    this.isConnected = false;
    this.lastCheckTime = null;
    this.lastSyncTime = null;
    this.syncInterval = null;
    this.reconnectInterval = null;
    this.tallyUrl = null; // Will be set dynamically from config
  }

  /**
   * Get current Tally URL from config or stored value
   */
  getTallyUrlDynamic() {
    // If set explicitly, use that; otherwise get from config
    return this.tallyUrl || getTallyUrl() || process.env.TALLY_URL || 'http://localhost:9000';
  }

  /**
   * Set Tally URL
   */
  setTallyUrl(url) {
    this.tallyUrl = url;
  }

  /**
   * Check if Tally is available
   */
  async checkTallyConnection() {
    const tallyUrl = this.getTallyUrlDynamic();
    try {
      const pingXml = `<?xml version="1.0" encoding="utf-8"?>
        <ENVELOPE>
          <HEADER>
            <VERSION>1</VERSION>
            <TALLYREQUEST>Export</TALLYREQUEST>
            <TYPE>Function</TYPE>
            <ID>$$CurrentCompany</ID>
          </HEADER>
          <BODY></BODY>
        </ENVELOPE>`;

      const response = await axios.post(tallyUrl, pingXml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 3000
      });

      this.isConnected = response.status === 200;
      this.lastCheckTime = new Date();
      return this.isConnected;
    } catch (err) {
      this.isConnected = false;
      this.lastCheckTime = new Date();
      return false;
    }
  }

  /**
   * Fetch ledgers from Tally using Collection export with proper balances
   * Uses the Ledger Collection export format which provides accurate balance data
   */
  async fetchLedgersFromTally() {
    const tallyUrl = this.getTallyUrlDynamic();
    // Use Collection export for ledgers - provides proper CLOSINGBALANCE and ONACCOUNTVALUE
    const xml = `<ENVELOPE>
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

    try {
      const response = await axios.post(tallyUrl, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 60000
      });
      return this.parseLedgersXml(response.data);
    } catch (err) {
      console.error('Error fetching ledgers from Tally:', err.message);
      // Try fallback format
      return this.fetchLedgersFromTallyFallback();
    }
  }

  /**
   * Fallback method using Export Data format
   */
  async fetchLedgersFromTallyFallback() {
    const tallyUrl = this.getTallyUrlDynamic();
    const xml = `<?xml version="1.0" encoding="utf-8"?>
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
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      const response = await axios.post(tallyUrl, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 60000
      });
      return this.parseLedgersXml(response.data);
    } catch (err) {
      console.error('Error fetching ledgers from Tally (fallback):', err.message);
      return [];
    }
  }

  /**
   * Fetch stock items from Tally using simple export
   */
  async fetchStockItemsFromTally() {
    const tallyUrl = this.getTallyUrlDynamic();
    // Use simpler List of Accounts export for stock items
    const xml = `<ENVELOPE>
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
            OPENINGBALANCE,
            OPENINGVALUE,
            CLOSINGBALANCE,
            CLOSINGVALUE
          </FETCH>
        </COLLECTION>
      </REQUESTDATA>
    </EXPORTDATA>
  </BODY>
</ENVELOPE>`;

    try {
      const response = await axios.post(tallyUrl, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 30000
      });
      return this.parseStockItemsXml(response.data);
    } catch (err) {
      console.error('Error fetching stock items from Tally:', err.message);
      return [];
    }
  }

  /**
   * Fetch vouchers from Tally using standard Voucher Register export
   * This uses the simpler export method that doesn't crash Tally
   */
  async fetchVouchersFromTally() {
    const tallyUrl = this.getTallyUrlDynamic();
    // Use the standard Voucher Register export - same as voucherRegister.js
    const xml = `<ENVELOPE>
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
</ENVELOPE>`;

    try {
      const response = await axios.post(tallyUrl, xml, {
        headers: { 'Content-Type': 'text/xml' },
        timeout: 60000
      });
      return this.parseVouchersXmlSimple(response.data);
    } catch (err) {
      console.error('Error fetching vouchers from Tally:', err.message);
      return [];
    }
  }

  /**
   * Simple voucher XML parser for Voucher Register export
   */
  parseVouchersXmlSimple(xmlData) {
    const vouchers = [];
    try {
      // Match VOUCHER elements with attributes
      const voucherRegex = /<VOUCHER[^>]*>([\s\S]*?)<\/VOUCHER>/gi;
      let match;
      while ((match = voucherRegex.exec(xmlData)) !== null) {
        const content = match[0]; // Full match including tags
        const inner = match[1]; // Inner content
        
        // Extract voucher number from attribute or element
        let voucherNumber = '';
        const voucherNumAttr = content.match(/VOUCHERNUMBER="([^"]+)"/i);
        if (voucherNumAttr) {
          voucherNumber = voucherNumAttr[1].trim();
        } else {
          voucherNumber = this.extractXmlValue(inner, 'VOUCHERNUMBER');
        }
        
        // Extract voucher type from attribute or element
        let voucherType = '';
        const voucherTypeAttr = content.match(/VCHTYPE="([^"]+)"/i);
        if (voucherTypeAttr) {
          voucherType = voucherTypeAttr[1].trim();
        } else {
          voucherType = this.extractXmlValue(inner, 'VOUCHERTYPENAME') || this.extractXmlValue(inner, 'VCHTYPE');
        }
        
        // Skip if both are empty
        if (!voucherNumber && !voucherType) continue;
        
        // Parse date
        let dateStr = this.extractXmlValue(inner, 'DATE');
        let parsedDate = null;
        if (dateStr && dateStr.length === 8) {
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          parsedDate = `${year}-${month}-${day}`;
        }
        
        // Extract party name
        const partyName = this.extractXmlValue(inner, 'PARTYLEDGERNAME') || 
                         this.extractXmlValue(inner, 'PARTYNAME') || '';
        
        // Extract amount - try multiple sources
        let amount = 0;
        const amountStr = this.extractXmlValue(inner, 'AMOUNT');
        if (amountStr) {
          amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0;
        }
        
        vouchers.push({
          voucher_number: voucherNumber || 'UNKNOWN',
          voucher_type: voucherType || 'UNKNOWN',
          date: parsedDate,
          party_name: partyName,
          amount: Math.abs(amount),
          narration: this.extractXmlValue(inner, 'NARRATION'),
          is_invoice: this.extractXmlValue(inner, 'ISINVOICE') === 'Yes',
          is_cancelled: this.extractXmlValue(inner, 'ISCANCELLED') === 'Yes',
          reference_number: this.extractXmlValue(inner, 'REFERENCE')
        });
      }
    } catch (err) {
      console.error('Error parsing vouchers XML:', err.message);
    }
    return vouchers;
  }

  /**
   * Parse ledgers XML response - handles Tally XML format with NAME as attribute or element
   * Supports GST details from nested LEDGSTREGDETAILS.LIST and LEDMAILINGDETAILS.LIST structures
   * 
   * BALANCE HANDLING:
   * Tally stores balances with the following conventions:
   * - Negative values = Debit balances (assets, expenses)
   * - Positive values = Credit balances (liabilities, incomes)
   * 
   * For DISPLAY purposes, we invert the sign for assets/expenses so:
   * - Sundry Debtors: Raw -1180 → Display +1180 (they owe us)
   * - Sundry Creditors: Raw +5000 → Display +5000 (we owe them)
   * - Direct Expenses: Raw -1000 → Display +1000 (expense incurred)
   * - Direct Incomes: Raw +2000 → Display +2000 (income earned)
   */
  parseLedgersXml(xmlData) {
    const ledgers = [];
    
    // Groups where negative raw balance = positive display (debit accounts)
    // IMPORTANT: These must be lowercase for exact matching
    const debitNatureGroups = [
      'sundry debtors', 'cash-in-hand', 'cash', 'bank accounts', 'bank',
      'bank occ a/c', 'bank od a/c',
      'fixed assets', 'current assets', 'investments', 'loans & advances',
      'loans & advances (asset)', 'deposits', 'deposits (asset)', 'stock-in-hand',
      'direct expenses', 'direct expense', 'expenses (direct)', 'expense (direct)',
      'indirect expenses', 'indirect expense', 'expenses (indirect)', 'expense (indirect)',
      'purchase accounts',
      'misc. expenses', 'misc. expenses (asset)', 'suspense', 'suspense a/c'
    ].map(normalizeGroupName);
    
    // Groups where positive raw balance = positive display (credit accounts)
    // IMPORTANT: These must be lowercase for exact matching
    const creditNatureGroups = [
      'sundry creditors', 'current liabilities', 'loans (liability)',
      'secured loans', 'unsecured loans', 'provisions', 'duties & taxes',
      'capital account', 'reserves & surplus', 'retained earnings',
      'sales accounts',
      'direct incomes', 'direct income', 'income (direct)',
      'indirect incomes', 'indirect income', 'income (indirect)',
      'branch / divisions'
    ].map(normalizeGroupName);
    
    try {
      // Match LEDGER elements - NAME can be an attribute: <LEDGER NAME="xyz"> or child element
      const ledgerRegex = /<LEDGER\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/LEDGER>|<LEDGER>([\s\S]*?)<\/LEDGER>/gi;
      let match;
      while ((match = ledgerRegex.exec(xmlData)) !== null) {
        let name = '';
        let content = '';
        
        if (match[1]) {
          // NAME is an attribute
          name = match[1].trim();
          content = match[2] || '';
        } else {
          // NAME is a child element
          content = match[3] || '';
          name = this.extractXmlValue(content, 'NAME');
        }
        
        // Skip if name is empty
        if (!name || name.trim() === '') continue;
        
        // Get parent group for balance interpretation
        const parent = this.extractXmlValue(content, 'PARENT') || 'Primary';
        const parentNormalized = normalizeGroupName(parent);
        
        // Extract phone - try CONTACTDETAILS.LIST first, then direct fields
        let phone = '';
        const contactMatch = content.match(/<CONTACTDETAILS\.LIST>([\s\S]*?)<\/CONTACTDETAILS\.LIST>/i);
        if (contactMatch) {
          phone = this.extractXmlValue(contactMatch[1], 'PHONENUMBER') || '';
        }
        if (!phone) {
          phone = this.extractXmlValue(content, 'LEDGERMOBILE') ||
                  this.extractXmlValue(content, 'LEDGERPHONE') ||
                  this.extractXmlValue(content, 'LEDGERCONTACT') ||
                  this.extractXmlValue(content, 'PHONENUMBER') ||
                  this.extractMultilineXmlValue(content, 'LEDGERMOBILE');
        }
        
        // Extract email - try multiple fields
        const email = this.extractXmlValue(content, 'EMAIL') ||
                      this.extractXmlValue(content, 'LEDGEREMAIL') ||
                      this.extractXmlValue(content, 'EMAILID') ||
                      this.extractMultilineXmlValue(content, 'EMAIL');
        
        // Extract GST details from LEDGSTREGDETAILS.LIST (nested structure)
        let gstin = '';
        let gstType = '';
        let placeOfSupply = '';
        const gstRegMatch = content.match(/<LEDGSTREGDETAILS\.LIST>([\s\S]*?)<\/LEDGSTREGDETAILS\.LIST>/i);
        if (gstRegMatch) {
          gstin = this.extractXmlValue(gstRegMatch[1], 'GSTIN') || '';
          gstType = this.extractXmlValue(gstRegMatch[1], 'GSTREGISTRATIONTYPE') || '';
          placeOfSupply = this.extractXmlValue(gstRegMatch[1], 'PLACEOFSUPPLY') || '';
        }
        // Fallback to direct fields if not found in nested structure
        if (!gstin) {
          gstin = this.extractXmlValue(content, 'LEDGSTIN') ||
                  this.extractXmlValue(content, 'PARTYGSTIN') ||
                  this.extractXmlValue(content, 'GSTIN') || '';
        }
        if (!gstType) {
          gstType = this.extractXmlValue(content, 'LEDGSTREGISTRATIONTYPE') ||
                    this.extractXmlValue(content, 'GSTREGISTRATIONTYPE') || '';
        }
        if (!placeOfSupply) {
          placeOfSupply = this.extractXmlValue(content, 'LEDPLACEOFSUPPLY') ||
                          this.extractXmlValue(content, 'PLACEOFSUPPLY') || '';
        }
        
        // Extract mailing details from LEDMAILINGDETAILS.LIST (nested structure)
        let address = '';
        let state = '';
        let country = '';
        let pincode = '';
        let mailingName = '';
        const mailingMatch = content.match(/<LEDMAILINGDETAILS\.LIST>([\s\S]*?)<\/LEDMAILINGDETAILS\.LIST>/i);
        if (mailingMatch) {
          mailingName = this.extractXmlValue(mailingMatch[1], 'MAILINGNAME') || '';
          state = this.extractXmlValue(mailingMatch[1], 'STATE') || '';
          country = this.extractXmlValue(mailingMatch[1], 'COUNTRY') || '';
          pincode = this.extractXmlValue(mailingMatch[1], 'PINCODE') || '';
          // Address from nested ADDRESS.LIST
          const addrListMatch = mailingMatch[1].match(/<ADDRESS\.LIST[^>]*>([\s\S]*?)<\/ADDRESS\.LIST>/i);
          if (addrListMatch) {
            const addrMatches = addrListMatch[1].match(/<ADDRESS>([^<]*)<\/ADDRESS>/gi);
            if (addrMatches) {
              address = addrMatches.map(a => {
                const m = a.match(/<ADDRESS>([^<]*)<\/ADDRESS>/i);
                return m ? m[1].trim() : '';
              }).filter(a => a).join(', ');
            }
          }
        }
        
        // Fallback to direct fields if not found in nested structure
        if (!address) {
          address = this.extractXmlValue(content, 'ADDRESS') ||
                    this.extractMultilineXmlValue(content, 'ADDRESS') ||
                    this.extractAddressFromList(content);
        }
        if (!state) {
          state = this.extractXmlValue(content, 'PRIORSTATENAME') ||
                  this.extractXmlValue(content, 'LEDSTATENAME') ||
                  this.extractXmlValue(content, 'STATENAME') || '';
        }
        if (!country) {
          country = this.extractXmlValue(content, 'COUNTRYOFRESIDENCE') ||
                    this.extractXmlValue(content, 'COUNTRYNAME') || '';
        }
        if (!pincode) {
          pincode = this.extractXmlValue(content, 'PINCODE') || '';
        }
        
        // Extract RAW balance - handle TYPE="Amount" attribute and Dr/Cr suffix
        let rawOpeningBalance = 0;
        let rawClosingBalance = 0;
        
        // Parse opening balance
        const openBalStr = this.extractXmlValue(content, 'OPENINGBALANCE') ||
                           this.extractXmlValue(content, 'LEDOPENINGBALANCE');
        if (openBalStr) {
          rawOpeningBalance = this.parseRawBalance(openBalStr);
        }
        
        // Parse closing balance
        const closeBalStr = this.extractXmlValue(content, 'CLOSINGBALANCE');
        if (closeBalStr) {
          rawClosingBalance = this.parseRawBalance(closeBalStr);
        }
        
        // Parse on account value (used for transaction totals)
        const onAcctStr = this.extractXmlValue(content, 'ONACCOUNTVALUE');
        let onAccountValue = 0;
        if (onAcctStr) {
          onAccountValue = this.parseRawBalance(onAcctStr);
        }
        
        // Convert raw balance to display balance based on account nature
        // Use EXACT matching to avoid "indirect expenses" matching "direct expenses"
        const isDebitNature = debitNatureGroups.includes(parentNormalized);
        const isCreditNature = creditNatureGroups.includes(parentNormalized);
        
        let openingBalance = rawOpeningBalance;
        let closingBalance = rawClosingBalance;
        
        if (isDebitNature) {
          // Debit-nature accounts: invert sign (negative raw → positive display)
          openingBalance = -rawOpeningBalance;
          closingBalance = -rawClosingBalance;
          onAccountValue = -onAccountValue;
        }
        // Credit-nature accounts keep the sign as-is
        
        // Determine balance type for display
        let balanceType = 'Dr';
        if (isDebitNature) {
          balanceType = closingBalance >= 0 ? 'Dr' : 'Cr';
        } else if (isCreditNature) {
          balanceType = closingBalance >= 0 ? 'Cr' : 'Dr';
        } else {
          // Unknown group - use sign
          balanceType = rawClosingBalance >= 0 ? 'Cr' : 'Dr';
        }
        
        ledgers.push({
          name: name,
          parent: parent,
          opening_balance: openingBalance,
          closing_balance: closingBalance,
          raw_closing_balance: rawClosingBalance,
          on_account_value: onAccountValue,
          balance_type: balanceType,
          balance_side: balanceType, // Alias for frontend compatibility
          is_debit: balanceType === 'Dr',
          is_credit: balanceType === 'Cr',
          isReceivable: isDebitNature && closingBalance > 0, // For debtors with positive balance
          isPayable: !isDebitNature && closingBalance > 0, // For creditors with positive balance
          address: address,
          email: email,
          phone: phone,
          gstin: gstin ? gstin.toUpperCase() : '',
          gst_type: gstType,
          place_of_supply: placeOfSupply || state,
          pan: this.extractXmlValue(content, 'INCOMETAXNUMBER') || '',
          state: state,
          country: country,
          pincode: pincode,
          mailing_name: mailingName || name
        });
      }
    } catch (err) {
      console.error('Error parsing ledgers XML:', err.message);
    }
    return ledgers;
  }
  
  /**
   * Parse raw balance string from Tally XML
   * Handles formats like: "-1180.00", "5000 Cr", "₹ 1,234.56 Dr", "TYPE='Amount'>-500</CLOSINGBALANCE>"
   */
  parseRawBalance(balStr) {
    if (!balStr) return 0;
    
    const str = String(balStr).trim();
    
    // Remove currency symbols and commas
    const cleanVal = str.replace(/[₹,Rs.\s]/gi, '').trim();
    const lowerVal = cleanVal.toLowerCase();
    
    // Extract numeric value
    const numericPart = cleanVal.replace(/[^0-9.\-]/g, '');
    let num = parseFloat(numericPart) || 0;
    
    // Handle Dr/Cr suffix (legacy format)
    if (lowerVal.includes('dr')) {
      // Dr means debit (negative in Tally's internal representation for assets)
      num = -Math.abs(num);
    } else if (lowerVal.includes('cr')) {
      // Cr means credit (positive in Tally's internal representation)
      num = Math.abs(num);
    }
    // If no suffix, use the sign as-is (new format)
    
    return num;
  }

  /**
   * Parse stock items XML response - handles NAME as attribute or element + ALIAS
   */
  parseStockItemsXml(xmlData) {
    const items = [];
    try {
      // Match STOCKITEM elements
      const itemRegex = /<STOCKITEM\s+NAME="([^"]+)"[^>]*>([\s\S]*?)<\/STOCKITEM>|<STOCKITEM>([\s\S]*?)<\/STOCKITEM>/gi;
      let match;
      while ((match = itemRegex.exec(xmlData)) !== null) {
        let name = '';
        let content = '';
        
        if (match[1]) {
          name = match[1].trim();
          content = match[2] || '';
        } else {
          content = match[3] || '';
          name = this.extractXmlValue(content, 'NAME');
        }
        
        // Skip if name is empty
        if (!name || name.trim() === '') continue;
        
        // Extract alias from LANGUAGENAME.LIST or direct ALIAS element
        let alias = this.extractXmlValue(content, 'ALIAS');
        if (!alias) {
          // Try to get from LANGUAGENAME.LIST > NAME.LIST > NAME (second NAME is alias)
          const langListMatch = content.match(/<LANGUAGENAME\.LIST>([\s\S]*?)<\/LANGUAGENAME\.LIST>/i);
          if (langListMatch) {
            const nameListMatch = langListMatch[1].match(/<NAME\.LIST>([\s\S]*?)<\/NAME\.LIST>/i);
            if (nameListMatch) {
              const names = nameListMatch[1].match(/<NAME>([^<]*)<\/NAME>/gi);
              if (names && names.length > 1) {
                const aliasMatch = names[1].match(/<NAME>([^<]*)<\/NAME>/i);
                if (aliasMatch) {
                  alias = aliasMatch[1].trim();
                }
              }
            }
          }
        }
        
        // Extract GST rate from GSTDETAILS.LIST > STATEWISEDETAILS.LIST > RATEDETAILS.LIST > GSTRATE
        let gstRate = parseFloat(this.extractXmlValue(content, 'GSTRATE')) || 0;
        if (!gstRate) {
          const gstMatch = content.match(/<GSTRATE>([^<]*)<\/GSTRATE>/i);
          if (gstMatch) {
            gstRate = parseFloat(gstMatch[1]) || 0;
          }
        }
        
        // Extract closing quantity - try multiple fields
        let closingQty = parseFloat(this.extractXmlValue(content, 'CLOSINGBALANCE')) || 0;
        if (!closingQty) {
          // Try to parse from compound value like "100 Nos"
          const balMatch = content.match(/<CLOSINGBALANCE>([^<]*)<\/CLOSINGBALANCE>/i);
          if (balMatch) {
            const numMatch = balMatch[1].match(/([\d.]+)/);
            if (numMatch) closingQty = parseFloat(numMatch[1]) || 0;
          }
        }
        
        // Extract rate - try multiple fields
        let closingRate = parseFloat(this.extractXmlValue(content, 'CLOSINGRATE')) || 0;
        if (!closingRate) {
          closingRate = parseFloat(this.extractXmlValue(content, 'OPENINGRATE')) || 0;
        }
        if (!closingRate) {
          // Try MRP or standard price
          closingRate = parseFloat(this.extractXmlValue(content, 'STANDARDSELLINGPRICE')) || 0;
        }
        if (!closingRate) {
          closingRate = parseFloat(this.extractXmlValue(content, 'STANDARDPRICE')) || 0;
        }
        
        items.push({
          name: name,
          alias: alias || '',
          parent: this.extractXmlValue(content, 'PARENT') || 'Primary',
          category: this.extractXmlValue(content, 'CATEGORY') || 'N/A',
          opening_qty: parseFloat(this.extractXmlValue(content, 'OPENINGBALANCE')) || 0,
          opening_rate: parseFloat(this.extractXmlValue(content, 'OPENINGRATE')) || 0,
          opening_value: parseFloat(this.extractXmlValue(content, 'OPENINGVALUE')) || 0,
          closing_qty: closingQty,
          closing_rate: closingRate,
          closing_value: parseFloat(this.extractXmlValue(content, 'CLOSINGVALUE')) || 0,
          unit: this.extractXmlValue(content, 'BASEUNITS') || 'Nos',
          gst_rate: gstRate,
          hsn_code: this.extractXmlValue(content, 'HSNCODE') || ''
        });
      }
    } catch (err) {
      console.error('Error parsing stock items XML:', err.message);
    }
    return items;
  }

  /**
   * Parse vouchers XML response - handles NAME/VOUCHERNUMBER as attribute or element
   */
  parseVouchersXml(xmlData) {
    const vouchers = [];
    try {
      // Match VOUCHER elements
      const voucherRegex = /<VOUCHER\s+(?:[^>]*VOUCHERNUMBER="([^"]+)"[^>]*|[^>]*)>([\s\S]*?)<\/VOUCHER>|<VOUCHER>([\s\S]*?)<\/VOUCHER>/gi;
      let match;
      while ((match = voucherRegex.exec(xmlData)) !== null) {
        let voucherNumber = '';
        let content = '';
        
        if (match[1]) {
          voucherNumber = match[1].trim();
          content = match[2] || '';
        } else {
          content = match[2] || match[3] || '';
          voucherNumber = this.extractXmlValue(content, 'VOUCHERNUMBER');
        }
        
        const voucherType = this.extractXmlValue(content, 'VOUCHERTYPENAME');
        
        // Skip if both voucher number and type are empty
        if ((!voucherNumber || voucherNumber.trim() === '') && (!voucherType || voucherType.trim() === '')) continue;
        
        // Parse date from YYYYMMDD format
        let dateStr = this.extractXmlValue(content, 'DATE');
        let parsedDate = null;
        if (dateStr && dateStr.length === 8) {
          const year = dateStr.substring(0, 4);
          const month = dateStr.substring(4, 6);
          const day = dateStr.substring(6, 8);
          parsedDate = `${year}-${month}-${day}`;
        }
        
        vouchers.push({
          voucher_number: voucherNumber || 'UNKNOWN',
          voucher_type: voucherType || 'UNKNOWN',
          date: parsedDate,
          party_name: this.extractXmlValue(content, 'PARTYLEDGERNAME'),
          amount: parseFloat(this.extractXmlValue(content, 'AMOUNT')) || 0,
          narration: this.extractXmlValue(content, 'NARRATION'),
          is_invoice: this.extractXmlValue(content, 'ISINVOICE') === 'Yes',
          is_cancelled: this.extractXmlValue(content, 'ISCANCELLED') === 'Yes',
          reference_number: this.extractXmlValue(content, 'REFERENCE')
        });
      }
    } catch (err) {
      console.error('Error parsing vouchers XML:', err.message);
    }
    return vouchers;
  }

  /**
   * Extract value from XML content - handles both element content and attribute values
   * Now properly handles TYPE="Amount" attributes and numeric values
   */
  extractXmlValue(content, tagName) {
    // First try as element with content: <TAG ...>value</TAG>
    // This handles <CLOSINGBALANCE TYPE="Amount">-1180.00</CLOSINGBALANCE>
    const elementRegex = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
    const elementMatch = content.match(elementRegex);
    if (elementMatch && elementMatch[1]) {
      return elementMatch[1].trim();
    }
    
    // Try as element with empty or whitespace content: <TAG></TAG> or <TAG>  </TAG>
    const emptyElementRegex = new RegExp(`<${tagName}[^>]*>\\s*</${tagName}>`, 'i');
    if (emptyElementRegex.test(content)) {
      return '';
    }
    
    // Try as self-closing element with value in attribute: <TAG VALUE="xxx"/>
    const attrRegex = new RegExp(`<${tagName}[^>]*\\s+(?:VALUE|TEXT)="([^"]*)"[^>]*/>`, 'i');
    const attrMatch = content.match(attrRegex);
    if (attrMatch && attrMatch[1]) {
      return attrMatch[1].trim();
    }
    
    // Try a more permissive regex for elements with any content (including empty)
    const permissiveRegex = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)</${tagName}>`, 'i');
    const permissiveMatch = content.match(permissiveRegex);
    if (permissiveMatch && permissiveMatch[1]) {
      const value = permissiveMatch[1].trim();
      // If it contains child elements, skip it (we want simple values only)
      if (!value.includes('<')) {
        return value;
      }
    }
    
    return '';
  }

  /**
   * Extract multiline value from XML content - handles elements with content that may include other XML
   */
  extractMultilineXmlValue(content, tagName) {
    // Match element with any content (including newlines): <TAG>...content...</TAG>
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i');
    const match = content.match(regex);
    if (match && match[1]) {
      // Remove any nested XML tags and clean up
      return match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    return '';
  }

  /**
   * Extract address from ADDRESS.LIST in Tally XML
   */
  extractAddressFromList(content) {
    // Tally sometimes stores address in ADDRESS.LIST > ADDRESS format
    const addressListMatch = content.match(/<ADDRESS\.LIST>([\s\S]*?)<\/ADDRESS\.LIST>/i);
    if (addressListMatch) {
      const addresses = addressListMatch[1].match(/<ADDRESS>([^<]*)<\/ADDRESS>/gi);
      if (addresses) {
        return addresses.map(a => {
          const m = a.match(/<ADDRESS>([^<]*)<\/ADDRESS>/i);
          return m ? m[1].trim() : '';
        }).filter(a => a).join(', ');
      }
    }
    return '';
  }

  /**
   * Sync ledgers to PostgreSQL with enhanced balance fields
   */
  async syncLedgersToDb(ledgers) {
    let count = 0;
    for (const ledger of ledgers) {
      // Skip ledgers with empty names
      if (!ledger.name || ledger.name.trim() === '') {
        console.warn('Skipping ledger with empty name');
        continue;
      }
      
      try {
        await dbQuery(`
          INSERT INTO tally_ledgers (
            name, parent, opening_balance, closing_balance, raw_closing_balance,
            on_account_value, balance_type, is_debit, is_credit,
            address, email, phone, gstin, gst_type, place_of_supply,
            pan, state, country, pincode, mailing_name, last_synced
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
          ON CONFLICT (name) DO UPDATE SET
            parent = EXCLUDED.parent,
            opening_balance = EXCLUDED.opening_balance,
            closing_balance = EXCLUDED.closing_balance,
            raw_closing_balance = EXCLUDED.raw_closing_balance,
            on_account_value = EXCLUDED.on_account_value,
            balance_type = EXCLUDED.balance_type,
            is_debit = EXCLUDED.is_debit,
            is_credit = EXCLUDED.is_credit,
            address = EXCLUDED.address,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            gstin = EXCLUDED.gstin,
            gst_type = EXCLUDED.gst_type,
            place_of_supply = EXCLUDED.place_of_supply,
            pan = EXCLUDED.pan,
            state = EXCLUDED.state,
            country = EXCLUDED.country,
            pincode = EXCLUDED.pincode,
            mailing_name = EXCLUDED.mailing_name,
            last_synced = NOW(),
            updated_at = NOW()
        `, [
          ledger.name,
          ledger.parent || 'Primary',
          ledger.opening_balance || 0,
          ledger.closing_balance || 0,
          ledger.raw_closing_balance || ledger.closing_balance || 0,
          ledger.on_account_value || 0,
          ledger.balance_type || 'Dr',
          ledger.is_debit !== undefined ? ledger.is_debit : true,
          ledger.is_credit !== undefined ? ledger.is_credit : false,
          ledger.address || '',
          ledger.email || '',
          ledger.phone || '',
          ledger.gstin || '',
          ledger.gst_type || '',
          ledger.place_of_supply || ledger.state || '',
          ledger.pan || '',
          ledger.state || '',
          ledger.country || 'India',
          ledger.pincode || '',
          ledger.mailing_name || ledger.name
        ]);
        count++;
      } catch (err) {
        console.error(`Error syncing ledger ${ledger.name}:`, err.message);
      }
    }
    return count;
  }

  /**
   * Sync stock items to PostgreSQL
   * Deletes items that no longer exist in Tally
   */
  async syncStockItemsToDb(items) {
    let count = 0;
    const syncedNames = [];
    
    for (const item of items) {
      // Skip items with empty names
      if (!item.name || item.name.trim() === '') {
        console.warn('Skipping stock item with empty name');
        continue;
      }
      
      syncedNames.push(item.name);
      
      try {
        await dbQuery(`
          INSERT INTO tally_stock_items (name, alias, parent, category, opening_qty, opening_rate, opening_value, closing_qty, closing_rate, closing_value, unit, gst_rate, hsn_code, last_synced)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
          ON CONFLICT (name) DO UPDATE SET
            alias = EXCLUDED.alias,
            parent = EXCLUDED.parent,
            category = EXCLUDED.category,
            opening_qty = EXCLUDED.opening_qty,
            opening_rate = EXCLUDED.opening_rate,
            opening_value = EXCLUDED.opening_value,
            closing_qty = EXCLUDED.closing_qty,
            closing_rate = EXCLUDED.closing_rate,
            closing_value = EXCLUDED.closing_value,
            unit = EXCLUDED.unit,
            gst_rate = EXCLUDED.gst_rate,
            hsn_code = EXCLUDED.hsn_code,
            last_synced = NOW(),
            updated_at = NOW()
        `, [
          item.name,
          item.alias || '',
          item.parent,
          item.category,
          item.opening_qty,
          item.opening_rate,
          item.opening_value,
          item.closing_qty,
          item.closing_rate,
          item.closing_value,
          item.unit,
          item.gst_rate,
          item.hsn_code
        ]);
        count++;
      } catch (err) {
        console.error(`Error syncing stock item ${item.name}:`, err.message);
      }
    }
    
    // Delete items that no longer exist in Tally
    if (syncedNames.length > 0) {
      try {
        const result = await dbQuery(`
          DELETE FROM tally_stock_items 
          WHERE name NOT IN (${syncedNames.map((_, i) => `$${i + 1}`).join(',')})
        `, syncedNames);
        if (result.rowCount > 0) {
          console.log(`[TallySync] Deleted ${result.rowCount} stock items that no longer exist in Tally`);
        }
      } catch (err) {
        console.error('Error deleting old stock items:', err.message);
      }
    }
    
    return count;
  }

  /**
   * Sync vouchers to PostgreSQL
   */
  async syncVouchersToDb(vouchers) {
    let count = 0;
    for (const voucher of vouchers) {
      // Skip vouchers with empty voucher numbers and type
      if ((!voucher.voucher_number || voucher.voucher_number.trim() === '' || voucher.voucher_number === 'UNKNOWN') && 
          (!voucher.voucher_type || voucher.voucher_type.trim() === '' || voucher.voucher_type === 'UNKNOWN')) {
        console.warn('Skipping voucher with empty number and type');
        continue;
      }
      
      // Prepare full voucher data for JSON storage (excluding 'raw' to save space)
      const voucherDataForStorage = { ...voucher };
      delete voucherDataForStorage.raw; // Remove raw XML to save space
      const voucherDataJson = JSON.stringify(voucherDataForStorage);
      
      try {
        await dbQuery(`
          INSERT INTO tally_vouchers (voucher_number, voucher_type, date, party_name, amount, narration, is_invoice, is_cancelled, reference_number, voucher_data, last_synced)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
          ON CONFLICT (voucher_number, voucher_type) DO UPDATE SET
            date = EXCLUDED.date,
            party_name = EXCLUDED.party_name,
            amount = EXCLUDED.amount,
            narration = EXCLUDED.narration,
            is_invoice = EXCLUDED.is_invoice,
            is_cancelled = EXCLUDED.is_cancelled,
            reference_number = EXCLUDED.reference_number,
            voucher_data = EXCLUDED.voucher_data,
            last_synced = NOW(),
            updated_at = NOW()
        `, [
          voucher.voucher_number,
          voucher.voucher_type,
          voucher.date ? new Date(voucher.date) : null,
          voucher.party_name || voucher.party_ledger || voucher.party || '',
          voucher.amount || voucher.totalAmount || 0,
          voucher.narration,
          voucher.is_invoice,
          voucher.is_cancelled,
          voucher.reference_number || voucher.reference || '',
          voucherDataJson
        ]);
        count++;
      } catch (err) {
        console.error(`Error syncing voucher ${voucher.voucher_number}:`, err.message);
      }
    }
    return count;
  }

  /**
   * Update sync status in database
   */
  async updateSyncStatus(results) {
    try {
      await dbQuery(`
        INSERT INTO tally_sync_status (sync_time, ledgers_synced, stock_items_synced, vouchers_synced, groups_synced, status, errors)
        VALUES (NOW(), $1, $2, $3, $4, $5, $6)
      `, [
        results.ledgers || 0,
        results.stockItems || 0,
        results.vouchers || 0,
        results.groups || 0,
        results.errors.length > 0 ? 'partial' : 'success',
        JSON.stringify(results.errors)
      ]);
    } catch (err) {
      console.error('Error updating sync status:', err.message);
    }
  }

  /**
   * Get ledgers from database
   */
  async getLedgersFromDb() {
    try {
      const result = await dbQuery('SELECT * FROM tally_ledgers ORDER BY name');
      return result.rows;
    } catch (err) {
      console.error('Error getting ledgers from database:', err.message);
      return [];
    }
  }

  /**
   * Get stock items from database
   */
  async getStockItemsFromDb() {
    try {
      const result = await dbQuery('SELECT * FROM tally_stock_items ORDER BY name');
      return result.rows;
    } catch (err) {
      console.error('Error getting stock items from database:', err.message);
      return [];
    }
  }

  /**
   * Get vouchers from database
   * Returns full voucher data from JSON if available, otherwise basic fields
   */
  async getVouchersFromDb() {
    try {
      const result = await dbQuery('SELECT * FROM tally_vouchers ORDER BY date DESC');
      
      // Parse voucher_data JSON and merge with basic fields
      return result.rows.map(row => {
        // If voucher_data exists, parse and return full data
        if (row.voucher_data) {
          try {
            const fullData = typeof row.voucher_data === 'string' 
              ? JSON.parse(row.voucher_data) 
              : row.voucher_data;
            // Ensure amount is a number
            if (fullData.amount !== undefined) {
              fullData.amount = Number(fullData.amount) || 0;
            }
            if (fullData.totalAmount !== undefined) {
              fullData.totalAmount = Number(fullData.totalAmount) || 0;
            }
            return fullData;
          } catch (parseErr) {
            console.warn('Failed to parse voucher_data for', row.voucher_number, parseErr.message);
          }
        }
        
        // Fallback: return basic fields with amount as number
        return {
          ...row,
          amount: Number(row.amount) || 0
        };
      });
    } catch (err) {
      console.error('Error getting vouchers from database:', err.message);
      return [];
    }
  }

  /**
   * Full sync - fetch from Tally and store in database
   */
  async fullSync() {
    const results = {
      ledgers: 0,
      stockItems: 0,
      vouchers: 0,
      groups: 0,
      errors: [],
      tallyConnected: false
    };

    // Check Tally connection first
    const connected = await this.checkTallyConnection();
    results.tallyConnected = connected;

    if (!connected) {
      results.errors.push('Tally is not available - using cached database data');
      return results;
    }

    try {
      // Sync ledgers
      const ledgers = await this.fetchLedgersFromTally();
      if (ledgers.length > 0) {
        results.ledgers = await this.syncLedgersToDb(ledgers);
      }

      // Sync stock items
      const stockItems = await this.fetchStockItemsFromTally();
      if (stockItems.length > 0) {
        results.stockItems = await this.syncStockItemsToDb(stockItems);
      }

      // Sync vouchers
      const vouchers = await this.fetchVouchersFromTally();
      if (vouchers.length > 0) {
        results.vouchers = await this.syncVouchersToDb(vouchers);
      }

      // Update sync status
      await this.updateSyncStatus(results);
      this.lastSyncTime = new Date();

    } catch (err) {
      results.errors.push(err.message);
    }

    return results;
  }

  /**
   * Add task to queue (for offline operations)
   */
  async addToQueue(taskType, taskData, priority = 0) {
    try {
      const id = require('crypto').randomUUID();
      await dbQuery(`
        INSERT INTO task_queue (id, task_type, task_data, priority, status)
        VALUES ($1, $2, $3, $4, 'pending')
      `, [id, taskType, JSON.stringify(taskData), priority]);
      return id;
    } catch (err) {
      console.error('Error adding task to queue:', err.message);
      return null;
    }
  }

  /**
   * Get pending tasks from queue
   */
  async getPendingTasks() {
    try {
      const result = await dbQuery(`
        SELECT * FROM task_queue 
        WHERE status = 'pending' 
        ORDER BY priority DESC, created_at ASC
      `);
      return result.rows;
    } catch (err) {
      console.error('Error getting pending tasks:', err.message);
      return [];
    }
  }

  /**
   * Process pending tasks (called when Tally comes back online)
   */
  async processPendingTasks() {
    const tasks = await this.getPendingTasks();
    let processed = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        // Mark as processing
        await dbQuery(`UPDATE task_queue SET status = 'processing', started_at = NOW() WHERE id = $1`, [task.id]);

        // Execute task based on type
        const taskData = typeof task.task_data === 'string' ? JSON.parse(task.task_data) : task.task_data;
        await this.executeTask(task.task_type, taskData);

        // Mark as completed
        await dbQuery(`UPDATE task_queue SET status = 'completed', completed_at = NOW() WHERE id = $1`, [task.id]);
        processed++;
      } catch (err) {
        // Mark as failed
        await dbQuery(`
          UPDATE task_queue 
          SET status = 'failed', error_message = $2, retry_count = retry_count + 1 
          WHERE id = $1
        `, [task.id, err.message]);
        failed++;
      }
    }

    return { processed, failed, total: tasks.length };
  }

  /**
   * Execute a specific task
   */
  async executeTask(taskType, taskData) {
    // Implement task execution based on type
    console.log(`Executing task: ${taskType}`, taskData);
    // Add specific implementations for different task types
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      lastCheckTime: this.lastCheckTime,
      lastSyncTime: this.lastSyncTime,
      tallyUrl: this.getTallyUrlDynamic()
    };
  }

  /**
   * Cache company details to database for offline use
   */
  async cacheCompanyDetails(company) {
    if (!company) return;
    try {
      await dbQuery(`
        INSERT INTO system_config (key, value, description, updated_at)
        VALUES ('cached_company_details', $1, 'Cached company details from Tally', NOW())
        ON CONFLICT (key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
      `, [JSON.stringify(company)]);
    } catch (err) {
      console.error('Error caching company details:', err.message);
    }
  }

  /**
   * Get cached company details from database
   */
  async getCachedCompanyDetails() {
    try {
      const result = await dbQuery(`
        SELECT value FROM system_config WHERE key = 'cached_company_details'
      `);
      if (result.rows.length > 0 && result.rows[0].value) {
        const value = result.rows[0].value;
        // Handle both string and object values
        if (typeof value === 'string') {
          return JSON.parse(value);
        }
        return value;
      }
      return null;
    } catch (err) {
      console.error('Error getting cached company details:', err.message);
      return null;
    }
  }

  /**
   * Fetch ledger balances from Tally using DSP report format
   * This returns the current Dr/Cr amounts for each ledger
   */
  async fetchLedgerBalancesFromTally(parentGroup = 'Sundry Debtors') {
    const tallyUrl = this.getTallyUrlDynamic();
    const groupList = Array.isArray(parentGroup) ? parentGroup : [parentGroup];
    const filteredGroups = groupList.filter(g => g && String(g).trim().length > 0);
    const targets = filteredGroups.length > 0 ? filteredGroups : ['Sundry Debtors'];

    const buildXml = (groupName) => `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>List of Accounts</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        <EXPLOESSION>All Ledgers Under:${groupName}</EXPLOESSION>
      </STATICVARIABLES>
    </DESC>
  </BODY>
</ENVELOPE>`;

    try {
      const responses = await Promise.all(
        targets.map(groupName =>
          axios.post(tallyUrl, buildXml(groupName), {
            headers: { 'Content-Type': 'text/xml' },
            timeout: 30000
          }).then(r => r.data).catch(err => {
            console.error(`Error fetching ledger balances for ${groupName}:`, err.message);
            return '';
          })
        )
      );

      const balanceMap = new Map();
      for (const xmlData of responses) {
        if (!xmlData) continue;
        const parsed = this.parseLedgerBalancesXml(xmlData);
        for (const bal of parsed) {
          balanceMap.set((bal.name || '').toLowerCase(), bal);
        }
      }

      return Array.from(balanceMap.values());
    } catch (err) {
      console.error('Error fetching ledger balances from Tally:', err.message);
      return [];
    }
  }

  /**
   * Parse ledger balances from DSP report XML format
   * Handles the DSPACCNAME/DSPACCINFO structure
   */
  parseLedgerBalancesXml(xmlData) {
    const balances = [];
    try {
      // Extract all DSPACCNAME blocks
      const nameMatches = xmlData.matchAll(/<DSPACCNAME>\s*<DSPDISPNAME>([^<]*)<\/DSPDISPNAME>\s*<\/DSPACCNAME>/gi);
      const names = [...nameMatches].map(m => m[1].trim());
      
      // Extract all DSPACCINFO blocks
      const infoMatches = xmlData.matchAll(/<DSPACCINFO>\s*<DSPCLDRAMT>\s*<DSPCLDRAMTA>([^<]*)<\/DSPCLDRAMTA>\s*<\/DSPCLDRAMT>\s*<DSPCLCRAMT>\s*<DSPCLCRAMTA>([^<]*)<\/DSPCLCRAMTA>\s*<\/DSPCLCRAMT>\s*<\/DSPACCINFO>/gi);
      const infos = [...infoMatches].map(m => ({
        drAmount: parseFloat(m[1].trim()) || 0,
        crAmount: parseFloat(m[2].trim()) || 0
      }));

      // Pair names with their balances
      for (let i = 0; i < names.length && i < infos.length; i++) {
        const name = names[i];
        const info = infos[i];
        
        // Calculate balance: positive Dr means receivable, negative means they owe
        // Cr amount means we owe them (for debtors, this is unusual but possible - advance received)
        let balance = 0;
        if (info.drAmount) {
          balance = info.drAmount; // Negative value means receivable (they owe us)
        } else if (info.crAmount) {
          balance = -info.crAmount; // Positive Cr means advance received
        }

        balances.push({
          name: name,
          drAmount: info.drAmount,
          crAmount: info.crAmount,
          balance: balance,
          // For display: format as receivable/payable
          displayBalance: Math.abs(balance),
          isReceivable: balance < 0, // Negative Dr = receivable
          isPayable: balance > 0 || info.crAmount > 0
        });
      }
    } catch (err) {
      console.error('Error parsing ledger balances XML:', err.message);
    }
    return balances;
  }

  /**
   * Get ledgers with their balances merged
   */
  async getLedgersWithBalances(parentGroup = 'Sundry Debtors') {
    try {
      // Fetch both ledger details and balances
      const [ledgers, balances] = await Promise.all([
        this.fetchLedgersFromTally(),
        this.fetchLedgerBalancesFromTally(parentGroup)
      ]);

      // Create balance lookup map
      const balanceMap = new Map();
      for (const bal of balances) {
        balanceMap.set(bal.name.toLowerCase(), bal);
      }

      // Filter ledgers by parent group(s) and merge with balances
      const groupList = Array.isArray(parentGroup) ? parentGroup : [parentGroup];
      const parentTargets = groupList.map(g => normalizeGroupName(g));
      const groupLedgers = ledgers.filter(l => 
        parentTargets.includes(normalizeGroupName(l.parent))
      );

      return groupLedgers.map(ledger => {
        const bal = balanceMap.get(ledger.name.toLowerCase());
        return {
          ...ledger,
          drAmount: bal?.drAmount || 0,
          crAmount: bal?.crAmount || 0,
          currentBalance: bal?.balance || ledger.closing_balance || 0,
          displayBalance: bal?.displayBalance || Math.abs(ledger.closing_balance || 0),
          isReceivable: bal?.isReceivable || false,
          isPayable: bal?.isPayable || false
        };
      });
    } catch (err) {
      console.error('Error getting ledgers with balances:', err.message);
      return [];
    }
  }
}

// Singleton instance
const tallySyncService = new TallySyncService();

module.exports = tallySyncService;
