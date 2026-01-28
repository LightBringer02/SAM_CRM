/**
 * Dummy Data Module
 * Provides mock data when backend is in DUMMY_DATA mode
 */

// Mock inventory data
const dummyInventory = [
  {
    serial: 1,
    name: "Sample Product A",
    alias: "SPA",
    group: "Electronics",
    category: "Gadgets",
    hsn: "8471",
    gst: "18",
    rate: 1500.00,
    quantity: 100,
    unit: "Nos",
    stock: "In Stock",
    purchase_rate: 1200.00,
    selling_rate: 1500.00,
    opening_balance: 50,
    opening_value: 60000,
    closing_value: 150000
  },
  {
    serial: 2,
    name: "Sample Product B",
    alias: "SPB",
    group: "Accessories",
    category: "Parts",
    hsn: "8517",
    gst: "12",
    rate: 500.00,
    quantity: 250,
    unit: "Nos",
    stock: "In Stock",
    purchase_rate: 350.00,
    selling_rate: 500.00,
    opening_balance: 100,
    opening_value: 35000,
    closing_value: 125000
  },
  {
    serial: 3,
    name: "Sample Product C",
    alias: "SPC",
    group: "Hardware",
    category: "Tools",
    hsn: "8205",
    gst: "18",
    rate: 2500.00,
    quantity: 30,
    unit: "Pcs",
    stock: "In Stock",
    purchase_rate: 2000.00,
    selling_rate: 2500.00,
    opening_balance: 20,
    opening_value: 40000,
    closing_value: 75000
  },
  {
    serial: 4,
    name: "Sample Product D",
    alias: "N/A",
    group: "Consumables",
    category: "Office",
    hsn: "4820",
    gst: "5",
    rate: 150.00,
    quantity: 0,
    unit: "Box",
    stock: "Out of Stock",
    purchase_rate: 100.00,
    selling_rate: 150.00,
    opening_balance: 50,
    opening_value: 5000,
    closing_value: 0
  },
  {
    serial: 5,
    name: "Sample Product E",
    alias: "SPE",
    group: "Electronics",
    category: "Displays",
    hsn: "8528",
    gst: "18",
    rate: 15000.00,
    quantity: 15,
    unit: "Nos",
    stock: "In Stock",
    purchase_rate: 12000.00,
    selling_rate: 15000.00,
    opening_balance: 10,
    opening_value: 120000,
    closing_value: 225000
  }
];

// Mock voucher data
const dummyVouchers = [
  {
    voucher_number: "DEMO-001",
    guid: "demo-guid-001",
    date: new Date().toISOString().slice(0, 10),
    voucher_type: "Sales",
    party_ledger: "Demo Customer A",
    amount: 25000.00,
    narration: "Sample sales voucher for demo purposes",
    ledgers: [
      { name: "Demo Customer A", amount: 25000.00, is_debit: true },
      { name: "Sales Account", amount: 25000.00, is_debit: false }
    ],
    payment_status: "Pending",
    unpaid_amount: 25000.00
  },
  {
    voucher_number: "DEMO-002",
    guid: "demo-guid-002",
    date: new Date().toISOString().slice(0, 10),
    voucher_type: "Purchase",
    party_ledger: "Demo Vendor B",
    amount: 15000.00,
    narration: "Sample purchase voucher for demo purposes",
    ledgers: [
      { name: "Purchase Account", amount: 15000.00, is_debit: true },
      { name: "Demo Vendor B", amount: 15000.00, is_debit: false }
    ],
    payment_status: "Pending",
    unpaid_amount: 15000.00
  },
  {
    voucher_number: "DEMO-003",
    guid: "demo-guid-003",
    date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), // Yesterday
    voucher_type: "Receipt",
    party_ledger: "Demo Customer C",
    amount: 10000.00,
    narration: "Payment received from customer",
    ledgers: [
      { name: "Cash", amount: 10000.00, is_debit: true },
      { name: "Demo Customer C", amount: 10000.00, is_debit: false }
    ],
    payment_status: "Paid",
    unpaid_amount: 0
  },
  {
    voucher_number: "DEMO-004",
    guid: "demo-guid-004",
    date: new Date(Date.now() - 172800000).toISOString().slice(0, 10), // 2 days ago
    voucher_type: "Payment",
    party_ledger: "Demo Vendor D",
    amount: 8000.00,
    narration: "Payment made to vendor",
    ledgers: [
      { name: "Demo Vendor D", amount: 8000.00, is_debit: true },
      { name: "Bank Account", amount: 8000.00, is_debit: false }
    ],
    payment_status: "Paid",
    unpaid_amount: 0
  },
  {
    voucher_number: "DEMO-005",
    guid: "demo-guid-005",
    date: new Date().toISOString().slice(0, 10),
    voucher_type: "Sales",
    party_ledger: "Demo Customer E",
    amount: 45000.00,
    narration: "Large order - demo data",
    ledgers: [
      { name: "Demo Customer E", amount: 45000.00, is_debit: true },
      { name: "Sales Account", amount: 45000.00, is_debit: false }
    ],
    payment_status: "Partial",
    unpaid_amount: 20000.00
  }
];

// Mock company data
const dummyCompany = {
  name: "Demo Company Pvt Ltd",
  address: "123 Demo Street, Sample City, State 123456",
  gstin: "29DEMO12345Z1Z5",
  pan: "ABCDE1234F",
  phone: "+91 9876543210",
  email: "demo@company.com",
  website: "www.democompany.com"
};

/**
 * Get dummy inventory data
 */
function getDummyInventory() {
  return [...dummyInventory];
}

/**
 * Get dummy vouchers with optional filtering
 */
function getDummyVouchers(filters = {}) {
  let vouchers = [...dummyVouchers];
  
  const { from, to, search, type, party_ledger, daybook } = filters;
  
  // Date filter
  if (from) {
    vouchers = vouchers.filter(v => v.date && v.date >= from);
  }
  if (to) {
    vouchers = vouchers.filter(v => v.date && v.date <= to);
  }
  
  // Daybook mode
  if (daybook === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    vouchers = vouchers.filter(v => v.date === today);
  }
  
  // Voucher type filter
  if (type && type.toLowerCase() !== 'all') {
    vouchers = vouchers.filter(v => {
      const vt = (v.voucher_type || '').toLowerCase();
      return vt.includes(type.toLowerCase());
    });
  }
  
  // Party ledger filter
  if (party_ledger) {
    vouchers = vouchers.filter(v => 
      (v.party_ledger || '').toLowerCase().includes(party_ledger.toLowerCase())
    );
  }
  
  // Search filter
  if (search) {
    const s = search.toLowerCase();
    vouchers = vouchers.filter(v =>
      (v.voucher_number || '').toLowerCase().includes(s) ||
      (v.party_ledger || '').toLowerCase().includes(s) ||
      String(v.amount || '').toLowerCase().includes(s) ||
      (v.narration || '').toLowerCase().includes(s)
    );
  }
  
  return vouchers;
}

/**
 * Get dummy company details
 */
function getDummyCompany() {
  return { ...dummyCompany };
}

/**
 * Get a single dummy voucher by ID
 */
function getDummyVoucherById(id) {
  return dummyVouchers.find(v => 
    v.voucher_number === id || 
    v.guid === id
  ) || null;
}

module.exports = {
  getDummyInventory,
  getDummyVouchers,
  getDummyCompany,
  getDummyVoucherById
};
