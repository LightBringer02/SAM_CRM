// --- Payment Status Helper ---
// Computes payment status by matching receipts to sales vouchers by party/ledger name
function computePaymentStatus(salesVouchers, allReceipts) {
  const normalize = name => (typeof name === 'string' ? name.toLowerCase().trim() : '');
  
  // Sort vouchers and receipts by date ascending
  const sortedVouchers = [...salesVouchers].sort((a, b) => new Date(a.date) - new Date(b.date));
  const sortedReceipts = [...allReceipts].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Create a map of remaining receipt amounts per party
  const receiptsByParty = {};
  sortedReceipts.forEach(r => {
    const partyName = normalize(r.party_ledger || r.party || r.party_name || '');
    if (!partyName) return;
    if (!receiptsByParty[partyName]) {
      receiptsByParty[partyName] = [];
    }
    // Clone receipt with remaining amount to track
    receiptsByParty[partyName].push({
      ...r,
      remaining: Number(r.amount) || 0
    });
  });
  
  // Process each sales voucher
  sortedVouchers.forEach(voucher => {
    const voucherAmount = getVoucherDisplayAmount(voucher);
    const partyName = normalize(voucher.party_ledger || voucher.party || voucher.party_name || '');
    
    let unpaidAmount = voucherAmount;
    
    // Find receipts for this party and apply payments
    if (partyName && receiptsByParty[partyName]) {
      const partyReceipts = receiptsByParty[partyName];
      
      for (const receipt of partyReceipts) {
        if (unpaidAmount <= 0) break;
        if (receipt.remaining <= 0) continue;
        
        // Apply receipt amount to this voucher
        const appliedAmount = Math.min(receipt.remaining, unpaidAmount);
        receipt.remaining -= appliedAmount;
        unpaidAmount -= appliedAmount;
      }
    }
    
    // Set payment status
    voucher.unpaid_amount = unpaidAmount;
    voucher.payment_status = unpaidAmount <= 0 ? 'Paid' : 'Pending';
  });
  
  return sortedVouchers;
}

// Helper to get display amount (debit ledger sum or voucher.amount)
// Handles both number and string amounts (from database cache)
function getVoucherDisplayAmount(row) {
  let displayAmount = 0;
  if (Array.isArray(row.ledgers) && row.ledgers.length > 0) {
    const debitLedger = row.ledgers.find(l => l.is_debit && (typeof row.party_ledger === 'undefined' || (l.name && l.name.toLowerCase().trim() === row.party_ledger.toLowerCase().trim())));
    if (debitLedger && (typeof debitLedger.amount === 'number' || typeof debitLedger.amount === 'string')) {
      displayAmount = Number(debitLedger.amount) || 0;
    }
  }
  // Fallback to row.amount - handle both number and string types
  if (displayAmount === 0 && (typeof row.amount === 'number' || typeof row.amount === 'string')) {
    displayAmount = Number(row.amount) || 0;
  }
  return displayAmount;
}
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Print styles - hide everything except invoice content when printing
const printStyles = `
@media print {
  /* Hide the entire page by default */
  html, body {
    margin: 0 !important;
    padding: 0 !important;
  }
  
  /* Hide sidebar, navbar, and all page content */
  body > * {
    visibility: hidden !important;
  }
  
  /* Hide the main layout wrapper */
  .bg-white.dark\\:bg-gray-900,
  .p-6,
  [class*="sidebar"],
  [class*="navbar"],
  nav,
  header,
  aside {
    visibility: hidden !important;
  }
  
  /* Show only the invoice print area */
  .invoice-print-area,
  .invoice-print-area * {
    visibility: visible !important;
  }
  
  /* Position the invoice at top-left */
  .invoice-print-area {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 210mm !important;
    max-width: 100% !important;
    padding: 8mm !important;
    margin: 0 !important;
    background: white !important;
    box-shadow: none !important;
    border: none !important;
    z-index: 99999 !important;
    overflow: visible !important;
    max-height: none !important;
  }
  
  /* Hide modal overlay and buttons */
  .print-hide,
  .fixed.inset-0.z-50::before,
  button {
    display: none !important;
    visibility: hidden !important;
  }
  
  /* Ensure scrollable areas print fully */
  .overflow-y-auto,
  .overflow-x-auto {
    overflow: visible !important;
    max-height: none !important;
    height: auto !important;
  }
  
  /* Page setup */
  @page {
    size: A4 portrait;
    margin: 8mm;
  }
  
  /* Ensure proper page breaks */
  .invoice-print-area table {
    page-break-inside: auto;
  }
  
  .invoice-print-area tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  /* Ensure black text for printing */
  .invoice-print-area,
  .invoice-print-area * {
    color: black !important;
    background-color: white !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  
  /* Make borders visible */
  .invoice-print-area table,
  .invoice-print-area th,
  .invoice-print-area td,
  .invoice-print-area .border {
    border-color: #333 !important;
  }
}
`;

// Helper function to extract numeric part from voucher number for sorting
// Handles formats like "SAM/25-26/5", "INV-001", "PUR/2024/123" etc.
function extractVoucherNumber(voucherNo) {
  if (!voucherNo) return 0;
  const str = String(voucherNo);
  // Get the last numeric segment
  const matches = str.match(/(\d+)/g);
  if (matches && matches.length > 0) {
    return parseInt(matches[matches.length - 1], 10);
  }
  return 0;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

// Indian number to words (handles rupees/paise, crores/lakhs)
function numberToWords(num) {
  if (num === 0) return "Zero Rupees Only";
  if (!num || isNaN(num)) return "";
  
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  const numToWords = (n) => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + numToWords(n % 100) : "");
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + numToWords(n % 1000) : "");
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + numToWords(n % 100000) : "");
    return numToWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + numToWords(n % 10000000) : "");
  };
  
  const absNum = Math.abs(Math.round(num));
  const rupees = Math.floor(absNum);
  const paise = Math.round((absNum - rupees) * 100);
  
  let result = numToWords(rupees) + " Rupees";
  if (paise > 0) {
    result += " and " + numToWords(paise) + " Paise";
  }
  result += " Only";
  return result;
}

// Debounce hook
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

// Calculate days since date
function getDaysSinceDate(dateStr) {
  if (!dateStr) return '';
  const voucherDate = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - voucherDate) / (1000 * 60 * 60 * 24));
  if (isNaN(diff) || diff < 0) return '';
  const months = Math.floor(diff / 30);
  const days = diff % 30;
  let result = '';
  if (months > 0) result += `${months} month${months > 1 ? 's' : ''}`;
  if (months > 0 && days > 0) result += ' ';
  if (days > 0) result += `${days} day${days > 1 ? 's' : ''}`;
  if (!result) result = 'Today';
  return result;
}

// Get today's date string
function getTodayStr() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Get current session (April to March)
function getCurrentSession() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  if (month >= 4) {
    return `${year}-${year + 1}`;
  } else {
    return `${year - 1}-${year}`;
  }
}

