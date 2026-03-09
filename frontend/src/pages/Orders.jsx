import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import axios from "axios";
import {
  Plus, Trash2, Edit2, Save, X, Search, Package, ShoppingCart,
  Send, AlertCircle, CheckCircle, Building, User, Loader2, Lock, Unlock
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const ORDERS_KEY = "crm_orders";
const RATE_LIST_KEY = "crm_rate_list";
const EDIT_APPROVALS_KEY = "crm_order_edit_approvals";
const NOTIFICATIONS_KEY = "crm_notifications";

function getRateListFromStorage() {
  try {
    return JSON.parse(localStorage.getItem(RATE_LIST_KEY) || '[]');
  } catch { return []; }
}

// ── Edit Lock Helpers ───────────────────────────────────────────────
function getEditApprovals() {
  try { return JSON.parse(localStorage.getItem(EDIT_APPROVALS_KEY) || '[]'); } catch { return []; }
}
function saveEditApprovals(arr) { localStorage.setItem(EDIT_APPROVALS_KEY, JSON.stringify(arr)); }

function hasApprovedEdit(orderId, userId) {
  const approvals = getEditApprovals();
  return approvals.some(a => a.orderId === orderId && a.userId === userId && !a.used);
}

function consumeEditApproval(orderId, userId) {
  const approvals = getEditApprovals();
  const updated = approvals.map(a =>
    a.orderId === orderId && a.userId === userId && !a.used ? { ...a, used: true } : a
  );
  saveEditApprovals(updated);
}

function sendEditRequestNotification(order, requestingUser) {
  try {
    const notifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || '[]');
    // Skip if there's already a pending request for this order by this user
    const existing = notifications.find(
      n => n.isEditRequest && n.orderId === order.id && n.requestedBy === requestingUser.id && n.editStatus === 'pending'
    );
    if (existing) return false; // already pending
    const notif = {
      id: Date.now(),
      type: 'warning',
      title: 'Order Edit Request',
      message: `${requestingUser.username || requestingUser.email} requests permission to edit Order ${order.orderNumber} (${order.partyName})`,
      time: new Date().toISOString(),
      read: false,
      page: 'orders',
      isEditRequest: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      requestedBy: requestingUser.id,
      requestedByName: requestingUser.username || requestingUser.email,
      editStatus: 'pending'
    };
    notifications.unshift(notif);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    window.dispatchEvent(new Event('notificationAdded'));
    return true;
  } catch { return false; }
}

