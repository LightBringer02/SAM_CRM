const express = require('express');
const router = express.Router();
const { fetchVouchers } = require('../connection/voucherRegister');



// GET /api/vouchers - fetch all voucher register entries
router.get('/', async (req, res) => {
  try {
    const vouchers = await fetchVouchers();
    // Filtering logic
    let filtered = vouchers;
    const { from, to, search, type, party_ledger } = req.query;

    // Date filter (inclusive)
    if (from) {
      filtered = filtered.filter(v => v.date && v.date >= from);
    }
    if (to) {
      filtered = filtered.filter(v => v.date && v.date <= to);
    }

    // Voucher type filter (case-insensitive)
    if (type && type !== 'all') {
      filtered = filtered.filter(v => {
        const vt = (v.voucher_type || (v.raw && v.raw.VOUCHERTYPENAME) || '').toLowerCase();
        return vt.includes(type.toLowerCase());
      });
    }

    // Party ledger filter (case-insensitive)
    if (party_ledger) {
      filtered = filtered.filter(v => (v.party_ledger || '').toLowerCase().includes(party_ledger.toLowerCase()));
    }

    // Search filter (searches voucher number, party ledger, and amount)
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(v =>
        (v.voucher_number || '').toLowerCase().includes(s) ||
        (v.party_ledger || '').toLowerCase().includes(s) ||
        (v.amount || '').toString().toLowerCase().includes(s)
      );
    }

    res.json(filtered);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch vouchers', details: err.message });
  }
});

// GET /api/vouchers/:id
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  // Determine voucher type (e.g., from DB or XML)
  const type = 'Sales'; // Example
  const xml = await fetchVoucherXML(id, type);
  let parsed;
  if (type === 'Sales') parsed = await parseSalesVoucher(xml);
  else if (type === 'Purchase') parsed = await parsePurchaseVoucher(xml);
  else if (type === 'Receipt') parsed = await parseReceiptVoucher(xml);
  else if (type === 'Payment') parsed = await parsePaymentVoucher(xml);
  else parsed = {};
  res.json(parsed);
});

module.exports = router;
