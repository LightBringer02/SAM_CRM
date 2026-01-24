const xml2js = require('xml2js');

async function parseSalesVoucher(xml) {
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  // TODO: Extract all fields needed for the invoice layout from parsed XML
  return {
    seller: {},
    consignee: {},
    buyer: {},
    invoice: {},
    items: [],
    totals: {},
    gst: {},
    grandTotal: 0,
    amountWords: '',
    hsnSummary: [],
    taxWords: '',
    declaration: '',
    signatory: ''
  };
}

module.exports = { parseSalesVoucher };
