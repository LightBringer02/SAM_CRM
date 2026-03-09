import React, { useState, useEffect, useRef, useMemo } from "react";
import { Search, Upload, Download, Plus, Edit2, Trash2, Save, X, AlertCircle, CheckCircle, FileSpreadsheet } from "lucide-react";
import axios from "axios";

const RATE_LIST_KEY = "crm_rate_list";
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const columns = [
  { key: "serial", label: "#", width: "w-12" },
  { key: "name", label: "Item Name", width: "flex-1" },
  { key: "alias", label: "Alias", width: "w-32" },
  { key: "category", label: "Category", width: "w-32" },
  { key: "group", label: "Group", width: "w-32" },
  { key: "hsn", label: "HSN Code", width: "w-28" },
  { key: "quantity", label: "Qty", width: "w-20" },
  { key: "rate", label: "Rate (₹)", width: "w-28" },
  { key: "gst", label: "GST %", width: "w-20" },
  { key: "unit", label: "Unit", width: "w-20" },
];

function getRateListFromStorage() {
  try {
    const stored = localStorage.getItem(RATE_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveRateListToStorage(items) {
  try {
    localStorage.setItem(RATE_LIST_KEY, JSON.stringify(items));
    return true;
  } catch { return false; }
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { 
    style: 'currency', 
    currency: 'INR', 
    maximumFractionDigits: 2 
  }).format(amount || 0);
}

export default function RateList() {
  const [items, setItems] = useState([]);
  const [inventoryMap, setInventoryMap] = useState({});
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterGroup, setFilterGroup] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  
  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showCSVModal, setShowCSVModal] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: "", alias: "", category: "", group: "", hsn: "", rate: "", gst: "", unit: "Nos"
  });
  
  const fileInputRef = useRef(null);
  
  // Common units
  const COMMON_UNITS = ['Nos', 'Pcs', 'Kg', 'Gms', 'Ltr', 'Ml', 'Mtr', 'Cm', 'Ft', 'Box', 'Bag', 'Set', 'Pair', 'Doz'];
  
  // Load items from localStorage immediately, then fetch inventory in background
  useEffect(() => {
    // Immediate load from localStorage (non-blocking)
    const stored = getRateListFromStorage();
    setItems(stored);
    setLoading(false);
    
    // Load cached inventoryMap from localStorage immediately
    try {
      const cachedMap = localStorage.getItem('crm_inventory_qty_map');
      if (cachedMap) setInventoryMap(JSON.parse(cachedMap));
    } catch {}
    
    // Fetch inventory for quantity data in background (non-blocking)
    const fetchInventory = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/inventory`);
        const invData = res.data?.data || res.data?.items || (Array.isArray(res.data) ? res.data : []);
        if (Array.isArray(invData) && invData.length > 0) {
          const qtyMap = {};
          invData.forEach(inv => {
            if (inv.name) {
              qtyMap[inv.name.toLowerCase()] = Number(inv.quantity || inv.closing_qty || 0);
            }
          });
          setInventoryMap(qtyMap);
          // Cache to localStorage for offline use
          try { localStorage.setItem('crm_inventory_qty_map', JSON.stringify(qtyMap)); } catch {}
          
          // Also update rate list items with rate from inventory if rate is missing/zero
          setItems(prev => {
            let changed = false;
            const updated = prev.map(item => {
              const inv = invData.find(i => (i.name || '').toLowerCase() === (item.name || '').toLowerCase());
              if (inv && (!item.rate || item.rate === 0)) {
                const invRate = parseFloat(inv.rate || inv.closing_rate || inv.selling_rate || 0);
                if (invRate > 0) {
                  changed = true;
                  return { ...item, rate: invRate };
                }
              }
              return item;
            });
            if (changed) saveRateListToStorage(updated);
            return changed ? updated : prev;
          });
        }
      } catch (err) {
        console.warn('Failed to fetch inventory for quantities:', err.message);
      }
    };
    fetchInventory();
  }, []);
  
  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [message]);
  
  // ESC key to close modals
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setShowAddModal(false);
        setShowCSVModal(false);
        setEditingItem(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Get unique categories and groups for filters
  const categories = useMemo(() => {
    return [...new Set(items.map(i => i.category).filter(Boolean))].sort();
  }, [items]);
  
  const groups = useMemo(() => {
    return [...new Set(items.map(i => i.group).filter(Boolean))].sort();
  }, [items]);
  
  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !search || 
        (item.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.alias || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.hsn || '').toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !filterCategory || item.category === filterCategory;
      const matchesGroup = !filterGroup || item.group === filterGroup;
      return matchesSearch && matchesCategory && matchesGroup;
    });
  }, [items, search, filterCategory, filterGroup]);
  
  // Add new item
  const handleAddItem = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Item name is required' });
      return;
    }
    
    const newItem = {
      id: Date.now(),
      ...formData,
      rate: parseFloat(formData.rate) || 0,
      gst: parseFloat(formData.gst) || 0,
      createdAt: new Date().toISOString()
    };
    
    const updated = [...items, newItem];
    setItems(updated);
    saveRateListToStorage(updated);
    setFormData({ name: "", alias: "", category: "", group: "", hsn: "", rate: "", gst: "", unit: "Nos" });
    setShowAddModal(false);
    setMessage({ type: 'success', text: 'Item added successfully' });
  };
  
  // Update existing item
  const handleUpdateItem = () => {
    if (!formData.name.trim()) {
      setMessage({ type: 'error', text: 'Item name is required' });
      return;
    }
    
    const updated = items.map(item => 
      item.id === editingItem.id 
        ? { ...item, ...formData, rate: parseFloat(formData.rate) || 0, gst: parseFloat(formData.gst) || 0 }
        : item
    );
    setItems(updated);
    saveRateListToStorage(updated);
    setEditingItem(null);
    setFormData({ name: "", alias: "", category: "", group: "", hsn: "", rate: "", gst: "", unit: "Nos" });
    setMessage({ type: 'success', text: 'Item updated successfully' });
  };
  
  // Delete item
  const handleDeleteItem = (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    const updated = items.filter(item => item.id !== id);
    setItems(updated);
    saveRateListToStorage(updated);
    setMessage({ type: 'success', text: 'Item deleted successfully' });
  };
  
  // Start editing
  const startEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || "",
      alias: item.alias || "",
      category: item.category || "",
      group: item.group || "",
      hsn: item.hsn || "",
      rate: item.rate || "",
      gst: item.gst || "",
      unit: item.unit || "Nos"
    });
  };
  
  // Handle CSV upload
  const handleCSVUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          setMessage({ type: 'error', text: 'CSV file must have at least a header and one data row' });
          return;
        }
        
        // Parse header
        const header = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIdx = header.findIndex(h => h === 'name' || h === 'item name' || h === 'item');
        const aliasIdx = header.findIndex(h => h === 'alias');
        const categoryIdx = header.findIndex(h => h === 'category');
        const groupIdx = header.findIndex(h => h === 'group');
        const hsnIdx = header.findIndex(h => h === 'hsn' || h === 'hsn code');
        const rateIdx = header.findIndex(h => h === 'rate' || h === 'price');
        const gstIdx = header.findIndex(h => h === 'gst' || h === 'gst %' || h === 'gst%');
        const unitIdx = header.findIndex(h => h === 'unit');
        
        if (nameIdx === -1) {
          setMessage({ type: 'error', text: 'CSV must have a "Name" column' });
          return;
        }
        
        // Parse data rows
        const newItems = [];
        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (!values[nameIdx]?.trim()) continue;
          
          newItems.push({
            id: Date.now() + i,
            name: values[nameIdx]?.trim() || '',
            alias: aliasIdx >= 0 ? values[aliasIdx]?.trim() || '' : '',
            category: categoryIdx >= 0 ? values[categoryIdx]?.trim() || '' : '',
            group: groupIdx >= 0 ? values[groupIdx]?.trim() || '' : '',
            hsn: hsnIdx >= 0 ? values[hsnIdx]?.trim() || '' : '',
            rate: rateIdx >= 0 ? parseFloat(values[rateIdx]) || 0 : 0,
            gst: gstIdx >= 0 ? parseFloat(values[gstIdx]) || 0 : 0,
            unit: unitIdx >= 0 ? values[unitIdx]?.trim() || 'Nos' : 'Nos',
            createdAt: new Date().toISOString()
          });
        }
        
        if (newItems.length === 0) {
          setMessage({ type: 'error', text: 'No valid items found in CSV' });
          return;
        }
        
        // Replace or merge with existing items
        setItems(newItems);
        saveRateListToStorage(newItems);
        setShowCSVModal(false);
        setMessage({ type: 'success', text: `Imported ${newItems.length} items from CSV` });
      } catch (err) {
        console.error('CSV parse error:', err);
        setMessage({ type: 'error', text: 'Failed to parse CSV file' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };
  
  // Parse CSV line handling quoted values
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }
  
  // Download sample CSV
  const downloadSampleCSV = () => {
    const sample = `Name,Alias,Category,Group,HSN,Rate,GST,Unit
Sample Item 1,SI1,Electronics,Consumer,8471,1500,18,Nos
Sample Item 2,SI2,Clothing,Apparel,6109,500,5,Pcs
Sample Item 3,SI3,Food,Grocery,1006,100,0,Kg`;
    
    const blob = new Blob([sample], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rate_list_sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Export current list as CSV
  const exportToCSV = () => {
    if (items.length === 0) {
      setMessage({ type: 'error', text: 'No items to export' });
      return;
    }
    
    const header = 'Name,Alias,Category,Group,HSN,Rate,GST,Unit';
    const rows = items.map(item => 
      `"${item.name || ''}","${item.alias || ''}","${item.category || ''}","${item.group || ''}","${item.hsn || ''}",${item.rate || 0},${item.gst || 0},"${item.unit || 'Nos'}"`
    );
    
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate_list_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ type: 'success', text: 'Rate list exported successfully' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="glass-text">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rate List</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your selling rates (independent of Tally inventory)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setFormData({ name: "", alias: "", category: "", group: "", hsn: "", rate: "", gst: "", unit: "Nos" });
              setShowAddModal(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition"
          >
            <Plus className="w-4 h-4" />
            Add Item
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg flex items-center gap-2 text-sm font-medium transition"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={filterGroup}
          onChange={(e) => setFilterGroup(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          <option value="">All Groups</option>
          {groups.map(grp => (
            <option key={grp} value={grp}>{grp}</option>
          ))}
        </select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mb-4 text-sm text-gray-600 dark:text-gray-400">
        <span>Total: <strong className="text-gray-900 dark:text-white">{items.length}</strong> items</span>
        {filteredItems.length !== items.length && (
          <span>Showing: <strong className="text-gray-900 dark:text-white">{filteredItems.length}</strong> items</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                {columns.map(col => (
                  <th key={col.key} className={`px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 ${col.width}`}>
                    {col.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-300 w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-10 h-10 opacity-50" />
                      <p>No items found</p>
                      <p className="text-xs">Add items manually or import from CSV</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition">
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{item.name}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.alias || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.category || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.group || '-'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-mono">{item.hsn || '-'}</td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-semibold">
                      {inventoryMap[(item.name || '').toLowerCase()] !== undefined
                        ? inventoryMap[(item.name || '').toLowerCase()].toFixed(2)
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-white font-semibold">{formatCurrency(item.rate)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.gst || 0}%</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{item.unit || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || editingItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setShowAddModal(false); setEditingItem(null); }}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingItem ? 'Edit Item' : 'Add New Item'}
              </h2>
              <button onClick={() => { setShowAddModal(false); setEditingItem(null); }} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter item name"
                  autoFocus
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alias</label>
                  <input
                    type="text"
                    value={formData.alias}
                    onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="Short name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={formData.hsn}
                    onChange={(e) => setFormData({ ...formData, hsn: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. 8471"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Electronics"
                    list="category-suggestions"
                  />
                  <datalist id="category-suggestions">
                    {categories.map(cat => <option key={cat} value={cat} />)}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Group</label>
                  <input
                    type="text"
                    value={formData.group}
                    onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Consumer"
                    list="group-suggestions"
                  />
                  <datalist id="group-suggestions">
                    {groups.map(grp => <option key={grp} value={grp} />)}
                  </datalist>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Rate (₹)</label>
                  <input
                    type="number"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST %</label>
                  <select
                    value={formData.gst}
                    onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select</option>
                    <option value="0">0%</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  >
                    {COMMON_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowAddModal(false); setEditingItem(null); }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={editingItem ? handleUpdateItem : handleAddItem}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
              >
                <Save className="w-4 h-4" />
                {editingItem ? 'Update' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showCSVModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCSVModal(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Import from CSV</h2>
              <button onClick={() => setShowCSVModal(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  <strong>Note:</strong> Importing a CSV will replace all existing items. Make sure to export your current list first if needed.
                </p>
              </div>
              
              <div className="p-4 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg text-center">
                <Upload className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  CSV should have columns: Name, Alias, Category, Group, HSN, Rate, GST, Unit
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
                >
                  Select CSV File
                </button>
              </div>
              
              <button
                onClick={downloadSampleCSV}
                className="w-full px-4 py-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Sample CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
