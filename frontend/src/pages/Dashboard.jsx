import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useState, useEffect } from "react";
import { 
  FileText, Edit3, Trash2, Clock, ChevronRight, Plus, TrendingUp, TrendingDown,
  Users, Package, IndianRupee, ShoppingCart, Receipt, CreditCard, BarChart3,
  ArrowUpRight, ArrowDownRight, Calendar, Activity, Bell, CheckCircle
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
      <div className="mb-8">
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

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4" style={{ color: currentTheme?.text }}>Quick Actions</h2>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
    </div>
  );
}
