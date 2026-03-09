import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useState, useEffect, useMemo } from "react";
import { 
  FileText, Edit3, Trash2, Clock, ChevronRight, Plus, TrendingUp, TrendingDown,
  Users, Package, IndianRupee, ShoppingCart, Receipt, CreditCard, BarChart3,
  ArrowUpRight, ArrowDownRight, Calendar, Activity, Bell, CheckCircle,
  UserCheck, UserX, Target, Briefcase, AlertTriangle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Dashboard() {
  const { user, isAdminOrHigher, isRoot } = useAuth();
  const { currentTheme, dark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    totalPurchases: 0,
    totalReceipts: 0,
    totalPayments: 0,
    pendingInvoices: 0,
    inventoryItems: 0,
    ledgerCount: 0,
    employeeCount: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [upcomingFollowups, setUpcomingFollowups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch all vouchers to get real counts and amounts
        try {
          const vouchersRes = await axios.get(`${API_BASE}/api/vouchers`);
          const allVouchers = vouchersRes.data?.vouchers || vouchersRes.data || [];
          
          // Calculate totals by type
          const salesVouchers = allVouchers.filter(v => (v.voucher_type || '').toLowerCase() === 'sales');
          const purchaseVouchers = allVouchers.filter(v => (v.voucher_type || '').toLowerCase() === 'purchase');
          const receiptVouchers = allVouchers.filter(v => (v.voucher_type || '').toLowerCase() === 'receipt');
          const paymentVouchers = allVouchers.filter(v => (v.voucher_type || '').toLowerCase() === 'payment');
          
          // Calculate amounts
          const salesAmount = salesVouchers.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
          const purchaseAmount = purchaseVouchers.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
          const receiptAmount = receiptVouchers.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
          const paymentAmount = paymentVouchers.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
          
          // Count pending invoices (unpaid sales)
          const pendingCount = salesVouchers.filter(v => v.payment_status === 'Pending' || v.unpaid_amount > 0).length;
          
          setStats(prev => ({
            ...prev,
            totalSales: salesVouchers.length,
            totalPurchases: purchaseVouchers.length,
            totalReceipts: receiptVouchers.length,
            totalPayments: paymentVouchers.length,
            salesAmount,
            purchaseAmount,
            receiptAmount,
            paymentAmount,
            pendingInvoices: pendingCount
          }));
        } catch (err) {
          console.error("Failed to fetch vouchers:", err);
        }

        // Try to fetch inventory count
        try {
          const invRes = await axios.get(`${API_BASE}/api/inventory`);
          const items = invRes.data?.items || invRes.data || [];
          setStats(prev => ({ ...prev, inventoryItems: items.length }));
        } catch {}

        // Try to fetch ledger count
        try {
          const ledgerRes = await axios.get(`${API_BASE}/api/ledgers/summary`);
          const totals = ledgerRes.data?.totals || {};
          setStats(prev => ({ 
            ...prev, 
            ledgerCount: (totals.debtors || 0) + (totals.creditors || 0),
            debtorsCount: totals.debtors || 0,
            creditorsCount: totals.creditors || 0,
            totalReceivable: totals.totalReceivable || 0,
            totalPayable: totals.totalPayable || 0
          }));
        } catch {}

        // Load local storage data
        const employees = JSON.parse(localStorage.getItem("crm_employees") || "[]");
        const todos = JSON.parse(localStorage.getItem("crm_todos") || "[]");
        const followups = JSON.parse(localStorage.getItem("crm_followups") || "[]");
        const orders = JSON.parse(localStorage.getItem("crm_orders") || "[]");

        setStats(prev => ({
          ...prev,
          employeeCount: employees.length,
          ordersCount: orders.length,
          pendingOrders: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length
        }));

        // Get pending tasks
        const pending = todos.filter(t => t.status === "pending").slice(0, 5);
        setPendingTasks(pending);

        // Get upcoming followups
        const today = new Date();
        const upcoming = followups
          .filter(f => f.status === "pending" && f.scheduledDate)
          .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate))
          .slice(0, 5);
        setUpcomingFollowups(upcoming);

        // Generate recent activity from logs
        const logs = JSON.parse(localStorage.getItem("crm_logs") || "[]");
        const recentLogs = logs.slice(0, 5).map(log => ({
          type: log.type,
          message: `${log.action}: ${log.details || ''}`,
          time: log.timestamp,
          user: log.userName
        }));
        setRecentActivity(recentLogs);

      } catch (err) {
        console.error("Dashboard load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
    return `₹${amount}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  };

  // ── Overall Target Data (for top-level card) ──
  const targetData = useMemo(() => {
    try {
      const employees = JSON.parse(localStorage.getItem("crm_employees") || "[]");
      const orders = JSON.parse(localStorage.getItem("crm_orders") || "[]");
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const active = employees.filter(e => !e.fired && e.monthlyTarget > 0);
      if (active.length === 0) return null;

      // Order-based amounts per employee
      const orderTargets = {};
      orders.forEach(order => {
        if (!order.otherReferences) return;
        const orderDate = new Date(order.orderDate || order.createdAt);
        if (orderDate.getMonth() !== currentMonth || orderDate.getFullYear() !== currentYear) return;
        const empName = order.otherReferences;
        if (!orderTargets[empName]) orderTargets[empName] = { convertedAmount: 0, pendingAmount: 0 };
        const amount = parseFloat(order.grandTotal) || 0;
        if (order.status === 'converted') {
          orderTargets[empName].convertedAmount += amount;
        } else if (!['cancelled'].includes(order.status)) {
          orderTargets[empName].pendingAmount += amount;
        }
      });

      const totalTarget = active.reduce((s, e) => s + (e.monthlyTarget || 0), 0);
      const totalVoucher = active.reduce((s, e) => s + ((e.targetAchieved || 0) * 100), 0);
      const totalPending = active.reduce((s, e) => s + (orderTargets[e.name]?.pendingAmount || 0), 0);
      const totalCombined = totalVoucher + totalPending;
      const combinedPct = totalTarget > 0 ? Math.min(Math.round((totalCombined / totalTarget) * 100), 100) : 0;
      const voucherPct = totalTarget > 0 ? Math.min(Math.round((totalVoucher / totalTarget) * 100), 100) : 0;
      const pendingPct = totalTarget > 0 ? Math.min(Math.round((totalPending / totalTarget) * 100), 100) : 0;

      return { totalTarget, totalVoucher, totalPending, totalCombined, combinedPct, voucherPct, pendingPct, employeeCount: active.length };
    } catch { return null; }
  }, [stats]); // re-run when stats updates (after API loads)

  // Format amounts for target card
  const fmtAmt = (a) => {
    if (a >= 10000000) return `₹${(a / 10000000).toFixed(1)}Cr`;
    if (a >= 100000) return `₹${(a / 100000).toFixed(1)}L`;
    if (a >= 1000) return `₹${(a / 1000).toFixed(1)}K`;
    return `₹${a}`;
  };

  // Quick action cards
  const quickActions = [
    { title: "Vouchers", icon: FileText, path: "/vouchers", color: "bg-blue-500", count: stats.totalSales + stats.totalPurchases },
    { title: "Inventory", icon: Package, path: "/inventory", color: "bg-purple-500" },
    { title: "Ledgers", icon: BarChart3, path: "/ledgers", color: "bg-green-500" },
    { title: "Employees", icon: Users, path: "/employees", color: "bg-orange-500", count: stats.employeeCount },
    { title: "Reports", icon: TrendingUp, path: "/reports", color: "bg-pink-500" },
    { title: "Tasks", icon: CheckCircle, path: "/todos", color: "bg-indigo-500", count: pendingTasks.length }
  ];

  return (
    <div className="min-h-screen" style={{ color: currentTheme?.text }}>
      {/* Header */}
      <div className="mb-8 glass-text">
        <h1 className="text-3xl font-bold" style={{ color: currentTheme?.text }}>Dashboard</h1>
        <p className="mt-1" style={{ color: currentTheme?.textMuted }}>
          Welcome back, {user?.name || user?.username}! Here's your business overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="rounded-xl p-6 border shadow-sm" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Total Sales</p>
              <p className="text-2xl font-bold mt-1" style={{ color: currentTheme?.text }}>{stats.totalSales}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-green-600">
            <ArrowUpRight className="w-4 h-4 mr-1" />
            <span>View all sales</span>
          </div>
        </div>

        <div className="rounded-xl p-6 border shadow-sm" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Total Purchases</p>
              <p className="text-2xl font-bold mt-1" style={{ color: currentTheme?.text }}>{stats.totalPurchases}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <ShoppingCart className="w-6 h-6 text-red-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-red-600">
            <ArrowDownRight className="w-4 h-4 mr-1" />
            <span>View all purchases</span>
          </div>
        </div>

        <div className="rounded-xl p-6 border shadow-sm" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Receipts</p>
              <p className="text-2xl font-bold mt-1" style={{ color: currentTheme?.text }}>{stats.totalReceipts}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-blue-600">
            <span>Money received</span>
          </div>
        </div>

        <div className="rounded-xl p-6 border shadow-sm" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Payments</p>
              <p className="text-2xl font-bold mt-1" style={{ color: currentTheme?.text }}>{stats.totalPayments}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-orange-600">
            <span>Money paid out</span>
          </div>
        </div>
      </div>

      {/* Overall Target Card */}
      {targetData && (
        <div className="mb-8 rounded-xl border shadow-sm p-6" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${currentTheme?.primary}18` }}>
                <Target className="w-6 h-6" style={{ color: currentTheme?.primary }} />
              </div>
              <div>
                <h2 className="text-lg font-bold" style={{ color: currentTheme?.text }}>Monthly Target</h2>
                <p className="text-xs" style={{ color: currentTheme?.textMuted }}>
                  {targetData.employeeCount} employee{targetData.employeeCount !== 1 ? 's' : ''} • {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold" style={{ color: targetData.combinedPct >= 75 ? '#22c55e' : targetData.combinedPct >= 50 ? '#f59e0b' : '#ef4444' }}>
                {targetData.combinedPct}%
              </p>
              <p className="text-xs" style={{ color: currentTheme?.textMuted }}>of {fmtAmt(targetData.totalTarget)}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-3 rounded-full overflow-hidden relative mb-4" style={{ backgroundColor: `${currentTheme?.border}44` }}>
            {/* Solid bar for voucher-confirmed */}
            <div className="h-full rounded-full absolute left-0 top-0 transition-all duration-700" 
              style={{ width: `${targetData.voucherPct}%`, backgroundColor: targetData.voucherPct >= 75 ? '#22c55e' : targetData.voucherPct >= 50 ? '#f59e0b' : '#ef4444' }} />
            {/* Light bar for pending orders */}
            {targetData.pendingPct > 0 && (
              <div className="h-full rounded-full absolute left-0 top-0 transition-all duration-700" 
                style={{ width: `${Math.min(targetData.voucherPct + targetData.pendingPct, 100)}%`, backgroundColor: targetData.voucherPct >= 75 ? '#22c55e' : targetData.voucherPct >= 50 ? '#f59e0b' : '#ef4444', opacity: 0.3 }} />
            )}
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: currentTheme?.surface }}>
              <p className="text-lg font-bold text-green-600">{fmtAmt(targetData.totalVoucher)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: currentTheme?.textMuted }}>Confirmed (Vouchers)</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: currentTheme?.surface }}>
              <p className="text-lg font-bold text-amber-500">{fmtAmt(targetData.totalPending)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: currentTheme?.textMuted }}>Pending (Orders)</p>
            </div>
            <div className="rounded-lg p-3 text-center" style={{ backgroundColor: currentTheme?.surface }}>
              <p className="text-lg font-bold" style={{ color: currentTheme?.primary }}>{fmtAmt(targetData.totalTarget - targetData.totalCombined > 0 ? targetData.totalTarget - targetData.totalCombined : 0)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: currentTheme?.textMuted }}>Remaining</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 justify-end text-[10px]" style={{ color: currentTheme?.textMuted }}>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-green-500 inline-block" /> Confirmed</span>
            <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-green-500 opacity-30 inline-block" /> Pending Orders</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4 glass-text" style={{ color: currentTheme?.text }}>Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={() => navigate(action.path)}
                className="group rounded-xl p-4 border hover:shadow-lg transition-all text-center"
                style={{ 
                  backgroundColor: currentTheme?.surfaceAlt, 
                  borderColor: currentTheme?.border 
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = currentTheme?.primary}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = currentTheme?.border}
              >
                <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-sm" style={{ color: currentTheme?.text }}>{action.title}</p>
                {action.count !== undefined && (
                  <p className="text-xs mt-1" style={{ color: currentTheme?.textMuted }}>{action.count} items</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pending Tasks */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: currentTheme?.text }}>
              <CheckCircle className="w-5 h-5" style={{ color: currentTheme?.primary }} />
              Pending Tasks
            </h3>
            <button onClick={() => navigate("/todos")} className="text-sm hover:underline" style={{ color: currentTheme?.primary }}>View All</button>
          </div>
          <div className="p-4">
            {pendingTasks.length === 0 ? (
              <p className="text-center py-4" style={{ color: currentTheme?.textMuted }}>No pending tasks</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: currentTheme?.surface }}>
                    <div className={`w-2 h-2 rounded-full ${task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: currentTheme?.text }}>{task.title}</p>
                      {task.dueDate && <p className="text-xs" style={{ color: currentTheme?.textMuted }}>Due: {formatDate(task.dueDate)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
            <h3 className="font-semibold flex items-center gap-2" style={{ color: currentTheme?.text }}>
              <Bell className="w-5 h-5 text-orange-600" />
              Upcoming Follow-ups
            </h3>
            <button onClick={() => navigate("/todos")} className="text-sm hover:underline" style={{ color: currentTheme?.primary }}>View All</button>
          </div>
          <div className="p-4">
            {upcomingFollowups.length === 0 ? (
              <p className="text-center py-4" style={{ color: currentTheme?.textMuted }}>No upcoming follow-ups</p>
            ) : (
              <div className="space-y-3">
                {upcomingFollowups.map(followup => (
                  <div key={followup.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: currentTheme?.surface }}>
                    <Calendar className="w-5 h-5" style={{ color: currentTheme?.primary }} />
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: currentTheme?.text }}>{followup.title}</p>
                      <p className="text-xs" style={{ color: currentTheme?.textMuted }}>{followup.contactName} • {formatDate(followup.scheduledDate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Low Stock / Purchase Required Alerts ── */}
      <LowStockAlerts currentTheme={currentTheme} navigate={navigate} />

      {/* ── Employee Management Cards with Liquid-Fill Animation ── */}
      <EmployeeSection currentTheme={currentTheme} navigate={navigate} />
    </div>
  );
}

// ── Low Stock / Purchase Required Alerts ────────────────────────────
function LowStockAlerts({ currentTheme, navigate }) {
  const [lowStockItems, setLowStockItems] = useState([]);

  useEffect(() => {
    try {
      const items = JSON.parse(localStorage.getItem('crm_low_stock_items') || '[]');
      setLowStockItems(items);
    } catch {}

    // Listen for changes
    const handleStorage = (e) => {
      if (e.key === 'crm_low_stock_items') {
        try {
          setLowStockItems(JSON.parse(e.newValue || '[]'));
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (lowStockItems.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 glass-text" style={{ color: currentTheme?.text }}>
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Low Stock - Purchase Required
        </h2>
        <button onClick={() => navigate("/inventory")} className="text-sm flex items-center gap-1 hover:underline" style={{ color: currentTheme?.primary }}>
          View Inventory <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
                <th className="text-left p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Item</th>
                <th className="text-left p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Group</th>
                <th className="text-center p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Current Qty</th>
                <th className="text-center p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Max Qty</th>
                <th className="text-center p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Avg Drop/Sync</th>
                <th className="text-center p-3 font-semibold" style={{ color: currentTheme?.textMuted }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.slice(0, 10).map((item, i) => {
                const severity = item.currentQty <= 0 ? 'critical' : item.currentQty <= item.maxQty * 0.15 ? 'high' : 'medium';
                const statusColors = {
                  critical: { bg: '#ef444420', text: '#ef4444', label: 'Out of Stock' },
                  high: { bg: '#f59e0b20', text: '#f59e0b', label: 'Very Low' },
                  medium: { bg: '#3b82f620', text: '#3b82f6', label: 'Low Stock' }
                };
                const s = statusColors[severity];
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${currentTheme?.border}22` }}
                    className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    <td className="p-3 font-medium" style={{ color: currentTheme?.text }}>{item.name}</td>
                    <td className="p-3 text-xs" style={{ color: currentTheme?.textMuted }}>{item.group}</td>
                    <td className="p-3 text-center font-bold" style={{ color: s.text }}>
                      {item.currentQty} {item.unit}
                    </td>
                    <td className="p-3 text-center" style={{ color: currentTheme?.textMuted }}>
                      {item.maxQty} {item.unit}
                    </td>
                    <td className="p-3 text-center" style={{ color: '#ef4444' }}>
                      -{item.avgDrop} {item.unit}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" 
                        style={{ backgroundColor: s.bg, color: s.text }}>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {lowStockItems.length > 10 && (
          <div className="p-3 text-center text-sm" style={{ color: currentTheme?.textMuted, borderTop: `1px solid ${currentTheme?.border}` }}>
            +{lowStockItems.length - 10} more items need attention
          </div>
        )}
      </div>
    </div>
  );
}

