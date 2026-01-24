const xml2js = require('xml2js');

async function parsePurchaseVoucher(xml) {
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  // TODO: Extract all fields needed for the purchase voucher
  return {};
}

module.exports = { parsePurchaseVoucher };
