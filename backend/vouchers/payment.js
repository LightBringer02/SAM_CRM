const xml2js = require('xml2js');

async function parsePaymentVoucher(xml) {
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  // TODO: Extract all fields needed for the payment voucher
  return {};
}

module.exports = { parsePaymentVoucher };
