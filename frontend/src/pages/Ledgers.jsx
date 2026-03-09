import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth";
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
  CheckCircle,
  Ban,
  ShieldAlert,
  Pin,
  PinOff
} from "lucide-react";

// Indian states list for dropdown
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

// Card configuration for each ledger group - All Tally groups
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
    name: "Cash-in-Hand",
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
    name: "Bank Accounts",
    icon: Landmark,
    color: "purple",
    bgLight: "bg-purple-50",
    bgDark: "dark:bg-purple-900/20",
    textLight: "text-purple-700",
    textDark: "dark:text-purple-400",
    borderLight: "border-purple-200",
    borderDark: "dark:border-purple-800",
    description: "Bank accounts"
  },
  {
    key: "bank-occ",
    name: "Bank OCC A/c",
    icon: Landmark,
    color: "indigo",
    bgLight: "bg-indigo-50",
    bgDark: "dark:bg-indigo-900/20",
    textLight: "text-indigo-700",
    textDark: "dark:text-indigo-400",
    borderLight: "border-indigo-200",
    borderDark: "dark:border-indigo-800",
    description: "Bank OCC accounts"
  },
  {
    key: "bank-od",
    name: "Bank OD A/c",
    icon: Landmark,
    color: "violet",
    bgLight: "bg-violet-50",
    bgDark: "dark:bg-violet-900/20",
    textLight: "text-violet-700",
    textDark: "dark:text-violet-400",
    borderLight: "border-violet-200",
    borderDark: "dark:border-violet-800",
    description: "Bank overdraft accounts"
  },
  {
    key: "capital-account",
    name: "Capital Account",
    icon: Building2,
    color: "emerald",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-900/20",
    textLight: "text-emerald-700",
    textDark: "dark:text-emerald-400",
    borderLight: "border-emerald-200",
    borderDark: "dark:border-emerald-800",
    description: "Capital accounts"
  },
  {
    key: "current-assets",
    name: "Current Assets",
    icon: TrendingUp,
    color: "teal",
    bgLight: "bg-teal-50",
    bgDark: "dark:bg-teal-900/20",
    textLight: "text-teal-700",
    textDark: "dark:text-teal-400",
    borderLight: "border-teal-200",
    borderDark: "dark:border-teal-800",
    description: "Current assets"
  },
  {
    key: "current-liabilities",
    name: "Current Liabilities",
    icon: TrendingDown,
    color: "rose",
    bgLight: "bg-rose-50",
    bgDark: "dark:bg-rose-900/20",
    textLight: "text-rose-700",
    textDark: "dark:text-rose-400",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-800",
    description: "Current liabilities"
  },
  {
    key: "deposits",
    name: "Deposits (Asset)",
    icon: Landmark,
    color: "cyan",
    bgLight: "bg-cyan-50",
    bgDark: "dark:bg-cyan-900/20",
    textLight: "text-cyan-700",
    textDark: "dark:text-cyan-400",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-800",
    description: "Deposit accounts"
  },
  {
    key: "direct-expenses",
    name: "Direct Expenses",
    icon: CreditCard,
    color: "red",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-900/20",
    textLight: "text-red-700",
    textDark: "dark:text-red-400",
    borderLight: "border-red-200",
    borderDark: "dark:border-red-800",
    description: "Direct expenses"
  },
  {
    key: "direct-incomes",
    name: "Direct Incomes",
    icon: TrendingUp,
    color: "lime",
    bgLight: "bg-lime-50",
    bgDark: "dark:bg-lime-900/20",
    textLight: "text-lime-700",
    textDark: "dark:text-lime-400",
    borderLight: "border-lime-200",
    borderDark: "dark:border-lime-800",
    description: "Direct incomes"
  },
  {
    key: "duties-taxes",
    name: "Duties & Taxes",
    icon: CreditCard,
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-900/20",
    textLight: "text-amber-700",
    textDark: "dark:text-amber-400",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-800",
    description: "Duties and taxes"
  },
  {
    key: "indirect-expenses",
    name: "Indirect Expenses",
    icon: CreditCard,
    color: "pink",
    bgLight: "bg-pink-50",
    bgDark: "dark:bg-pink-900/20",
    textLight: "text-pink-700",
    textDark: "dark:text-pink-400",
    borderLight: "border-pink-200",
    borderDark: "dark:border-pink-800",
    description: "Indirect expenses"
  },
  {
    key: "indirect-incomes",
    name: "Indirect Incomes",
    icon: TrendingUp,
    color: "sky",
    bgLight: "bg-sky-50",
    bgDark: "dark:bg-sky-900/20",
    textLight: "text-sky-700",
    textDark: "dark:text-sky-400",
    borderLight: "border-sky-200",
    borderDark: "dark:border-sky-800",
    description: "Indirect incomes"
  },
  {
    key: "fixed-assets",
    name: "Fixed Assets",
    icon: Building2,
    color: "stone",
    bgLight: "bg-stone-50",
    bgDark: "dark:bg-stone-900/20",
    textLight: "text-stone-700",
    textDark: "dark:text-stone-400",
    borderLight: "border-stone-200",
    borderDark: "dark:border-stone-800",
    description: "Fixed assets"
  },
  {
    key: "investments",
    name: "Investments",
    icon: TrendingUp,
    color: "fuchsia",
    bgLight: "bg-fuchsia-50",
    bgDark: "dark:bg-fuchsia-900/20",
    textLight: "text-fuchsia-700",
    textDark: "dark:text-fuchsia-400",
    borderLight: "border-fuchsia-200",
    borderDark: "dark:border-fuchsia-800",
    description: "Investment accounts"
  },
  {
    key: "loans-advances",
    name: "Loans & Advances (Asset)",
    icon: CreditCard,
    color: "yellow",
    bgLight: "bg-yellow-50",
    bgDark: "dark:bg-yellow-900/20",
    textLight: "text-yellow-700",
    textDark: "dark:text-yellow-400",
    borderLight: "border-yellow-200",
    borderDark: "dark:border-yellow-800",
    description: "Loans and advances (asset)"
  },
  {
    key: "loans-liability",
    name: "Loans (Liability)",
    icon: CreditCard,
    color: "orange",
    bgLight: "bg-orange-50",
    bgDark: "dark:bg-orange-900/20",
    textLight: "text-orange-700",
    textDark: "dark:text-orange-400",
    borderLight: "border-orange-200",
    borderDark: "dark:border-orange-800",
    description: "Loan liabilities"
  },
  {
    key: "provisions",
    name: "Provisions",
    icon: Wallet,
    color: "gray",
    bgLight: "bg-gray-50",
    bgDark: "dark:bg-gray-900/20",
    textLight: "text-gray-700",
    textDark: "dark:text-gray-400",
    borderLight: "border-gray-200",
    borderDark: "dark:border-gray-800",
    description: "Provision accounts"
  },
  {
    key: "purchase-accounts",
    name: "Purchase Accounts",
    icon: CreditCard,
    color: "red",
    bgLight: "bg-red-50",
    bgDark: "dark:bg-red-900/20",
    textLight: "text-red-700",
    textDark: "dark:text-red-400",
    borderLight: "border-red-200",
    borderDark: "dark:border-red-800",
    description: "Purchase accounts"
  },
  {
    key: "reserves-surplus",
    name: "Reserves & Surplus",
    icon: Landmark,
    color: "emerald",
    bgLight: "bg-emerald-50",
    bgDark: "dark:bg-emerald-900/20",
    textLight: "text-emerald-700",
    textDark: "dark:text-emerald-400",
    borderLight: "border-emerald-200",
    borderDark: "dark:border-emerald-800",
    description: "Reserves and surplus"
  },
  {
    key: "sales-accounts",
    name: "Sales Accounts",
    icon: TrendingUp,
    color: "green",
    bgLight: "bg-green-50",
    bgDark: "dark:bg-green-900/20",
    textLight: "text-green-700",
    textDark: "dark:text-green-400",
    borderLight: "border-green-200",
    borderDark: "dark:border-green-800",
    description: "Sales accounts"
  },
  {
    key: "secured-loans",
    name: "Secured Loans",
    icon: CreditCard,
    color: "amber",
    bgLight: "bg-amber-50",
    bgDark: "dark:bg-amber-900/20",
    textLight: "text-amber-700",
    textDark: "dark:text-amber-400",
    borderLight: "border-amber-200",
    borderDark: "dark:border-amber-800",
    description: "Secured loan accounts"
  },
  {
    key: "unsecured-loans",
    name: "Unsecured Loans",
    icon: CreditCard,
    color: "rose",
    bgLight: "bg-rose-50",
    bgDark: "dark:bg-rose-900/20",
    textLight: "text-rose-700",
    textDark: "dark:text-rose-400",
    borderLight: "border-rose-200",
    borderDark: "dark:border-rose-800",
    description: "Unsecured loan accounts"
  },
  {
    key: "suspense",
    name: "Suspense A/c",
    icon: AlertCircle,
    color: "slate",
    bgLight: "bg-slate-50",
    bgDark: "dark:bg-slate-900/20",
    textLight: "text-slate-700",
    textDark: "dark:text-slate-400",
    borderLight: "border-slate-200",
    borderDark: "dark:border-slate-800",
    description: "Suspense accounts"
  },
  {
    key: "stock-in-hand",
    name: "Stock-in-Hand",
    icon: Wallet,
    color: "cyan",
    bgLight: "bg-cyan-50",
    bgDark: "dark:bg-cyan-900/20",
    textLight: "text-cyan-700",
    textDark: "dark:text-cyan-400",
    borderLight: "border-cyan-200",
    borderDark: "dark:border-cyan-800",
    description: "Stock in hand"
  },
  {
    key: "branch-divisions",
    name: "Branch / Divisions",
    icon: Building2,
    color: "violet",
    bgLight: "bg-violet-50",
    bgDark: "dark:bg-violet-900/20",
    textLight: "text-violet-700",
    textDark: "dark:text-violet-400",
    borderLight: "border-violet-200",
    borderDark: "dark:border-violet-800",
    description: "Branch and division accounts"
  },
  {
    key: "misc-expenses",
    name: "Misc. Expenses (ASSET)",
    icon: CreditCard,
    color: "neutral",
    bgLight: "bg-neutral-50",
    bgDark: "dark:bg-neutral-900/20",
    textLight: "text-neutral-700",
    textDark: "dark:text-neutral-400",
    borderLight: "border-neutral-200",
    borderDark: "dark:border-neutral-800",
    description: "Miscellaneous expenses (asset)"
  },
  {
    key: "retained-earnings",
    name: "Retained Earnings",
    icon: TrendingUp,
    color: "teal",
    bgLight: "bg-teal-50",
    bgDark: "dark:bg-teal-900/20",
    textLight: "text-teal-700",
    textDark: "dark:text-teal-400",
    borderLight: "border-teal-200",
    borderDark: "dark:border-teal-800",
    description: "Retained earnings"
  }
];

