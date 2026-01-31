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
  ChevronRight,
  Clock,
  MessageSquare,
  Send,
  Plus,
  Save,
  X,
  AlertCircle,
  CheckCircle
} from "lucide-react";

// Card configuration for each ledger group
const LEDGER_CARDS = [
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

// Format currency with Dr/Cr suffix
function formatCurrency(amount, showDrCr = false) {
  // Parse the amount - handle string values with symbols
  let num = parseFloat(amount);
  if (isNaN(num)) num = 0;
  
  // If amount seems unreasonably large (likely in paise), divide by 100
  // This handles cases where Tally returns amounts in paise
  // Note: 1 Crore = 1,00,00,000 - if balance > 1000 Cr (10 billion paise), it's likely in paise
  // Heuristic: values > 1 trillion are likely in paise
  // Actually safer to NOT auto-divide as it may break valid large values
  
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  
  // Format in Indian number system
  const formatted = absNum.toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  
  if (showDrCr) {
    return isNegative ? `₹${formatted} Cr` : `₹${formatted} Dr`;
  }
  return isNegative ? `- ₹${formatted}` : `₹${formatted}`;
}

// Recently Accessed Ledgers Component
function RecentlyAccessedLedgers({ onSelectLedger }) {
  const [recentLedgers, setRecentLedgers] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("recently_accessed_ledgers");
    if (saved) {
      setRecentLedgers(JSON.parse(saved).slice(0, 5));
    }
  }, []);

  if (recentLedgers.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Recently Accessed</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {recentLedgers.map((ledger, idx) => (
          <button
            key={idx}
            onClick={() => onSelectLedger(ledger)}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            {ledger.name}
          </button>
        ))}
      </div>
    </div>
  );
}

