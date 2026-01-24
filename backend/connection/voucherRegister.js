const axios = require('axios');
const xml2js = require('xml2js');

const TALLY_URL = process.env.TALLY_URL || 'http://localhost:9000';

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
      <REQUESTDATA>
        <COLLECTION NAME="InvoiceCollection">
          <TYPE>Voucher</TYPE>
          <FETCH>
            DATE,
            VOUCHERNUMBER,
            PARTYLEDGERNAME,
            STOCKITEMNAME,
            BILLEDQTY,
            RATE,
            AMOUNT,
            LEDGERNAME
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

async function fetchVoucherRegisterXML() {
  const { data } = await axios.post(TALLY_URL, VOUCHER_REGISTER_XML, {
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
  return `${year}-${month}-${day}`;
}

async function parseVoucherRegisterXml(xml) {
  const parsed = await xml2js.parseStringPromise(xml, {
    explicitArray: false,
    mergeAttrs: true,
    preserveChildrenOrder: true
  });

  const vouchers = [];
  // UNIVERSAL VOUCHER FINDER
  function scan(node) {
    if (!node || typeof node !== "object") return;
    if (node.VOUCHER) {
      const list = Array.isArray(node.VOUCHER) ? node.VOUCHER : [node.VOUCHER];
      vouchers.push(...list);
    }
    for (const key of Object.keys(node)) {
      scan(node[key]);
    }
  }
  scan(parsed);

  // Process all vouchers
  return vouchers.map(v => ({
    date: parseTallyDate(v.DATE),
    voucher_number: v.VOUCHERNUMBER || '',
    party_ledger: v.PARTYLEDGERNAME || '',
    stock_item: v.STOCKITEMNAME || '',
    billed_qty: v.BILLEDQTY || '',
    rate: v.RATE || '',
    amount: v.AMOUNT || '',
    ledger_name: v.LEDGERNAME || '',
    raw: v
  }));
}

async function fetchVouchers() {
  try {
    const xml = await fetchVoucherRegisterXML();
    return await parseVoucherRegisterXml(xml);
  } catch (err) {
    console.error("Tally Voucher Register Fetch Error:", err);
    throw err;
  }
}

module.exports = { fetchVouchers, parseVoucherRegisterXml };
