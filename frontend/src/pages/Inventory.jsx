import { useEffect, useState } from "react";
import axios from "axios";

const columns = [
  { key: "serial", label: "Serial" },
  { key: "name", label: "Name" },
  { key: "alias", label: "Alias" },
  { key: "group", label: "Group" },
  { key: "category", label: "Category" },
  { key: "hsn", label: "HSN Code" },
  { key: "gst", label: "GST %" },
  { key: "rate", label: "Rate" },
  { key: "quantity", label: "Quantity" },
  { key: "unit", label: "Unit" },
  { key: "stock", label: "Stock" },
];

export default function Inventory() {
  const [data, setData] = useState([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    axios.get("/api/inventory")
      .then(res => {
        console.log("Inventory API response:", res);
        setData(res.data.data || []);
      })
      .catch(err => {
        setError("Failed to fetch inventory");
        console.error("Inventory API error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = data.filter(item =>
    columns.some(col =>
      (item[col.key] || "").toString().toLowerCase().includes(filter.toLowerCase())
    )
  );

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Inventory</h1>
      <input
        className="mb-4 px-3 py-2 border rounded w-full max-w-xs"
        placeholder="Filter..."
        value={filter}
        onChange={e => setFilter(e.target.value)}
      />
      {loading && <div className="mb-4 text-blue-600">Loading inventory...</div>}
      {error && <div className="mb-4 text-red-600">{error}</div>}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 rounded-lg">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col.key} className="px-4 py-2 border-b bg-gray-100 text-left text-sm font-semibold">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, idx) => (
              <tr key={idx} className={idx % 2 ? "bg-gray-50" : "bg-white"}>
                {columns.map(col => (
                  <td key={col.key} className="px-4 py-2 border-b text-sm">{item[col.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
