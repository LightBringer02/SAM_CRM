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
  const [type, setType] = useState("sales");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [search, setSearch] = useState("");
  const [daybook, setDaybook] = useState(false);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(true);

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
        const res = await axios.get(`/api/vouchers?${params.toString()}`);
        if (!cancelled) setVouchers(res.data);
      } catch (err) {
        if (!cancelled) setError("Failed to fetch vouchers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchVouchers();
    return () => { cancelled = true; };
  }, [type, fromDate, toDate, debouncedSearch, daybook]);

  const isSalesOrPurchase = type === "sales" || type === "purchase";
  const tableColumns = isSalesOrPurchase
    ? [
        { key: "number", label: "Invoice No" },
        { key: "date", label: "Date" },
        { key: "party", label: "Customer" },
        { key: "type", label: "Type" },
        { key: "amount", label: "Amount" },
        { key: "action", label: "Action" },
      ]
    : [
        { key: "number", label: "Voucher No" },
        { key: "date", label: "Date" },
        { key: "party", label: "Customer" },
        { key: "paymentType", label: "Payment Type" },
        { key: "amount", label: "Amount" },
        { key: "narration", label: "Narration" },
        { key: "action", label: "Action" },
      ];

  return (
    <div className="min-h-screen bg-[#181A20] text-gray-100 px-6 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold tracking-wide">Vouchers</h1>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={daybook}
              onChange={e => setDaybook(e.target.checked)}
              className="accent-blue-500 w-5 h-5 rounded"
            />
            <span className="font-semibold text-base">Daybook</span>
          </label>
        </div>

        {/* Filters Accordion */}
        <div className="mb-6 bg-[#23262F] rounded-lg shadow border border-[#23262F]">
          <button
            className="w-full flex justify-between items-center px-5 py-3 focus:outline-none"
            onClick={() => setFiltersOpen(o => !o)}
          >
            <span className="font-semibold text-lg">Filters</span>
            <span className="text-gray-400">{filtersOpen ? "▲" : "▼"}</span>
          </button>
          {filtersOpen && (
            <div className="px-5 pb-4 pt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                  className="w-full rounded bg-[#1A1C23] border border-[#353945] px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                  className="w-full rounded bg-[#1A1C23] border border-[#353945] px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Search Customer</label>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Type customer name..."
                  className="w-full rounded bg-[#1A1C23] border border-[#353945] px-3 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Voucher Type Radio Group */}
        <div className="flex gap-4 mb-6">
          {VOUCHER_TYPES.map(vt => (
            <label
              key={vt.value}
              className={`flex items-center gap-2 px-4 py-2 rounded cursor-pointer font-semibold transition ${
                type === vt.value
                  ? "bg-blue-600 text-white"
                  : "bg-[#23262F] text-gray-300 hover:bg-[#353945]"
              }`}
            >
              <input
                type="radio"
                name="voucherType"
                value={vt.value}
                checked={type === vt.value}
                onChange={() => setType(vt.value)}
                className="accent-blue-500"
              />
              {vt.label}
            </label>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#23262F] rounded-lg shadow border border-[#23262F] overflow-x-auto">
          {loading ? (
            <div className="py-12 text-center text-blue-400 font-semibold">Loading vouchers...</div>
          ) : error ? (
            <div className="py-12 text-center text-red-400 font-semibold">{error}</div>
          ) : vouchers.length === 0 ? (
            <div className="py-12 text-center text-gray-400 font-semibold">No vouchers found</div>
          ) : (
            <table className="min-w-full">
              <thead>
                <tr>
                  {tableColumns.map(col => (
                    <th
                      key={col.key}
                      className="px-4 py-3 text-left font-bold bg-[#1A1C23] text-gray-200 border-b border-[#353945]"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v, idx) => (
                  <tr
                    key={v.number || v.id || idx}
                    className="hover:bg-[#353945] transition"
                  >
                    {tableColumns.map(col => {
                      if (col.key === "action") {
                        return (
                          <td key="action" className="px-4 py-2">
                            <button
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-semibold"
                              onClick={() => navigate(`/voucher/${v.number || v.id}`)}
                            >
                              Show
                            </button>
                          </td>
                        );
                      }
                      let value = v[col.key];
                      if (col.key === "date" && value) {
                        value = value.slice(0, 10); // YYYY-MM-DD
                      }
                      return (
                        <td key={col.key} className="px-4 py-2 border-b border-[#353945]">
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
