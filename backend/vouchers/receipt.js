const xml2js = require('xml2js');

async function parseReceiptVoucher(xml) {
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  // TODO: Extract all fields needed for the receipt voucher
  return {};
}

module.exports = { parseReceiptVoucher };