// ── Liquid-Fill Animation Component ──────────────────────────────────
function LiquidFill({ percentage, color, size = 72 }) {
  const [animPct, setAnimPct] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimPct(percentage), 150);
    return () => clearTimeout(t);
  }, [percentage]);

  const r = size / 2;
  const wave1 = animPct;
  const fillY = size - (size * animPct) / 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <clipPath id={`clip-${size}-${color.replace('#', '')}`}>
            <circle cx={r} cy={r} r={r - 2} />
          </clipPath>
        </defs>
        {/* Background circle */}
        <circle cx={r} cy={r} r={r - 2} fill="none" stroke={color} strokeOpacity="0.2" strokeWidth="2" />
        {/* Liquid fill */}
        <g clipPath={`url(#clip-${size}-${color.replace('#', '')})`}>
          <rect x="0" y={fillY} width={size} height={size} fill={color} opacity="0.2"
            style={{ transition: "y 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }} />
          {/* Wave effect */}
          <path
            d={`M 0 ${fillY} Q ${size * 0.25} ${fillY - 4} ${size * 0.5} ${fillY} T ${size} ${fillY} V ${size} H 0 Z`}
            fill={color} opacity="0.35"
            style={{ transition: "d 1.2s cubic-bezier(0.4, 0, 0.2, 1)" }}
          >
            <animate attributeName="d"
              values={`M 0 ${fillY} Q ${size * 0.25} ${fillY - 4} ${size * 0.5} ${fillY} T ${size} ${fillY} V ${size} H 0 Z;M 0 ${fillY} Q ${size * 0.25} ${fillY + 4} ${size * 0.5} ${fillY} T ${size} ${fillY} V ${size} H 0 Z;M 0 ${fillY} Q ${size * 0.25} ${fillY - 4} ${size * 0.5} ${fillY} T ${size} ${fillY} V ${size} H 0 Z`}
              dur="3s" repeatCount="indefinite" />
          </path>
        </g>
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{animPct}%</span>
      </div>
    </div>
  );
}

