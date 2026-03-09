import React, { useEffect, useState } from "react";
import axios from "axios";

const columns = [
  { key: "serial", label: "Serial" },
  { key: "name", label: "Name" },
  { key: "alias", label: "Alias" },
  { key: "group", label: "Group" },
  { key: "category", label: "Category" },
  { key: "hsn", label: "HSN Code" },
  { key: "gst", label: "GST %" },
  { key: "quantity", label: "Quantity" },
  { key: "rate", label: "Rate" },
  { key: "unit", label: "Unit" },
];

export default function Inventory() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minQty, setMinQty] = useState("");
  const [maxQty, setMaxQty] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    let hasCachedData = false;
    
    // Load cached data from localStorage immediately
    try {
      const cached = localStorage.getItem('crm_inventory_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setData(parsed);
          setFromCache(true);
          setLoading(false);
          hasCachedData = true;
        }
      }
    } catch {}
    
    // Fetch from API in background
    setError("");
    axios.get("/api/inventory")
      .then(res => {
        const apiData = res.data?.data || res.data || [];
        const items = Array.isArray(apiData) ? apiData : [];
        if (items.length > 0) {
          setData(items);
          setFromCache(false);
          // Cache to localStorage for offline use
          try { localStorage.setItem('crm_inventory_cache', JSON.stringify(items)); } catch {}
          // Track quantity changes for purchase decision
          trackQuantityChanges(items);
        }
      })
      .catch(err => {
        if (!hasCachedData) {
          setError("Failed to fetch inventory. " + (err?.response?.data?.error || err.message));
        }
        console.error("Inventory API error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Track last 5 quantity changes per item ──
  function trackQuantityChanges(newItems) {
    try {
      const QTY_HISTORY_KEY = 'crm_inventory_qty_history';
      const history = JSON.parse(localStorage.getItem(QTY_HISTORY_KEY) || '{}');
      const now = new Date().toISOString();
      let lowStockItems = [];

      newItems.forEach(item => {
        if (!item.name) return;
        // Skip services
        if ((item.group || '').toLowerCase() === 'services') return;

        const currentQty = Number(item.quantity) || 0;
        const key = item.name;
        
        if (!history[key]) {
          history[key] = [];
        }
        
        const records = history[key];
        const lastRecord = records.length > 0 ? records[records.length - 1] : null;
        
        // Only log if quantity actually changed or first entry
        if (!lastRecord || lastRecord.qty !== currentQty) {
          const diff = lastRecord ? currentQty - lastRecord.qty : 0;
          records.push({ qty: currentQty, date: now, diff });
          
          // Keep only last 5 entries
          if (records.length > 5) {
            history[key] = records.slice(-5);
          }
        }
        
        // Analyze trend: if qty is decreasing over last 3+ records, and current qty is low
        const recs = history[key];
        if (recs.length >= 3) {
          const recentDiffs = recs.slice(-3).map(r => r.diff).filter(d => d !== 0);
          const avgDrop = recentDiffs.length > 0 
            ? recentDiffs.reduce((s, d) => s + d, 0) / recentDiffs.length 
            : 0;
          
          // Find the minimum qty historically
          const allQtys = recs.map(r => r.qty);
          const minQty = Math.min(...allQtys);
          const maxQty = Math.max(...allQtys);
          
          // Item needs purchase if: qty is trending down and current qty is within 20% of historical min
          // OR qty dropped by more than 50% from max
          const isLow = (maxQty > 0 && currentQty <= maxQty * 0.3) || 
                        (currentQty <= minQty * 1.2 && avgDrop < 0) ||
                        (currentQty <= 5 && avgDrop < 0);
          
          if (isLow && currentQty >= 0) {
            lowStockItems.push({
              name: item.name,
              group: item.group || '',
              currentQty,
              minQty,
              maxQty,
              avgDrop: Math.abs(avgDrop).toFixed(1),
              unit: item.unit || 'Nos'
            });
          }
        }
      });

      localStorage.setItem(QTY_HISTORY_KEY, JSON.stringify(history));

      // Save low stock items for Dashboard to read
      if (lowStockItems.length > 0) {
        localStorage.setItem('crm_low_stock_items', JSON.stringify(lowStockItems));
        
        // Send bell notification (only once per session to avoid spam)
        const notifKey = 'crm_low_stock_notified_' + new Date().toDateString();
        if (!sessionStorage.getItem(notifKey)) {
          sessionStorage.setItem(notifKey, '1');
          if (window.addCRMNotification) {
            window.addCRMNotification({
              type: 'warning',
              title: 'Low Stock Alert',
              message: `${lowStockItems.length} item${lowStockItems.length > 1 ? 's' : ''} need${lowStockItems.length === 1 ? 's' : ''} to be purchased soon: ${lowStockItems.slice(0, 3).map(i => i.name).join(', ')}${lowStockItems.length > 3 ? '...' : ''}`,
              page: 'inventory'
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to track quantity changes:', err);
    }
  }

  const filtered = data.filter(item => {
    // Hide rows where group is SERVICES (case-insensitive)
    if ((item.group || '').toString().trim().toLowerCase() === 'services') return false;
    // Text search
    const matchesText = columns.some(col =>
      (item[col.key] || "").toString().toLowerCase().includes(filter.toLowerCase())
    );
    // Price filter
    const price = Number(item.rate) || 0;
    const priceOk =
      (minPrice === "" || price >= Number(minPrice)) &&
      (maxPrice === "" || price <= Number(maxPrice));
    // Quantity filter
    const qty = Number(item.quantity) || 0;
    const qtyOk =
      (minQty === "" || qty >= Number(minQty)) &&
      (maxQty === "" || qty <= Number(maxQty));
    return matchesText && priceOk && qtyOk;
  });

  // Modal state for create item
  const [showCreate, setShowCreate] = useState(false);
  const [itemMode, setItemMode] = useState("new"); // "new" or "existing"
  const [selectedExisting, setSelectedExisting] = useState("");
  const [newItem, setNewItem] = useState({ 
    name: "", alias: "", group: "", category: "", hsn: "", gst: "", rate: "", quantity: "", 
    unit: "Nos", 
    isCompoundUnit: false,
    compoundQty: "",
    compoundUnit: "Pcs"
  });
  const [customGst, setCustomGst] = useState("");
  const [useCustomGst, setUseCustomGst] = useState(false);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  // CSV upload modal state
  const [showCSV, setShowCSV] = useState(false);
  const fileInputRef = React.useRef();

  // Extract unique stock groups from data
  const stockGroups = React.useMemo(() => {
    const groups = [...new Set(data.map(item => item.group).filter(g => g && g.trim()))];
    return groups.sort();
  }, [data]);

  // Common units in Tally
  const COMMON_UNITS = ['Nos', 'Pcs', 'Kg', 'Gms', 'Ltr', 'Ml', 'Mtr', 'Cm', 'Ft', 'Box', 'Bag', 'Set', 'Pair', 'Doz', 'Qntl', 'Ton'];

  // Handle existing item selection - autofill form for adding stock
  function handleExistingItemSelect(itemName) {
    setSelectedExisting(itemName);
    if (!itemName) {
      // Reset form if nothing selected
      setNewItem({ 
        name: "", alias: "", group: "", category: "", hsn: "", gst: "", rate: "", quantity: "", 
        unit: "Nos", isCompoundUnit: false, compoundQty: "", compoundUnit: "Pcs" 
      });
      setUseCustomGst(false);
      setCustomGst("");
      return;
    }
    // Find the item and autofill all details
    const item = data.find(i => i.name === itemName);
    if (item) {
      // Get unit - use as-is from item
      const itemUnit = item.unit || "Nos";
      
      // Get GST value - convert to string for comparison
      const gstVal = item.gst !== null && item.gst !== undefined ? String(item.gst) : "";
      // Standard GST rates (as numbers for comparison)
      const standardGstRates = [0, 5, 12, 18, 28];
      const gstNum = parseFloat(gstVal);
      const isStandardGst = !isNaN(gstNum) && standardGstRates.includes(gstNum);
      
      setNewItem({
        name: item.name || "",
        alias: item.alias || "",
        group: item.group || "",
        category: item.category || "",
        hsn: item.hsn || "",
        gst: isStandardGst ? String(gstNum) : "", // Set dropdown value for standard rates
        rate: item.rate?.toString() || "",
        quantity: "", // Keep quantity empty for user to enter how many to add
        unit: itemUnit,
        isCompoundUnit: false,
        compoundQty: "",
        compoundUnit: "Pcs",
        existingQty: item.quantity || 0 // Store existing quantity for reference
      });
      
      // For non-standard GST, use custom input
      if (!isStandardGst && gstVal !== "") {
        setUseCustomGst(true);
        setCustomGst(gstVal);
      } else {
        setUseCustomGst(false);
        setCustomGst("");
      }
    }
  }

  // Reset form when mode changes
  function handleModeChange(mode) {
    setItemMode(mode);
    setSelectedExisting("");
    setNewItem({ 
      name: "", alias: "", group: "", category: "", hsn: "", gst: "", rate: "", quantity: "", 
      unit: "Nos", isCompoundUnit: false, compoundQty: "", compoundUnit: "Pcs" 
    });
    setUseCustomGst(false);
    setCustomGst("");
    setCreateError("");
  }

  function handleCreateChange(e) {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  }
  
  async function handleCreateSubmit(e) {
    e.preventDefault();
    
    // For existing items, only quantity is required
    if (itemMode === "existing" && selectedExisting) {
      if (!newItem.quantity || parseFloat(newItem.quantity) <= 0) {
        setCreateError("Please enter quantity to add.");
        return;
      }
    } else {
      if (!newItem.name || !newItem.rate || !newItem.quantity || !newItem.unit) {
        setCreateError("Name, Rate, Quantity, and Unit are required.");
        return;
      }
    }
    
    // Build unit string for Tally
    let unitStr = newItem.unit;
    if (newItem.isCompoundUnit && newItem.compoundQty && newItem.compoundUnit) {
      unitStr = `${newItem.unit} of ${newItem.compoundQty} ${newItem.compoundUnit}`;
    }
    
    // Determine final gst value (custom or selected)
    const finalGst = useCustomGst ? customGst : newItem.gst;
    
    setCreateError("");
    setIsCreating(true);
    try {
      // Different API call for existing item (add stock) vs new item (create)
      const isAddingStock = itemMode === "existing" && selectedExisting;
      
      const response = await axios.post("/api/inventory", {
        name: newItem.name,
        alias: newItem.alias,
        group: newItem.group,
        category: newItem.category,
        hsn: newItem.hsn,
        gst: finalGst,
        rate: newItem.rate,
        openingQty: newItem.quantity,
        unit: unitStr,
        compoundUnit: newItem.isCompoundUnit ? newItem.compoundUnit : null,
        compoundQty: newItem.isCompoundUnit ? newItem.compoundQty : null,
        // Flag to indicate this is adding stock to existing item
        addToExisting: isAddingStock
      });
      
      if (response.data.success) {
        const isAddingStock = itemMode === "existing" && selectedExisting;
        
        if (isAddingStock) {
          // Update existing item's quantity in local state
          const addedQty = parseFloat(newItem.quantity) || 0;
          setData(data.map(item => 
            item.name === newItem.name 
              ? { ...item, quantity: (parseFloat(item.quantity) || 0) + addedQty }
              : item
          ));
        } else {
          // Add the new item to the list
          const createdItem = {
            serial: data.length + 1,
            name: newItem.name,
            alias: newItem.alias || "N/A",
            group: newItem.group || "",
            category: newItem.category || "",
            hsn: newItem.hsn || "",
            gst: parseFloat(finalGst) || 0,
            rate: parseFloat(newItem.rate) || 0,
            quantity: parseFloat(newItem.quantity) || 0,
            unit: unitStr
          };
          setData([...data, createdItem]);
        }
        setShowCreate(false);
        setSelectedExisting("");
        setItemMode("new");
        setNewItem({ 
          name: "", alias: "", group: "", category: "", hsn: "", gst: "", rate: "", quantity: "", 
          unit: "Nos", isCompoundUnit: false, compoundQty: "", compoundUnit: "Pcs" 
        });
        setUseCustomGst(false);
        setCustomGst("");
      } else {
        setCreateError(response.data.error || "Failed to create item");
      }
    } catch (err) {
      console.error("Create inventory error:", err);
      setCreateError(err.response?.data?.error || err.message || "Failed to create item");
    } finally {
      setIsCreating(false);
    }
  }
  function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setShowCSV(false);
  }

  return (
    <div className="min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white glass-text">Inventory</h1>
      <div className="flex flex-wrap gap-4 mb-4">
        <input
          className="px-3 py-2 border rounded w-full max-w-xs bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
          placeholder="Search..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <input
          className="px-3 py-2 border rounded w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          type="number"
          placeholder="Min Price"
          value={minPrice}
          onChange={e => setMinPrice(e.target.value)}
        />
        <input
          className="px-3 py-2 border rounded w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          type="number"
          placeholder="Max Price"
          value={maxPrice}
          onChange={e => setMaxPrice(e.target.value)}
        />
        <input
          className="px-3 py-2 border rounded w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          type="number"
          placeholder="Min Qty"
          value={minQty}
          onChange={e => setMinQty(e.target.value)}
        />
        <input
          className="px-3 py-2 border rounded w-32 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
          type="number"
          placeholder="Max Qty"
          value={maxQty}
          onChange={e => setMaxQty(e.target.value)}
        />
      </div>

      {/* Create Item and Add by CSV buttons removed per user request */}
      {/* Inventory data is synced from Tally */}
            {/* Add by CSV Modal */}
      {showCSV && (
        <div className="fixed inset-0 flex items-center justify-center z-50 transition-all" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white bg-opacity-100 p-4 md:p-8 rounded shadow-lg w-full max-w-[90vw] md:min-w-[400px]">
                  <h2 className="text-lg font-bold mb-4">Add Inventory by CSV</h2>
                  <div className="mb-4">
                    <div className="font-semibold mb-2">CSV Format:</div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200 rounded-lg text-sm">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="px-3 py-2 border">name *</th>
                            <th className="px-3 py-2 border">alias</th>
                            <th className="px-3 py-2 border">group</th>
                            <th className="px-3 py-2 border">category</th>
                            <th className="px-3 py-2 border">hsn</th>
                            <th className="px-3 py-2 border">gst</th>
                            <th className="px-3 py-2 border">rate *</th>
                            <th className="px-3 py-2 border">quantity *</th>
                            <th className="px-3 py-2 border">unit *</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="px-3 py-2 border">Turbo</td>
                            <td className="px-3 py-2 border">TURBO-ALIAS-123</td>
                            <td className="px-3 py-2 border">Cimmmins</td>
                            <td className="px-3 py-2 border">Filters</td>
                            <td className="px-3 py-2 border">8708</td>
                            <td className="px-3 py-2 border">18</td>
                            <td className="px-3 py-2 border">15000</td>
                            <td className="px-3 py-2 border">10</td>
                            <td className="px-3 py-2 border">pcs</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block mb-2 font-medium">Upload CSV File</label>
                    <button
                      className="w-full h-24 flex items-center justify-center border-2 border-dashed border-brown-700 bg-brown-100 text-brown-800 rounded-lg text-lg cursor-pointer hover:bg-brown-200"
                      style={{ background: '#f5f5f0', borderColor: '#8B5C2A', color: '#8B5C2A' }}
                      onClick={() => fileInputRef.current.click()}
                    >
                      Browse from computer
                    </button>
                    <input
                      type="file"
                      accept=".csv"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleCSVUpload}
                    />
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button className="px-4 py-2 bg-blue-700 text-white rounded" onClick={() => setShowCSV(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            )}
      {loading && <div className="mb-4 text-blue-600 dark:text-blue-400">Loading inventory...</div>}
      {error && <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>}
      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
        {filtered.length === 0 && !loading && !error ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">No inventory found.</div>
        ) : (
          <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg">
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col.key} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr key={idx} className={idx % 2 ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900"}>
                  {columns.map(col => {
                    let value = col.key === 'serial' ? idx + 1 : item[col.key];
                    // For rate and quantity, show empty if 0 or invalid
                    if ((col.key === 'rate' || col.key === 'quantity') && (!value || Number(value) === 0)) {
                      value = '';
                    }
                    // For rate, show 2 decimals if present
                    if (col.key === 'rate' && value !== '' && !isNaN(Number(value))) {
                      value = Number(value).toFixed(2);
                    }
                    // For quantity, show as integer if present
                    if (col.key === 'quantity' && value !== '' && !isNaN(Number(value))) {
                      value = Number(value);
                    }
                    return (
                      <td key={col.key} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100">{value}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Create Item Modal */}
      {showCreate && (
        <div className="fixed inset-0 flex items-center justify-center z-50 transition-all" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}>
          <form className="bg-white dark:bg-gray-800 p-4 md:p-8 rounded-xl shadow-xl w-full max-w-[90vw] md:min-w-[650px] max-h-[90vh] overflow-y-auto border dark:border-gray-700" onSubmit={handleCreateSubmit}>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create Inventory Item</h2>
            
            {/* Mode Toggle */}
            <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="itemMode" 
                    value="new" 
                    checked={itemMode === "new"}
                    onChange={() => handleModeChange("new")}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">New Item</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="itemMode" 
                    value="existing" 
                    checked={itemMode === "existing"}
                    onChange={() => handleModeChange("existing")}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">From Existing Item (Autofill)</span>
                </label>
              </div>
              
              {/* Existing Item Dropdown */}
              {itemMode === "existing" && (
                <div className="mt-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Existing Item</label>
                  <select
                    value={selectedExisting}
                    onChange={(e) => handleExistingItemSelect(e.target.value)}
                    className="w-full border dark:border-gray-600 px-3 py-2 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Select an item to copy --</option>
                    {data.filter(i => i.name).map(item => (
                      <option key={item.name} value={item.name}>{item.name} {item.alias && item.alias !== 'N/A' ? `(${item.alias})` : ''}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">This will autofill the form. You can modify values before creating.</p>
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
                <input name="name" value={newItem.name} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Alias</label>
                <input name="alias" value={newItem.alias} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              
              {/* Stock Group - only existing groups from Tally */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Stock Group</label>
                <select 
                  name="group" 
                  value={newItem.group} 
                  onChange={handleCreateChange} 
                  className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="">-- None (Default) --</option>
                  {stockGroups.map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Only existing Tally groups are available</p>
              </div>
              
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <input name="category" value={newItem.category} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">HSN Code</label>
                <input name="hsn" value={newItem.hsn} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              
              {/* GST with Custom Option */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST %</label>
                {!useCustomGst ? (
                  <>
                    <select 
                      name="gst" 
                      value={newItem.gst} 
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setUseCustomGst(true);
                          setNewItem({...newItem, gst: ""});
                        } else {
                          handleCreateChange(e);
                        }
                      }} 
                      className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Select GST Rate</option>
                      <option value="0">0% (Exempt)</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                      <option value="__custom__">✏️ Custom...</option>
                    </select>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={customGst}
                      onChange={(e) => setCustomGst(e.target.value)}
                      placeholder="Enter custom GST %"
                      className="flex-1 border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      autoFocus
                    />
                    <button 
                      type="button" 
                      onClick={() => { setUseCustomGst(false); setCustomGst(""); }}
                      className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
              
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate *</label>
                <input name="rate" value={newItem.rate} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required type="number" step="0.01" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {itemMode === "existing" && selectedExisting ? "Quantity to Add *" : "Opening Quantity *"}
                </label>
                {itemMode === "existing" && selectedExisting && newItem.existingQty !== undefined && (
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Current stock: {newItem.existingQty} {newItem.unit || 'units'}
                  </div>
                )}
                <input name="quantity" value={newItem.quantity} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required type="number" />
              </div>
              
              {/* Unit Selection */}
              <div className="mb-2 col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit *</label>
                <div className="flex items-center gap-4">
                  {itemMode === "existing" && selectedExisting ? (
                    // For existing items, show unit as readonly (can't change unit of existing item)
                    <input 
                      type="text" 
                      value={newItem.unit} 
                      readOnly 
                      className="w-32 border dark:border-gray-600 px-2 py-1 rounded bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"
                    />
                  ) : (
                    <select 
                      name="unit" 
                      value={newItem.unit} 
                      onChange={handleCreateChange} 
                      className="w-32 border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      required
                    >
                      {COMMON_UNITS.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  )}
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={newItem.isCompoundUnit} 
                      onChange={(e) => setNewItem({...newItem, isCompoundUnit: e.target.checked})}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-300">Compound Unit</span>
                  </label>
                </div>
                
                {/* Compound Unit Fields */}
                {newItem.isCompoundUnit && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Example: 1 Box = 20 Pcs</p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300">1 {newItem.unit} =</span>
                      <input 
                        type="number" 
                        value={newItem.compoundQty} 
                        onChange={(e) => setNewItem({...newItem, compoundQty: e.target.value})}
                        className="w-20 border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        placeholder="Qty"
                      />
                      <select 
                        value={newItem.compoundUnit} 
                        onChange={(e) => setNewItem({...newItem, compoundUnit: e.target.value})}
                        className="w-24 border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        {COMMON_UNITS.filter(u => u !== newItem.unit).map(u => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {createError && <div className="text-red-600 dark:text-red-400 mb-2 p-2 bg-red-50 dark:bg-red-900/20 rounded">{createError}</div>}
            <div className="flex gap-2 mt-4">
              <button 
                type="submit" 
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition flex items-center gap-2 disabled:opacity-50"
                disabled={isCreating}
              >
                {isCreating ? (
                  <><span className="animate-spin">⏳</span> {itemMode === "existing" && selectedExisting ? "Adding..." : "Creating..."}</>
                ) : (
                  itemMode === "existing" && selectedExisting ? '+ Add Stock' : 'Create'
                )}
              </button>
              <button type="button" className="px-4 py-2 bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded transition" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