const ORDER_STATUS = [
  { value: "draft", label: "Draft", color: "bg-gray-100 text-gray-700" },
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { value: "processing", label: "Processing", color: "bg-purple-100 text-purple-700" },
  { value: "shipped", label: "Shipped", color: "bg-indigo-100 text-indigo-700" },
  { value: "delivered", label: "Delivered", color: "bg-green-100 text-green-700" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-700" },
  { value: "converted", label: "Converted to Sales", color: "bg-emerald-100 text-emerald-700" }
];

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

export default function Orders() {
  const { user, isAdminOrHigher, hasPermission, loading: authLoading } = useAuth();
  const { currentTheme } = useTheme();

  // Core state
  const [orders, setOrders] = useState([]);
  const [rateList, setRateList] = useState([]);
  const [inventory, setInventory] = useState([]); // Keep for fallback
  const [ledgers, setLedgers] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [employees, setEmployees] = useState([]);
  
  // UI state - showCreatePage for modal order creation
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [limitedEdit, setLimitedEdit] = useState(false); // invoice generator restricted mode
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState(null);

  // ESC key to close create/edit modal
  useEffect(() => {
    if (!showCreatePage) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowCreatePage(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreatePage]);
  
  // Form state
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  const [showInventoryDropdown, setShowInventoryDropdown] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  
  // New ledger popup state
  const [showNewLedgerPopup, setShowNewLedgerPopup] = useState(false);
  const [newLedgerDetails, setNewLedgerDetails] = useState({ name: '', gstin: '', phone: '', address: '', state: '' });
  
  const canViewRates = user && ((typeof isAdminOrHigher === 'function' && isAdminOrHigher()) || 
                       (typeof hasPermission === 'function' && hasPermission('view_rates')));
  
  const [orderForm, setOrderForm] = useState({
    orderNumber: "", orderDate: new Date().toISOString().slice(0, 10), partyName: "", partyGstin: "",
    partyAddress: "", partyPhone: "", partyState: "", deliveryDate: "", paymentTerms: "", narration: "",
    // Additional reference fields
    referenceNo: "", otherReferences: user?.name || user?.username || "", buyersOrderNo: "", buyersOrderDate: "",
    dispatchThrough: "", destination: "", termsOfDelivery: "",
    items: [], status: "draft", subtotal: 0, cgstTotal: 0, sgstTotal: 0, grandTotal: 0
  });

  // Initialize page - load orders from localStorage immediately, then load API data in background
  useEffect(() => {
    if (authLoading) return;
    // Immediately load orders from localStorage
    const localOrders = getOrdersFromStorage();
    setOrders(localOrders);
    // Load rate list from localStorage
    const localRateList = getRateListFromStorage();
    setRateList(localRateList);
    setPageLoading(false);
    // Load API data in background (non-blocking)
    const loadApiData = async () => {
      try {
        const [invRes, ledgersRes, empRes] = await Promise.all([
          axios.get(`${API_BASE}/api/inventory`).catch(() => ({ data: { data: [] } })),
          // Fetch ledgers with balances for showing outstanding amounts
          axios.get(`${API_BASE}/api/ledgers/with-balances/sundry-debtors?limit=500`).catch(() => 
            // Fallback to regular list if with-balances endpoint fails
            axios.get(`${API_BASE}/api/ledgers/list/sundry-debtors?limit=500`).catch(() => ({ data: { ledgers: [] } }))
          ),
          // Fetch employees for other_references dropdown
          axios.get(`${API_BASE}/api/employees`).catch(() => ({ data: { employees: [] } }))
        ]);
        // Handle different API response formats: {data: [...]} or {items: [...]} or [...]
        const invData = invRes.data?.data || invRes.data?.items || (Array.isArray(invRes.data) ? invRes.data : []);
        setInventory(Array.isArray(invData) ? invData : []);
        setLedgers(ledgersRes.data?.ledgers || []);
        // Set employees for other_references
        const empData = empRes.data?.employees || empRes.data || [];
        setEmployees(Array.isArray(empData) ? empData : []);
      } catch (err) {
        console.error("[Orders] Failed to load API data:", err);
      }
      // Load blacklist separately
      try {
        const blRes = await axios.get(`${API_BASE}/api/blacklist`, {
          headers: { 'x-user-id': user?.id?.toString() || '', 'x-user-role': user?.role || 'user' }
        });
        setBlacklist(blRes.data?.ledgers || []);
      } catch {
        const stored = localStorage.getItem('crm_blacklisted_ledgers');
        setBlacklist(stored ? JSON.parse(stored) : []);
        console.warn("[Orders] Blacklist fallback from localStorage");
      }
    };
    loadApiData();
  }, [authLoading, user?.id, user?.role]);

  const isBlacklisted = useCallback((ledgerName) => {
    return blacklist.some(b => b.name?.toLowerCase() === ledgerName?.toLowerCase());
  }, [blacklist]);

  // Generate session-based order number (e.g., ORD/25-26/1)
  const generateOrderNumber = useCallback(() => {
    const d = new Date();
    // Financial year: April to March. If month >= 4 (April), session is current year - next year
    const month = d.getMonth(); // 0-indexed
    const year = d.getFullYear();
    const sessionStartYear = month >= 3 ? year : year - 1; // April = month 3
    const sessionEndYear = sessionStartYear + 1;
    const session = `${sessionStartYear.toString().slice(-2)}-${sessionEndYear.toString().slice(-2)}`;
    
    // Count orders in current session
    const sessionOrders = orders.filter(o => {
      if (!o.orderNumber) return false;
      return o.orderNumber.includes(`/${session}/`);
    });
    
    return `ORD/${session}/${(sessionOrders.length + 1)}`;
  }, [orders]);

  const resetForm = useCallback(() => {
    setOrderForm({
      orderNumber: generateOrderNumber(), orderDate: new Date().toISOString().slice(0, 10), partyName: "", partyGstin: "",
      partyAddress: "", partyPhone: "", partyState: "", deliveryDate: "", paymentTerms: "", narration: "",
      referenceNo: "", otherReferences: user?.name || user?.username || "", buyersOrderNo: "", buyersOrderDate: "",
      dispatchThrough: "", destination: "", termsOfDelivery: "",
      items: [], status: "draft", subtotal: 0, cgstTotal: 0, sgstTotal: 0, grandTotal: 0
    });
    setEditingOrder(null);
    setLimitedEdit(false);
    setPartySuggestions([]);
    setShowPartySuggestions(false);
  }, [generateOrderNumber, user?.name, user?.username]);

  // ── Edit Lock Logic ──────────────────────────────────────────────
  const handleEditClick = useCallback((order) => {
    // Admin/root can always edit fully
    if (isAdminOrHigher()) {
      setEditingOrder(order);
      setOrderForm(order);
      setLimitedEdit(false);
      setShowCreatePage(true);
      return;
    }
    // Invoice generators can edit limited fields (dispatch/delivery/narration only)
    if (hasPermission('generate_invoice')) {
      setEditingOrder(order);
      setOrderForm(order);
      setLimitedEdit(true);
      setShowCreatePage(true);
      return;
    }
    // Check for approved edit permission
    if (hasApprovedEdit(order.id, user?.id)) {
      consumeEditApproval(order.id, user?.id);
      setEditingOrder(order);
      setOrderForm(order);
      setLimitedEdit(false);
      setShowCreatePage(true);
      setMessage({ type: 'success', text: 'Edit permission used (one-time).' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    // Otherwise, send an edit request notification to admin
    const sent = sendEditRequestNotification(order, user);
    if (sent) {
      setMessage({ type: 'info', text: `Edit request sent to admin for Order ${order.orderNumber}. You will be notified when approved.` });
    } else {
      setMessage({ type: 'info', text: `Edit request already pending for this order.` });
    }
    setTimeout(() => setMessage(null), 5000);
  }, [isAdminOrHigher, hasPermission, user]);

  const handlePartyNameChange = (value) => {
    setOrderForm({ ...orderForm, partyName: value });
    if (value.length >= 1) {
      const searchLower = value.toLowerCase();
      const filtered = ledgers.filter(l => 
        (l.name || '').toLowerCase().includes(searchLower) ||
        (l.alias || l.alias_name || '').toLowerCase().includes(searchLower) ||
        (l.phone || '').includes(value) ||
        (l.gstin || '').toLowerCase().includes(searchLower)
      ).slice(0, 15);
      setPartySuggestions(filtered);
      setShowPartySuggestions(filtered.length > 0);
    } else {
      setPartySuggestions([]);
      setShowPartySuggestions(false);
    }
  };

  const selectParty = async (ledger) => {
    if (isBlacklisted(ledger.name)) {
      setMessage({ type: 'error', text: `${ledger.name} is blacklisted` });
      setTimeout(() => setMessage(null), 4000);
      setPartySuggestions([]);
      setShowPartySuggestions(false);
      return;
    }

    // Use data directly from the ledger list first for instant feedback
    let addressStr = '';
    if (ledger.address) {
      addressStr = Array.isArray(ledger.address) ? ledger.address.join(', ') : String(ledger.address);
    }

    let gstin = ledger.gstin || ledger.gst_number || ledger.party_gstin || '';
    let phone = ledger.phone || ledger.mobile || '';
    let state = ledger.state || '';

    setOrderForm(prev => ({
      ...prev,
      partyName: ledger.name || '',
      partyGstin: gstin,
      partyAddress: addressStr,
      partyPhone: phone,
      partyState: state
    }));
    setPartySuggestions([]);
    setShowPartySuggestions(false);

    // Fetch from ledger detail API only (not from vouchers)
    try {
      const res = await axios.get(`${API_BASE}/api/ledgers/detail/${encodeURIComponent(ledger.name)}`);
      if (res.data?.success && res.data?.ledger) {
        const fullDetails = res.data.ledger;
        let fullAddress = '';
        if (fullDetails.address) {
          fullAddress = Array.isArray(fullDetails.address) ? fullDetails.address.join(', ') : String(fullDetails.address);
        }
        const detailGstin = fullDetails.gstin || fullDetails.gst_number || fullDetails.party_gstin || '';
        const detailPhone = fullDetails.phone || fullDetails.mobile || '';
        const detailState = fullDetails.state || '';
        
        setOrderForm(prev => ({
          ...prev,
          partyGstin: detailGstin || prev.partyGstin || '',
          partyAddress: fullAddress || prev.partyAddress || '',
          partyPhone: detailPhone || prev.partyPhone || '',
          partyState: detailState || prev.partyState || ''
        }));
        gstin = detailGstin || gstin;
        phone = detailPhone || phone;
        addressStr = fullAddress || addressStr;
        state = detailState || state;
      }
    } catch (err) {
      console.warn("[Orders] Failed to fetch ledger details:", err);
    }

    // Check if essential details are missing - show new ledger popup (only if phone AND address missing)
    // GSTIN is optional for unregistered firms
    if (!phone && !addressStr) {
      setNewLedgerDetails({ name: ledger.name, gstin: gstin || '', phone: '', address: '', state: state || '' });
      setShowNewLedgerPopup(true);
    }
  };

  const addItem = () => {
    setOrderForm({ ...orderForm, items: [...orderForm.items, { id: Date.now().toString(), name: "", hsn: "", qty: 1, unit: "Nos", rate: 0, gstPercent: 18, cgst: 0, sgst: 0, amount: 0 }] });
  };

  const addItemFromInventory = (invItem) => {
    // Auto-fill rate from rate list item
    const itemRate = parseFloat(invItem.rate) || 0;
    const gstPercent = parseFloat(invItem.gst_rate) || parseFloat(invItem.gst_percent) || parseFloat(invItem.gst) || 18;
    const amount = itemRate;  // qty=1 * rate
    const gstAmount = (amount * gstPercent) / 100;
    
    const newItem = {
      id: Date.now().toString(),
      name: invItem.name || invItem.item_name || '',
      hsn: invItem.hsn || invItem.hsn_code || '',
      qty: 1,
      unit: invItem.unit || invItem.stock_unit || 'Nos',
      rate: itemRate, // Auto-fill rate from rate list
      gstPercent: gstPercent,
      cgst: gstAmount / 2, 
      sgst: gstAmount / 2, 
      amount: amount
    };

    const items = [...orderForm.items, newItem];
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0;
    items.forEach(item => { subtotal += item.amount || 0; cgstTotal += item.cgst || 0; sgstTotal += item.sgst || 0; });
    setOrderForm({ ...orderForm, items, subtotal, cgstTotal, sgstTotal, grandTotal: subtotal + cgstTotal + sgstTotal });
    setShowInventoryDropdown(false);
    setInventorySearch("");
  };

  // Use rate list for filtering, fallback to inventory if rate list is empty
  const itemSource = rateList.length > 0 ? rateList : inventory;
  
  // Build inventory quantity lookup map from API inventory data (or localStorage cache)
  const invQtyMap = React.useMemo(() => {
    const m = {};
    // First try from inventory state (API data)
    if (inventory.length > 0) {
      inventory.forEach(inv => {
        const name = (inv.name || inv.item_name || '').toLowerCase();
        if (name) m[name] = parseFloat(inv.quantity || inv.closing_qty || inv.stock_quantity || 0);
      });
    }
    // Fallback/supplement from localStorage cached qty map (set by RateList page)
    try {
      const cached = JSON.parse(localStorage.getItem('crm_inventory_qty_map') || '{}');
      Object.entries(cached).forEach(([key, val]) => {
        if (!(key in m)) m[key] = parseFloat(val) || 0;
      });
    } catch {}
    return m;
  }, [inventory]);

  // Calculate booked quantities per item from all active orders (not delivered/cancelled/converted)
  const bookedQtyMap = React.useMemo(() => {
    const qtyMap = {};
    orders.forEach(order => {
      // Only count orders that are still active (not delivered, cancelled, or converted)
      if (['delivered', 'cancelled', 'converted'].includes(order.status)) return;
      (order.items || []).forEach(item => {
        const itemName = (item.name || '').toLowerCase();
        if (itemName) {
          qtyMap[itemName] = (qtyMap[itemName] || 0) + (parseFloat(item.qty) || 0);
        }
      });
    });
    return qtyMap;
  }, [orders]);

  const filteredInventory = (Array.isArray(itemSource) ? itemSource : []).filter(item => {
    const s = inventorySearch.toLowerCase();
    const itemName = (item.name || item.item_name || '').toLowerCase();
    const itemAlias = (item.alias || item.alias_name || '').toLowerCase();
    const itemHsn = (item.hsn || item.hsn_code || '').toLowerCase();
    return itemName.includes(s) || itemAlias.includes(s) || itemHsn.includes(s);
  }).slice(0, 20);

  const updateItem = (index, field, value) => {
    const items = [...orderForm.items];
    items[index][field] = value;
    const qty = parseFloat(items[index].qty) || 0, rate = parseFloat(items[index].rate) || 0, gstPercent = parseFloat(items[index].gstPercent) || 0;
    const amount = qty * rate, gstAmount = (amount * gstPercent) / 100;
    items[index].amount = amount; items[index].cgst = gstAmount / 2; items[index].sgst = gstAmount / 2;
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0;
    items.forEach(item => { subtotal += item.amount || 0; cgstTotal += item.cgst || 0; sgstTotal += item.sgst || 0; });
    setOrderForm({ ...orderForm, items, subtotal, cgstTotal, sgstTotal, grandTotal: subtotal + cgstTotal + sgstTotal });
  };

  const removeItem = (index) => {
    const items = orderForm.items.filter((_, i) => i !== index);
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0;
    items.forEach(item => { subtotal += item.amount || 0; cgstTotal += item.cgst || 0; sgstTotal += item.sgst || 0; });
    setOrderForm({ ...orderForm, items, subtotal, cgstTotal, sgstTotal, grandTotal: subtotal + cgstTotal + sgstTotal });
  };

  const handleItemNameChange = (index, value) => {
    updateItem(index, 'name', value);
    if (value.length >= 2) {
      const searchVal = value.toLowerCase();
      // Use rate list for suggestions, fallback to inventory
      const source = rateList.length > 0 ? rateList : inventory;
      const filtered = (Array.isArray(source) ? source : []).filter(item => {
        const itemName = (item.name || item.item_name || '').toLowerCase();
        const itemAlias = (item.alias || item.alias_name || '').toLowerCase();
        return itemName.includes(searchVal) || itemAlias.includes(searchVal);
      }).slice(0, 10);
      setSuggestions(filtered); setActiveSuggestionField(index);
    } else { setSuggestions([]); setActiveSuggestionField(null); }
  };

  const selectItem = (index, item) => {
    const items = [...orderForm.items];
    // Auto-fill rate from rate list
    const itemRate = parseFloat(item.rate) || 0;
    const gstPercent = parseFloat(item.gst_rate) || parseFloat(item.gst) || 18;
    items[index] = { ...items[index], name: item.name || item.item_name || '', hsn: item.hsn || '', unit: item.unit || 'Nos', rate: itemRate, gstPercent: gstPercent };
    const qty = parseFloat(items[index].qty) || 1, rate = parseFloat(items[index].rate) || 0;
    const amount = qty * rate, gstAmount = (amount * gstPercent) / 100;
    items[index].amount = amount; items[index].cgst = gstAmount / 2; items[index].sgst = gstAmount / 2;
    let subtotal = 0, cgstTotal = 0, sgstTotal = 0;
    items.forEach(i => { subtotal += i.amount || 0; cgstTotal += i.cgst || 0; sgstTotal += i.sgst || 0; });
    setOrderForm({ ...orderForm, items, subtotal, cgstTotal, sgstTotal, grandTotal: subtotal + cgstTotal + sgstTotal });
    setSuggestions([]); setActiveSuggestionField(null);
  };

  const saveOrder = () => {
    if (!orderForm.partyName.trim()) { setMessage({ type: "error", text: "Party name is required" }); return; }
    if (orderForm.items.length === 0) { setMessage({ type: "error", text: "At least one item is required" }); return; }
    // Always enforce current user's name as otherReferences
    const formToSave = { ...orderForm, otherReferences: user?.name || user?.username || orderForm.otherReferences };
    if (editingOrder) {
      const updated = orders.map(o => o.id === editingOrder.id ? { ...formToSave, id: editingOrder.id, updatedAt: new Date().toISOString() } : o);
      saveOrdersToStorage(updated); setOrders(updated); setMessage({ type: "success", text: "Order updated!" });
    } else {
      const newOrder = { ...formToSave, id: Date.now().toString(), orderNumber: formToSave.orderNumber || generateOrderNumber(), createdAt: new Date().toISOString(), createdBy: user?.id };
      const updated = [...orders, newOrder]; saveOrdersToStorage(updated); setOrders(updated); setMessage({ type: "success", text: "Order created!" });
    }
    setShowCreatePage(false); resetForm(); setTimeout(() => setMessage(null), 3000);
  };

  const deleteOrder = (id) => {
    if (!window.confirm("Delete this order?")) return;
    const updated = orders.filter(o => o.id !== id); saveOrdersToStorage(updated); setOrders(updated);
    setMessage({ type: "success", text: "Order deleted!" }); setTimeout(() => setMessage(null), 3000);
  };

  const updateStatus = (id, status) => {
    const updated = orders.map(o => o.id === id ? { ...o, status, updatedAt: new Date().toISOString() } : o);
    saveOrdersToStorage(updated); setOrders(updated);
  };

  const convertToSales = async (order) => {
    setLoading(true);
    try {
      const salesVoucher = {
        voucher_type: "Sales", 
        date: order.orderDate, 
        party_ledger: order.partyName, 
        party_gstin: order.partyGstin,
        party_address: order.partyAddress, 
        party_state: order.partyState,
        reference: order.orderNumber, 
        narration: order.narration || `Converted from Order ${order.orderNumber}`,
        // Additional reference fields
        reference_no: order.referenceNo,
        other_references: order.otherReferences,
        buyers_order_no: order.buyersOrderNo,
        buyers_order_date: order.buyersOrderDate,
        dispatched_through: order.dispatchThrough,
        destination: order.destination,
        terms_of_delivery: order.termsOfDelivery,
        items: order.items.map(item => ({ name: item.name, hsn: item.hsn, qty: item.qty, rate: item.rate, per: item.unit, amount: item.amount, gst: { cgst: item.gstPercent / 2, sgst: item.gstPercent / 2, igst: 0 } })),
        amount: order.grandTotal
      };
      const res = await axios.post(`${API_BASE}/api/tally/create-voucher`, salesVoucher);
      if (res.data.success) { updateStatus(order.id, "converted"); setMessage({ type: "success", text: `Order converted to Sales Voucher!` }); }
      else { setMessage({ type: "error", text: res.data.error || "Failed to create sales voucher" }); }
    } catch (err) { setMessage({ type: "error", text: "Failed to convert: " + (err.response?.data?.error || err.message) }); }
    finally { setLoading(false); setTimeout(() => setMessage(null), 5000); }
  };

  const filteredOrders = orders.filter(o => {
    const matchesSearch = !search || o.orderNumber?.toLowerCase().includes(search.toLowerCase()) || o.partyName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const stats = { total: orders.length, draft: orders.filter(o => o.status === "draft").length, pending: orders.filter(o => o.status === "pending").length, confirmed: orders.filter(o => o.status === "confirmed").length, converted: orders.filter(o => o.status === "converted").length };

  // Loading state
  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
          <p className="text-gray-500">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="glass-text">
          <h1 className="text-3xl font-bold" style={{ color: currentTheme?.text || '#1e293b' }}>Orders</h1>
          <p style={{ color: currentTheme?.textMuted || '#64748b' }}>Create and manage orders for conversion to sales vouchers</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowCreatePage(true); }} 
          className="px-4 py-2 text-white rounded-lg flex items-center gap-2"
          style={{ backgroundColor: currentTheme?.primary || '#6366f1' }}
        >
          <Plus className="w-4 h-4" /> New Order
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === "error" ? "bg-red-100 text-red-700" : message.type === "info" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
          {message.type === "error" ? <AlertCircle className="w-4 h-4" /> : message.type === "info" ? <Lock className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="rounded-lg p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
          <p className="text-sm" style={{ color: currentTheme?.textMuted || '#64748b' }}>Total</p>
          <p className="text-2xl font-bold" style={{ color: currentTheme?.text || '#1e293b' }}>{stats.total}</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
          <p className="text-sm" style={{ color: currentTheme?.textMuted || '#64748b' }}>Draft</p>
          <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
          <p className="text-sm" style={{ color: currentTheme?.textMuted || '#64748b' }}>Pending</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
          <p className="text-sm" style={{ color: currentTheme?.textMuted || '#64748b' }}>Confirmed</p>
          <p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p>
        </div>
        <div className="rounded-lg p-4 border" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
          <p className="text-sm" style={{ color: currentTheme?.textMuted || '#64748b' }}>Converted</p>
          <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search orders..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
            className="w-full pl-10 pr-4 py-2 rounded-lg border"
            style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}
          />
        </div>
        <select 
          value={filterStatus} 
          onChange={(e) => setFilterStatus(e.target.value)} 
          className="px-4 py-2 border rounded-lg"
          style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}
        >
          <option value="">All Status</option>
          {ORDER_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border overflow-x-auto" style={{ backgroundColor: currentTheme?.surfaceAlt || '#f8fafc', borderColor: currentTheme?.border || '#e2e8f0' }}>
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p style={{ color: currentTheme?.textMuted || '#64748b' }}>No orders found</p>
            <button onClick={() => { resetForm(); setShowCreatePage(true); }} className="mt-3 text-blue-600 hover:underline">Create your first order</button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: currentTheme?.surface || '#ffffff' }}>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Order #</th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Party</th>
                <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Items</th>
                <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Amount</th>
                <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium" style={{ color: currentTheme?.textMuted || '#64748b' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map(order => {
                const statusObj = ORDER_STATUS.find(s => s.value === order.status) || ORDER_STATUS[0];
                return (
                  <tr key={order.id} className="border-t" style={{ borderColor: currentTheme?.border || '#e2e8f0' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: currentTheme?.primary || '#6366f1' }}>{order.orderNumber}</td>
                    <td className="px-4 py-3" style={{ color: currentTheme?.textMuted || '#64748b' }}>{formatDate(order.orderDate)}</td>
                    <td className="px-4 py-3" style={{ color: currentTheme?.text || '#1e293b' }}>{order.partyName}</td>
                    <td className="px-4 py-3 text-center" style={{ color: currentTheme?.textMuted || '#64748b' }}>{order.items?.length || 0}</td>
                    <td className="px-4 py-3 text-right font-medium" style={{ color: currentTheme?.text || '#1e293b' }}>{formatCurrency(order.grandTotal)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusObj.color}`}>{statusObj.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleEditClick(order)} className="p-1 hover:bg-gray-100 rounded" title={isAdminOrHigher() ? "Edit" : "Request Edit Permission"}>{isAdminOrHigher() || hasPermission('generate_invoice') ? <Edit2 className="w-4 h-4 text-gray-500" /> : <Lock className="w-4 h-4 text-orange-500" />}</button>
                      {order.status !== "converted" && <button onClick={() => convertToSales(order)} disabled={loading} className="p-1 hover:bg-green-100 rounded ml-1" title="Convert to Sales"><Send className="w-4 h-4 text-green-600" /></button>}
                      {isAdminOrHigher() && <button onClick={() => deleteOrder(order.id)} className="p-1 hover:bg-red-100 rounded ml-1" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Order Modal Popup */}
      {showCreatePage && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 overflow-y-auto py-8" onClick={() => setShowCreatePage(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full mx-4 my-auto max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div>
                  <h2 className="text-xl font-bold">{editingOrder ? "Edit Order" : "Create New Order"}</h2>
                  {limitedEdit && (
                    <p className="text-xs text-orange-600 flex items-center gap-1 mt-1">
                      <Lock className="w-3 h-3" /> Limited edit mode — only dispatch, delivery &amp; narration fields are editable
                    </p>
                  )}
                </div>
                <button onClick={() => setShowCreatePage(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Close (Esc)">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                {/* Order Details */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div><label className="block text-sm font-medium mb-1">Order Number</label><input type="text" value={orderForm.orderNumber} onChange={(e) => setOrderForm({...orderForm, orderNumber: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></div>
                  <div><label className="block text-sm font-medium mb-1">Order Date</label><input type="date" value={orderForm.orderDate} onChange={(e) => setOrderForm({...orderForm, orderDate: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></div>
                  <div><label className="block text-sm font-medium mb-1">Delivery Date</label><input type="date" value={orderForm.deliveryDate} onChange={(e) => setOrderForm({...orderForm, deliveryDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                  <div><label className="block text-sm font-medium mb-1">Status</label><select value={orderForm.status} onChange={(e) => setOrderForm({...orderForm, status: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`}>{ORDER_STATUS.filter(s => s.value !== 'converted').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
                </div>

                {/* Party Details */}
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2"><Building className="w-4 h-4" /> Party Details {limitedEdit && <span className="text-xs text-orange-500 font-normal flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">Party Name *</label>
                    <input type="text" value={orderForm.partyName} onChange={(e) => handlePartyNameChange(e.target.value)} onFocus={() => orderForm.partyName.length >= 1 && setShowPartySuggestions(true)} onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="Type to search..." />
                    {showPartySuggestions && partySuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {partySuggestions.map((ledger, idx) => {
                          const blocked = isBlacklisted(ledger.name);
                          // Calculate balance display - handle both drAmount/crAmount and closing_balance formats
                          const drAmt = parseFloat(ledger.drAmount) || 0;
                          const crAmt = parseFloat(ledger.crAmount) || 0;
                          const closingBal = parseFloat(ledger.closing_balance) || parseFloat(ledger.currentBalance) || 0;
                          // drAmount negative = they owe us (receivable), crAmount positive = we received advance
                          let balanceAmount = 0;
                          let balanceType = '';
                          if (drAmt && drAmt < 0) {
                            balanceAmount = Math.abs(drAmt);
                            balanceType = 'receivable';
                          } else if (drAmt && drAmt > 0) {
                            balanceAmount = drAmt;
                            balanceType = 'advance';
                          } else if (crAmt && crAmt > 0) {
                            balanceAmount = crAmt;
                            balanceType = 'advance';
                          } else if (closingBal) {
                            balanceAmount = Math.abs(closingBal);
                            balanceType = closingBal < 0 ? 'receivable' : 'advance';
                          }
                          return (
                            <button key={idx} type="button" onMouseDown={(e) => { e.preventDefault(); if (!blocked) selectParty(ledger); }} disabled={blocked} className={`w-full px-4 py-3 text-left border-b last:border-b-0 ${blocked ? 'bg-red-50 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-gray-700'}`}>
                              <div className="flex items-center justify-between">
                                <p className={`font-medium ${blocked ? 'text-red-600' : ''}`}>{ledger.name}</p>
                                <div className="flex items-center gap-2">
                                  {balanceAmount > 0 && (
                                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${balanceType === 'receivable' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                      {balanceType === 'receivable' ? '↑' : '↓'} ₹{balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                  {blocked && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Blacklisted</span>}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {ledger.address && <span>📍 {typeof ledger.address === 'string' ? ledger.address.substring(0, 40) : ledger.address}...</span>}
                                {ledger.phone && <span>📞 {ledger.phone}</span>}
                                {ledger.gstin && <span>GST: {ledger.gstin}</span>}
                                {ledger.state && <span>🏠 {ledger.state}</span>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div><label className="block text-sm font-medium mb-1">GSTIN <span className="text-xs text-gray-400">(Optional for unregistered)</span></label><input type="text" value={orderForm.partyGstin} onChange={(e) => setOrderForm({...orderForm, partyGstin: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="Enter GSTIN or leave blank for unregistered" /></div>
                  <div><label className="block text-sm font-medium mb-1">Phone <span className="text-red-500">*</span></label><input type="tel" value={orderForm.partyPhone} onChange={(e) => setOrderForm({...orderForm, partyPhone: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : !orderForm.partyPhone ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`} placeholder="Enter phone number" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Address <span className="text-red-500">*</span></label><input type="text" value={orderForm.partyAddress} onChange={(e) => setOrderForm({...orderForm, partyAddress: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : !orderForm.partyAddress ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`} placeholder="Enter address" /></div>
                  <div><label className="block text-sm font-medium mb-1">State <span className="text-red-500">*</span></label><input type="text" value={orderForm.partyState} onChange={(e) => setOrderForm({...orderForm, partyState: e.target.value})} disabled={limitedEdit} className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${limitedEdit ? 'opacity-60 cursor-not-allowed' : !orderForm.partyState ? 'border-red-300 bg-red-50 dark:bg-red-900/20' : ''}`} placeholder="Enter state" /></div>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Items {limitedEdit && <span className="text-xs text-orange-500 font-normal flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}</h3>
                  {!limitedEdit && (
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <button onClick={() => setShowInventoryDropdown(!showInventoryDropdown)} className="px-3 py-1 bg-green-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-green-700"><Package className="w-4 h-4" /> From Inventory</button>
                      {showInventoryDropdown && (
                        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border rounded-lg shadow-xl z-30 max-h-96 overflow-hidden">
                          <div className="p-3 border-b">
                            <input type="text" placeholder="Search inventory..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm" autoFocus />
                          </div>
                          <div className="max-h-72 overflow-y-auto">
                            {filteredInventory.length === 0 ? (
                              <div className="p-4 text-center text-gray-500 text-sm">No items found</div>
                            ) : filteredInventory.map((item, idx) => {
                              const itemName = (item.name || item.item_name || '').toLowerCase();
                              const stockQty = parseFloat(item.quantity || item.closing_qty || invQtyMap[itemName] || 0);
                              const bookedQty = bookedQtyMap[itemName] || 0;
                              const availableQty = Math.max(0, stockQty - bookedQty);
                              return (
                              <button key={idx} onClick={() => addItemFromInventory(item)} className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b last:border-b-0">
                                <p className="font-medium text-sm">{item.name || item.item_name}</p>
                                {item.alias && item.alias !== 'N/A' && <p className="text-xs text-blue-600">Alias: {item.alias}</p>}
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>HSN: {item.hsn || '-'}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-gray-500">Stock: <span className="font-medium">{stockQty}</span></span>
                                    <span className={`font-medium ${availableQty > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                      Avail: {availableQty}{bookedQty > 0 && <span className="text-orange-500 ml-1">({bookedQty} booked)</span>}
                                    </span>
                                  </div>
                                  {canViewRates && <span>₹{item.rate || item.selling_price || 0}</span>}
                                </div>
                              </button>
                            );})}
                          </div>
                        </div>
                      )}
                    </div>
                    <button onClick={addItem} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1 hover:bg-blue-700"><Plus className="w-4 h-4" /> Add Row</button>
                  </div>
                  )}
                </div>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead><tr className="bg-gray-100 dark:bg-gray-700"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item Name</th><th className="px-3 py-2 text-left w-24">HSN</th><th className="px-3 py-2 text-center w-20">Qty</th><th className="px-3 py-2 text-left w-16">Unit</th>{canViewRates && <th className="px-3 py-2 text-right w-24">Rate</th>}<th className="px-3 py-2 text-center w-20">GST %</th>{canViewRates && <th className="px-3 py-2 text-right w-28">Amount</th>}<th className="px-3 py-2 w-10"></th></tr></thead>
                    <tbody>
                      {orderForm.items.length === 0 ? (
                        <tr><td colSpan={canViewRates ? 9 : 7} className="px-4 py-8 text-center text-gray-500">No items added. Click "From Inventory" or "Add Row" to start.</td></tr>
                      ) : orderForm.items.map((item, idx) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2 text-center">{idx + 1}</td>
                          <td className="px-3 py-2 relative">
                            <input type="text" value={item.name} onChange={(e) => handleItemNameChange(idx, e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} placeholder="Type to search..." />
                            {activeSuggestionField === idx && suggestions.length > 0 && !limitedEdit && (
                              <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {suggestions.map((s, i) => (
                                  <button key={i} onClick={() => selectItem(idx, s)} className="w-full px-3 py-2 text-left hover:bg-gray-100 text-sm">
                                    <p className="font-medium">{s.name || s.item_name}</p>
                                    {canViewRates && <p className="text-xs text-gray-500">HSN: {s.hsn || '-'} | Rate: ₹{s.rate || 0}</p>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2"><input type="text" value={item.hsn} onChange={(e) => updateItem(idx, 'hsn', e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></td>
                          <td className="px-3 py-2"><input type="text" inputMode="numeric" pattern="[0-9]*" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm text-center ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></td>
                          <td className="px-3 py-2"><input type="text" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></td>
                          {canViewRates && <td className="px-3 py-2"><input type="text" inputMode="decimal" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm text-right ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></td>}
                          <td className="px-3 py-2"><input type="text" inputMode="numeric" pattern="[0-9]*" value={item.gstPercent} onChange={(e) => updateItem(idx, 'gstPercent', e.target.value)} disabled={limitedEdit} className={`w-full px-2 py-1 border rounded text-sm text-center ${limitedEdit ? 'opacity-60 cursor-not-allowed' : ''}`} /></td>
                          {canViewRates && <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>}
                          <td className="px-3 py-2">{!limitedEdit && <button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {orderForm.items.length > 0 && canViewRates && (
                  <div className="mt-4 flex justify-end">
                    <div className="w-64 space-y-2 text-sm">
                      <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(orderForm.subtotal)}</span></div>
                      <div className="flex justify-between text-gray-600"><span>CGST:</span><span>{formatCurrency(orderForm.cgstTotal)}</span></div>
                      <div className="flex justify-between text-gray-600"><span>SGST:</span><span>{formatCurrency(orderForm.sgstTotal)}</span></div>
                      <div className="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total:</span><span>{formatCurrency(orderForm.grandTotal)}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment & Notes */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">Reference & Delivery Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Reference No.</label>
                    <input type="text" value={orderForm.referenceNo} onChange={(e) => setOrderForm({...orderForm, referenceNo: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. PO/25-26/01245" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Other Reference (Salesperson) *</label>
                    <input 
                      type="text" 
                      value={orderForm.otherReferences || user?.name || user?.username || ''} 
                      readOnly 
                      className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-600 cursor-not-allowed font-medium"
                      title="Auto-assigned to current user"
                    />
                  </div>
                  <div><label className="block text-sm font-medium mb-1">Payment Terms</label><input type="text" value={orderForm.paymentTerms} onChange={(e) => setOrderForm({...orderForm, paymentTerms: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. 30 days" /></div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Buyer's Order No.</label>
                    <input type="text" value={orderForm.buyersOrderNo} onChange={(e) => setOrderForm({...orderForm, buyersOrderNo: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. ORDERNO.12589" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Buyer's Order Date</label>
                    <input type="date" value={orderForm.buyersOrderDate} onChange={(e) => setOrderForm({...orderForm, buyersOrderDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Dispatched Through</label>
                    <input type="text" value={orderForm.dispatchThrough} onChange={(e) => setOrderForm({...orderForm, dispatchThrough: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. ROAD" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Destination</label>
                    <input type="text" value={orderForm.destination} onChange={(e) => setOrderForm({...orderForm, destination: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. LOCAL" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-1">Terms of Delivery</label>
                    <input type="text" value={orderForm.termsOfDelivery} onChange={(e) => setOrderForm({...orderForm, termsOfDelivery: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="e.g. AS DISCUSSED" />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 gap-4">
                <div><label className="block text-sm font-medium mb-1">Narration / Notes</label><textarea value={orderForm.narration} onChange={(e) => setOrderForm({...orderForm, narration: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" rows={2} placeholder="Additional notes for this order..." /></div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t flex justify-end gap-3">
                <button onClick={() => setShowCreatePage(false)} className="px-6 py-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2">
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button onClick={saveOrder} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                  <Save className="w-4 h-4" /> {editingOrder ? "Update Order" : "Create Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Ledger Details Popup */}
      {showNewLedgerPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-500" />
                  New Ledger Detected
                </h2>
                <p className="text-sm text-gray-500 mt-1">No details found for "{newLedgerDetails.name}". Please fill in the required information.</p>
              </div>
              <button onClick={() => setShowNewLedgerPopup(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Party Name</label>
                <input type="text" value={newLedgerDetails.name} disabled className="w-full px-3 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">GSTIN <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newLedgerDetails.gstin} 
                  onChange={(e) => setNewLedgerDetails({...newLedgerDetails, gstin: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${!newLedgerDetails.gstin ? 'border-red-300' : 'border-green-300'}`}
                  placeholder="Enter GSTIN (e.g., 29ABCDE1234F1Z5)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Phone <span className="text-red-500">*</span></label>
                <input 
                  type="tel" 
                  value={newLedgerDetails.phone} 
                  onChange={(e) => setNewLedgerDetails({...newLedgerDetails, phone: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${!newLedgerDetails.phone ? 'border-red-300' : 'border-green-300'}`}
                  placeholder="Enter phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address <span className="text-red-500">*</span></label>
                <textarea 
                  value={newLedgerDetails.address} 
                  onChange={(e) => setNewLedgerDetails({...newLedgerDetails, address: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${!newLedgerDetails.address ? 'border-red-300' : 'border-green-300'}`}
                  placeholder="Enter full address"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">State <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newLedgerDetails.state} 
                  onChange={(e) => setNewLedgerDetails({...newLedgerDetails, state: e.target.value})} 
                  className={`w-full px-3 py-2 border rounded-lg dark:bg-gray-700 ${!newLedgerDetails.state ? 'border-red-300' : 'border-green-300'}`}
                  placeholder="Enter state (e.g., Maharashtra)"
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3">
              <button 
                onClick={() => setShowNewLedgerPopup(false)} 
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Skip
              </button>
              <button 
                onClick={() => {
                  // Apply the new ledger details to the order form
                  setOrderForm(prev => ({
                    ...prev,
                    partyGstin: newLedgerDetails.gstin || prev.partyGstin,
                    partyPhone: newLedgerDetails.phone || prev.partyPhone,
                    partyAddress: newLedgerDetails.address || prev.partyAddress,
                    partyState: newLedgerDetails.state || prev.partyState
                  }));
                  setShowNewLedgerPopup(false);
                  setMessage({ type: 'success', text: 'Party details updated!' });
                  setTimeout(() => setMessage(null), 3000);
                }}
                disabled={!newLedgerDetails.gstin || !newLedgerDetails.phone || !newLedgerDetails.address || !newLedgerDetails.state}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  newLedgerDetails.gstin && newLedgerDetails.phone && newLedgerDetails.address && newLedgerDetails.state
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" /> Apply Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