// ── Employee Section ─────────────────────────────────────────────────
function EmployeeSection({ currentTheme, navigate }) {
  const [employees, setEmployees] = useState(() => {
    try { return JSON.parse(localStorage.getItem("crm_employees") || "[]"); } catch { return []; }
  });

  const attendance = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("crm_attendance") || "{}"); } catch { return {}; }
  }, []);

  // Fetch actual target achievement from database via API
  useEffect(() => {
    if (!employees.length) return;
    const empWithTargets = employees.filter(e => e.monthlyTarget > 0);
    if (!empWithTargets.length) return;

    const now = new Date();
    const fetchTargets = async () => {
      try {
        const res = await axios.post(`${API_BASE}/api/sync/employee-targets`, {
          employeeNames: empWithTargets.map(e => e.name),
          month: now.getMonth(),
          year: now.getFullYear()
        });
        if (res.data?.success && res.data.targets) {
          const targets = res.data.targets;
          let changed = false;
          const updated = employees.map(emp => {
            if (emp.monthlyTarget > 0 && targets[emp.name]) {
              const achieved = Math.round(targets[emp.name].achieved);
              if (emp.targetAchieved !== achieved) {
                changed = true;
                return { ...emp, targetAchieved: achieved, targetVoucherCount: targets[emp.name].voucherCount };
              }
            }
            return emp;
          });
          if (changed) {
            setEmployees(updated);
            try { localStorage.setItem("crm_employees", JSON.stringify(updated)); } catch {}
          }
        }
      } catch (err) {
        console.warn("Dashboard: Failed to fetch employee targets:", err.message);
      }
    };
    fetchTargets();
  }, [employees.length]);

  // Calculate order-based target progress from localStorage
  const orderTargets = useMemo(() => {
    try {
      const orders = JSON.parse(localStorage.getItem("crm_orders") || "[]");
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const targets = {};
      orders.forEach(order => {
        if (!order.otherReferences) return;
        const orderDate = new Date(order.orderDate || order.createdAt);
        if (orderDate.getMonth() !== currentMonth || orderDate.getFullYear() !== currentYear) return;
        
        const empName = order.otherReferences;
        if (!targets[empName]) targets[empName] = { orderAmount: 0, orderCount: 0, convertedAmount: 0, pendingAmount: 0 };
        
        const amount = parseFloat(order.grandTotal) || 0;
        targets[empName].orderAmount += amount;
        targets[empName].orderCount += 1;
        
        if (order.status === 'converted') {
          targets[empName].convertedAmount += amount;
        } else if (!['cancelled'].includes(order.status)) {
          targets[empName].pendingAmount += amount;
        }
      });
      return targets;
    } catch { return {}; }
  }, []);

  if (employees.length === 0) return null;

  const today = new Date();
  const todayKey = (() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  // Today's attendance
  let presentToday = 0, absentToday = 0, leaveToday = 0;
  const active = employees.filter(e => !e.fired);
  active.forEach(emp => {
    const a = attendance[emp.id]?.[todayKey];
    if (a?.status === "present") presentToday++;
    else if (a?.status === "absent") absentToday++;
    else if (a?.status === "leave") leaveToday++;
  });
  const attendancePct = active.length > 0 ? Math.round((presentToday / active.length) * 100) : 0;

  // Target progress (aggregate) - include both voucher-based and order-based
  const withTarget = active.filter(e => e.monthlyTarget > 0);
  const totalTarget = withTarget.reduce((s, e) => s + (e.monthlyTarget || 0), 0);
  const totalVoucherAchieved = withTarget.reduce((s, e) => s + (e.targetAchieved || 0), 0);
  const totalOrderPending = withTarget.reduce((s, e) => s + (orderTargets[e.name]?.pendingAmount || 0), 0);
  const totalCombined = totalVoucherAchieved + totalOrderPending;
  const targetPct = totalTarget > 0 ? Math.min(Math.round((totalCombined / totalTarget) * 100), 100) : 0;
  const voucherPct = totalTarget > 0 ? Math.min(Math.round((totalVoucherAchieved / totalTarget) * 100), 100) : 0;

  // Fired count
  const firedCount = employees.filter(e => e.fired).length;

  const summaryCards = [
    { label: "Present Today", value: presentToday, icon: UserCheck, iconColor: "#22c55e", fillColor: "#22c55e", pct: attendancePct },
    { label: "Absent Today", value: absentToday, icon: UserX, iconColor: "#ef4444", fillColor: "#ef4444", pct: active.length > 0 ? Math.round((absentToday / active.length) * 100) : 0 },
    { label: "On Leave", value: leaveToday, icon: Calendar, iconColor: "#f59e0b", fillColor: "#f59e0b", pct: active.length > 0 ? Math.round((leaveToday / active.length) * 100) : 0 },
    { label: "Target Progress", value: totalTarget > 0 ? `${targetPct}%` : '—', icon: Target, iconColor: currentTheme?.primary, fillColor: currentTheme?.primary, pct: targetPct },
  ];

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2" style={{ color: currentTheme?.text }}>
          <Briefcase className="w-5 h-5" style={{ color: currentTheme?.primary }} />
          Employee Management
        </h2>
        <button onClick={() => navigate("/employees")} className="text-sm flex items-center gap-1 hover:underline" style={{ color: currentTheme?.primary }}>
          View All <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Liquid-fill attendance card + summary grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
        {/* Big attendance card with liquid-fill */}
        <div className="sm:col-span-2 rounded-2xl border p-4 md:p-6 flex items-center gap-4 md:gap-6 transition-all duration-300 hover:shadow-lg"
          style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <LiquidFill percentage={attendancePct} color={currentTheme?.primary || "#6366f1"} size={88} />
          <div>
            <p className="text-sm font-medium" style={{ color: currentTheme?.textMuted }}>Today's Attendance</p>
            <p className="text-3xl font-bold mt-1" style={{ color: currentTheme?.text }}>{presentToday}/{active.length}</p>
            <p className="text-xs mt-1" style={{ color: currentTheme?.textMuted }}>employees present</p>
          </div>
        </div>

        {/* Summary cards */}
        {summaryCards.slice(0, 3).map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={i}
              className="rounded-2xl border p-4 transition-all duration-300 hover:shadow-lg group cursor-pointer"
              style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}
              onClick={() => navigate("/employees/attendance")}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${card.iconColor}14` }}>
                  <Icon className="w-5 h-5" style={{ color: card.iconColor }} />
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: `${card.iconColor}14`, color: card.iconColor }}>
                  {card.pct}%
                </span>
              </div>
              <p className="text-2xl font-bold" style={{ color: currentTheme?.text }}>{card.value}</p>
              <p className="text-xs mt-0.5" style={{ color: currentTheme?.textMuted }}>{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Top employees mini-list */}
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
          <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: currentTheme?.text }}>
            <Users className="w-4 h-4" style={{ color: currentTheme?.primary }} />
            Quick Overview
          </h3>
          <button onClick={() => navigate("/employees/management")} className="text-xs hover:underline" style={{ color: currentTheme?.primary }}>Manage</button>
        </div>
        <div className="divide-y" style={{ borderColor: currentTheme?.border }}>
          {active.slice(0, 4).map(emp => {
            const voucherAchieved = (emp.targetAchieved || 0) * 100;
            const pendingOrders = orderTargets[emp.name]?.pendingAmount || 0;
            const combined = voucherAchieved + pendingOrders;
            const empTargetPct = emp.monthlyTarget > 0 ? Math.min(Math.round((combined / emp.monthlyTarget) * 100), 100) : null;
            const empVoucherPct = emp.monthlyTarget > 0 ? Math.min(Math.round((voucherAchieved / emp.monthlyTarget) * 100), 100) : 0;
            const empPendingPct = emp.monthlyTarget > 0 ? Math.min(Math.round((pendingOrders / emp.monthlyTarget) * 100), 100) : 0;
            return (
            <div key={emp.id} className="flex items-center px-4 py-3 gap-3 transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
              onClick={() => navigate("/employees/management")}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
                {emp.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: currentTheme?.text }}>{emp.name}</p>
                <p className="text-xs truncate" style={{ color: currentTheme?.textMuted }}>{emp.department || emp.designation || "Employee"}</p>
                {empTargetPct !== null && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="h-1.5 flex-1 rounded-full overflow-hidden relative" style={{ backgroundColor: `${currentTheme?.border}66`, maxWidth: 120 }}>
                      {/* Solid bar for voucher-confirmed deals */}
                      <div className="h-full rounded-full absolute left-0 top-0" style={{ width: `${empVoucherPct}%`, backgroundColor: empVoucherPct >= 75 ? '#22c55e' : empVoucherPct >= 50 ? '#f59e0b' : '#ef4444' }} />
                      {/* Light bar for pending orders (on top, extends further) */}
                      {empPendingPct > 0 && (
                        <div className="h-full rounded-full absolute left-0 top-0" style={{ width: `${Math.min(empVoucherPct + empPendingPct, 100)}%`, backgroundColor: empVoucherPct >= 75 ? '#22c55e' : empVoucherPct >= 50 ? '#f59e0b' : '#ef4444', opacity: 0.3 }} />
                      )}
                    </div>
                    <span className="text-[10px] font-medium whitespace-nowrap" style={{ color: empTargetPct >= 75 ? '#22c55e' : empTargetPct >= 50 ? '#f59e0b' : '#ef4444' }}>
                      {empVoucherPct}%{empPendingPct > 0 && <span className="opacity-60">+{empPendingPct}%</span>}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium" style={{ color: attendance[emp.id]?.[todayKey]?.status === "present" ? "#22c55e" : "#ef4444" }}>
                  {attendance[emp.id]?.[todayKey]?.status === "present" ? "Present" : attendance[emp.id]?.[todayKey]?.status === "leave" ? "Leave" : "—"}
                </p>
              </div>
            </div>
          );})}
          {active.length === 0 && (
            <p className="text-center py-4 text-sm" style={{ color: currentTheme?.textMuted }}>No active employees</p>
          )}
        </div>
      </div>

      {/* ── Detailed Target Tracking Section ── */}
      {withTarget.length > 0 && (
        <div className="mt-4 rounded-2xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="p-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: currentTheme?.text }}>
              <Target className="w-4 h-4" style={{ color: currentTheme?.primary }} />
              Monthly Target Tracking
            </h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-green-500 inline-block" /> Confirmed</span>
              <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-full bg-green-500 opacity-30 inline-block" /> Pending Orders</span>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {withTarget.map(emp => {
              const voucherAmt = (emp.targetAchieved || 0) * 100;
              const pendingAmt = orderTargets[emp.name]?.pendingAmount || 0;
              const orderCount = orderTargets[emp.name]?.orderCount || 0;
              const combinedAmt = voucherAmt + pendingAmt;
              const target = emp.monthlyTarget || 0;
              const vPct = target > 0 ? Math.min(Math.round((voucherAmt / target) * 100), 100) : 0;
              const pPct = target > 0 ? Math.min(Math.round((pendingAmt / target) * 100), 100) : 0;
              const totalPct = Math.min(vPct + pPct, 100);
              const color = vPct >= 75 ? '#22c55e' : vPct >= 50 ? '#f59e0b' : '#ef4444';
              const formatAmt = (a) => a >= 100000 ? `₹${(a/100000).toFixed(1)}L` : a >= 1000 ? `₹${(a/1000).toFixed(1)}K` : `₹${a}`;

              return (
                <div key={emp.id} className="rounded-xl p-3" style={{ backgroundColor: currentTheme?.surface }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: `linear-gradient(135deg, ${currentTheme?.primary}, ${currentTheme?.accent})` }}>
                        {emp.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium" style={{ color: currentTheme?.text }}>{emp.name}</p>
                        <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>
                          Target: {formatAmt(target)} • Vouchers: {emp.targetVoucherCount || 0} • Orders: {orderCount}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color }}>{totalPct}%</p>
                      <p className="text-[10px]" style={{ color: currentTheme?.textMuted }}>
                        {formatAmt(voucherAmt)} confirmed{pendingAmt > 0 && ` + ${formatAmt(pendingAmt)} pending`}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: `${currentTheme?.border}44` }}>
                    <div className="h-full rounded-full absolute left-0 top-0 transition-all duration-700" style={{ width: `${vPct}%`, backgroundColor: color }} />
                    {pPct > 0 && <div className="h-full rounded-full absolute left-0 top-0 transition-all duration-700" style={{ width: `${totalPct}%`, backgroundColor: color, opacity: 0.3 }} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
