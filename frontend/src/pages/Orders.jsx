import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import axios from "axios";
import {
  Plus, Trash2, Edit2, Save, X, Search, Package, ShoppingCart,
  Send, AlertCircle, CheckCircle, Building, User
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const ORDERS_KEY = "crm_orders";

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
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [ledgers, setLedgers] = useState([]); // Sundry Debtors list
  const [showModal, setShowModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeSuggestionField, setActiveSuggestionField] = useState(null);
  const [partySuggestions, setPartySuggestions] = useState([]);
  const [showPartySuggestions, setShowPartySuggestions] = useState(false);
  
  const [orderForm, setOrderForm] = useState({
    orderNumber: "", orderDate: new Date().toISOString().slice(0, 10), partyName: "", partyGstin: "",
    partyAddress: "", partyPhone: "", partyState: "", deliveryDate: "", paymentTerms: "", narration: "",
    items: [], status: "draft", subtotal: 0, cgstTotal: 0, sgstTotal: 0, grandTotal: 0
  });

  useEffect(() => { setOrders(getOrdersFromStorage()); loadInventory(); loadLedgers(); }, []);

  const loadInventory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/inventory`);
      setInventory(res.data?.items || res.data || []);
    } catch (err) { console.error("Failed to load inventory:", err); }
  };

  const loadLedgers = async () => {
    try {
      // Load Sundry Debtors (customers) for party selection
      const res = await axios.get(`${API_BASE}/api/ledgers/list/debtors?limit=500`);
      setLedgers(res.data?.ledgers || []);
    } catch (err) { console.error("Failed to load ledgers:", err); }
  };

  const generateOrderNumber = () => {
    const d = new Date();
    return `ORD/${d.getFullYear().toString().slice(-2)}${(d.getMonth()+1).toString().padStart(2,'0')}/${(orders.length+1).toString().padStart(4,'0')}`;
  };

  const resetForm = () => {
    setOrderForm({
      orderNumber: generateOrderNumber(), orderDate: new Date().toISOString().slice(0, 10), partyName: "", partyGstin: "",
      partyAddress: "", partyPhone: "", partyState: "", deliveryDate: "", paymentTerms: "", narration: "",
      items: [], status: "draft", subtotal: 0, cgstTotal: 0, sgstTotal: 0, grandTotal: 0
    });
    setEditingOrder(null);
    setPartySuggestions([]);
    setShowPartySuggestions(false);
  };

  const handlePartyNameChange = (value) => {
    setOrderForm({ ...orderForm, partyName: value });
    if (value.length >= 2) {
      const filtered = ledgers.filter(l => 
        (l.name || '').toLowerCase().includes(value.toLowerCase()) ||
        (l.phone || '').includes(value) ||
        (l.gstin || '').toLowerCase().includes(value.toLowerCase())
      ).slice(0, 10);
      setPartySuggestions(filtered);
      setShowPartySuggestions(true);
    } else {
      setPartySuggestions([]);
      setShowPartySuggestions(false);
    }
  };

  const selectParty = (ledger) => {
    setOrderForm({
      ...orderForm,
      partyName: ledger.name || '',
      partyGstin: ledger.gstin || ledger.gst_number || '',
      partyAddress: ledger.address || '',
      partyPhone: ledger.phone || ledger.mobile || '',
      partyState: ledger.state || ''
    });
    setPartySuggestions([]);
    setShowPartySuggestions(false);
  };

  const addItem = () => {
    setOrderForm({ ...orderForm, items: [...orderForm.items, { id: Date.now().toString(), name: "", hsn: "", qty: 1, unit: "Nos", rate: 0, gstPercent: 18, cgst: 0, sgst: 0, amount: 0 }] });
  };

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
      const filtered = inventory.filter(item => (item.name || item.item_name || '').toLowerCase().includes(value.toLowerCase()) || (item.hsn || '').includes(value)).slice(0, 10);
      setSuggestions(filtered); setActiveSuggestionField(index);
    } else { setSuggestions([]); setActiveSuggestionField(null); }
  };

  const selectItem = (index, item) => {
    const items = [...orderForm.items];
    items[index] = { ...items[index], name: item.name || item.item_name || '', hsn: item.hsn || '', unit: item.unit || 'Nos', rate: parseFloat(item.rate) || parseFloat(item.selling_price) || 0, gstPercent: parseFloat(item.gst_rate) || 18 };
    const qty = parseFloat(items[index].qty) || 1, rate = parseFloat(items[index].rate) || 0, gstPercent = parseFloat(items[index].gstPercent) || 0;
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
    if (editingOrder) {
      const updated = orders.map(o => o.id === editingOrder.id ? { ...orderForm, id: editingOrder.id, updatedAt: new Date().toISOString() } : o);
      saveOrdersToStorage(updated); setOrders(updated); setMessage({ type: "success", text: "Order updated!" });
    } else {
      const newOrder = { ...orderForm, id: Date.now().toString(), orderNumber: orderForm.orderNumber || generateOrderNumber(), createdAt: new Date().toISOString(), createdBy: user?.id };
      const updated = [...orders, newOrder]; saveOrdersToStorage(updated); setOrders(updated); setMessage({ type: "success", text: "Order created!" });
    }
    setShowModal(false); resetForm(); setTimeout(() => setMessage(null), 3000);
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
        voucher_type: "Sales", date: order.orderDate, party_ledger: order.partyName, party_gstin: order.partyGstin,
        party_address: order.partyAddress, reference: order.orderNumber, narration: order.narration || `Converted from Order ${order.orderNumber}`,
        items: order.items.map(item => ({ name: item.name, hsn: item.hsn, qty: item.qty, rate: item.rate, per: item.unit, amount: item.amount, gst: { cgst: item.gstPercent / 2, sgst: item.gstPercent / 2, igst: 0 } })),
        amount: order.grandTotal
      };
      const res = await axios.post(`${API_BASE}/api/tally/create-voucher`, salesVoucher);
      if (res.data.success) { updateStatus(order.id, "converted"); setMessage({ type: "success", text: `Order converted to Sales Voucher: ${res.data.voucherNumber || 'Success'}` }); }
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

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Orders</h1><p className="text-gray-500">Create and manage orders for conversion to sales vouchers</p></div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Plus className="w-4 h-4" /> New Order</button>
      </div>
      {message && (<div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}{message.text}</div>)}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border"><p className="text-sm text-gray-500">Total</p><p className="text-2xl font-bold">{stats.total}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border"><p className="text-sm text-gray-500">Draft</p><p className="text-2xl font-bold text-gray-600">{stats.draft}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{stats.pending}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border"><p className="text-sm text-gray-500">Confirmed</p><p className="text-2xl font-bold text-blue-600">{stats.confirmed}</p></div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border"><p className="text-sm text-gray-500">Converted</p><p className="text-2xl font-bold text-green-600">{stats.converted}</p></div>
      </div>
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800" /></div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-2 border rounded-lg bg-white dark:bg-gray-800">{[{value:"", label:"All Status"}, ...ORDER_STATUS].map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
        {filteredOrders.length === 0 ? (<div className="p-12 text-center"><ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No orders found. Create your first order!</p></div>) : (
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 dark:bg-gray-700 border-b"><th className="px-4 py-3 text-left">Order No.</th><th className="px-4 py-3 text-left">Date</th><th className="px-4 py-3 text-left">Party</th><th className="px-4 py-3 text-right">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Actions</th></tr></thead>
            <tbody className="divide-y dark:divide-gray-700">{filteredOrders.map(order => {
              const status = ORDER_STATUS.find(s => s.value === order.status) || ORDER_STATUS[0];
              return (<tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 font-medium text-blue-600">{order.orderNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(order.orderDate)}</td>
                <td className="px-4 py-3"><div><p className="font-medium">{order.partyName}</p>{order.partyPhone && <p className="text-xs text-gray-500">{order.partyPhone}</p>}</div></td>
                <td className="px-4 py-3 text-right">{order.items?.length || 0}</td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">{formatCurrency(order.grandTotal)}</td>
                <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>{status.label}</span></td>
                <td className="px-4 py-3"><div className="flex items-center justify-center gap-1">
                  <button onClick={() => { setEditingOrder(order); setOrderForm(order); setShowModal(true); }} className="p-1.5 hover:bg-gray-100 rounded" title="Edit"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                  {order.status !== "converted" && <button onClick={() => convertToSales(order)} disabled={loading} className="p-1.5 hover:bg-green-100 rounded" title="Convert to Sales"><Send className="w-4 h-4 text-green-600" /></button>}
                  <button onClick={() => deleteOrder(order.id)} className="p-1.5 hover:bg-red-100 rounded" title="Delete"><Trash2 className="w-4 h-4 text-red-500" /></button>
                </div></td>
              </tr>);
            })}</tbody>
          </table>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-5xl w-full mx-4 max-h-[95vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center"><h2 className="text-xl font-bold">{editingOrder ? "Edit Order" : "New Order"}</h2><button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button></div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><label className="block text-sm font-medium mb-1">Order Number</label><input type="text" value={orderForm.orderNumber} onChange={(e) => setOrderForm({...orderForm, orderNumber: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                <div><label className="block text-sm font-medium mb-1">Order Date</label><input type="date" value={orderForm.orderDate} onChange={(e) => setOrderForm({...orderForm, orderDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                <div><label className="block text-sm font-medium mb-1">Delivery Date</label><input type="date" value={orderForm.deliveryDate} onChange={(e) => setOrderForm({...orderForm, deliveryDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                <div><label className="block text-sm font-medium mb-1">Status</label><select value={orderForm.status} onChange={(e) => setOrderForm({...orderForm, status: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700">{ORDER_STATUS.filter(s => s.value !== 'converted').map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <h3 className="font-semibold mb-3 flex items-center gap-2"><Building className="w-4 h-4" /> Party Details (from Sundry Debtors)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <label className="block text-sm font-medium mb-1">Party Name *</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input type="text" value={orderForm.partyName} onChange={(e) => handlePartyNameChange(e.target.value)} onFocus={() => orderForm.partyName.length >= 2 && setShowPartySuggestions(true)} onBlur={() => setTimeout(() => setShowPartySuggestions(false), 200)} className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700" placeholder="Type to search customer..." autoComplete="off" />
                    </div>
                    {showPartySuggestions && partySuggestions.length > 0 && (
                      <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {partySuggestions.map((ledger, idx) => (
                          <button key={idx} type="button" onMouseDown={() => selectParty(ledger)} className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-gray-700 border-b last:border-b-0">
                            <p className="font-medium text-gray-900 dark:text-white">{ledger.name}</p>
                            <div className="flex gap-3 text-xs text-gray-500 mt-1">
                              {ledger.phone && <span>📞 {ledger.phone}</span>}
                              {ledger.gstin && <span>GST: {ledger.gstin}</span>}
                              {ledger.state && <span>📍 {ledger.state}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div><label className="block text-sm font-medium mb-1">GSTIN</label><input type="text" value={orderForm.partyGstin} onChange={(e) => setOrderForm({...orderForm, partyGstin: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                  <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={orderForm.partyPhone} onChange={(e) => setOrderForm({...orderForm, partyPhone: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                  <div className="md:col-span-2"><label className="block text-sm font-medium mb-1">Address</label><input type="text" value={orderForm.partyAddress} onChange={(e) => setOrderForm({...orderForm, partyAddress: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                  <div><label className="block text-sm font-medium mb-1">State</label><input type="text" value={orderForm.partyState} onChange={(e) => setOrderForm({...orderForm, partyState: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-3"><h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4" /> Items</h3><button onClick={addItem} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm flex items-center gap-1"><Plus className="w-4 h-4" /> Add Item</button></div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100 dark:bg-gray-700"><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Item Name</th><th className="px-3 py-2 text-left w-24">HSN</th><th className="px-3 py-2 text-center w-20">Qty</th><th className="px-3 py-2 text-left w-16">Unit</th><th className="px-3 py-2 text-right w-24">Rate</th><th className="px-3 py-2 text-center w-20">GST %</th><th className="px-3 py-2 text-right w-28">Amount</th><th className="px-3 py-2 w-10"></th></tr></thead>
                    <tbody>{orderForm.items.length === 0 ? (<tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No items added. Click "Add Item" to start.</td></tr>) : orderForm.items.map((item, idx) => (
                      <tr key={item.id} className="border-t dark:border-gray-700">
                        <td className="px-3 py-2 text-center">{idx + 1}</td>
                        <td className="px-3 py-2 relative"><input type="text" value={item.name} onChange={(e) => handleItemNameChange(idx, e.target.value)} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700" placeholder="Type to search..." />{activeSuggestionField === idx && suggestions.length > 0 && (<div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-48 overflow-y-auto">{suggestions.map((s, i) => (<button key={i} onClick={() => selectItem(idx, s)} className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"><p className="font-medium">{s.name || s.item_name}</p><p className="text-xs text-gray-500">HSN: {s.hsn || '-'} | Rate: ₹{s.rate || s.selling_price || 0}</p></button>))}</div>)}</td>
                        <td className="px-3 py-2"><input type="text" value={item.hsn} onChange={(e) => updateItem(idx, 'hsn', e.target.value)} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.qty} onChange={(e) => updateItem(idx, 'qty', e.target.value)} className="w-full px-2 py-1 border rounded text-sm text-center dark:bg-gray-700" min="0" /></td>
                        <td className="px-3 py-2"><input type="text" value={item.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} className="w-full px-2 py-1 border rounded text-sm dark:bg-gray-700" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.rate} onChange={(e) => updateItem(idx, 'rate', e.target.value)} className="w-full px-2 py-1 border rounded text-sm text-right dark:bg-gray-700" min="0" /></td>
                        <td className="px-3 py-2"><input type="number" value={item.gstPercent} onChange={(e) => updateItem(idx, 'gstPercent', e.target.value)} className="w-full px-2 py-1 border rounded text-sm text-center dark:bg-gray-700" min="0" max="28" /></td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                        <td className="px-3 py-2"><button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4 text-red-500" /></button></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                {orderForm.items.length > 0 && (<div className="mt-4 flex justify-end"><div className="w-64 space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(orderForm.subtotal)}</span></div><div className="flex justify-between text-gray-600"><span>CGST:</span><span>{formatCurrency(orderForm.cgstTotal)}</span></div><div className="flex justify-between text-gray-600"><span>SGST:</span><span>{formatCurrency(orderForm.sgstTotal)}</span></div><div className="flex justify-between font-bold text-lg border-t pt-2"><span>Grand Total:</span><span>{formatCurrency(orderForm.grandTotal)}</span></div></div></div>)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Payment Terms</label><input type="text" value={orderForm.paymentTerms} onChange={(e) => setOrderForm({...orderForm, paymentTerms: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" /></div>
                <div><label className="block text-sm font-medium mb-1">Narration / Notes</label><textarea value={orderForm.narration} onChange={(e) => setOrderForm({...orderForm, narration: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700" rows={2} /></div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button><button onClick={saveOrder} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" /> {editingOrder ? "Update" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