// Determine the balance side (Dr/Cr) using available metadata
// Helper to determine if ledger group is Asset type (Dr positive) or Liability type (Cr positive)
function isAssetGroupType(groupKey, ledger) {
  const gk = (groupKey || '').toLowerCase();
  const parentGroup = (ledger?.parent || '').toLowerCase();
  
  // Asset types: Sundry Debtors, Cash, Bank accounts - positive balance = Dr
  const assetGroups = ['sundry-debtors', 'cash', 'bank', 'bank-occ', 'bank-od'];
  const assetParents = ['debtor', 'cash', 'bank'];
  
  if (assetGroups.includes(gk)) return true;
  if (assetParents.some(p => parentGroup.includes(p))) return true;
  
  // Liability types: Sundry Creditors - positive balance = Cr
  // Default to liability behavior if unknown
  return false;
}

function resolveBalanceSide(rawAmount, options = {}) {
  if (options.side) return options.side;

  if (typeof options.isReceivable === 'boolean') {
    return options.isReceivable ? 'Dr' : 'Cr';
  }
  if (typeof options.isPayable === 'boolean') {
    return options.isPayable ? 'Cr' : 'Dr';
  }

  if (options.ledger) {
    const ledger = options.ledger;
    if (typeof ledger.isReceivable === 'boolean') {
      return ledger.isReceivable ? 'Dr' : 'Cr';
    }
    if (typeof ledger.isPayable === 'boolean') {
      return ledger.isPayable ? 'Cr' : 'Dr';
    }
    if (ledger.balance_side) {
      const side = ledger.balance_side.toString().toUpperCase();
      if (side.includes('CR')) return 'Cr';
      if (side.includes('DR')) return 'Dr';
    }
  }

  const numericRaw = parseFloat(rawAmount);
  if (!Number.isNaN(numericRaw) && numericRaw !== 0) {
    // Use groupKey to determine if asset or liability type
    const isAsset = isAssetGroupType(options.groupKey, options.ledger);
    if (isAsset) {
      // Assets: positive = Dr (debit balance), negative = Cr
      return numericRaw > 0 ? 'Dr' : 'Cr';
    } else {
      // Liabilities: positive = Cr (credit balance), negative = Dr
      return numericRaw > 0 ? 'Cr' : 'Dr';
    }
  }

  return options.defaultSide || 'Dr';
}

