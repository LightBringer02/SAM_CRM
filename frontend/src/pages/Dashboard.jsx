import { useAuth } from "../auth";
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
        // Try to fetch voucher stats
        try {
          const salesRes = await axios.get(`${API_BASE}/api/vouchers?type=sales&limit=1`);
          const purchaseRes = await axios.get(`${API_BASE}/api/vouchers?type=purchase&limit=1`);
          const receiptRes = await axios.get(`${API_BASE}/api/vouchers?type=receipt&limit=1`);
          const paymentRes = await axios.get(`${API_BASE}/api/vouchers?type=payment&limit=1`);
          
          // Get counts from response
          setStats(prev => ({
            ...prev,
            totalSales: salesRes.data?.total || salesRes.data?.data?.length || 0,
            totalPurchases: purchaseRes.data?.total || purchaseRes.data?.data?.length || 0,
            totalReceipts: receiptRes.data?.total || receiptRes.data?.data?.length || 0,
            totalPayments: paymentRes.data?.total || paymentRes.data?.data?.length || 0
          }));
        } catch {}

        // Load local storage data
        const employees = JSON.parse(localStorage.getItem("crm_employees") || "[]");
        const todos = JSON.parse(localStorage.getItem("crm_todos") || "[]");
        const followups = JSON.parse(localStorage.getItem("crm_followups") || "[]");

        setStats(prev => ({
          ...prev,
          employeeCount: employees.length
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

        // Generate recent activity
        const activities = [];
        if (todos.length > 0) {
          const recentTodo = todos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          if (recentTodo) activities.push({ type: "task", message: `Task created: ${recentTodo.title}`, time: recentTodo.createdAt });
        }
        if (employees.length > 0) {
          const recentEmp = employees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
          if (recentEmp) activities.push({ type: "employee", message: `Employee added: ${recentEmp.name}`, time: recentEmp.createdAt });
        }
        setRecentActivity(activities.slice(0, 5));

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
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Welcome back, {user?.name || user?.username}! Here's your business overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalSales}</p>
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

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Purchases</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalPurchases}</p>
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

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Receipts</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalReceipts}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Receipt className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-blue-600">
            <span>Money received</span>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Payments</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stats.totalPayments}</p>
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {quickActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <button
                key={idx}
                onClick={() => navigate(action.path)}
                className="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all text-center"
              >
                <div className={`w-12 h-12 ${action.color} rounded-xl flex items-center justify-center mx-auto mb-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{action.title}</p>
                {action.count !== undefined && (
                  <p className="text-xs text-gray-500 mt-1">{action.count} items</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Tasks */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Pending Tasks
            </h3>
            <button onClick={() => navigate("/todos")} className="text-sm text-blue-600 hover:underline">View All</button>
          </div>
          <div className="p-4">
            {pendingTasks.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No pending tasks</p>
            ) : (
              <div className="space-y-3">
                {pendingTasks.map(task => (
                  <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full ${task.priority === "high" ? "bg-red-500" : task.priority === "medium" ? "bg-yellow-500" : "bg-green-500"}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{task.title}</p>
                      {task.dueDate && <p className="text-xs text-gray-500">Due: {formatDate(task.dueDate)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Follow-ups */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Upcoming Follow-ups
            </h3>
            <button onClick={() => navigate("/todos")} className="text-sm text-blue-600 hover:underline">View All</button>
          </div>
          <div className="p-4">
            {upcomingFollowups.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No upcoming follow-ups</p>
            ) : (
              <div className="space-y-3">
                {upcomingFollowups.map(followup => (
                  <div key={followup.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{followup.title}</p>
                      <p className="text-xs text-gray-500">{followup.contactName} • {formatDate(followup.scheduledDate)}</p>
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