// Summary Cards View (main ledgers page)
function LedgerSummaryCards() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [newLedger, setNewLedger] = useState({
    name: "", group: "Sundry Debtors", address: "", phone: "", email: "", 
    gstin: "", gst_type: "Regular", state: "", pincode: ""
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get('/api/ledgers/summary');
      setSummary(res.data.summary);
    } catch (err) {
      setError("Failed to fetch ledger summary: " + (err?.response?.data?.error || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecentLedger = (ledger) => {
    setSelectedLedger(ledger);
  };

  const resetNewLedger = () => {
    setNewLedger({ name: "", group: "Sundry Debtors", address: "", phone: "", email: "", gstin: "", gst_type: "Regular", state: "", pincode: "" });
  };

  const handleCreateLedger = async () => {
    if (!newLedger.name.trim()) { setMessage({ type: "error", text: "Ledger name is required" }); return; }
    setCreateLoading(true);
    try {
      const res = await axios.post('/api/tally/create-ledger', newLedger);
      if (res.data.success) {
        setMessage({ type: "success", text: `Ledger "${newLedger.name}" created in Tally!` });
        setShowCreateModal(false);
        resetNewLedger();
        fetchSummary();
      } else {
        setMessage({ type: "error", text: res.data.error || "Failed to create ledger" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to create ledger: " + (err.response?.data?.error || err.message) });
    } finally {
      setCreateLoading(false);
      setTimeout(() => setMessage(null), 5000);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading ledger summary...</span>
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
      {message && <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}{message.text}</div>}
      
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ledgers</h1>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus className="w-4 h-4" />
            Add to Tally
          </button>
          <button 
            onClick={fetchSummary}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800/40 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Recently Accessed */}
      <RecentlyAccessedLedgers onSelectLedger={handleSelectRecentLedger} />

      {/* Ledger Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {LEDGER_CARDS.map(card => {
          const Icon = card.icon;
          const data = summary?.[card.key] || { count: 0, openingBalance: 0, closingBalance: 0 };
          const balanceChange = data.closingBalance - data.openingBalance;
          const isPositive = balanceChange >= 0;

          return (
            <div
              key={card.key}
              onClick={() => navigate(`/ledgers/${card.key}`)}
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

      {/* Ledger Detail Modal */}
      {selectedLedger && (
        <LedgerDetailModal 
          ledger={selectedLedger} 
          onClose={() => setSelectedLedger(null)} 
        />
      )}

      {/* Create Ledger Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Ledger to Tally</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="block text-sm font-medium mb-1">Ledger Name *</label><input type="text" value={newLedger.name} onChange={(e) => setNewLedger({...newLedger, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Party/Company name" /></div>
                <div><label className="block text-sm font-medium mb-1">Group</label><select value={newLedger.group} onChange={(e) => setNewLedger({...newLedger, group: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"><option value="Sundry Debtors">Sundry Debtors</option><option value="Sundry Creditors">Sundry Creditors</option><option value="Bank Accounts">Bank Accounts</option><option value="Cash-in-Hand">Cash-in-Hand</option></select></div>
                <div><label className="block text-sm font-medium mb-1">GST Type</label><select value={newLedger.gst_type} onChange={(e) => setNewLedger({...newLedger, gst_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"><option value="Regular">Regular</option><option value="Composition">Composition</option><option value="Consumer">Consumer</option><option value="Unregistered">Unregistered</option></select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">GSTIN</label><input type="text" value={newLedger.gstin} onChange={(e) => setNewLedger({...newLedger, gstin: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="GSTIN number" /></div>
              <div><label className="block text-sm font-medium mb-1">Address</label><textarea value={newLedger.address} onChange={(e) => setNewLedger({...newLedger, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" rows={2} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={newLedger.phone} onChange={(e) => setNewLedger({...newLedger, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
                <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" value={newLedger.email} onChange={(e) => setNewLedger({...newLedger, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">State</label><input type="text" value={newLedger.state} onChange={(e) => setNewLedger({...newLedger, state: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
                <div><label className="block text-sm font-medium mb-1">Pincode</label><input type="text" value={newLedger.pincode} onChange={(e) => setNewLedger({...newLedger, pincode: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateLedger} disabled={createLoading} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4" />{createLoading ? 'Creating...' : 'Create in Tally'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Voucher Detail Mini Modal (shown inside Ledger Detail Modal)
function VoucherDetailMiniModal({ voucher, onClose }) {
  if (!voucher) return null;
  
  const voucherType = (voucher.voucher_type || '').toLowerCase();
  const typeColors = {
    sales: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    purchase: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    receipt: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    payment: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
  };
  
  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${typeColors[voucherType] || 'bg-gray-100 text-gray-700'}`}>
              {voucherType.charAt(0).toUpperCase() + voucherType.slice(1)}
            </span>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {voucher.voucher_number || 'Voucher'}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Date and Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Date</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {voucher.date ? new Date(voucher.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Amount</p>
              <p className="font-bold text-lg text-gray-900 dark:text-white">
                ₹{parseFloat(voucher.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          
          {/* Party Details */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Party</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {voucher.party_name || voucher.party_ledger || '-'}
            </p>
          </div>
          
          {/* Bank/Payment Info */}
          {voucher.bank_ledger && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Bank/Cash</p>
              <p className="font-medium text-gray-900 dark:text-white">{voucher.bank_ledger}</p>
              {voucher.check_number && (
                <p className="text-sm text-gray-500 dark:text-gray-400">Cheque: {voucher.check_number}</p>
              )}
            </div>
          )}
          
          {/* Narration */}
          {voucher.narration && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Narration</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{voucher.narration}</p>
            </div>
          )}
          
          {/* Items if available */}
          {voucher.items && voucher.items.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-2">Items</p>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-2 py-1 text-left text-xs">Item</th>
                      <th className="px-2 py-1 text-right text-xs">Qty</th>
                      <th className="px-2 py-1 text-right text-xs">Rate</th>
                      <th className="px-2 py-1 text-right text-xs">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {voucher.items.slice(0, 5).map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-2 py-1">{item.name || item.item_name}</td>
                        <td className="px-2 py-1 text-right">{item.quantity || item.qty}</td>
                        <td className="px-2 py-1 text-right">₹{parseFloat(item.rate || 0).toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1 text-right">₹{parseFloat(item.amount || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {voucher.items.length > 5 && (
                  <p className="text-xs text-center py-1 text-gray-500">+{voucher.items.length - 5} more items</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Ledger Detail Modal Component with Vouchers
function LedgerDetailModal({ ledger, onClose, groupKey }) {
  const [vouchers, setVouchers] = useState([]);
  const [loadingVouchers, setLoadingVouchers] = useState(false);
  const [voucherCount, setVoucherCount] = useState(0);
  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'vouchers'
  const [vouchersFetched, setVouchersFetched] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'month', 'session'
  const [selectedVoucher, setSelectedVoucher] = useState(null); // For voucher detail modal
  const navigate = useNavigate();
  
  // Determine if this is a bank/cash type ledger
  const isBankOrCash = groupKey === 'bank' || groupKey === 'cash';

  // Get current financial year session
  const getCurrentSession = () => {
    const now = new Date();
    const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return { start: new Date(year, 3, 1), end: new Date(year + 1, 2, 31) };
  };

  // Filter vouchers based on period
  const filteredVouchers = vouchers.filter(v => {
    if (filterPeriod === 'all') return true;
    const vDate = new Date(v.date);
    if (filterPeriod === 'month') {
      const now = new Date();
      return vDate.getMonth() === now.getMonth() && vDate.getFullYear() === now.getFullYear();
    }
    if (filterPeriod === 'session') {
      const session = getCurrentSession();
      return vDate >= session.start && vDate <= session.end;
    }
    return true;
  });

  // Fetch voucher count on mount
  useEffect(() => {
    const fetchVoucherCount = async () => {
      try {
        // Fetch all voucher types to get count - include new types
        const types = ['sales', 'purchase', 'receipt', 'payment', 'contra', 'journal', 'credit_note', 'debit_note'];
        let totalCount = 0;
        
        for (const type of types) {
          const res = await axios.get(`/api/vouchers?type=${type}`);
          const voucherData = Array.isArray(res.data) ? res.data : (res.data.vouchers || []);
          const count = voucherData.filter(v => 
            (v.party_name || v.party_ledger || '').toLowerCase() === ledger.name.toLowerCase()
          ).length;
          totalCount += count;
        }
        
        setVoucherCount(totalCount);
      } catch (err) {
        console.error('Failed to fetch voucher count:', err);
      }
    };
    
    fetchVoucherCount();
  }, [ledger.name]);

  // Fetch full vouchers when tab is clicked
  // Compute GST-inclusive total for a voucher
  const computeVoucherGstTotal = (voucher) => {
    if (!Array.isArray(voucher.items) || voucher.items.length === 0) {
      return voucher;
    }
    
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
    return voucher;
  };

  const fetchVouchers = async () => {
    if (vouchersFetched) return;
    setLoadingVouchers(true);
    try {
      // Fetch ALL vouchers without type filter to include all voucher types
      // (Sales, Purchase, Receipt, Payment, Contra, Journal, Credit Note, Debit Note, Cash, Stock Journal, etc.)
      const res = await axios.get(`/api/vouchers`);
      const voucherData = Array.isArray(res.data) ? res.data : (res.data.vouchers || []);
      
      // Filter by party name (ledger name)
      const ledgerNameLower = ledger.name.toLowerCase();
      const filtered = voucherData.filter(v => {
        const partyName = (v.party_name || v.party_ledger || v.party || '').toLowerCase();
        // Also check ledger entries for this party
        const ledgerEntries = v.ledger_entries || v.ledgers || [];
        const hasLedgerEntry = ledgerEntries.some(le => 
          (le.name || le.ledger_name || '').toLowerCase() === ledgerNameLower
        );
        return partyName === ledgerNameLower || hasLedgerEntry;
      });
      
      // Compute GST totals for each voucher
      const withGst = filtered.map(v => computeVoucherGstTotal(v));
      
      withGst.sort((a, b) => new Date(b.date) - new Date(a.date));
      setVouchers(withGst);
      setVouchersFetched(true);
    } catch (err) {
      console.error('Failed to fetch vouchers:', err);
    } finally {
      setLoadingVouchers(false);
    }
  };

  // Calculate totals - correct accounting logic using filtered vouchers
  // For Debtors: Sales = Debit, Receipt = Credit
  // For Creditors: Purchase = Credit, Payment = Debit
  // Debit Note = Debit (increases receivable), Credit Note = Credit (decreases receivable)
  // Journal entries need to be analyzed per ledger entry for proper Dr/Cr
  // Contra entries typically don't affect party ledgers
  // Use totalAmount (with GST) if available, otherwise fall back to amount
  const getVoucherAmount = (v) => {
    // Priority: totalAmount > ledger_total > grand_total > amount
    return parseFloat(v.totalAmount) || parseFloat(v.ledger_total) || parseFloat(v.grand_total) || parseFloat(v.amount) || 0;
  };

  const debitTotal = filteredVouchers
    .filter(v => {
      const type = (v.voucher_type || '').toLowerCase().replace(/_/g, ' ');
      // Sales, Payment, Debit Note, Stock Journal are debits
      return type === 'sales' || type === 'payment' || 
             type === 'debit note' || type === 'debitnote' ||
             type === 'stock journal' || type.includes('debit');
    })
    .reduce((sum, v) => sum + getVoucherAmount(v), 0);
  
  const creditTotal = filteredVouchers
    .filter(v => {
      const type = (v.voucher_type || '').toLowerCase().replace(/_/g, ' ');
      // Purchase, Receipt, Credit Note are credits
      return type === 'purchase' || type === 'receipt' || 
             type === 'credit note' || type === 'creditnote' ||
             type.includes('credit');
    })
    .reduce((sum, v) => sum + getVoucherAmount(v), 0);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{ledger.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{ledger.parent}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Actions - Hide for bank/cash ledgers */}
            {!isBankOrCash && (
              <>
                <button
                  onClick={() => {
                    const phone = (ledger.phone || '').replace(/[^0-9]/g, '');
                    if (phone) {
                      const message = encodeURIComponent(`Hello ${ledger.name}, regarding your account...`);
                      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                    } else {
                      navigate(`/communication?type=whatsapp&name=${encodeURIComponent(ledger.name)}&email=${encodeURIComponent(ledger.email || '')}`);
                    }
                  }}
                  className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition"
                  title="WhatsApp"
                >
                  <MessageSquare className="w-5 h-5" />
                </button>
                <button
                  onClick={() => {
                    if (ledger.email) {
                      window.location.href = `mailto:${ledger.email}`;
                    } else {
                      navigate(`/communication?type=email&name=${encodeURIComponent(ledger.name)}&phone=${encodeURIComponent(ledger.phone || '')}`);
                    }
                  }}
                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                  title="Email"
                >
                  <Send className="w-5 h-5" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'details' 
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Details
          </button>
          <button
            onClick={() => {
              setActiveTab('vouchers');
              fetchVouchers();
            }}
            className={`px-6 py-3 text-sm font-medium transition ${
              activeTab === 'vouchers' 
                ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Vouchers ({vouchersFetched ? vouchers.length : voucherCount})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'details' ? (
            <div className="space-y-4">
              {ledger.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Address</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ledger.address}</p>
                  </div>
                </div>
              )}
              
              {ledger.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Phone</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ledger.phone}</p>
                  </div>
                </div>
              )}
              
              {ledger.email && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ledger.email}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {ledger.gstin && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">GSTIN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ledger.gstin}</p>
                  </div>
                )}
                {ledger.pan && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">PAN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{ledger.pan}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Opening Balance</p>
                  <p className={`text-xl font-bold ${(ledger.opening_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(ledger.opening_balance)}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Closing Balance</p>
                  <p className={`text-xl font-bold ${(ledger.closing_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                    {formatCurrency(ledger.closing_balance)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Filter for Cash/Bank or Show Summary for others */}
              {isBankOrCash ? (
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-700 dark:text-gray-300">Transactions</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterPeriod('all')}
                      className={`px-3 py-1 text-sm rounded-lg transition ${filterPeriod === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterPeriod('month')}
                      className={`px-3 py-1 text-sm rounded-lg transition ${filterPeriod === 'month' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      This Month
                    </button>
                    <button
                      onClick={() => setFilterPeriod('session')}
                      className={`px-3 py-1 text-sm rounded-lg transition ${filterPeriod === 'session' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
                    >
                      This Session
                    </button>
                  </div>
                </div>
              ) : (
                /* Voucher Summary for non-cash/bank */
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-400">Total Debit (Sales/Payment)</p>
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{formatCurrency(debitTotal)}</p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-700 dark:text-red-400">Total Credit (Purchase/Receipt)</p>
                    <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCurrency(creditTotal)}</p>
                  </div>
                </div>
              )}

              {/* Vouchers List */}
              {loadingVouchers ? (
                <div className="flex items-center justify-center h-32">
                  <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                </div>
              ) : filteredVouchers.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No vouchers found {filterPeriod !== 'all' ? 'for this period' : 'for this ledger'}
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Date</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Type</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-300">Voucher #</th>
                        <th className="px-3 py-2 text-right font-medium text-green-700 dark:text-green-400">Debit</th>
                        <th className="px-3 py-2 text-right font-medium text-red-700 dark:text-red-400">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredVouchers.map((v, idx) => {
                        // Correct debit/credit: Sales, Payment, Debit Note = Debit; Purchase, Receipt, Credit Note = Credit
                        const voucherType = (v.voucher_type || '').toLowerCase().replace(/_/g, ' ');
                        const isDebit = voucherType === 'sales' || voucherType === 'payment' || 
                                        voucherType === 'debit note' || voucherType === 'debitnote' ||
                                        voucherType === 'stock journal';
                        
                        // Get voucher type color
                        const getTypeColor = (type) => {
                          const t = type.toLowerCase().replace(/_/g, ' ');
                          if (t === 'sales') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                          if (t === 'purchase') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
                          if (t === 'receipt') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                          if (t === 'payment') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
                          if (t === 'contra') return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
                          if (t === 'journal') return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
                          if (t === 'credit note' || t === 'creditnote') return 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400';
                          if (t === 'debit note' || t === 'debitnote') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
                          if (t.includes('cash')) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400';
                          if (t.includes('stock')) return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400';
                          if (t.includes('delivery') || t.includes('note')) return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400';
                          return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
                        };
                        
                        // Format voucher type for display
                        const formatVoucherType = (type) => {
                          if (!type) return '-';
                          return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                        };
                        
                        return (
                          <tr 
                            key={idx} 
                            className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer"
                            onClick={() => {
                              // Open voucher detail modal instead of navigating
                              setSelectedVoucher(v);
                            }}
                          >
                            <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
                              {v.date ? new Date(v.date).toLocaleDateString('en-IN') : '-'}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeColor(v.voucher_type || '')}`}>
                                {formatVoucherType(v.voucher_type)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-900 dark:text-white">{v.voucher_number || '-'}</td>
                            <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">
                              {isDebit ? formatCurrency(getVoucherAmount(v)) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                              {!isDebit ? formatCurrency(getVoucherAmount(v)) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Voucher Detail Mini Modal */}
      {selectedVoucher && (
        <VoucherDetailMiniModal 
          voucher={selectedVoucher} 
          onClose={() => setSelectedVoucher(null)} 
        />
      )}
    </div>
  );
}

// Ledger List View (for specific ledger group)
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

  const cardConfig = LEDGER_CARDS.find(c => c.key === groupKey) || LEDGER_CARDS[0];
  const Icon = cardConfig.icon;
  
  // Determine if this is a bank/cash type ledger group
  const isBankOrCash = groupKey === 'bank' || groupKey === 'cash';

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
      const res = await axios.get(`/api/ledgers/list/${groupKey}?${params}`);
      setLedgers(res.data.ledgers || []);
      setTotalPages(res.data.totalPages || 1);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError("Failed to fetch ledgers: " + (err?.response?.data?.error || err?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Save to recently accessed
  const handleSelectLedger = (ledger) => {
    setSelectedLedger(ledger);
    
    // Save to recently accessed
    const saved = localStorage.getItem("recently_accessed_ledgers");
    let recent = saved ? JSON.parse(saved) : [];
    recent = [ledger, ...recent.filter(l => l.name !== ledger.name)].slice(0, 10);
    localStorage.setItem("recently_accessed_ledgers", JSON.stringify(recent));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/ledgers')}
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
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Opening</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Closing</th>
                {!isBankOrCash && (
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ledgers.map((ledger, idx) => (
                <tr 
                  key={ledger.name || idx}
                  onClick={() => handleSelectLedger(ledger)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-white">{ledger.name}</div>
                    {ledger.gstin && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">GSTIN: {ledger.gstin}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${(ledger.opening_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {formatCurrency(ledger.opening_balance, true)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${(ledger.closing_balance || 0) < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                      {formatCurrency(ledger.closing_balance, true)}
                    </span>
                  </td>
                  {!isBankOrCash && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const phone = (ledger.phone || '').replace(/[^0-9]/g, '');
                            if (phone) {
                              const message = encodeURIComponent(`Hello ${ledger.name}, regarding your account...`);
                              window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                            } else {
                              navigate(`/communication?type=whatsapp&name=${encodeURIComponent(ledger.name)}&email=${encodeURIComponent(ledger.email || '')}`);
                            }
                          }}
                          className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 transition"
                          title="WhatsApp"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (ledger.email) {
                              window.location.href = `mailto:${ledger.email}?subject=Regarding your account`;
                            } else {
                              navigate(`/communication?type=email&name=${encodeURIComponent(ledger.name)}&phone=${encodeURIComponent(ledger.phone || '')}`);
                            }
                          }}
                          className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition"
                          title="Email"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        {ledger.phone && (
                          <a
                            href={`tel:${ledger.phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 rounded-lg text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition"
                            title="Call"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  )}
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
        <LedgerDetailModal 
          ledger={selectedLedger} 
          onClose={() => setSelectedLedger(null)}
          groupKey={groupKey}
        />
      )}
    </div>
  );
}

// Main Ledgers Component
export default function Ledgers() {
  const { group } = useParams();

  // If a group is specified, show ledger list
  if (group) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <LedgerListView groupKey={group} />
      </div>
    );
  }

  // Otherwise show summary cards
  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <LedgerSummaryCards />
    </div>
  );
}