// Format ledger balances with optional Dr/Cr suffix and metadata
function formatLedgerBalance(amount, options = {}) {
  let numeric = parseFloat(amount);
  if (Number.isNaN(numeric)) numeric = 0;

  const divideBy = options.divideBy || 1;
  const normalized = numeric / divideBy;
  const side = resolveBalanceSide(amount, options);

  const formatted = Math.abs(normalized).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (options.showDrCr === false) {
    const prefix = normalized < 0 ? '- ₹' : '₹';
    return { text: `${prefix}${formatted}`, side, value: normalized };
  }

  return { text: `₹${formatted} ${side}`, side, value: normalized };
}

// Backwards-compatible currency formatter
function formatCurrency(amount, showDrCr = false, options = {}) {
  const meta = formatLedgerBalance(amount, { ...options, showDrCr });
  return meta.text;
}

function balanceColorClass(side) {
  return side === 'Cr'
    ? 'text-red-600 dark:text-red-400'
    : 'text-green-600 dark:text-green-400';
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
  const { user, isAdminOrHigher, hasPermission } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLedger, setSelectedLedger] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [blacklistedLedgers, setBlacklistedLedgers] = useState([]);
  const [pinnedCards, setPinnedCards] = useState(() => {
    try {
      const saved = localStorage.getItem('ledger_pinned_cards');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newLedger, setNewLedger] = useState({
    name: "", group: "Sundry Debtors", address: "", phone: "", email: "", 
    gstin: "", gst_type: "Regular", state: "", pincode: ""
  });
  const navigate = useNavigate();
  
  // Check if user can see blacklisted ledgers (admin or has permission)
  const canSeeBlacklisted = isAdminOrHigher() || hasPermission('view_blacklisted_ledgers');

  // Toggle pin for a card (max 4 pins)
  const togglePinCard = (cardKey, e) => {
    e.stopPropagation();
    setPinnedCards(prev => {
      let newPins;
      if (prev.includes(cardKey)) {
        newPins = prev.filter(k => k !== cardKey);
      } else if (prev.length < 4) {
        newPins = [...prev, cardKey];
      } else {
        // Max 4 pins - replace oldest
        newPins = [...prev.slice(1), cardKey];
      }
      localStorage.setItem('ledger_pinned_cards', JSON.stringify(newPins));
      return newPins;
    });
  };

  // Sort cards: pinned first, then others
  const sortedLedgerCards = [...LEDGER_CARDS].sort((a, b) => {
    const aIsPinned = pinnedCards.includes(a.key);
    const bIsPinned = pinnedCards.includes(b.key);
    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;
    return 0;
  });

  useEffect(() => {
    fetchSummary();
    loadBlacklistedLedgers();
  }, []);

  const loadBlacklistedLedgers = () => {
    try {
      const stored = localStorage.getItem('crm_blacklisted_ledgers');
      setBlacklistedLedgers(stored ? JSON.parse(stored) : []);
    } catch { setBlacklistedLedgers([]); }
  };

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white glass-text">Ledgers</h1>
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

      {/* Blacklisted Ledgers Card - Admin only - AT TOP - Always show for admins */}
      {canSeeBlacklisted && (
        <div 
          onClick={() => navigate('/ledgers/blacklisted')}
          className="p-6 rounded-xl border-2 border-dashed border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 cursor-pointer transition-all hover:shadow-lg hover:border-red-400"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/40">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-700 dark:text-red-400">Blacklisted Ledgers</h3>
              <p className="text-sm text-red-600/70 dark:text-red-400/70">
                {blacklistedLedgers.length > 0 
                  ? `${blacklistedLedgers.length} ledgers marked - Admin access only`
                  : 'No ledgers blacklisted - Click to manage'}
              </p>
              {/* Show recently added blacklisted ledgers (last 5) */}
              {blacklistedLedgers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {blacklistedLedgers.slice(0, 5).map((ledger, idx) => (
                    <span key={idx} className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-1 rounded">
                      {ledger.name || ledger}
                    </span>
                  ))}
                  {blacklistedLedgers.length > 5 && (
                    <span className="text-xs text-red-500">+{blacklistedLedgers.length - 5} more</span>
                  )}
                </div>
              )}
            </div>
            <Ban className="w-5 h-5 text-red-500" />
          </div>
        </div>
      )}

      {/* Recently Accessed */}
      <RecentlyAccessedLedgers onSelectLedger={handleSelectRecentLedger} />

      {/* Ledger Type Cards - Pinned cards show first */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {sortedLedgerCards.map(card => {
          const Icon = card.icon;
          const data = summary?.[card.key] || { count: 0, openingBalance: 0, closingBalance: 0 };
          // For debtors, positive = receivable. For creditors, negative = payable.
          const isDebtors = card.key === 'sundry-debtors';
          const isCreditors = card.key === 'sundry-creditors';
          // Show absolute closing balance as "Total Receivable" for debtors, "Total Payable" for creditors
          // Multiply by 100 to match Tally display format
          const totalBalance = Math.abs((data.closingBalance || 0));
          const balanceLabel = isDebtors ? 'Total Receivable' : isCreditors ? 'Total Payable' : 'Balance';

          // Use the count directly from backend (already deduplicated)
          const ledgerCount = typeof data.count === 'number' ? data.count : 0;
          const isPinned = pinnedCards.includes(card.key);

          return (
            <div
              key={card.key}
              onClick={() => navigate(`/ledgers/${card.key}`)}
              className={`p-6 rounded-xl border cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] relative
                ${card.bgLight} ${card.bgDark} ${card.borderLight} ${card.borderDark}
                ${isPinned ? 'ring-2 ring-yellow-400 dark:ring-yellow-500' : ''}`}
            >
              {/* Pin Button */}
              <button
                onClick={(e) => togglePinCard(card.key, e)}
                className={`absolute top-2 right-2 p-1.5 rounded-full transition-all ${
                  isPinned 
                    ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400' 
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover:opacity-100'
                }`}
                style={{ opacity: isPinned ? 1 : undefined }}
                title={isPinned ? 'Unpin card' : 'Pin card (max 4)'}
              >
                {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
              </button>
              
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${card.bgLight} ${card.bgDark}`}>
                  <Icon className={`w-6 h-6 ${card.textLight} ${card.textDark}`} />
                </div>
                <span className={`text-2xl font-bold ${card.textLight} ${card.textDark}`}>
                  {ledgerCount}
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
                  <span className="text-gray-600 dark:text-gray-400">{balanceLabel}</span>
                  <span className={`font-medium ${isDebtors ? 'text-green-600 dark:text-green-400' : isCreditors ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Parties</span>
                  <span className="text-gray-900 dark:text-white font-medium">{ledgerCount} ledgers</span>
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
          groupKey={
            (selectedLedger.parent || '').toLowerCase().includes('debtor') ? 'sundry-debtors' :
            (selectedLedger.parent || '').toLowerCase().includes('creditor') ? 'sundry-creditors' :
            (selectedLedger.parent || '').toLowerCase().includes('bank') ? 'bank' :
            (selectedLedger.parent || '').toLowerCase().includes('cash') ? 'cash' : ''
          }
        />
      )}

      {/* Create Ledger Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Ledger to Tally</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Basic Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> Basic Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Ledger Name *</label>
                    <input type="text" value={newLedger.name} onChange={(e) => setNewLedger({...newLedger, name: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Party/Company name" autoFocus />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Group *</label>
                    <select value={newLedger.group} onChange={(e) => setNewLedger({...newLedger, group: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                      <option value="Sundry Debtors">Sundry Debtors</option>
                      <option value="Sundry Creditors">Sundry Creditors</option>
                      <option value="Bank Accounts">Bank Accounts</option>
                      <option value="Cash-in-Hand">Cash-in-Hand</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">GST Type</label>
                    <select value={newLedger.gst_type} onChange={(e) => setNewLedger({...newLedger, gst_type: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                      <option value="Regular">Regular</option>
                      <option value="Composition">Composition</option>
                      <option value="Consumer">Consumer</option>
                      <option value="Unregistered">Unregistered</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* GST Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">GST Details</h3>
                <div>
                  <label className="block text-sm font-medium mb-1">GSTIN</label>
                  <input type="text" value={newLedger.gstin} onChange={(e) => setNewLedger({...newLedger, gstin: e.target.value.toUpperCase()})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="22AAAAA0000A1Z5" maxLength={15} />
                  {newLedger.gstin && newLedger.gstin.length !== 15 && <p className="text-xs text-orange-500 mt-1">GSTIN should be 15 characters</p>}
                </div>
              </div>

              {/* Contact Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Contact Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Phone</label>
                    <input 
                      type="tel" 
                      value={newLedger.phone} 
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9+\-\s]/g, '');
                        setNewLedger({...newLedger, phone: val});
                      }}
                      className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${newLedger.phone && !/^[\d\s+\-]{10,15}$/.test(newLedger.phone) ? 'border-red-500' : ''}`}
                      placeholder="+91 XXXXX XXXXX"
                    />
                    {newLedger.phone && !/^[\d\s+\-]{10,15}$/.test(newLedger.phone) && <p className="text-xs text-red-500 mt-1">Invalid phone format</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Email</label>
                    <input 
                      type="email" 
                      value={newLedger.email} 
                      onChange={(e) => setNewLedger({...newLedger, email: e.target.value})}
                      className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 ${newLedger.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLedger.email) ? 'border-red-500' : ''}`}
                      placeholder="email@example.com"
                    />
                    {newLedger.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLedger.email) && <p className="text-xs text-red-500 mt-1">Invalid email format</p>}
                  </div>
                </div>
              </div>

              {/* Address Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Address Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Address</label>
                    <textarea value={newLedger.address} onChange={(e) => setNewLedger({...newLedger, address: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" rows={2} placeholder="Street address, Area, Landmark" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">State</label>
                      <select value={newLedger.state} onChange={(e) => setNewLedger({...newLedger, state: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">
                        <option value="">Select State...</option>
                        {INDIAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Pincode</label>
                      <input type="text" value={newLedger.pincode} onChange={(e) => setNewLedger({...newLedger, pincode: e.target.value.replace(/\D/g, '').slice(0, 6)})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="110001" maxLength={6} />
                      {newLedger.pincode && newLedger.pincode.length !== 6 && <p className="text-xs text-orange-500 mt-1">Pincode should be 6 digits</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 sticky bottom-0 bg-white dark:bg-gray-800">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={handleCreateLedger} disabled={createLoading || !newLedger.name || (newLedger.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newLedger.email)) || (newLedger.phone && !/^[\d\s+\-]{10,15}$/.test(newLedger.phone))} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"><Save className="w-4 h-4" />{createLoading ? 'Creating...' : 'Create in Tally'}</button>
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
  const [activeTab, setActiveTab] = useState('vouchers'); // Default to vouchers tab
  const [vouchersFetched, setVouchersFetched] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'month', 'session'
  const [selectedVoucher, setSelectedVoucher] = useState(null); // For voucher detail modal
  const navigate = useNavigate();

  const rawOpeningBalance = parseFloat(ledger?.opening_balance ?? ledger?.openingBalance ?? 0);
  const rawClosingBalance = parseFloat(ledger?.closing_balance ?? ledger?.closingBalance ?? 0);

  const openingSummary = formatLedgerBalance(rawOpeningBalance, {
    showDrCr: true,
    groupKey,
    ledger
  });
  const closingSummary = formatLedgerBalance(rawClosingBalance, {
    showDrCr: true,
    groupKey,
    ledger
  });
  const netMovementMeta = formatLedgerBalance(rawClosingBalance - rawOpeningBalance, {
    showDrCr: true,
    groupKey,
    ledger
  });

  const ledgerGstin = (ledger?.gstin || ledger?.gst_number || ledger?.gstNo || ledger?.party_gstin || ledger?.GSTIN || '').toString().toUpperCase();
  const ledgerGstType = ledger?.gst_type || ledger?.gstType || ledger?.gst_registration_type || ledger?.registration_type || '';
  const ledgerGstStatus = ledger?.gst_registration_status || ledger?.registration_status || ledger?.gst_category || '';
  const ledgerPlaceOfSupply = ledger?.place_of_supply || ledger?.placeOfSupply || '';
  const ledgerState = ledger?.state || ledger?.state_name || ledger?.stateName || ledgerPlaceOfSupply || '';
  const ledgerCountry = ledger?.country || ledger?.countryName || '';
  const ledgerPincode = ledger?.pincode || ledger?.postal_code || ledger?.zip || '';
  const ledgerPan = ledger?.pan || ledger?.PAN || ledger?.pan_number || '';

  const gstInfoFields = [];
  const addInfoField = (label, value) => {
    if (!value) return;
    const displayValue = typeof value === 'string' ? value.trim() : value;
    if (!displayValue) return;
    gstInfoFields.push({ label, value: displayValue });
  };

  addInfoField('GSTIN', ledgerGstin);
  addInfoField('GST Type', ledgerGstType);
  addInfoField('GST Registration', ledgerGstStatus);
  addInfoField('Place of Supply', ledgerPlaceOfSupply || ledgerState);
  addInfoField('State', ledgerState);
  addInfoField('Country', ledgerCountry);
  addInfoField('Pincode', ledgerPincode);
  addInfoField('PAN', ledgerPan);
  
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

  // Fetch voucher count on mount and auto-fetch vouchers since vouchers tab is default
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
    // Auto-fetch vouchers on mount since vouchers tab is default
    fetchVouchers();
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
  // Contra entries also analyzed per ledger entry
  // Use totalAmount (with GST) if available, otherwise fall back to amount
  const getVoucherAmount = (v) => {
    // Priority: totalAmount > ledger_total > grand_total > amount
    return parseFloat(v.totalAmount) || parseFloat(v.ledger_total) || parseFloat(v.grand_total) || parseFloat(v.amount) || 0;
  };

  // Get ledger-specific amount and debit/credit direction for journal/contra
  const getLedgerEntryInfo = (v) => {
    const ledgerEntries = v.ledger_entries || v.ledgers || [];
    const ledgerNameLower = ledger.name.toLowerCase();
    const entry = ledgerEntries.find(le => 
      (le.name || le.ledger_name || '').toLowerCase() === ledgerNameLower
    );
    if (entry) {
      const amount = Math.abs(parseFloat(entry.amount) || 0);
      const isDebit = entry.is_debit === true || entry.is_debit === 'true' || 
                      (parseFloat(entry.amount) || 0) < 0; // In Tally, negative amounts are often debits
      return { amount, isDebit };
    }
    return null;
  };

  // Classify each voucher as debit or credit with proper amount
  const classifiedVouchers = filteredVouchers.map(v => {
    const type = (v.voucher_type || '').toLowerCase().replace(/_/g, ' ');
    
    // For journal and contra, check ledger entries
    if (type === 'journal' || type === 'contra') {
      const entryInfo = getLedgerEntryInfo(v);
      if (entryInfo) {
        return { ...v, _isDebit: entryInfo.isDebit, _ledgerAmount: entryInfo.amount };
      }
      // Fallback: show as credit (since image shows journal as credit)
      return { ...v, _isDebit: false, _ledgerAmount: getVoucherAmount(v) };
    }
    
    // Standard classification
    const isDebit = type === 'sales' || type === 'payment' || 
                    type === 'debit note' || type === 'debitnote' ||
                    type === 'stock journal' || type.includes('debit');
    return { ...v, _isDebit: isDebit, _ledgerAmount: getVoucherAmount(v) };
  });

  const debitTotal = classifiedVouchers
    .filter(v => v._isDebit)
    .reduce((sum, v) => sum + (v._ledgerAmount || 0), 0);
  
  const creditTotal = classifiedVouchers
    .filter(v => !v._isDebit)
    .reduce((sum, v) => sum + (v._ledgerAmount || 0), 0);

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

        {/* Tabs - Vouchers first, Details second */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
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

              {gstInfoFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  {gstInfoFields.map(field => (
                    <div key={field.label}>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{field.label}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{field.value}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Balance Summary - Like Tally's Opening/Current/Closing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-400">Opening Balance</p>
                  <p className={`text-xl font-bold ${balanceColorClass(openingSummary.side)}`}>
                    {openingSummary.text}
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="text-sm text-purple-700 dark:text-purple-400">Transaction Total</p>
                  <p className={`text-xl font-bold ${balanceColorClass(netMovementMeta.side)}`}>
                    {netMovementMeta.text}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">Closing Balance</p>
                  <p className={`text-xl font-bold ${balanceColorClass(closingSummary.side)}`}>
                    {closingSummary.text}
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
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
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
                      {classifiedVouchers.map((v, idx) => {
                        // Use pre-classified debit/credit
                        const isDebit = v._isDebit;
                        const displayAmount = v._ledgerAmount || getVoucherAmount(v);
                        
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
                              {isDebit ? formatCurrency(displayAmount) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-red-600 dark:text-red-400">
                              {!isDebit ? formatCurrency(displayAmount) : '-'}
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
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow overflow-x-auto">
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
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Opening Balance</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 dark:text-gray-300">Closing Balance</th>
                {!isBankOrCash && (
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {ledgers.map((ledger, idx) => {
                const openingMeta = formatLedgerBalance(ledger.opening_balance, {
                  showDrCr: true,
                  ledger,
                  groupKey
                });
                const closingMeta = formatLedgerBalance(ledger.closing_balance, {
                  showDrCr: true,
                  ledger,
                  groupKey
                });
                return (
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
                  <td className="px-4 py-3">
                    {ledger.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                        <Phone className="w-3 h-3" />
                        {ledger.phone}
                      </div>
                    )}
                    {ledger.email && (
                      <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
                        <Mail className="w-3 h-3" />
                        {ledger.email}
                      </div>
                    )}
                    {!ledger.phone && !ledger.email && (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${balanceColorClass(openingMeta.side)}`}>
                      {openingMeta.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-bold ${balanceColorClass(closingMeta.side)}`}>
                      {closingMeta.text}
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
                );
              })}
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
      <div className="min-h-screen">
        <LedgerListView groupKey={group} />
      </div>
    );
  }

  // Otherwise show summary cards
  return (
    <div className="min-h-screen">
      <LedgerSummaryCards />
    </div>
  );
}
