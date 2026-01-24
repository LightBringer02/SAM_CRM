import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";


function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

const VOUCHER_TYPES = [
  { value: "sales", label: "Sales" },
  { value: "purchase", label: "Purchase" },
  { value: "receipt", label: "Receipt" },
  { value: "payment", label: "Payment" },
];

export default function VouchersPage() {
  try {
    // Modal state
    const [selectedVoucher, setSelectedVoucher] = useState(null);
    const [type, setType] = useState("sales");
    // Date state and helpers
    function getTodayStr() {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [search, setSearch] = useState("");
    const [daybook, setDaybook] = useState(false);
    // Session logic
    function getCurrentSession() {
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth() + 1;
      // Session starts in April
      if (month >= 4) {
        return `${year}-${year + 1}`;
      } else {
        return `${year - 1}-${year}`;
      }
    }
    function getLastFiveSessions() {
      const sessions = [];
      let [start, end] = getCurrentSession().split('-').map(Number);
      for (let i = 4; i >= 0; i--) {
        const s = `${start - i}-${end - i}`;
        sessions.push(s);
      }
      return sessions;
    }
    // Add 'Custom' option to session dropdown
    const sessionOptions = [...getLastFiveSessions(), 'Custom'];
    const [session, setSession] = useState(() => getCurrentSession());

    // Always reset to current session on mount (first load)
    useEffect(() => {
      setSession(getCurrentSession());
      setFromDate("");
      setToDate("");
      setDaybook(false);
    }, []);
    const [vouchers, setVouchers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const debouncedSearch = useDebounce(search, 400);
    const navigate = useNavigate();

    // DEBUG: Log the payload that will be sent to the backend
    function logVoucherFetchPayload(payload) {
      console.log('[DEBUG] Fetching vouchers with payload:', JSON.stringify(payload, null, 2));
    }

    useEffect(() => {
      let cancelled = false;
      async function fetchVouchers() {
        setLoading(true);
        setError("");
        // Build the payload as per strict filter requirements
        const payload = {
          search: search || null,
          from_date: fromDate || null,
          to_date: toDate || null,
          session: session || null,
          type: type ? type.charAt(0).toUpperCase() + type.slice(1) : null
        };
        logVoucherFetchPayload(payload);
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
            if (!Array.isArray(data)) {
              // Try to convert object to array or fallback to []
              if (data && typeof data === 'object') {
                data = Object.values(data);
              } else {
                data = [];
              }
            }
            // No alert for empty data; just show empty state in UI
            console.log('Fetched vouchers:', data);
            setVouchers(data);
          }
        } catch (err) {
          if (!cancelled) {
            setError("Failed to fetch vouchers: " + (err?.message || 'Unknown error'));
            // eslint-disable-next-line no-alert
            alert('Error fetching vouchers: ' + (err?.message || err));
            console.error('Error fetching vouchers:', err);
          }
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
      fetchVouchers();
      return () => { cancelled = true; };
    }, [type, fromDate, toDate, debouncedSearch, daybook]);

  // Dynamically set columns based on voucher type
  let tableColumns = [
    { key: "voucher_number", label: "Voucher No" },
    { key: "date", label: "Date" },
    { key: "party_ledger", label: "Party Ledger" },
    { key: "voucher_type", label: "Voucher Type" },
    { key: "amount", label: "Amount" },
  ];
  if (type === "receipt" || type === "payment") {
    tableColumns = [
      { key: "voucher_number", label: "Voucher No" },
      { key: "date", label: "Date" },
      { key: "party_ledger", label: "Party Ledger" },
      { key: "pay_type", label: "Pay Type" },
      { key: "check_number", label: "Check Number" },
      { key: "amount", label: "Amount" },
    ];
  } else if (type === "sales") {
    tableColumns = [
      { key: "voucher_number", label: "Voucher No" },
      { key: "date", label: "Date" },
      { key: "party_ledger", label: "Party Ledger" },
      { key: "voucher_type", label: "Voucher Type" },
      { key: "amount", label: "Amount" },
      { key: "payment_status_combined", label: "Payment Status" },
    ];
  }

  // Track payment status and paid amount for sales vouchers
  const [paymentStatusMap, setPaymentStatusMap] = useState({}); // {voucher_number: status}
  const [paidAmountMap, setPaidAmountMap] = useState({}); // {voucher_number: paidAmount}

    return (
      <div className="p-6 bg-white min-h-screen">
      {error && <div style={{color:'red',fontWeight:'bold',marginBottom:16}}>{error}</div>}
      <h1 className="text-2xl font-bold mb-4 text-blue-800">Vouchers</h1>
      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        {/* Session & Search Group */}
        <div className="flex flex-col min-w-[220px]">
          <div className="flex gap-2">
            <div className="flex flex-col">
              <label className="text-xs font-semibold mb-1">Session</label>
              <select
                className="border rounded px-4 py-2 min-w-[120px] text-base"
                value={session}
                onChange={e => {
                  const val = e.target.value;
                  setSession(val);
                  if (val && val !== 'Custom') {
                    const [start, end] = val.split('-').map(Number);
                    setFromDate(`${start}-04-01`); // 01-04-YYYY
                    setToDate(`${end}-03-31`);    // 31-03-(YYYY+1)
                  } else if (val === 'Custom') {
                    setFromDate("");
                    setToDate("");
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
              <label className="text-xs font-semibold mb-1">Search</label>
              <input
                className="px-3 py-2 border rounded w-full"
                placeholder="Search Customer"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        {/* From Date with label */}
        <div className="flex flex-col">
          <label htmlFor="from-date" className="text-xs font-medium mb-1">From</label>
          <input
            id="from-date"
            className="px-4 py-2 border rounded min-w-[140px] text-base"
            type="date"
            placeholder="From Date"
            value={daybook ? getTodayStr() : fromDate}
            onChange={e => {
              setFromDate(e.target.value);
              if (session && session !== 'Custom') setSession('Custom');
            }}
            disabled={daybook}
          />
        </div>
        {/* To Date with label */}
        <div className="flex flex-col">
          <label htmlFor="to-date" className="text-xs font-medium mb-1">To</label>
          <input
            id="to-date"
            className="px-4 py-2 border rounded min-w-[140px] text-base"
            type="date"
            placeholder="To Date"
            value={daybook ? getTodayStr() : toDate}
            onChange={e => {
              setToDate(e.target.value);
              if (session && session !== 'Custom') setSession('Custom');
            }}
            disabled={daybook}
          />
        </div>
        {/* Daybook checkbox aligned horizontally */}
        <div className="flex flex-col justify-end h-full">
          <label className="flex items-center gap-2 font-medium mt-6">
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
            <span>Daybook (Today only)</span>
          </label>
        </div>
      </div>
      {/* Voucher Type (smaller buttons) */}
      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex gap-1">
          {VOUCHER_TYPES.map(vt => (
            <button
              key={vt.value}
              className={`px-2 py-1 rounded text-sm font-semibold border ${
                type === vt.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-blue-700 border-blue-300 hover:bg-blue-50"
              }`}
              onClick={() => setType(vt.value)}
              type="button"
              style={{ minWidth: 60 }}
            >
              {vt.label}
            </button>
          ))}
        </div>
      </div>
      {/* Table */}
      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow">
        {loading ? (
          <div className="py-12 text-center text-blue-600 font-semibold">Loading vouchers...</div>
        ) : error ? (
          <div className="py-12 text-center text-red-500 font-semibold">{error}</div>
        ) : vouchers.length === 0 ? (
          <div className="py-12 text-center text-blue-400 font-semibold">No vouchers found</div>
        ) : (
          <table className="min-w-full">
            <thead>
              <tr>
                {tableColumns.map(col => (
                  <th
                    key={col.key}
                    className="px-4 py-3 text-left font-bold bg-blue-50 text-blue-900 border-b border-gray-200"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v, idx) => {
                // All rows clickable for now (or add logic if needed)
                // Add voucher_type from raw if not present
                const row = { ...v };
                if (!row.voucher_type && row.raw && row.raw.VOUCHERTYPENAME) {
                  row.voucher_type = row.raw.VOUCHERTYPENAME;
                }
                // For sales, set default payment status and paid amount if not set
                if (type === "sales") {
                  if (!paymentStatusMap[row.voucher_number]) {
                    paymentStatusMap[row.voucher_number] = "Pending";
                  }
                  if (!paidAmountMap[row.voucher_number]) {
                    paidAmountMap[row.voucher_number] = "";
                  }
                }
                return (
                  <tr
                    key={row.voucher_number || row.id || idx}
                    className={
                      (idx % 2 ? "bg-gray-50" : "bg-white") +
                      " cursor-pointer hover:bg-blue-100 transition"
                    }
                    // Only open details if not clicking inside payment status cell (for sales)
                    onClick={e => {
                      // If sales and click is inside payment status cell, do nothing
                      if (
                        type === "sales" &&
                        e.target.closest(".payment-status-cell")
                      ) {
                        return;
                      }
                      setSelectedVoucher(row);
                    }}
                  >
                    {tableColumns.map(col => {
                      let value = row[col.key];
                      if (col.key === "date" && value) {
                        value = String(value).slice(0, 10); // YYYY-MM-DD
                      }
                      // Combined Payment Status column for sales
                      if (type === "sales" && col.key === "payment_status_combined") {
                        const status = paymentStatusMap[row.voucher_number] || "Pending";
                        return (
                          <td key={col.key} className="px-4 py-2 border-b border-gray-100 payment-status-cell" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <select
                                value={status}
                                onChange={e => {
                                  setPaymentStatusMap(prev => ({ ...prev, [row.voucher_number]: e.target.value }));
                                  // If status is set to Paid, clear paid amount
                                  if (e.target.value !== "Pending") {
                                    setPaidAmountMap(prev => ({ ...prev, [row.voucher_number]: "" }));
                                  }
                                }}
                                className="border rounded px-2 py-1"
                              >
                                <option value="Pending">Pending</option>
                                <option value="Paid">Paid</option>
                              </select>
                              {status === "Pending" ? (
                                <input
                                  type="number"
                                  min="0"
                                  max={row.amount}
                                  value={paidAmountMap[row.voucher_number] || ""}
                                  onChange={e => {
                                    let val = e.target.value;
                                    if (Number(val) > Number(row.amount)) val = row.amount;
                                    setPaidAmountMap(prev => ({ ...prev, [row.voucher_number]: val }));
                                  }}
                                  placeholder="Enter paid amount"
                                  className="border rounded px-2 py-1 w-32"
                                  style={{marginLeft: 8}}
                                />
                              ) : (
                                <span className="text-green-700 font-semibold ml-2">Paid</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      return (
                        <td key={col.key} className="px-4 py-2 border-b border-gray-100">
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Voucher Details Modal (moved outside table) */}
      {selectedVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(255,255,255,0.7)'}} onClick={() => setSelectedVoucher(null)}>
          <div
            className="bg-white rounded-lg shadow-lg p-8 min-w-[600px] max-w-[900px] w-full relative flex flex-col"
            style={{aspectRatio: '4/2', maxHeight: '90vh'}}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-xl font-bold"
              onClick={() => setSelectedVoucher(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className="text-xl font-bold text-blue-800 mb-4">Voucher Details</h2>
            <div className="space-y-2 overflow-y-auto flex-1">
              {/* Show main fields */}
              {Object.entries(selectedVoucher).map(([key, value]) => {
                if (key === "raw" && value && typeof value === "object") {
                  // Show nested lists for items and ledgers
                  return (
                    <div key={key} className="mb-4">
                      <span className="font-semibold text-gray-700 capitalize min-w-[100px]">Voucher Raw Data:</span>
                      <div className="ml-4">
                        {/* Inventory Items */}
                        {Array.isArray(value["ALLINVENTORYENTRIES.LIST"]) && (
                          <div className="mb-2">
                            <span className="font-semibold text-blue-700">Items:</span>
                            <ul className="list-disc ml-6">
                              {value["ALLINVENTORYENTRIES.LIST"].map((item, i) => (
                                <li key={i} className="mb-1">
                                  <span className="font-semibold">{item.STOCKITEMNAME}</span> - Qty: {item.BILLEDQTY}, Rate: {item.RATE}, Amount: {item.AMOUNT}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Ledger Entries */}
                        {Array.isArray(value["LEDGERENTRIES.LIST"]) && (
                          <div className="mb-2">
                            <span className="font-semibold text-blue-700">Ledgers:</span>
                            <ul className="list-disc ml-6">
                              {value["LEDGERENTRIES.LIST"].map((led, i) => (
                                <li key={i} className="mb-1">
                                  <span className="font-semibold">{led.LEDGERNAME}</span> - Amount: {led.AMOUNT}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {/* Show other raw fields as JSON */}
                        <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600">Show full raw JSON</summary>
                          <pre className="bg-gray-100 p-2 rounded text-xs max-h-[300px] overflow-auto">{JSON.stringify(value, null, 2)}</pre>
                        </details>
                      </div>
                    </div>
                  );
                }
                // Show normal fields
                return (
                  <div key={key} className="flex gap-2">
                    <span className="font-semibold text-gray-700 capitalize min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
                    <span className="text-gray-900">{String(value)}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 justify-end mt-6">
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                onClick={() => window.print()}
              >
                Print
              </button>
              <button
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                onClick={() => {
                  const data = JSON.stringify(selectedVoucher, null, 2);
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `voucher_${selectedVoucher.voucher_no || selectedVoucher.id || 'details'}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    );
  } catch (e) {
    return <div style={{color:'red',fontWeight:'bold',padding:32}}>Render error: {e.message}</div>;
  }
}
