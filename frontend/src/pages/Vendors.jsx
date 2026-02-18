import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { 
  UserCheck, 
  CreditCard, 
  Wallet, 
  Landmark, 
  Search, 
  RefreshCw,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  TrendingUp,
  TrendingDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

// Card configuration for each vendor group
const VENDOR_CARDS = [
  {
    key: "sundry-debtors",
    name: "Sundry Debtors",
    icon: UserCheck,
    color: "blue",
    bgLight: "bg-blue-50",
    bgDark: "dark:bg-blue-900/20",
    textLight: "text-blue-700",
    textDark: "dark:text-blue-400",
    borderLight: "border-blue-200",
    borderDark: "dark:border-blue-800",
    description: "Customers who owe you money"
  },
  {
    key: "sundry-creditors",
    name: "Sundry Creditors",
    icon: CreditCard,
    color: "orange",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-900/20",
    textLight: "text-orange-700",
    textDark: "dark:text-orange-400",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
    description: "Suppliers you owe money to"
  },
  {
    key: "cash",
    name: "Cash",
    icon: Wallet,
    color: "green",
    bgLight: "bg-green-50",
    bgDark: "dark:bg-green-900/20",
    textLight: "text-green-700",
    textDark: "dark:text-green-400",
    borderLight: "border-green-200",
    borderDark: "dark:border-green-800",
    description: "Cash-in-hand accounts"
  },
  {
    key: "bank",
    name: "Bank",
    icon: Landmark,
    color: "purple",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-900/20",
    textLight: "text-purple-700",
    textDark: "dark:text-purple-400",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-800",
    description: "Bank accounts"
  }
];

// Format currency
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  const isNegative = num < 0;
  const formatted = Math.abs(num).toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  return isNegative ? `- ₹${formatted}` : `₹${formatted}`;
}

// Summary Cards View (main vendors page)
function VendorSummaryCards() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get('/api/vendors/summary');
      setSummary(res.data.summary);
    } catch (err) {
      setError("Failed to fetch vendor summary: " + (err?.response?.data?.error || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading vendor summary...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
        {error}
        <button 
          onClick={fetchSummary}
          className="ml-4 px-3 py-1 bg-red-100 dark:bg-red-900/40 rounded hover:bg-red-200 dark:hover:bg-red-800/60"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Vendors</h1>
        <button 
          onClick={fetchSummary}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {VENDOR_CARDS.map(card => {
          const Icon = card.icon;
          const data = summary?.[card.key] || { count: 0, openingBalance: 0, closingBalance: 0 };
          const balanceChange = data.closingBalance - data.openingBalance;
          const isPositive = balanceChange >= 0;

          return (
            <div
              key={card.key}
              onClick={() => navigate(`/vendors/${card.key}`)}
              className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]
                ${card.bgLight} ${card.bgDark} ${card.borderLight} ${card.borderDark}`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bgLight} ${card.bgDark}`}>
                  <Icon className={`w-6 h-6 ${card.textLight} ${card.textDark}`} />
                </div>
                <span className={`text-2xl font-bold ${card.textLight} ${card.textDark}`}>
                  {data.count}
                </span>
              </div>
              
              <h3 className={`text-lg font-semibold mb-1 ${card.textLight} ${card.textDark}`}>
                {card.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {card.description}
              </p>

              <div className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Closing Balance</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(data.closingBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Change</span>
                  <span className={`flex items-center gap-1 font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(Math.abs(balanceChange))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Ledger List View (for specific vendor group)
function LedgerListView({ groupKey }) {
  const [ledgers, setLedgers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLedger, setSelectedLedger] = useState(null);
  const navigate = useNavigate();

  const cardConfig = VENDOR_CARDS.find(c => c.key === groupKey) || VENDOR_CARDS[0];
  const Icon = cardConfig.icon;

  useEffect(() => {
    fetchLedgers();
  }, [groupKey, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLedgers();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLedgers = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ search, page, limit: 20 });
      const res = await axios.get(`/api/vendors/ledgers/${groupKey}?${params}`);
      setLedgers(res.data.ledgers || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError("Failed to fetch ledgers: " + (err?.response?.data?.error || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/vendors')}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className={`p-3 rounded-lg ${cardConfig.bgLight} ${cardConfig.bgDark}`}>
          <Icon className={`w-6 h-6 ${cardConfig.textLight} ${cardConfig.textDark}`} />
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${cardConfig.textLight} ${cardConfig.textDark}`}>
            {cardConfig.name}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">{total} ledgers found</p>
        </div>
      </div>

      {/* Search & Refresh */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, address, or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button 
          onClick={fetchLedgers}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Ledgers Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : ledgers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500 dark:text-gray-400">
            <Building2 className="w-12 h-12 mb-3 opacity-50" />
            <p>No ledgers found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Contact</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Opening</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Closing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ledgers.map((ledger, idx) => (
                <tr 
                  key={ledger.name || idx}
                  onClick={() => setSelectedLedger(ledger)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{ledger.name}</div>
                    {ledger.gstin && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">GSTIN: {ledger.gstin}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-400">
                      {ledger.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {ledger.phone}
                        </span>
                      )}
                      {ledger.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {ledger.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${(ledger.opening_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {formatCurrency(ledger.opening_balance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${(ledger.closing_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                      {formatCurrency(ledger.closing_balance)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Ledger Detail Modal */}
      {selectedLedger && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedLedger(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selectedLedger.name}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedLedger.parent}</p>
              </div>
              <button
                onClick={() => setSelectedLedger(null)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {selectedLedger.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLedger.address}</p>
                  </div>
                </div>
              )}
              
              {selectedLedger.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLedger.phone}</p>
                  </div>
                </div>
              )}
              
              {selectedLedger.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLedger.email}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {selectedLedger.gstin && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLedger.gstin}</p>
                  </div>
                )}
                {selectedLedger.pan && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">PAN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{selectedLedger.pan}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Opening Balance</p>
                  <p className={`text-xl font-bold ${(selectedLedger.opening_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(selectedLedger.opening_balance)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Closing Balance</p>
                  <p className={`text-xl font-bold ${(selectedLedger.closing_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(selectedLedger.closing_balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Vendors Component
export default function Vendors() {
  const { group } = useParams();

  // If a group is specified, show ledger list
  if (group) {
    return (
      <div className="p-6 min-h-screen">
        <LedgerListView groupKey={group} />
      </div>
    );
  }

  // Otherwise show summary cards
  return (
    <div className="p-6 min-h-screen">
      <VendorSummaryCards />
    </div>
  );
}