// Get last five sessions
function getLastFiveSessions() {
  const sessions = [];
  const [start, end] = getCurrentSession().split('-').map(Number);
  for (let i = 4; i >= 0; i--) {
    sessions.push(`${start - i}-${end - i}`);
  }
  return sessions;
}

// Voucher types
const VOUCHER_TYPES = [
  { value: "all", label: "All" },
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment" },
  { value: "contra", label: "Contra" },
  { value: "journal", label: "Journal" },
  { value: "credit_note", label: "Credit Note" },
  { value: "debit_note", label: "Debit Note" },
];

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function VouchersPage() {
  // State
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [companyDetails, setCompanyDetails] = useState(null);
  const invoiceRef = useRef(null);
  // Persist voucher type selection in localStorage - default to 'all' to show all vouchers
  const [type, setType] = useState(() => {
    return localStorage.getItem('voucherType') || "all";
  });
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [daybook, setDaybook] = useState(false);
  const [session, setSession] = useState(() => getCurrentSession());
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sortOrder, setSortOrder] = useState("desc"); // "asc" or "desc" for date sorting
  const [partyLedgerDetails, setPartyLedgerDetails] = useState(null);
  
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const sessionOptions = [...getLastFiveSessions(), 'Custom'];

  // Reset on mount
  useEffect(() => {
    setSession(getCurrentSession());
    setFromDate("");
    setToDate("");
    setDaybook(false);
  }, []);

  // Persist type selection to localStorage
  useEffect(() => {
    localStorage.setItem('voucherType', type);
  }, [type]);

  // Fetch company details
  useEffect(() => {
    async function fetchCompany() {
      try {
        const res = await axios.get('/api/vouchers/company');
        setCompanyDetails(res.data);
      } catch (err) {
        console.error('Failed to fetch company details:', err.message);
      }
    }
    fetchCompany();
  }, []);

  // Fetch party ledger details when a voucher is selected
  useEffect(() => {
    async function fetchPartyLedger() {
      if (!selectedVoucher) {
        setPartyLedgerDetails(null);
        return;
      }
      const partyName = selectedVoucher.party_ledger || selectedVoucher.PARTYLEDGERNAME || 
                        selectedVoucher.LEDGERNAME || selectedVoucher.PARTYNAME || 
                        selectedVoucher.ledger_name || '';
      if (!partyName) {
        setPartyLedgerDetails(null);
        return;
      }
      try {
        const res = await axios.get(`/api/ledgers?search=${encodeURIComponent(partyName)}`);
        const ledgers = res.data?.ledgers || res.data || [];
        const match = ledgers.find(l => l.name === partyName);
        setPartyLedgerDetails(match || null);
      } catch (err) {
        console.error('Failed to fetch party ledger details:', err.message);
        setPartyLedgerDetails(null);
      }
    }
    fetchPartyLedger();
  }, [selectedVoucher]);

  // Fetch vouchers and compute pending amounts
  useEffect(() => {
    let cancelled = false;
        async function fetchVouchers() {
          setLoading(true);
          setError("");
          try {
            const params = new URLSearchParams({
              type,
              from: fromDate,
              to: toDate,
              search: debouncedSearch,
              daybook: daybook ? "true" : "false",
            });
            const url = `/api/vouchers?${params.toString()}`;
            const res = await axios.get(url);
            if (!cancelled) {
              let data = res.data;
              // Handle different response formats
              // Backend returns { vouchers: [...] } or direct array
              if (data && typeof data === 'object' && !Array.isArray(data)) {
                // If response has vouchers property, use it
                if (Array.isArray(data.vouchers)) {
                  data = data.vouchers;
                } else {
                  // Fallback: try to find any array in the response
                  const arrays = Object.values(data).filter(v => Array.isArray(v));
                  data = arrays.length > 0 ? arrays[0] : [];
                }
              }
              if (!Array.isArray(data)) {
                data = [];
              }
              // --- Payment Status System for Sales Vouchers (Frontend Only) ---
              if (type === 'sales') {
                let sales = data.filter(v => (v.voucher_type || '').toLowerCase() === 'sales');
                
                // Fetch ALL receipts separately to calculate payment status
                // This is needed because filtered sales data doesn't include receipts
                let allReceipts = [];
                try {
                  const receiptParams = new URLSearchParams({
                    type: 'receipt',
                    from: fromDate,
                    to: '', // Get all receipts up to now for accurate calculation
                    search: '',
                    daybook: 'false',
                  });
                  const receiptRes = await axios.get(`/api/vouchers?${receiptParams.toString()}`);
                  let receiptData = receiptRes.data;
                  if (receiptData && typeof receiptData === 'object' && !Array.isArray(receiptData)) {
                    if (Array.isArray(receiptData.vouchers)) {
                      receiptData = receiptData.vouchers;
                    } else {
                      const arrays = Object.values(receiptData).filter(v => Array.isArray(v));
                      receiptData = arrays.length > 0 ? arrays[0] : [];
                    }
                  }
                  allReceipts = Array.isArray(receiptData) ? receiptData : [];
                } catch (receiptErr) {
                  console.warn('Failed to fetch receipts for payment status:', receiptErr.message);
                }
                
                // Patch: Ensure each sales voucher has GST-inclusive total
                sales = sales.map(voucher => {
                  // If items exist and totalAmount is missing or wrong, recalculate
                  if (Array.isArray(voucher.items) && voucher.items.length > 0) {
                    let subtotal = 0, cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
                    const getStateCode = gstin => (gstin && gstin.length >= 2 ? gstin.substring(0, 2) : '');
                    const supplierGstin = voucher.supplier_gstin || voucher.company_gstin || '';
                    const buyerGstin = voucher.party_gstin || '';
                    const supplierState = getStateCode(supplierGstin);
                    const buyerState = getStateCode(buyerGstin);
                    
                    // FIXED: Handle unregistered buyers (no GSTIN) - use place of supply or state
                    let isInterState = false;
                    if (supplierGstin && buyerGstin && supplierState && buyerState) {
                      // Both parties registered: compare GSTIN state codes
                      isInterState = supplierState !== buyerState;
                    } else if (supplierGstin && supplierState) {
                      // Buyer unregistered: check place of supply or state name
                      const placeOfSupply = voucher.place_of_supply || '';
                      const partyState = voucher.party_state || voucher.buyer_state || '';
                      
                      // Try to extract state code from place of supply
                      if (placeOfSupply) {
                        const codeMatch = placeOfSupply.match(/(\d{2})/);
                        if (codeMatch && codeMatch[1] !== supplierState) {
                          isInterState = true;
                        }
                      }
                    }
                    
                    voucher.items.forEach(item => {
                      const qty = Math.abs(Number(item.qty) || 0);
                      const rate = Math.abs(Number(item.rate) || 0);
                      const gst = item.gst || {};
                      const lineAmount = qty * rate;
                      let cgstPercent = (item.CGSTPERCENT !== undefined && item.CGSTPERCENT !== 0) ? Number(item.CGSTPERCENT) : undefined;
                      let sgstPercent = (item.SGSTPERCENT !== undefined && item.SGSTPERCENT !== 0) ? Number(item.SGSTPERCENT) : undefined;
                      let igstPercent = (item.IGSTPERCENT !== undefined && item.IGSTPERCENT !== 0) ? Number(item.IGSTPERCENT) : undefined;
                      if (cgstPercent === undefined && gst.cgst) cgstPercent = Number(gst.cgst);
                      if (sgstPercent === undefined && gst.sgst) sgstPercent = Number(gst.sgst);
                      if (igstPercent === undefined && gst.igst) igstPercent = Number(gst.igst);
                      cgstPercent = cgstPercent !== undefined ? cgstPercent : 0;
                      sgstPercent = sgstPercent !== undefined ? sgstPercent : 0;
                      igstPercent = igstPercent !== undefined ? igstPercent : 0;
                      
                      // Calculate combined GST for IGST (CGST + SGST = IGST)
                      const combinedGstPercent = cgstPercent + sgstPercent;
                      
                      let lineCgst = 0, lineSgst = 0, lineIgst = 0;
                      if (isInterState) {
                        // For inter-state, use IGST (or combine CGST+SGST if IGST not specified)
                        const effectiveIgstPercent = igstPercent > 0 ? igstPercent : combinedGstPercent;
                        lineIgst = (lineAmount * effectiveIgstPercent) / 100;
                      } else if (!isInterState && (cgstPercent > 0 || sgstPercent > 0)) {
                        lineCgst = (lineAmount * cgstPercent) / 100;
                        lineSgst = (lineAmount * sgstPercent) / 100;
                      }
                      subtotal += lineAmount;
                      cgstAmount += lineCgst;
                      sgstAmount += lineSgst;
                      igstAmount += lineIgst;
                    });
                    voucher.totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;
                  }
                  return voucher;
                });
                // Use allReceipts (fetched separately) to compute payment status
                const updatedSales = computePaymentStatus(sales, allReceipts);
                data = data.map(v => {
                  if ((v.voucher_type || '').toLowerCase() === 'sales') {
                    const updated = updatedSales.find(s => s.voucher_number === v.voucher_number);
                    return updated ? updated : v;
                  }
                  return v;
                });
              }
              setVouchers(data);
            }
          } catch (err) {
            if (!cancelled) {
              setError("Failed to fetch vouchers: " + (err?.message || 'Unknown error'));
            }
          } finally {
            if (!cancelled) setLoading(false);
          }
        }
        fetchVouchers();
        return () => { cancelled = true; };
  }, [type, fromDate, toDate, debouncedSearch, daybook]);

  // Dynamic table columns based on voucher type
  const getTableColumns = () => {
    if (type === "receipt" || type === "payment") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Party Ledger" },
        { key: "party_voucher_count", label: "Party V#" },
        { key: "pay_type", label: "Pay Type" },
        { key: "amount", label: "Amount" },
      ];
    } else if (type === "sales") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Party Ledger" },
        { key: "party_voucher_count", label: "Party V#" },
        { key: "amount", label: "Amount" },
        { key: "payment_status", label: "Payment Status" },
      ];
    } else if (type === "purchase") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Party Ledger" },
        { key: "party_voucher_count", label: "Party V#" },
        { key: "supplier_ref", label: "Supp. Inv. No" },
        { key: "supplier_date", label: "Supp. Date" },
        { key: "amount", label: "Amount" },
      ];
    } else if (type === "contra") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Ledger" },
        { key: "bank_ledger", label: "Bank/Cash" },
        { key: "amount", label: "Amount" },
      ];
    } else if (type === "journal") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Party Ledger" },
        { key: "narration", label: "Narration" },
        { key: "amount", label: "Amount" },
      ];
    } else if (type === "credit_note" || type === "debit_note") {
      return [
        { key: "voucher_number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party_ledger", label: "Party Ledger" },
        { key: "reference", label: "Reference" },
        { key: "amount", label: "Amount" },
      ];
    }
    // For "all" type - show voucher type column
    return [
      { key: "voucher_number", label: "Voucher No" },
      { key: "date", label: "Date" },
      { key: "party_ledger", label: "Party Ledger" },
      { key: "voucher_type", label: "Type" },
      { key: "amount", label: "Amount" },
    ];
  };

  const tableColumns = getTableColumns();

  // Get row color based on payment status
  const getRowColor = (row) => {
    if (type !== "sales") return "";
    const status = row.payment_status || 'Pending';
    if (status === 'Paid') return "bg-green-100 dark:bg-green-900/30";
    // Pending: color by days
    const voucherDate = row.date ? new Date(row.date) : null;
    const today = new Date();
    const daysPending = voucherDate ? Math.floor((today - voucherDate) / (1000 * 60 * 60 * 24)) : 0;
    if (daysPending <= 30) return "bg-red-100 dark:bg-red-900/30";
    if (daysPending <= 90) return "bg-red-300 dark:bg-red-800/50";
    return "bg-red-500 text-white dark:bg-red-700";
  };

  // Render cell value
  const renderCellValue = (row, col) => {
    let value = row[col.key];
    if (col.key === "amount") {
        const displayAmount = getVoucherDisplayAmount(row);
        if (displayAmount === 0) {
          console.warn('Amount is 0 for row:', row);
        }
        return `₹ ${displayAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    }
    if (col.key === "date" && value) {
      return String(value).slice(0, 10);
    }
    if (col.key === "payment_status") {
      const status = row.payment_status || 'Pending';
      if (status === 'Paid') {
        return (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-green-800 dark:text-green-400">Paid</span>
          </div>
        );
      }
      // Pending: show amount and days
      const pendingAmount = typeof row.unpaid_amount === 'number' ? row.unpaid_amount : 0;
      const voucherDate = row.date ? new Date(row.date) : null;
      const today = new Date();
      const daysPending = voucherDate ? Math.floor((today - voucherDate) / (1000 * 60 * 60 * 24)) : 0;
      
      // Format days as months + days if > 30
      const formatPendingTime = (days) => {
        if (days < 30) return `${days} days`;
        const months = Math.floor(days / 30);
        const remainingDays = days % 30;
        if (months >= 12) {
          const years = Math.floor(months / 12);
          const remainingMonths = months % 12;
          if (remainingMonths === 0) return `${years} yr${years > 1 ? 's' : ''}`;
          return `${years} yr${years > 1 ? 's' : ''} ${remainingMonths} mo`;
        }
        if (remainingDays === 0) return `${months} mo`;
        return `${months} mo ${remainingDays} days`;
      };
      
      return (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-red-800 dark:text-red-400">
            Pending: ₹{pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
          <span className="text-xs text-red-800 dark:text-red-400">{formatPendingTime(daysPending)}</span>
        </div>
      );
    }
    if (col.key === "pay_type") {
      const payType = (row.pay_type || '').toLowerCase();
      const checkNo = row.check_number || '';
      const bankName = row.bank_ledger || '';
      const bankNameLower = bankName.toLowerCase();
      
      // Determine if this is a bank/cheque transaction or cash transaction
      const isBankType = payType === 'bank' || payType === 'cheque' || payType === 'dd';
      const isCashType = payType === 'cash';
      const hasBankInName = bankNameLower.includes('bank');
      const hasCashInName = bankNameLower.includes('cash');
      
      // Priority: Explicit pay_type > bank_ledger name detection
      // If payType is explicitly bank/cheque/dd, show as cheque
      if (isBankType) {
        return (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-gray-100">{bankName || 'Bank'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {checkNo ? `Cheque/DD (${checkNo})` : 'Cheque/DD'}
            </span>
          </div>
        );
      }
      
      // If payType is explicitly cash, show only "Cash" - no bank name
      if (isCashType) {
        return (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-gray-100">Cash</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Cash Payment</span>
          </div>
        );
      }
      
      // Fallback: Detect from bank_ledger name
      // If bank_ledger contains 'cash' (case-insensitive), treat as cash
      if (hasCashInName && !hasBankInName) {
        return (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-gray-100">{bankName}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Cash Payment</span>
          </div>
        );
      }
      
      // If bank_ledger contains 'bank', treat as bank/cheque
      if (hasBankInName) {
        return (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-gray-100">{bankName}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {checkNo ? `Cheque/DD (${checkNo})` : 'Cheque/DD'}
            </span>
          </div>
        );
      }
      
      // Default fallback - show raw values
      return checkNo ? `${row.pay_type || ''} (${checkNo})` : (row.pay_type || bankName || '-');
    }
    // Narration column - truncate if too long
    if (col.key === "narration") {
      const narr = value || '';
      return narr.length > 40 ? narr.substring(0, 40) + '...' : narr || '-';
    }
    // Reference column
    if (col.key === "reference") {
      return value || row.reference_no || row.SUPPLIERINVOICENO || '-';
    }
    // Supplier invoice reference for purchase vouchers
    if (col.key === "supplier_ref") {
      return row.SUPPLIERINVOICENO || row.supplier_invoice_no || row.reference || row.reference_no || '-';
    }
    // Supplier invoice date for purchase vouchers
    if (col.key === "supplier_date") {
      const supplierDate = row.SUPPLIERINVOICEDATE || row.supplier_invoice_date || row.BASICINVOICEDATE || '';
      if (!supplierDate) return '-';
      // Format the date
      try {
        const d = new Date(supplierDate);
        if (isNaN(d.getTime())) return supplierDate;
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch { return supplierDate; }
    }
    // Voucher type column (for "all" view)
    if (col.key === "voucher_type") {
      const typeMap = {
        'sales': 'Sales',
        'purchase': 'Purchase',
        'receipt': 'Receipt',
        'payment': 'Payment',
        'contra': 'Contra',
        'journal': 'Journal',
        'credit_note': 'Credit Note',
        'debit_note': 'Debit Note'
      };
      return typeMap[value?.toLowerCase()] || value || '-';
    }
    // Bank/Cash column for contra
    if (col.key === "bank_ledger") {
      return value || row.pay_type || '-';
    }
    // Party voucher count - show this voucher's sequential number for the party
    if (col.key === "party_voucher_count") {
      // Calculate how many vouchers exist for this party before this one (by date)
      const party = row.party_ledger || '';
      const voucherDate = row.date || '';
      const voucherId = row.guid || row.voucher_number || row.number || '';
      
      // Get all vouchers for this party, sorted by date ascending
      const partyVouchers = vouchers
        .filter(v => (v.party_ledger || '') === party)
        .sort((a, b) => {
          const dateA = new Date(a.date || '1900-01-01');
          const dateB = new Date(b.date || '1900-01-01');
          if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
          // If same date, sort by voucher number
          return (a.voucher_number || '').localeCompare(b.voucher_number || '');
        });
      
      // Find the index of this voucher
      const index = partyVouchers.findIndex(v => 
        (v.guid || v.voucher_number || v.number) === voucherId
      );
      
      return index >= 0 ? `#${index + 1}` : '-';
    }
    return value || '';
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-900 min-h-screen">
      {/* Inject print styles */}
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      
      {error && <div className="text-red-600 dark:text-red-400 font-bold mb-4">{error}</div>}
      <h1 className="text-2xl font-bold mb-4 text-blue-800 dark:text-blue-400">Vouchers</h1>
      
      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex flex-col min-w-[220px]">
          <div className="flex gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Session</label>
              <select
                className="border rounded px-4 py-2 min-w-[120px] text-base bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                value={session}
                onChange={e => {
                  const val = e.target.value;
                  setSession(val);
                  if (val && val !== 'Custom') {
                    const [start, end] = val.split('-').map(Number);
                    setFromDate(`${start}-04-01`);
                    setToDate(`${end}-03-31`);
                  } else {
                    setFromDate("");
                    setToDate("");
                  }
                }}
              >
                {sessionOptions.map(opt => (
                  <option key={opt} value={opt}>{opt === 'Custom' ? 'Custom (Select Dates)' : opt}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col w-full max-w-xs">
              <label className="text-xs font-semibold mb-1 text-gray-700 dark:text-gray-300">Search</label>
              <input
                className="px-3 py-2 border rounded w-full bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                placeholder="Search Customer"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">From</label>
          <input
            className="px-4 py-2 border rounded min-w-[140px] text-base bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            type="date"
            value={daybook ? getTodayStr() : fromDate}
            onChange={e => {
              setFromDate(e.target.value);
              if (session !== 'Custom') setSession('Custom');
            }}
            disabled={daybook}
          />
        </div>
        
        <div className="flex flex-col">
          <label className="text-xs font-medium mb-1 text-gray-700 dark:text-gray-300">To</label>
          <input
            className="px-4 py-2 border rounded min-w-[140px] text-base bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            type="date"
            value={daybook ? getTodayStr() : toDate}
            onChange={e => {
              setToDate(e.target.value);
              if (session !== 'Custom') setSession('Custom');
            }}
            disabled={daybook}
          />
        </div>
        
        <div className="flex flex-col justify-end h-full">
          <label className="flex items-center gap-2 font-medium mt-6 text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={daybook}
              onChange={e => {
                if (e.target.checked) {
                  setDaybook(true);
                  setFromDate(getTodayStr());
                  setToDate(getTodayStr());
                  setSession("");
                } else {
                  setDaybook(false);
                  setFromDate("");
                  setToDate("");
                }
              }}
              className="accent-blue-600 w-5 h-5 rounded"
            />
            <span>Daybook</span>
          </label>
        </div>
      </div>
      
      {/* Voucher Type Buttons and Controls */}
      <div className="flex flex-wrap gap-4 mb-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex flex-wrap gap-1">
            {VOUCHER_TYPES.map(vt => (
              <button
                key={vt.value}
                className={`px-2 py-1 rounded text-xs font-semibold border transition-all ${
                  type === vt.value
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-gray-700"
                }`}
                onClick={() => setType(vt.value)}
                type="button"
                aria-pressed={type === vt.value}
              >
                {vt.label}
              </button>
            ))}
          </div>
          
          {/* Sort by Date Button */}
          <button
            className="px-3 py-1 rounded text-xs font-semibold border bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-1"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            type="button"
            title={`Sort by date ${sortOrder === "desc" ? "ascending" : "descending"}`}
          >
            <span>Date</span>
            <span>{sortOrder === "desc" ? "↓" : "↑"}</span>
          </button>
        </div>
        
        {/* Voucher Count */}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold">{vouchers.length}</span> voucher{vouchers.length !== 1 ? 's' : ''} found
        </div>
      </div>
      
      {/* Vouchers Table */}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow">
        {loading ? (
          <div className="py-12 text-center text-blue-600 dark:text-blue-400 font-semibold">Loading vouchers...</div>
        ) : vouchers.length === 0 ? (
          <div className="py-12 text-center text-blue-400 dark:text-blue-500 font-semibold">No vouchers found</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                {tableColumns.map(col => (
                  <th key={col.key} className="px-4 py-3 text-left font-bold bg-blue-50 dark:bg-gray-700 text-blue-900 dark:text-blue-300 border-b border-gray-200 dark:border-gray-600">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...vouchers].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                const dateDiff = sortOrder === "desc" ? dateB - dateA : dateA - dateB;
                // If dates are equal, sort by voucher number
                if (dateDiff === 0) {
                  const numA = extractVoucherNumber(a.voucher_number || a.number);
                  const numB = extractVoucherNumber(b.voucher_number || b.number);
                  return sortOrder === "desc" ? numB - numA : numA - numB;
                }
                return dateDiff;
              }).map((row, idx) => {
                // Make all vouchers with items clickable (sales, purchase, credit_note, debit_note)
                const voucherTypeLC = (type || '').toLowerCase();
                const isClickable = voucherTypeLC === "sales" || voucherTypeLC === "purchase" || 
                                   voucherTypeLC === "credit_note" || voucherTypeLC === "debit_note";
                const rowColor = getRowColor(row);
                
                return (
                  <tr
                    key={row.voucher_number || row.guid || idx}
                    className={`${rowColor} transition ${isClickable ? "cursor-pointer hover:bg-blue-100 dark:hover:bg-gray-700" : "hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                    onClick={isClickable ? () => setSelectedVoucher(row) : undefined}
                  >
                    {tableColumns.map(col => (
                      <td key={col.key} className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-gray-900 dark:text-gray-100">
                        {renderCellValue(row, col)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* GST Invoice Modal */}
      {selectedVoucher && (() => {
        const v = selectedVoucher;
        // Debug: log selected voucher and supplier invoice fields
        console.log('Selected voucher:', v);
        console.log('Supplier Invoice Fields:', {
          SUPPLIERINVOICENO: v.SUPPLIERINVOICENO,
          BASICINVOICENO: v.BASICINVOICENO,
          BASICSHIPPINGINVOICENO: v.BASICSHIPPINGINVOICENO
        });
        const items = Array.isArray(v.items) ? v.items : [];
        const ledgers = Array.isArray(v.ledgers) ? v.ledgers : [];
        const narration = v.narration || '';
        const voucherNo = v.voucher_number || v.number || '';
        const invoiceDate = v.date ? String(v.date).slice(0, 10) : '';
        // Supplier/Buyer mapping:
        // STRICT supplier/buyer assignment (do not change data extraction)
        const company = companyDetails || {};
        const companyName = company.company_name || company.formal_name || '';
        const companyAddress = company.address || '';
        const companyGstin = company.gstin || v.company_gstin || '';
        const companyMobile = company.mobile || '';
        let supplierName = '', supplierGstin = '', supplierAddress = '';
        let buyerName = '', buyerGstin = '', buyerAddress = '';
        if (String(v.voucher_type).toLowerCase() === 'sales') {
          supplierName = companyName;
          supplierGstin = companyGstin;
          supplierAddress = companyAddress;
          buyerName = v.party_ledger || v.PARTYLEDGERNAME || v.LEDGERNAME || v.PARTYNAME || v.ledger_name || v.supplier_ledger || v.party || '';
          buyerGstin = v.party_gstin || v.PARTYGSTIN || v.supplier_gstin || (partyLedgerDetails?.gstin || '');
          buyerAddress = v.party_address || v.BILLTO || v.supplier_address || (partyLedgerDetails?.address || '');
        } else if (String(v.voucher_type).toLowerCase() === 'purchase') {
          buyerName = companyName;
          buyerGstin = companyGstin;
          buyerAddress = companyAddress;
          supplierName = v.party_ledger || v.PARTYLEDGERNAME || v.LEDGERNAME || v.PARTYNAME || v.ledger_name || v.supplier_ledger || v.party || '';
          supplierGstin = v.party_gstin || v.PARTYGSTIN || v.supplier_gstin || (partyLedgerDetails?.gstin || '');
          supplierAddress = v.party_address || v.BILLTO || v.supplier_address || (partyLedgerDetails?.address || '');
        } else {
          supplierName = v.party_ledger || v.PARTYLEDGERNAME || v.LEDGERNAME || v.PARTYNAME || v.ledger_name || v.supplier_ledger || v.party || '';
          supplierGstin = v.party_gstin || v.PARTYGSTIN || v.supplier_gstin || (partyLedgerDetails?.gstin || '');
          supplierAddress = v.party_address || v.BILLTO || v.supplier_address || (partyLedgerDetails?.address || '');
          buyerName = companyName;
          buyerGstin = companyGstin;
          buyerAddress = companyAddress;
        }
        // Supplier invoice number from XML: SUPPLIERINVOICENO, BASICINVOICENO, BASICSHIPPINGINVOICENO
        const supplierInvoiceNo = v.SUPPLIERINVOICENO || v.BASICINVOICENO || v.BASICSHIPPINGINVOICENO || '';
        // Remove voucher type from invoice output (do not use anywhere below)
        // Amount calculations
        // Line item amount = Qty × Rate, no negative unless credit note
        let subtotal = 0;
        let cgstAmount = 0;
        let sgstAmount = 0;
        let igstAmount = 0;
        // GST classification: only one type per line (IGST or CGST+SGST)
        // Determine GST state codes for supplier and buyer
        const getStateCode = gstin => (gstin && gstin.length >= 2 ? gstin.substring(0, 2) : '');
        const supplierState = getStateCode(supplierGstin);
        const buyerState = getStateCode(buyerGstin);
        
        // Get place of supply and party state for unregistered buyers
        const placeOfSupply = v.place_of_supply || v.placeofsupply || '';
        const partyState = v.party_state || v.buyer_state || '';
        const consigneeState = v.consignee_state || '';
        
        // Determine if inter-state transaction
        // FIXED: For unregistered firms (no GSTIN), use place of supply or state name to determine
        // inter-state vs intra-state. If buyer has no GSTIN but is from different state, use IGST.
        let isInterState = false;
        
        if (supplierGstin && buyerGstin && supplierState && buyerState) {
          // Both parties registered: compare GSTIN state codes
          isInterState = supplierState !== buyerState;
        } else if (supplierGstin && supplierState) {
          // Buyer unregistered: check place of supply or state name
          // Extract state code from place of supply if available (format: "State - Code" or just state name)
          let derivedBuyerStateCode = '';
          
          // Try to extract state code from place of supply
          if (placeOfSupply) {
            const codeMatch = placeOfSupply.match(/(\d{2})/);
            if (codeMatch) {
              derivedBuyerStateCode = codeMatch[1];
            }
          }
          
          // Fallback: Check if buyer/consignee state name differs from supplier state
          if (!derivedBuyerStateCode) {
            // Get supplier state name from company details
            const companyStateName = (company.state || '').toLowerCase().trim();
            const buyerStateName = (partyState || consigneeState || '').toLowerCase().trim();
            
            // If state names are available and different, it's inter-state
            if (companyStateName && buyerStateName && companyStateName !== buyerStateName) {
              isInterState = true;
            }
          } else {
            // Compare derived state code with supplier state code
            isInterState = derivedBuyerStateCode !== supplierState;
          }
        }

        const computedItems = items.map(item => {
          const qty = Math.abs(Number(item.qty) || 0);
          const rate = Math.abs(Number(item.rate) || 0);
          const gst = item.gst || {};
          const lineAmount = qty * rate;
          // Robust GST percent extraction
          let cgstPercent = (item.CGSTPERCENT !== undefined && item.CGSTPERCENT !== 0) ? Number(item.CGSTPERCENT) : undefined;
          let sgstPercent = (item.SGSTPERCENT !== undefined && item.SGSTPERCENT !== 0) ? Number(item.SGSTPERCENT) : undefined;
          let igstPercent = (item.IGSTPERCENT !== undefined && item.IGSTPERCENT !== 0) ? Number(item.IGSTPERCENT) : undefined;
          if (cgstPercent === undefined && gst.cgst) cgstPercent = Number(gst.cgst);
          if (sgstPercent === undefined && gst.sgst) sgstPercent = Number(gst.sgst);
          if (igstPercent === undefined && gst.igst) igstPercent = Number(gst.igst);
          cgstPercent = cgstPercent !== undefined ? cgstPercent : 0;
          sgstPercent = sgstPercent !== undefined ? sgstPercent : 0;
          igstPercent = igstPercent !== undefined ? igstPercent : 0;
          
          // Calculate combined GST rate for IGST (CGST + SGST = IGST)
          const combinedGstPercent = cgstPercent + sgstPercent;
          
          let lineCgst = 0, lineSgst = 0, lineIgst = 0;
          // GST logic: 
          // - Inter-state (including unregistered buyers from different state): Use IGST
          // - Intra-state: Use CGST + SGST
          if (isInterState) {
            // For inter-state, use IGST rate (or combine CGST+SGST if IGST not specified)
            const effectiveIgstPercent = igstPercent > 0 ? igstPercent : combinedGstPercent;
            lineIgst = (lineAmount * effectiveIgstPercent) / 100;
          } else if (!isInterState && (cgstPercent > 0 || sgstPercent > 0)) {
            lineCgst = (lineAmount * cgstPercent) / 100;
            lineSgst = (lineAmount * sgstPercent) / 100;
          }
          subtotal += lineAmount;
          cgstAmount += lineCgst;
          sgstAmount += lineSgst;
          igstAmount += lineIgst;
          return { ...item, amount: lineAmount, cgst: lineCgst, sgst: lineSgst, igst: lineIgst, cgstPercent, sgstPercent, igstPercent, isInterState };
        });
        let totalAmount = subtotal + cgstAmount + sgstAmount + igstAmount;
        if (v.voucher_type === 'credit_note' || v.type === 'credit_note') {
          // Allow negative for credit note
        } else {
          subtotal = Math.abs(subtotal);
          cgstAmount = Math.abs(cgstAmount);
          sgstAmount = Math.abs(sgstAmount);
          igstAmount = Math.abs(igstAmount);
          totalAmount = Math.abs(totalAmount);
        }
        
        return (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center print:!bg-transparent" 
            style={{ background: "rgba(0,0,0,0.5)" }} 
            onClick={() => setSelectedVoucher(null)}
          >
            <div 
              className="bg-white border border-gray-400 flex flex-col shadow-xl print:!shadow-none print:!border-none" 
              style={{ width: "210mm", maxWidth: "98vw", maxHeight: "95vh", minWidth: "800px" }} 
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header - Fixed - Hidden when printing */}
              <div className="flex justify-between items-center p-4 border-b border-gray-300 bg-gray-50 print-hide">
                <h2 className="text-lg font-bold">TAX INVOICE</h2>
                <div className="flex gap-2">
                  <button 
                    className="px-3 py-1 bg-gray-600 text-white text-sm font-semibold rounded" 
                    onClick={() => setSelectedVoucher(null)}
                  >
                    Close
                  </button>
                  <button 
                    className="px-3 py-1 bg-blue-600 text-white text-sm font-semibold rounded" 
                    onClick={() => window.print()}
                  >
                    Print
                  </button>
                  <button
                    className="px-3 py-1 bg-emerald-600 text-white text-sm font-semibold rounded flex items-center gap-1"
                    onClick={() => alert('Email functionality coming soon!')}
                  >
                    <span role="img" aria-label="Email"></span> Email
                  </button>
                  <button
                    className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded flex items-center gap-1"
                    onClick={() => alert('WhatsApp functionality coming soon!')}
                  >
                    <span role="img" aria-label="WhatsApp"></span> WhatsApp
                  </button>
                </div>
              </div>
              
              {/* Scrollable Invoice Content - This is what gets printed */}
              <div ref={invoiceRef} className="invoice-print-area flex-1 overflow-auto p-6 bg-white print:!overflow-visible print:!max-h-none" style={{minWidth: '760px'}}>
                {/* Invoice Header */}
                <div className="text-center border-b border-gray-400 pb-2 mb-4">
                  <h1 className="text-xl font-bold">TAX INVOICE</h1>
                </div>
                
                {/* Supplier and Invoice Details - Enhanced Layout like Tax Invoice */}
                <div className="border border-gray-400 mb-0">
                  <div className="flex flex-nowrap">
                    {/* Left: Supplier Details */}
                    <div className="flex-1 min-w-[280px] p-3 border-r border-gray-400">
                      <p className="font-bold text-base whitespace-nowrap">{supplierName || '-'}</p>
                      <p className="text-xs">{supplierAddress || '-'}</p>
                      <p className="text-xs whitespace-nowrap"><span className="font-semibold">GSTIN/UIN:</span> {supplierGstin || '-'}</p>
                      <p className="text-xs whitespace-nowrap"><span className="font-semibold">State Name:</span> {company.state || v.party_state || '-'}{supplierState ? `, Code: ${supplierState}` : ''}</p>
                      {companyMobile && <p className="text-xs whitespace-nowrap"><span className="font-semibold">Contact:</span> {companyMobile}</p>}
                      {company.email && <p className="text-xs whitespace-nowrap"><span className="font-semibold">E-Mail:</span> {company.email}</p>}
                    </div>
                    {/* Right: Invoice Details Grid */}
                    <div className="w-[420px] flex-shrink-0">
                      <table className="w-full text-xs border-collapse table-fixed">
                        <tbody>
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold w-[90px] whitespace-nowrap">Invoice No.</td>
                            <td className="border border-gray-300 px-2 py-1 w-[120px] truncate" title={voucherNo || '-'}>{voucherNo || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold w-[80px] whitespace-nowrap">Dated</td>
                            <td className="border border-gray-300 px-2 py-1 w-[100px] whitespace-nowrap">{invoiceDate || '-'}</td>
                          </tr>
                          {(v.delivery_note || v.mode_of_payment) && (
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Delivery Note</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.delivery_note || '-'}>{v.delivery_note || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Mode/Terms</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.mode_of_payment || '-'}>{v.mode_of_payment || '-'}</td>
                          </tr>
                          )}
                          {(v.reference_no || v.reference || v.other_references) && (
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Reference No.</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.reference_no || v.reference || '-'}>{v.reference_no || v.reference || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Other Ref.</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.other_references || '-'}>{v.other_references || '-'}</td>
                          </tr>
                          )}
                          {(v.buyers_order_no || v.buyers_order_date) && (
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Buyer's Order</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.buyers_order_no || '-'}>{v.buyers_order_no || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Dated</td>
                            <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{v.buyers_order_date || '-'}</td>
                          </tr>
                          )}
                          {(v.dispatch_doc_no || v.delivery_note_date) && (
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Dispatch Doc</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.dispatch_doc_no || '-'}>{v.dispatch_doc_no || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Del. Note Date</td>
                            <td className="border border-gray-300 px-2 py-1 whitespace-nowrap">{v.delivery_note_date || '-'}</td>
                          </tr>
                          )}
                          {(v.dispatched_through || v.destination) && (
                          <tr>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Dispatched Via</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.dispatched_through || '-'}>{v.dispatched_through || '-'}</td>
                            <td className="border border-gray-300 px-2 py-1 font-semibold truncate">Destination</td>
                            <td className="border border-gray-300 px-2 py-1 truncate" title={v.destination || '-'}>{v.destination || '-'}</td>
                          </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                {/* Consignee (Ship to) and Buyer (Bill to) */}
                <div className="border border-t-0 border-gray-400 mb-0">
                  <div className="flex flex-nowrap">
                    {/* Consignee (Ship to) */}
                    <div className="flex-1 min-w-[280px] p-3 border-r border-gray-400">
                      <p className="font-semibold text-xs mb-1">Consignee (Ship to)</p>
                      <p className="font-bold text-sm whitespace-nowrap">{v.consignee_name || buyerName || '-'}</p>
                      <p className="text-xs">{v.consignee_address || buyerAddress || '-'}</p>
                      <p className="text-xs whitespace-nowrap"><span className="font-semibold">GSTIN/UIN:</span> {v.consignee_gstin || buyerGstin || 'Unregistered'}</p>
                      <p className="text-xs whitespace-nowrap"><span className="font-semibold">State Name:</span> {v.consignee_state || partyState || '-'}{v.consignee_state_code || buyerState ? `, Code: ${v.consignee_state_code || buyerState}` : ''}</p>
                      {(v.consignee_pincode || v.buyer_pincode) && <p className="text-xs whitespace-nowrap"><span className="font-semibold">PIN:</span> {v.consignee_pincode || v.buyer_pincode}</p>}
                    </div>
                    {/* Terms of Delivery */}
                    <div className="w-[420px] flex-shrink-0 p-3">
                      <p className="font-semibold text-xs mb-1">Terms of Delivery</p>
                      <p className="text-xs">{v.terms_of_delivery || '-'}</p>
                      {v.vehicle_number && <p className="text-xs mt-1"><span className="font-semibold">Vehicle No:</span> {v.vehicle_number}</p>}
                      {v.bill_of_lading_no && <p className="text-xs"><span className="font-semibold">Bill of Lading:</span> {v.bill_of_lading_no}</p>}
                      {v.eway_bill_no && <p className="text-xs"><span className="font-semibold">E-Way Bill:</span> {v.eway_bill_no}</p>}
                      {v.dispatch_from_name && <p className="text-xs mt-1"><span className="font-semibold">Dispatch From:</span> {v.dispatch_from_name}{v.dispatch_from_place ? `, ${v.dispatch_from_place}` : ''}</p>}
                    </div>
                  </div>
                </div>
                
                {/* Buyer (Bill to) */}
                <div className="border border-t-0 border-gray-400 p-3 mb-4">
                  <p className="font-semibold text-xs mb-1">Buyer (Bill to)</p>
                  <p className="font-bold text-sm whitespace-nowrap">{buyerName || '-'}</p>
                  <p className="text-xs">{buyerAddress || '-'}</p>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <p className="whitespace-nowrap"><span className="font-semibold">GSTIN/UIN:</span> {buyerGstin || 'N/A'}</p>
                    <p className="whitespace-nowrap"><span className="font-semibold">State:</span> {v.buyer_state || partyState || 'N/A'}, <span className="font-semibold">Code:</span> {v.buyer_state_code || buyerState || 'N/A'}</p>
                    <p className="whitespace-nowrap"><span className="font-semibold">Place of Supply:</span> {placeOfSupply || 'N/A'}</p>
                  </div>
                </div>
                
                {/* Items Table */}
                <div className="border border-gray-400 mb-2 print:break-inside-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 w-10 text-center" style={{minHeight:32}}>Sl</th>
                        <th className="border border-gray-300 p-2 text-left" style={{minHeight:32}}>Description</th>
                        <th className="border border-gray-300 p-2 w-20 text-center" style={{minHeight:32}}>HSN/SAC</th>
                        <th className="border border-gray-300 p-2 w-16 text-center" style={{minHeight:32}}>Qty</th>
                        <th className="border border-gray-300 p-2 w-12 text-center" style={{minHeight:32}}>Per</th>
                        <th className="border border-gray-300 p-2 w-20 text-right" style={{minHeight:32}}>Rate</th>
                        <th className="border border-gray-300 p-2 w-24 text-right" style={{minHeight:32}}>Amount</th>
                        <th className="border border-gray-300 p-2 w-32 text-center" style={{minHeight:32}}>GST (CGST/SGST/IGST)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computedItems.length > 0 ? computedItems.map((item, idx) => (
                        <tr key={idx} style={{minHeight:32}}>
                          <td className="border border-gray-300 p-2 text-center" style={{minHeight:32}}>{idx + 1}</td>
                          <td className="border border-gray-300 p-2" style={{minHeight:32}}>{item.name || ''}</td>
                          <td className="border border-gray-300 p-2 text-center" style={{minHeight:32}}>{item.hsn || ''}</td>
                          <td className="border border-gray-300 p-2 text-center" style={{minHeight:32}}>{item.qty || ''}</td>
                          <td className="border border-gray-300 p-2 text-center" style={{minHeight:32}}>{item.per || ''}</td>
                          <td className="border border-gray-300 p-2 text-right" style={{minHeight:32}}>₹{(item.rate || 0).toFixed(2)}</td>
                          <td className="border border-gray-300 p-2 text-right" style={{minHeight:32}}>₹{(item.amount || 0).toFixed(2)}</td>
                                <td className="border border-gray-300 p-2 text-center" style={{minHeight:32}}>
                                    {/* GST Percent Row: Show CGST/SGST/IGST percent from backend fields, fallback to item.gst if missing */}
                                    {(() => {
                                      let cgstPercent = item.CGSTPERCENT !== undefined ? Number(item.CGSTPERCENT) : undefined;
                                      let sgstPercent = item.SGSTPERCENT !== undefined ? Number(item.SGSTPERCENT) : undefined;
                                      let igstPercent = item.IGSTPERCENT !== undefined ? Number(item.IGSTPERCENT) : undefined;
                                      // Fallback to item.gst if percent is missing or zero
                                      if ((cgstPercent === undefined || cgstPercent === 0) && item.gst && item.gst.cgst) {
                                        cgstPercent = Number(item.gst.cgst);
                                      }
                                      if ((sgstPercent === undefined || sgstPercent === 0) && item.gst && item.gst.sgst) {
                                        sgstPercent = Number(item.gst.sgst);
                                      }
                                      if ((igstPercent === undefined || igstPercent === 0) && item.gst && item.gst.igst) {
                                        igstPercent = Number(item.gst.igst);
                                      }
                                      // Default to 0 if still undefined
                                      cgstPercent = cgstPercent !== undefined ? cgstPercent : 0;
                                      sgstPercent = sgstPercent !== undefined ? sgstPercent : 0;
                                      igstPercent = igstPercent !== undefined ? igstPercent : 0;
                                      return `${cgstPercent}/${sgstPercent}/${igstPercent}%`;
                                    })()}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-gray-500">No items found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* HSN/SAC Summary Table */}
                {computedItems.length > 0 && (
                <div className="w-full mb-2">
                  <p className="text-xs font-semibold mb-1">HSN/SAC Summary</p>
                  <table className="border border-gray-400 text-xs w-full">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-1 text-left">HSN/SAC</th>
                        <th className="border border-gray-300 p-1 text-right">Taxable Value</th>
                        <th className="border border-gray-300 p-1 text-center">GST Rate</th>
                        <th className="border border-gray-300 p-1 text-right">CGST</th>
                        <th className="border border-gray-300 p-1 text-right">SGST</th>
                        <th className="border border-gray-300 p-1 text-right">IGST</th>
                        <th className="border border-gray-300 p-1 text-right">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Group items by HSN
                        const hsnGroups = {};
                        computedItems.forEach(item => {
                          const hsn = item.hsn || 'N/A';
                          if (!hsnGroups[hsn]) {
                            hsnGroups[hsn] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: (item.cgstPercent || 0) + (item.sgstPercent || 0) || (item.igstPercent || 0) };
                          }
                          hsnGroups[hsn].taxable += (item.amount || 0);
                          hsnGroups[hsn].cgst += (item.cgst || 0);
                          hsnGroups[hsn].sgst += (item.sgst || 0);
                          hsnGroups[hsn].igst += (item.igst || 0);
                        });
                        return Object.entries(hsnGroups).map(([hsn, data]) => (
                          <tr key={hsn}>
                            <td className="border border-gray-300 p-1">{hsn}</td>
                            <td className="border border-gray-300 p-1 text-right">₹{data.taxable.toFixed(2)}</td>
                            <td className="border border-gray-300 p-1 text-center">{data.rate}%</td>
                            <td className="border border-gray-300 p-1 text-right">₹{data.cgst.toFixed(2)}</td>
                            <td className="border border-gray-300 p-1 text-right">₹{data.sgst.toFixed(2)}</td>
                            <td className="border border-gray-300 p-1 text-right">₹{data.igst.toFixed(2)}</td>
                            <td className="border border-gray-300 p-1 text-right">₹{(data.cgst + data.sgst + data.igst).toFixed(2)}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
                )}
                
                {/* GST Summary Sub-Table (after items, before Amount in Words) */}
                <div className="w-full mb-2">
                  <table className="border border-gray-400 rounded bg-gray-50 text-xs w-full">
                    <thead>
                      <tr>
                        <th className="p-2 text-left">GST Type</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cgstAmount > 0 && (
                        <tr>
                          <td className="p-2">CGST</td>
                          <td className="p-2 text-right">₹{cgstAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      {sgstAmount > 0 && (
                        <tr>
                          <td className="p-2">SGST</td>
                          <td className="p-2 text-right">₹{sgstAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      {igstAmount > 0 && (
                        <tr>
                          <td className="p-2">IGST</td>
                          <td className="p-2 text-right">₹{igstAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      {(cgstAmount <= 0 && sgstAmount <= 0 && igstAmount <= 0) && (
                        <tr>
                          <td className="p-2 text-center" colSpan={2}>No GST applied</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {/* Totals and Amount in Words */}
                <div className="border border-gray-400 p-3">
                  <div className="flex">
                    <div className="flex-1 pr-4">
                      <p className="font-semibold text-xs">Amount in Words:</p>
                      <p className="text-sm">{numberToWords(totalAmount)}</p>
                      {narration && (
                        <p className="mt-2 text-xs"><span className="font-semibold">Narration:</span> {narration}</p>
                      )}
                    </div>
                    <div className="w-64 border-l border-gray-300 pl-4 text-xs">
                      <div className="flex justify-between border-b border-gray-200 py-1">
                        <span>Subtotal</span>
                        <span>₹{subtotal.toFixed(2)}</span>
                      </div>
                      {/* GST Totals Breakdown: Show IGST or CGST+SGST only, not both */}
                      {igstAmount > 0 ? (
                        <div className="flex justify-between border-b border-gray-200 py-1">
                          <span>IGST</span>
                          <span>₹{igstAmount.toFixed(2)}</span>
                        </div>
                      ) : null}
                      {(cgstAmount > 0 || sgstAmount > 0) && igstAmount === 0 ? (
                        <>
                          {cgstAmount > 0 && (
                            <div className="flex justify-between border-b border-gray-200 py-1">
                              <span>CGST</span>
                              <span>₹{cgstAmount.toFixed(2)}</span>
                            </div>
                          )}
                          {sgstAmount > 0 && (
                            <div className="flex justify-between border-b border-gray-200 py-1">
                              <span>SGST</span>
                              <span>₹{sgstAmount.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      ) : null}
                      <div className="flex justify-between font-bold pt-2">
                        <span>Total</span>
                        <span>₹{totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Signature Block */}
                <div className="mt-6 flex justify-between items-end text-xs">
                  <div>
                    <div className="h-12"></div>
                    <p>Receiver's Signature</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold mb-1">For {companyName || 'Company'}</p>
                    <div className="h-12"></div>
                    <p>Authorized Signatory</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
