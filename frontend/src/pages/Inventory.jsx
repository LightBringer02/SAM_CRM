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

  useEffect(() => {
    setLoading(true);
    setError("");
    axios.get("/api/inventory")
      .then(res => {
        setData(res.data.data || []);
        console.log("Fetched inventory data:", res.data.data);
      })
      .catch(err => {
        setError("Failed to fetch inventory");
        console.error("Inventory API error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

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
  const [newItem, setNewItem] = useState({ name: "", alias: "", group: "", category: "", hsn: "", gst: "", rate: "", quantity: "", unit: "" });
  const [createError, setCreateError] = useState("");
  // CSV upload modal state
  const [showCSV, setShowCSV] = useState(false);
  const fileInputRef = React.useRef();

  function handleCreateChange(e) {
    setNewItem({ ...newItem, [e.target.name]: e.target.value });
  }
  function handleCreateSubmit(e) {
    e.preventDefault();
    if (!newItem.name || !newItem.rate || !newItem.quantity || !newItem.unit) {
      setCreateError("Name, Rate, Quantity, and Unit are required.");
      return;
    }
    setShowCreate(false);
    setCreateError("");
  }
  function handleCSVUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setShowCSV(false);
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Inventory</h1>
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

      {/* Create Item and Add by CSV buttons side by side below filters */}
      <div className="mb-6 flex gap-3">
        <button className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-base transition" onClick={() => setShowCreate(true)}>
          Create Item
        </button>
        <button className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded text-base transition" onClick={() => setShowCSV(true)}>
          Add by CSV
        </button>
      </div>
            {/* Add by CSV Modal */}
      {showCSV && (
        <div className="fixed inset-0 flex items-center justify-center z-50 transition-all" style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(2px)' }}>
          <div className="bg-white bg-opacity-100 p-8 rounded shadow-lg min-w-[400px] max-w-[90vw]">
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
          <form className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-xl min-w-[600px] max-w-[90vw] border dark:border-gray-700" onSubmit={handleCreateSubmit}>
            <h2 className="text-lg font-bold mb-4 text-gray-900 dark:text-white">Create Inventory Item</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
                <input name="name" value={newItem.name} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Alias</label>
                <input name="alias" value={newItem.alias} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Group</label>
                <input name="group" value={newItem.group} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                <input name="category" value={newItem.category} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">HSN</label>
                <input name="hsn" value={newItem.hsn} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST</label>
                <input name="gst" value={newItem.gst} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rate *</label>
                <input name="rate" value={newItem.rate} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required type="number" />
              </div>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Quantity *</label>
                <input name="quantity" value={newItem.quantity} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required type="number" />
              </div>
              <div className="mb-2 col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit *</label>
                <input name="unit" value={newItem.unit} onChange={handleCreateChange} className="w-full border dark:border-gray-600 px-2 py-1 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" required />
              </div>
            </div>
            {createError && <div className="text-red-600 dark:text-red-400 mb-2">{createError}</div>}
            <div className="flex gap-2 mt-4">
              <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition">Create</button>
              <button type="button" className="px-4 py-2 bg-gray-400 hover:bg-gray-500 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded transition" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
