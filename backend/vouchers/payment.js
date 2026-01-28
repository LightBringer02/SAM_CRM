const xml2js = require('xml2js');


async function parsePaymentVoucher(xml) {
  const parsed = await xml2js.parseStringPromise(xml, { explicitArray: false });
  // Adjust the path below based on your actual XML structure
  const voucher = parsed.ENVELOPE?.BODY?.DATA?.TALLYMESSAGE?.VOUCHER || {};
  let amount = 0;

  // Try to extract amount from LEDGERENTRIES.LIST
  if (voucher['LEDGERENTRIES.LIST']) {
    const ledgers = Array.isArray(voucher['LEDGERENTRIES.LIST'])
      ? voucher['LEDGERENTRIES.LIST']
      : [voucher['LEDGERENTRIES.LIST']];
    // For payment, usually the first negative amount is the paid amount
    const paymentLedger = ledgers.find(l => l.AMOUNT && Number(l.AMOUNT) < 0);
    if (paymentLedger) amount = Math.abs(Number(paymentLedger.AMOUNT));
    else if (ledgers[0] && ledgers[0].AMOUNT) amount = Math.abs(Number(ledgers[0].AMOUNT));
  } else if (voucher.AMOUNT) {
    amount = Math.abs(Number(voucher.AMOUNT));
  }

  return {
    voucher_number: voucher.VOUCHERNUMBER || '',
    date: voucher.DATE || '',
    party_ledger: voucher.PARTYLEDGERNAME || '',
    amount: amount,
    raw: voucher
  };
}

module.exports = { parsePaymentVoucher };
