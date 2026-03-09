import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import axios from "axios";
import {
  BarChart3, PieChart, TrendingUp, TrendingDown, FileText, Users, Package,
  Calendar, Download, X, ArrowUpRight, IndianRupee, ShoppingCart, Receipt,
  CreditCard, Building, Briefcase, Target, Clock, Filter
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Report card definitions
const REPORT_CARDS = [
  {
    id: "sales_summary",
    title: "Sales Summary",
    description: "Overview of all sales transactions with party-wise breakdown",
    icon: TrendingUp,
    color: "bg-green-500",
    category: "Financial"
  },
  {
    id: "purchase_summary",
    title: "Purchase Summary",
    description: "Summary of all purchases with vendor analysis",
    icon: ShoppingCart,
    color: "bg-red-500",
    category: "Financial"
  },
  {
    id: "receipts_payments",
    title: "Receipts & Payments",
    description: "Cash flow analysis with receipts and payments breakdown",
    icon: CreditCard,
    color: "bg-blue-500",
    category: "Financial"
  },
  {
    id: "outstanding",
    title: "Outstanding Report",
    description: "Pending payments from customers and to vendors",
    icon: Clock,
    color: "bg-orange-500",
    category: "Financial"
  },
  {
    id: "employee_performance",
    title: "Employee Performance",
    description: "Sales targets, attendance, and performance metrics",
    icon: Users,
    color: "bg-purple-500",
    category: "HR"
  },
  {
    id: "attendance_report",
    title: "Attendance Report",
    description: "Monthly attendance summary for all employees",
    icon: Calendar,
    color: "bg-indigo-500",
    category: "HR"
  },
  {
    id: "inventory_stock",
    title: "Inventory Stock",
    description: "Current stock levels and low stock alerts",
    icon: Package,
    color: "bg-teal-500",
    category: "Inventory"
  },
  {
    id: "party_ledger",
    title: "Party Ledger",
    description: "Detailed ledger for each party with transactions",
    icon: Building,
    color: "bg-pink-500",
    category: "Ledgers"
  }
];

export default function Reports() {
  const { user, isAdminOrHigher } = useAuth();
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const categories = [...new Set(REPORT_CARDS.map(r => r.category))];

  const filteredReports = REPORT_CARDS.filter(r => !filterCategory || r.category === filterCategory);

  // Generate report data
  const generateReport = async (reportId) => {
    setLoading(true);
    setSelectedReport(reportId);
    
    try {
      let data = null;
      
      switch (reportId) {
        case "sales_summary": {
          const res = await axios.get(`${API_BASE}/api/vouchers?type=sales`);
          const raw = res.data;
          const vouchers = Array.isArray(raw) ? raw : (raw?.vouchers || raw?.data || []);
          const totalAmount = vouchers.reduce((sum, v) => sum + Math.abs(Number(v.amount) || Number(v.totalAmount) || 0), 0);
          const partyWise = {};
          vouchers.forEach(v => {
            const party = v.party_ledger || v.party || "Unknown";
            partyWise[party] = (partyWise[party] || 0) + Math.abs(Number(v.amount) || Number(v.totalAmount) || 0);
          });
          // Monthly breakdown
          const monthlyData = {};
          vouchers.forEach(v => {
            if (!v.date) return;
            const d = new Date(v.date);
            const key = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
            monthlyData[key] = (monthlyData[key] || 0) + Math.abs(Number(v.amount) || Number(v.totalAmount) || 0);
          });
          data = { 
            title: "Sales Summary Report",
            totalVouchers: vouchers.length,
            totalAmount,
            partyWise: Object.entries(partyWise).sort((a, b) => b[1] - a[1]).slice(0, 15),
            monthlyBreakdown: Object.entries(monthlyData),
            vouchers: vouchers.slice(0, 30)
          };
          break;
        }
        
        case "purchase_summary": {
          const res = await axios.get(`${API_BASE}/api/vouchers?type=purchase`);
          const raw = res.data;
          const vouchers = Array.isArray(raw) ? raw : (raw?.vouchers || raw?.data || []);
          const totalAmount = vouchers.reduce((sum, v) => sum + Math.abs(Number(v.amount) || Number(v.totalAmount) || 0), 0);
          const vendorWise = {};
          vouchers.forEach(v => {
            const vendor = v.party_ledger || v.party || "Unknown";
            vendorWise[vendor] = (vendorWise[vendor] || 0) + Math.abs(Number(v.amount) || Number(v.totalAmount) || 0);
          });
          data = { 
            title: "Purchase Summary Report",
            totalVouchers: vouchers.length,
            totalAmount,
            vendorWise: Object.entries(vendorWise).sort((a, b) => b[1] - a[1]).slice(0, 15),
            vouchers: vouchers.slice(0, 30)
          };
          break;
        }
        
        case "receipts_payments": {
          const [receiptsRes, paymentsRes] = await Promise.all([
            axios.get(`${API_BASE}/api/vouchers?type=receipt`),
            axios.get(`${API_BASE}/api/vouchers?type=payment`)
          ]);
          const rawR = receiptsRes.data;
          const rawP = paymentsRes.data;
          const receipts = Array.isArray(rawR) ? rawR : (rawR?.vouchers || rawR?.data || []);
          const payments = Array.isArray(rawP) ? rawP : (rawP?.vouchers || rawP?.data || []);
          const totalReceipts = receipts.reduce((sum, v) => sum + Math.abs(Number(v.amount) || 0), 0);
          const totalPayments = payments.reduce((sum, v) => sum + Math.abs(Number(v.amount) || 0), 0);
          data = {
            title: "Receipts & Payments Report",
            totalReceipts: receipts.length,
            totalReceiptAmount: totalReceipts,
            totalPayments: payments.length,
            totalPaymentAmount: totalPayments,
            netCashFlow: totalReceipts - totalPayments,
            receipts: receipts.slice(0, 15),
            payments: payments.slice(0, 15)
          };
          break;
        }
        
        case "outstanding": {
          // Fetch sales and receipts to calculate outstanding
          const [salesRes, receiptRes] = await Promise.all([
            axios.get(`${API_BASE}/api/vouchers?type=sales`),
            axios.get(`${API_BASE}/api/vouchers?type=receipt`)
          ]);
          const rawS = salesRes.data;
          const rawRcpt = receiptRes.data;
          const sales = Array.isArray(rawS) ? rawS : (rawS?.vouchers || rawS?.data || []);
          const receiptsData = Array.isArray(rawRcpt) ? rawRcpt : (rawRcpt?.vouchers || rawRcpt?.data || []);
          
          // Party-wise outstanding
          const partyTotals = {};
          sales.forEach(v => {
            const party = v.party_ledger || v.party || "Unknown";
            if (!partyTotals[party]) partyTotals[party] = { sales: 0, received: 0 };
            partyTotals[party].sales += Math.abs(Number(v.amount) || Number(v.totalAmount) || 0);
          });
          receiptsData.forEach(v => {
            const party = v.party_ledger || v.party || "Unknown";
            if (!partyTotals[party]) partyTotals[party] = { sales: 0, received: 0 };
            partyTotals[party].received += Math.abs(Number(v.amount) || 0);
          });
          
          const outstandingList = Object.entries(partyTotals)
            .map(([party, vals]) => ({ party, sales: vals.sales, received: vals.received, outstanding: vals.sales - vals.received }))
            .filter(p => p.outstanding > 0)
            .sort((a, b) => b.outstanding - a.outstanding);
          
          const totalOutstanding = outstandingList.reduce((s, p) => s + p.outstanding, 0);
          
          data = {
            title: "Outstanding Report",
            totalOutstanding,
            totalParties: outstandingList.length,
            outstandingList: outstandingList.slice(0, 20)
          };
          break;
        }
        
        case "employee_performance": {
          const employees = JSON.parse(localStorage.getItem("crm_employees") || "[]");
          const attendance = JSON.parse(localStorage.getItem("crm_attendance") || "{}");
          const orders = JSON.parse(localStorage.getItem("crm_orders") || "[]");
          const now = new Date();
          const empData = employees.map(emp => {
            const empAttendance = attendance[emp.id] || {};
            const presentDays = Object.values(empAttendance).filter(a => a.status === "present").length;
            // Calculate actual target progress from orders and targetAchieved
            const empOrders = orders.filter(o => o.otherReferences === emp.name);
            const orderValue = empOrders.reduce((s, o) => s + (parseFloat(o.grandTotal) || 0), 0);
            const achieved = (emp.targetAchieved || 0) * 100;
            const target = emp.monthlyTarget || 0;
            const progress = target > 0 ? Math.min(Math.round(((achieved + orderValue) / target) * 100), 100) : 0;
            return { ...emp, presentDays, targetProgress: progress, achieved, orderValue, orderCount: empOrders.length };
          });
          data = {
            title: "Employee Performance Report",
            totalEmployees: employees.length,
            employees: empData
          };
          break;
        }
        
        case "attendance_report": {
          const employees = JSON.parse(localStorage.getItem("crm_employees") || "[]");
          const attendance = JSON.parse(localStorage.getItem("crm_attendance") || "{}");
          const now = new Date();
          const month = now.getMonth();
          const year = now.getFullYear();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          let totalPresent = 0, totalAbsent = 0, totalLeave = 0;
          const empData = employees.map(emp => {
            const empAttendance = attendance[emp.id] || {};
            let present = 0, absent = 0, leave = 0;
            // Use date key format YYYY-MM-DD to avoid timezone issues
            for (let day = 1; day <= daysInMonth; day++) {
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const a = empAttendance[dateKey];
              if (a) {
                if (a.status === "present") present++;
                else if (a.status === "absent") absent++;
                else if (a.status === "leave") leave++;
              }
            }
            totalPresent += present;
            totalAbsent += absent;
            totalLeave += leave;
            return { ...emp, present, absent, leave };
          });
          data = {
            title: "Attendance Report",
            month: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
            totalPresent,
            totalAbsent,
            totalLeave,
            totalEmployees: employees.length,
            daysInMonth,
            employees: empData
          };
          break;
        }
        
        case "inventory_stock": {
          try {
            const res = await axios.get(`${API_BASE}/api/inventory`);
            const raw = res.data;
            const items = Array.isArray(raw) ? raw : (raw?.inventory || raw?.data || raw?.items || []);
            // Filter out items with group = 'services'
            const filtered = items.filter(i => (i.group || '').toString().trim().toLowerCase() !== 'services');
            const totalItems = filtered.length;
            const getQty = (i) => Number(i.quantity) || Number(i.closing_qty) || Number(i.qty) || 0;
            const getRate = (i) => Number(i.rate) || Number(i.closing_rate) || Number(i.selling_rate) || 0;
            const lowStock = filtered.filter(i => {
              const q = getQty(i);
              return q > 0 && q <= 10;
            });
            const totalValue = filtered.reduce((s, i) => s + (getQty(i) * getRate(i)), 0);
            data = {
              title: "Inventory Stock Report",
              totalItems,
              lowStockCount: lowStock.length,
              totalStockValue: totalValue,
              lowStockItems: lowStock.slice(0, 20).map(i => ({
                name: i.name || i.item_name || '-',
                qty: getQty(i),
                unit: i.unit || 'Nos'
              })),
              items: filtered.slice(0, 50).map(i => ({
                name: i.name || i.item_name || '-',
                qty: getQty(i),
                rate: getRate(i),
                unit: i.unit || 'Nos',
                group: i.group || '-'
              }))
            };
          } catch (err) {
            data = { title: "Inventory Stock Report", error: "Could not fetch inventory: " + err.message };
          }
          break;
        }
        
        case "party_ledger": {
          try {
            const res = await axios.get(`${API_BASE}/api/ledgers`);
            const raw = res.data;
            const ledgers = Array.isArray(raw) ? raw : (raw?.ledgers || raw?.data || []);
            const grouped = {};
            ledgers.forEach(l => {
              const group = l.group || l.parent || 'Other';
              if (!grouped[group]) grouped[group] = [];
              grouped[group].push(l);
            });
            data = {
              title: "Party Ledger Report",
              totalLedgers: ledgers.length,
              groups: Object.entries(grouped).map(([name, items]) => ({
                name,
                count: items.length,
                totalBalance: items.reduce((s, l) => s + (Math.abs(Number(l.closing_balance) || 0)), 0)
              })).sort((a, b) => b.totalBalance - a.totalBalance),
              ledgers: ledgers.slice(0, 30)
            };
          } catch (err) {
            data = { title: "Party Ledger Report", error: "Could not fetch ledgers: " + err.message };
          }
          break;
        }
        
        default:
          data = { title: "Report", message: "Report data coming soon" };
      }
      
      setReportData(data);
    } catch (err) {
      console.error("Report generation error:", err);
      setReportData({ title: "Error", error: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="glass-text">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Reports</h1>
          <p className="text-gray-500 dark:text-gray-400">Generate and view detailed business reports</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-4 mb-6">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"
        >
          <option value="">All Categories</option>
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredReports.map(report => {
          const Icon = report.icon;
          return (
            <button
              key={report.id}
              onClick={() => generateReport(report.id)}
              className="group bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className={`w-12 h-12 ${report.color} rounded-xl flex items-center justify-center`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">{report.title}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{report.description}</p>
              <span className="mt-3 inline-block px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                {report.category}
              </span>
            </button>
          );
        })}
      </div>

      {/* Report Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setSelectedReport(null); setReportData(null); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{reportData?.title || "Loading..."}</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1">
                  <Download className="w-4 h-4" /> Export
                </button>
                <button onClick={() => { setSelectedReport(null); setReportData(null); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-500">Generating report...</p>
                </div>
              ) : reportData?.error ? (
                <div className="text-center py-12 text-red-500">{reportData.error}</div>
              ) : reportData ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  {(reportData.totalAmount !== undefined || reportData.totalVouchers !== undefined) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {reportData.totalVouchers !== undefined && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <p className="text-sm text-blue-600">Total Vouchers</p>
                          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{reportData.totalVouchers}</p>
                        </div>
                      )}
                      {reportData.totalAmount !== undefined && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <p className="text-sm text-green-600">Total Amount</p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-300">{formatCurrency(reportData.totalAmount)}</p>
                        </div>
                      )}
                      {reportData.netCashFlow !== undefined && (
                        <div className={`p-4 rounded-lg ${reportData.netCashFlow >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
                          <p className="text-sm text-gray-600">Net Cash Flow</p>
                          <p className={`text-2xl font-bold ${reportData.netCashFlow >= 0 ? "text-green-700" : "text-red-700"}`}>{formatCurrency(reportData.netCashFlow)}</p>
                        </div>
                      )}
                      {reportData.totalReceiptAmount !== undefined && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg">
                          <p className="text-sm text-emerald-600">Receipts ({reportData.totalReceipts})</p>
                          <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{formatCurrency(reportData.totalReceiptAmount)}</p>
                        </div>
                      )}
                      {reportData.totalPaymentAmount !== undefined && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <p className="text-sm text-red-600">Payments ({reportData.totalPayments})</p>
                          <p className="text-2xl font-bold text-red-900 dark:text-red-300">{formatCurrency(reportData.totalPaymentAmount)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Attendance Summary Stats */}
                  {reportData.totalPresent !== undefined && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="text-sm text-blue-600">Employees</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{reportData.totalEmployees}</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <p className="text-sm text-green-600">Total Present</p>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-300">{reportData.totalPresent}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <p className="text-sm text-red-600">Total Absent</p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-300">{reportData.totalAbsent}</p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                        <p className="text-sm text-amber-600">On Leave</p>
                        <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">{reportData.totalLeave}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Outstanding Report Stats */}
                  {reportData.totalOutstanding !== undefined && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                        <p className="text-sm text-orange-600">Total Outstanding</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">{formatCurrency(reportData.totalOutstanding)}</p>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="text-sm text-blue-600">Parties with Dues</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{reportData.totalParties}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Outstanding List */}
                  {reportData.outstandingList && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Outstanding Parties</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="px-4 py-2 text-left">Party</th>
                              <th className="px-4 py-2 text-right">Sales</th>
                              <th className="px-4 py-2 text-right">Received</th>
                              <th className="px-4 py-2 text-right">Outstanding</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.outstandingList.map((p, idx) => (
                              <tr key={idx} className="border-b dark:border-gray-700">
                                <td className="px-4 py-2 font-medium">{p.party}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(p.sales)}</td>
                                <td className="px-4 py-2 text-right text-green-600">{formatCurrency(p.received)}</td>
                                <td className="px-4 py-2 text-right font-bold text-red-600">{formatCurrency(p.outstanding)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Inventory Stats */}
                  {reportData.totalItems !== undefined && (
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                        <p className="text-sm text-teal-600">Total Items</p>
                        <p className="text-2xl font-bold text-teal-900 dark:text-teal-300">{reportData.totalItems}</p>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                        <p className="text-sm text-red-600">Low Stock Items</p>
                        <p className="text-2xl font-bold text-red-900 dark:text-red-300">{reportData.lowStockCount}</p>
                      </div>
                      {reportData.totalStockValue !== undefined && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <p className="text-sm text-green-600">Stock Value</p>
                          <p className="text-2xl font-bold text-green-900 dark:text-green-300">{formatCurrency(reportData.totalStockValue)}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Low Stock Items */}
                  {reportData.lowStockItems && reportData.lowStockItems.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-red-700 dark:text-red-400 mb-3">Low Stock Alerts (≤ 10 units)</h3>
                      <div className="space-y-2">
                        {reportData.lowStockItems.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                            <span className="font-medium text-gray-900 dark:text-white">{item.name}</span>
                            <span className="text-red-600 font-bold">{item.qty} {item.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Inventory Items */}
                  {reportData.items && !reportData.vouchers && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Stock Items ({reportData.items.length})</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="px-4 py-2 text-left">Item</th>
                              <th className="px-4 py-2 text-left">Group</th>
                              <th className="px-4 py-2 text-right">Qty</th>
                              <th className="px-4 py-2 text-left">Unit</th>
                              <th className="px-4 py-2 text-right">Rate</th>
                              <th className="px-4 py-2 text-right">Value</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.items.map((item, idx) => (
                              <tr key={idx} className="border-b dark:border-gray-700">
                                <td className="px-4 py-2 font-medium">{item.name}</td>
                                <td className="px-4 py-2 text-gray-500">{item.group || '-'}</td>
                                <td className="px-4 py-2 text-right">{item.qty || '-'}</td>
                                <td className="px-4 py-2">{item.unit}</td>
                                <td className="px-4 py-2 text-right">{item.rate ? formatCurrency(item.rate) : '-'}</td>
                                <td className="px-4 py-2 text-right">{item.qty && item.rate ? formatCurrency(item.qty * item.rate) : '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Ledger Groups */}
                  {reportData.groups && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ledger Groups ({reportData.totalLedgers} total)</h3>
                      <div className="space-y-2">
                        {reportData.groups.map((g, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">{g.name}</span>
                              <span className="text-xs text-gray-500 ml-2">({g.count} ledgers)</span>
                            </div>
                            <span className="text-gray-700 dark:text-gray-300 font-semibold">{formatCurrency(g.totalBalance)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Monthly Breakdown */}
                  {reportData.monthlyBreakdown && reportData.monthlyBreakdown.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Monthly Breakdown</h3>
                      <div className="space-y-2">
                        {reportData.monthlyBreakdown.map(([month, amount], idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="font-medium text-gray-900 dark:text-white">{month}</span>
                            <span className="text-gray-600 dark:text-gray-400 font-semibold">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Party/Vendor Wise Breakdown */}
                  {(reportData.partyWise || reportData.vendorWise) && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
                        {reportData.partyWise ? "Top Parties" : "Top Vendors"}
                      </h3>
                      <div className="space-y-2">
                        {(reportData.partyWise || reportData.vendorWise).map(([name, amount], idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                            <span className="font-medium text-gray-900 dark:text-white">{name}</span>
                            <span className="text-gray-600 dark:text-gray-400">{formatCurrency(amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Employee Data */}
                  {reportData.employees && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Employee Details</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="px-4 py-2 text-left">Name</th>
                              <th className="px-4 py-2 text-left">Department</th>
                              {reportData.employees[0]?.present !== undefined && <>
                                <th className="px-4 py-2 text-center">Present</th>
                                <th className="px-4 py-2 text-center">Absent</th>
                                <th className="px-4 py-2 text-center">Leave</th>
                              </>}
                              {reportData.employees[0]?.targetProgress !== undefined && <>
                                <th className="px-4 py-2 text-left">Target</th>
                                <th className="px-4 py-2 text-left">Progress</th>
                              </>}
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.employees.map(emp => (
                              <tr key={emp.id} className="border-b dark:border-gray-700">
                                <td className="px-4 py-2 font-medium">{emp.name}</td>
                                <td className="px-4 py-2">{emp.department || "-"}</td>
                                {emp.present !== undefined && <>
                                  <td className="px-4 py-2 text-center text-green-600">{emp.present}</td>
                                  <td className="px-4 py-2 text-center text-red-600">{emp.absent}</td>
                                  <td className="px-4 py-2 text-center text-blue-600">{emp.leave}</td>
                                </>}
                                {emp.targetProgress !== undefined && <>
                                  <td className="px-4 py-2">{formatCurrency(emp.monthlyTarget || 0)}</td>
                                  <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div className={`h-2 rounded-full ${emp.targetProgress >= 75 ? 'bg-green-500' : emp.targetProgress >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${emp.targetProgress}%` }}></div>
                                      </div>
                                      <span className="text-xs whitespace-nowrap">{emp.targetProgress}%</span>
                                    </div>
                                  </td>
                                </>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Voucher List */}
                  {reportData.vouchers && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Vouchers</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="px-4 py-2 text-left">Date</th>
                              <th className="px-4 py-2 text-left">Voucher No</th>
                              <th className="px-4 py-2 text-left">Party</th>
                              <th className="px-4 py-2 text-right">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.vouchers.map((v, idx) => (
                              <tr key={idx} className="border-b dark:border-gray-700">
                                <td className="px-4 py-2">{v.date?.slice(0, 10) || "-"}</td>
                                <td className="px-4 py-2">{v.voucher_number || "-"}</td>
                                <td className="px-4 py-2">{v.party_ledger || v.party || "-"}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(Math.abs(v.amount || v.totalAmount || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Ledger List */}
                  {reportData.ledgers && (
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Ledger Details</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                              <th className="px-4 py-2 text-left">Name</th>
                              <th className="px-4 py-2 text-left">Group</th>
                              <th className="px-4 py-2 text-right">Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.ledgers.map((l, idx) => (
                              <tr key={idx} className="border-b dark:border-gray-700">
                                <td className="px-4 py-2 font-medium">{l.name || '-'}</td>
                                <td className="px-4 py-2">{l.group || l.parent || '-'}</td>
                                <td className="px-4 py-2 text-right">{formatCurrency(Math.abs(l.closing_balance || 0))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
