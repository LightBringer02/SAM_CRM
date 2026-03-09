import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import {
  Truck, Package, CheckCircle, Clock, Search, Filter, ChevronDown,
  ChevronRight, MapPin, Calendar, User, AlertCircle, Send, Box,
  ArrowRight, RefreshCw, Eye, X, FileText
} from "lucide-react";

const ORDERS_KEY = "crm_orders";

function getOrdersFromStorage() {
  try {
    const stored = localStorage.getItem(ORDERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveOrdersToStorage(orders) {
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(orders)); return true; } catch { return false; }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(dateStr) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const DELIVERY_STATUSES = [
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle },
  { value: "processing", label: "Processing", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", icon: Package },
  { value: "dispatched", label: "Dispatched", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400", icon: Send },
  { value: "shipped", label: "Shipped", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Truck },
  { value: "in_transit", label: "In Transit", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", icon: Truck },
  { value: "out_for_delivery", label: "Out for Delivery", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", icon: MapPin },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
];

function getStatusInfo(status) {
  return DELIVERY_STATUSES.find(s => s.value === status) || DELIVERY_STATUSES[0];
}

export default function Delivery() {
  const { user } = useAuth();
  const { currentTheme } = useTheme();

  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEwayBill, setFilterEwayBill] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [message, setMessage] = useState(null);

  // Dispatch form
  const [dispatchForm, setDispatchForm] = useState({
    dispatchDate: new Date().toISOString().slice(0, 10),
    dispatchThrough: "",
    trackingNumber: "",
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    estimatedDelivery: "",
    notes: ""
  });

  // Load orders
  useEffect(() => {
    const allOrders = getOrdersFromStorage();
    // Only show orders that are confirmed or beyond (not draft/pending/cancelled)
    const deliveryOrders = allOrders.filter(o =>
      ['confirmed', 'processing', 'dispatched', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(o.status)
    );
    setOrders(deliveryOrders);
  }, []);

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchesSearch = !search ||
        (o.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.partyName || '').toLowerCase().includes(search.toLowerCase()) ||
        (o.destination || '').toLowerCase().includes(search.toLowerCase());
      const matchesStatus = !filterStatus || o.status === filterStatus;
      const matchesEway = !filterEwayBill || (parseFloat(o.grandTotal) || 0) > 50000;
      return matchesSearch && matchesStatus && matchesEway;
    });
  }, [orders, search, filterStatus, filterEwayBill]);

  // Stats
  const stats = useMemo(() => {
    const confirmed = orders.filter(o => o.status === 'confirmed').length;
    const processing = orders.filter(o => o.status === 'processing').length;
    const dispatched = orders.filter(o => ['dispatched', 'shipped', 'in_transit', 'out_for_delivery'].includes(o.status)).length;
    const delivered = orders.filter(o => o.status === 'delivered').length;
    return { confirmed, processing, dispatched, delivered, total: orders.length };
  }, [orders]);

  // Update order status
  const updateOrderStatus = useCallback((orderId, newStatus, extraData = {}) => {
    const allOrders = getOrdersFromStorage();
    const updatedAll = allOrders.map(o => {
      if (o.id === orderId || o.orderNumber === orderId) {
        const updated = { ...o, status: newStatus, ...extraData };
        // Add timeline entry
        if (!updated.timeline) updated.timeline = [];
        updated.timeline.push({
          status: newStatus,
          timestamp: new Date().toISOString(),
          updatedBy: user?.name || user?.username || 'System',
          notes: extraData.notes || ''
        });
        return updated;
      }
      return o;
    });
    saveOrdersToStorage(updatedAll);
    // Update local state
    const deliveryOrders = updatedAll.filter(o =>
      ['confirmed', 'processing', 'dispatched', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(o.status)
    );
    setOrders(deliveryOrders);
    // Update selected order if viewing
    if (selectedOrder && (selectedOrder.id === orderId || selectedOrder.orderNumber === orderId)) {
      const updated = updatedAll.find(o => o.id === orderId || o.orderNumber === orderId);
      setSelectedOrder(updated || null);
    }
    setMessage({ type: 'success', text: `Order status updated to ${newStatus}` });
  }, [user, selectedOrder]);

  // Handle dispatch
  const handleDispatch = useCallback(() => {
    if (!selectedOrder) return;
    const id = selectedOrder.id || selectedOrder.orderNumber;
    updateOrderStatus(id, 'dispatched', {
      dispatchDate: dispatchForm.dispatchDate,
      dispatchThrough: dispatchForm.dispatchThrough,
      trackingNumber: dispatchForm.trackingNumber,
      vehicleNumber: dispatchForm.vehicleNumber,
      driverName: dispatchForm.driverName,
      driverPhone: dispatchForm.driverPhone,
      estimatedDelivery: dispatchForm.estimatedDelivery,
      notes: dispatchForm.notes
    });
    setShowDispatchModal(false);
    setDispatchForm({
      dispatchDate: new Date().toISOString().slice(0, 10),
      dispatchThrough: "", trackingNumber: "", vehicleNumber: "",
      driverName: "", driverPhone: "", estimatedDelivery: "", notes: ""
    });
  }, [selectedOrder, dispatchForm, updateOrderStatus]);

  // Mark as delivered
  const markDelivered = useCallback((order) => {
    const id = order.id || order.orderNumber;
    updateOrderStatus(id, 'delivered', {
      deliveredDate: new Date().toISOString(),
      deliveredBy: user?.name || user?.username || 'System'
    });
  }, [updateOrderStatus, user]);

  // Open dispatch modal
  const openDispatchModal = (order) => {
    setSelectedOrder(order);
    setDispatchForm({
      dispatchDate: new Date().toISOString().slice(0, 10),
      dispatchThrough: order.dispatchThrough || "",
      trackingNumber: order.trackingNumber || "",
      vehicleNumber: order.vehicleNumber || "",
      driverName: order.driverName || "",
      driverPhone: order.driverPhone || "",
      estimatedDelivery: order.estimatedDelivery || order.deliveryDate || "",
      notes: ""
    });
    setShowDispatchModal(true);
  };

  // Get next status for quick action
  const getNextStatus = (currentStatus) => {
    const flow = ['confirmed', 'processing', 'dispatched', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'];
    const idx = flow.indexOf(currentStatus);
    return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
  };

  return (
    <div className="p-4 md:p-6 max-w-full min-h-screen" style={{ color: currentTheme?.text }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="glass-text">
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: currentTheme?.text }}>
            <Truck className="w-7 h-7" style={{ color: currentTheme?.primary }} />
            Delivery Management
          </h1>
          <p className="text-sm mt-1" style={{ color: currentTheme?.textMuted }}>
            Track order dispatches and deliveries
          </p>
        </div>
        <button
          onClick={() => {
            const allOrders = getOrdersFromStorage();
            const deliveryOrders = allOrders.filter(o =>
              ['confirmed', 'processing', 'dispatched', 'shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(o.status)
            );
            setOrders(deliveryOrders);
            setMessage({ type: 'success', text: 'Orders refreshed' });
          }}
          className="px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition hover:opacity-80"
          style={{ backgroundColor: currentTheme?.primary, color: '#fff' }}
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'success'
            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
            : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Total Orders", value: stats.total, icon: Box, color: currentTheme?.primary || '#6366f1' },
          { label: "Confirmed", value: stats.confirmed, icon: CheckCircle, color: '#3b82f6' },
          { label: "Processing", value: stats.processing, icon: Package, color: '#8b5cf6' },
          { label: "In Transit", value: stats.dispatched, icon: Truck, color: '#f59e0b' },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle, color: '#22c55e' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="rounded-xl p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-5 h-5" style={{ color: stat.color }} />
                <span className="text-2xl font-bold" style={{ color: currentTheme?.text }}>{stat.value}</span>
              </div>
              <p className="text-xs" style={{ color: currentTheme?.textMuted }}>{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: currentTheme?.textMuted }} />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm"
          style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
        >
          <option value="">All Statuses</option>
          {DELIVERY_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterEwayBill(!filterEwayBill)}
          className={`px-3 py-2 border rounded-lg text-sm font-medium flex items-center gap-2 transition ${filterEwayBill ? 'bg-amber-100 border-amber-400 text-amber-800 dark:bg-amber-900/30 dark:border-amber-600 dark:text-amber-400' : ''}`}
          style={!filterEwayBill ? { backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text } : undefined}
        >
          <FileText className="w-4 h-4" />
          E-Way Bill Eligible
        </button>
      </div>

      {/* Orders Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: currentTheme?.surface, borderBottom: `1px solid ${currentTheme?.border}` }}>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: currentTheme?.textMuted }}>Order #</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: currentTheme?.textMuted }}>Party</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: currentTheme?.textMuted }}>Date</th>
                <th className="px-4 py-3 text-right font-semibold" style={{ color: currentTheme?.textMuted }}>Amount</th>
                <th className="px-4 py-3 text-left font-semibold" style={{ color: currentTheme?.textMuted }}>Destination</th>
                <th className="px-4 py-3 text-center font-semibold" style={{ color: currentTheme?.textMuted }}>Status</th>
                <th className="px-4 py-3 text-center font-semibold" style={{ color: currentTheme?.textMuted }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Truck className="w-10 h-10 opacity-30" style={{ color: currentTheme?.textMuted }} />
                      <p style={{ color: currentTheme?.textMuted }}>No delivery orders found</p>
                      <p className="text-xs" style={{ color: currentTheme?.textMuted }}>Confirmed orders will appear here</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const statusInfo = getStatusInfo(order.status);
                  const nextStatus = getNextStatus(order.status);
                  const StatusIcon = statusInfo.icon;
                  return (
                    <tr key={order.id || order.orderNumber}
                      className="transition hover:opacity-90 cursor-pointer"
                      style={{ borderBottom: `1px solid ${currentTheme?.border}` }}
                      onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                    >
                      <td className="px-4 py-3 font-medium" style={{ color: currentTheme?.text }}>
                        {order.orderNumber || '-'}
                      </td>
                      <td className="px-4 py-3" style={{ color: currentTheme?.text }}>
                        <p className="font-medium">{order.partyName || '-'}</p>
                        {order.partyPhone && <p className="text-xs" style={{ color: currentTheme?.textMuted }}>{order.partyPhone}</p>}
                      </td>
                      <td className="px-4 py-3" style={{ color: currentTheme?.textMuted }}>
                        {formatDate(order.orderDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold" style={{ color: currentTheme?.text }}>
                        <div className="flex flex-col items-end gap-1">
                          <span>{formatCurrency(order.grandTotal)}</span>
                          {(parseFloat(order.grandTotal) || 0) > 50000 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                              <FileText className="w-3 h-3" />
                              E-Way Bill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: currentTheme?.textMuted }}>
                        {order.destination || order.partyAddress?.substring(0, 30) || '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {order.status === 'confirmed' && (
                            <button
                              onClick={() => openDispatchModal(order)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1 transition"
                              title="Dispatch Order"
                            >
                              <Send className="w-3 h-3" />
                              Dispatch
                            </button>
                          )}
                          {order.status === 'processing' && (
                            <button
                              onClick={() => openDispatchModal(order)}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-medium flex items-center gap-1 transition"
                              title="Dispatch Order"
                            >
                              <Send className="w-3 h-3" />
                              Dispatch
                            </button>
                          )}
                          {['dispatched', 'shipped', 'in_transit', 'out_for_delivery'].includes(order.status) && (
                            <button
                              onClick={() => markDelivered(order)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium flex items-center gap-1 transition"
                              title="Mark Delivered"
                            >
                              <CheckCircle className="w-3 h-3" />
                              Delivered
                            </button>
                          )}
                          {nextStatus && order.status !== 'confirmed' && order.status !== 'processing' && order.status !== 'delivered' && (
                            <button
                              onClick={() => updateOrderStatus(order.id || order.orderNumber, nextStatus)}
                              className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition"
                              style={{ backgroundColor: `${currentTheme?.primary}20`, color: currentTheme?.primary }}
                              title={`Move to ${getStatusInfo(nextStatus).label}`}
                            >
                              <ArrowRight className="w-3 h-3" />
                              {getStatusInfo(nextStatus).label}
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="p-1 rounded transition hover:opacity-80"
                            style={{ color: currentTheme?.primary }}
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Pane */}
      {selectedOrder && !showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setSelectedOrder(null)}>
          <div className="rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4" style={{ borderBottom: `1px solid ${currentTheme?.border}` }}>
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: currentTheme?.text }}>
                <Package className="w-5 h-5" style={{ color: currentTheme?.primary }} />
                Order {selectedOrder.orderNumber}
              </h2>
              <button onClick={() => setSelectedOrder(null)} className="p-1 rounded hover:opacity-70">
                <X className="w-5 h-5" style={{ color: currentTheme?.textMuted }} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Party</p>
                  <p className="font-semibold" style={{ color: currentTheme?.text }}>{selectedOrder.partyName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Amount</p>
                  <p className="font-semibold" style={{ color: currentTheme?.text }}>{formatCurrency(selectedOrder.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Order Date</p>
                  <p style={{ color: currentTheme?.text }}>{formatDate(selectedOrder.orderDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Delivery Date</p>
                  <p style={{ color: currentTheme?.text }}>{formatDate(selectedOrder.deliveryDate || selectedOrder.estimatedDelivery)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Destination</p>
                  <p style={{ color: currentTheme?.text }}>{selectedOrder.destination || selectedOrder.partyAddress || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Dispatched Through</p>
                  <p style={{ color: currentTheme?.text }}>{selectedOrder.dispatchThrough || '-'}</p>
                </div>
                {selectedOrder.trackingNumber && (
                  <div>
                    <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Tracking #</p>
                    <p style={{ color: currentTheme?.text }}>{selectedOrder.trackingNumber}</p>
                  </div>
                )}
                {selectedOrder.vehicleNumber && (
                  <div>
                    <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Vehicle No.</p>
                    <p style={{ color: currentTheme?.text }}>{selectedOrder.vehicleNumber}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium" style={{ color: currentTheme?.textMuted }}>Created By</p>
                  <p style={{ color: currentTheme?.text }}>{selectedOrder.otherReferences || '-'}</p>
                </div>
              </div>

              {/* Items */}
              {Array.isArray(selectedOrder.items) && selectedOrder.items.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: currentTheme?.textMuted }}>Items ({selectedOrder.items.length})</p>
                  <div className="rounded-lg border overflow-hidden" style={{ borderColor: currentTheme?.border }}>
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ backgroundColor: currentTheme?.surface }}>
                          <th className="px-3 py-2 text-left" style={{ color: currentTheme?.textMuted }}>Item</th>
                          <th className="px-3 py-2 text-center" style={{ color: currentTheme?.textMuted }}>Qty</th>
                          <th className="px-3 py-2 text-right" style={{ color: currentTheme?.textMuted }}>Rate</th>
                          <th className="px-3 py-2 text-right" style={{ color: currentTheme?.textMuted }}>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items.map((item, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${currentTheme?.border}` }}>
                            <td className="px-3 py-2" style={{ color: currentTheme?.text }}>{item.name || item.itemName || '-'}</td>
                            <td className="px-3 py-2 text-center" style={{ color: currentTheme?.text }}>{item.qty || item.quantity || 0}</td>
                            <td className="px-3 py-2 text-right" style={{ color: currentTheme?.text }}>{formatCurrency(item.rate)}</td>
                            <td className="px-3 py-2 text-right font-medium" style={{ color: currentTheme?.text }}>{formatCurrency(item.amount || (item.qty * item.rate))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {Array.isArray(selectedOrder.timeline) && selectedOrder.timeline.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: currentTheme?.textMuted }}>Delivery Timeline</p>
                  <div className="space-y-3">
                    {selectedOrder.timeline.map((entry, i) => {
                      const info = getStatusInfo(entry.status);
                      const EntryIcon = info.icon;
                      return (
                        <div key={i} className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${info.color}`}>
                              <EntryIcon className="w-4 h-4" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: currentTheme?.text }}>{info.label}</p>
                            <p className="text-xs" style={{ color: currentTheme?.textMuted }}>
                              {formatDateTime(entry.timestamp)} {entry.updatedBy ? `by ${entry.updatedBy}` : ''}
                            </p>
                            {entry.notes && <p className="text-xs mt-1" style={{ color: currentTheme?.textMuted }}>{entry.notes}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status Actions */}
              <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: `1px solid ${currentTheme?.border}` }}>
                {(selectedOrder.status === 'confirmed' || selectedOrder.status === 'processing') && (
                  <button
                    onClick={() => openDispatchModal(selectedOrder)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition"
                  >
                    <Send className="w-4 h-4" />
                    Dispatch Order
                  </button>
                )}
                {['dispatched', 'shipped', 'in_transit', 'out_for_delivery'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => markDelivered(selectedOrder)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark as Delivered
                  </button>
                )}
                {selectedOrder.status !== 'delivered' && getNextStatus(selectedOrder.status) && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id || selectedOrder.orderNumber, getNextStatus(selectedOrder.status))}
                    className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                    style={{ backgroundColor: `${currentTheme?.primary}15`, color: currentTheme?.primary }}
                  >
                    <ArrowRight className="w-4 h-4" />
                    Move to {getStatusInfo(getNextStatus(selectedOrder.status)).label}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Modal */}
      {showDispatchModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowDispatchModal(false)}>
          <div className="rounded-xl shadow-xl w-full max-w-lg mx-4 p-6"
            style={{ backgroundColor: currentTheme?.surfaceAlt, border: `1px solid ${currentTheme?.border}` }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: currentTheme?.text }}>
                Dispatch Order {selectedOrder.orderNumber}
              </h2>
              <button onClick={() => setShowDispatchModal(false)} className="p-1 rounded hover:opacity-70">
                <X className="w-5 h-5" style={{ color: currentTheme?.textMuted }} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Dispatch Date *</label>
                  <input
                    type="date"
                    value={dispatchForm.dispatchDate}
                    onChange={e => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Estimated Delivery</label>
                  <input
                    type="date"
                    value={dispatchForm.estimatedDelivery}
                    onChange={e => setDispatchForm({ ...dispatchForm, estimatedDelivery: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Dispatched Through</label>
                <input
                  type="text"
                  value={dispatchForm.dispatchThrough}
                  onChange={e => setDispatchForm({ ...dispatchForm, dispatchThrough: e.target.value })}
                  placeholder="e.g. Blue Dart, DTDC, Own Vehicle"
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Tracking Number</label>
                  <input
                    type="text"
                    value={dispatchForm.trackingNumber}
                    onChange={e => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
                    placeholder="AWB / Tracking ID"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Vehicle Number</label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleNumber}
                    onChange={e => setDispatchForm({ ...dispatchForm, vehicleNumber: e.target.value })}
                    placeholder="e.g. MH-01-AB-1234"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Driver Name</label>
                  <input
                    type="text"
                    value={dispatchForm.driverName}
                    onChange={e => setDispatchForm({ ...dispatchForm, driverName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Driver Phone</label>
                  <input
                    type="text"
                    value={dispatchForm.driverPhone}
                    onChange={e => setDispatchForm({ ...dispatchForm, driverPhone: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: currentTheme?.textMuted }}>Notes</label>
                <textarea
                  value={dispatchForm.notes}
                  onChange={e => setDispatchForm({ ...dispatchForm, notes: e.target.value })}
                  rows={2}
                  placeholder="Any additional dispatch notes..."
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="px-4 py-2 rounded-lg text-sm transition"
                style={{ color: currentTheme?.textMuted }}
              >
                Cancel
              </button>
              <button
                onClick={handleDispatch}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition"
              >
                <Send className="w-4 h-4" />
                Confirm Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
