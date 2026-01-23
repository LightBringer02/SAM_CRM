
import { useLocation, Link } from "react-router-dom";
import { ListTodo, NotepadText, RefreshCw } from "lucide-react";
import { useAuth } from "../auth";
import { useEffect, useState, useRef } from "react";

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | success | error
  const [lastSync, setLastSync] = useState(null);
  const intervalRef = useRef();

  // Fetch sync status from backend
  const fetchSyncStatus = async () => {
    setSyncStatus("syncing");
    try {
      const res = await fetch("http://localhost:4000/api/inventory/sync-status");
      if (!res.ok) throw new Error("Not connected");
      const data = await res.json();
      if (data.success) {
        setLastSync(data.lastSync);
        setSyncStatus("success");
      } else {
        setSyncStatus("error");
      }
    } catch {
      setSyncStatus("error");
    }
  };

  useEffect(() => {
    fetchSyncStatus();
    intervalRef.current = setInterval(fetchSyncStatus, 60000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const titles = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/inventory": "Inventory",
    "/vouchers": "Vouchers",
    "/vendors": "Vendors",
    "/orders": "Orders",
    "/users": "Users",
    "/employees": "Employees",
    "/logs": "Logs",
    "/todos": "Todos",
    "/reports": "Reports",
    "/settings": "Settings",
    "/profile": "Profile",
  };

  const pageTitle = titles[location.pathname] || "CRM Panel";

  return (
    <div className="h-14 bg-sky-100 text-blue-900 border-b border-blue-300 flex items-center justify-between px-6 transition-all">
      <h2 className="text-lg font-semibold text-blue-900">
        {pageTitle}
      </h2>

      <div className="flex items-center gap-4">
        <Link
          to="/todos"
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-blue-900"
        >
          <ListTodo className="w-5 h-5" />
          <span>Todos</span>
        </Link>

        <Link
          to="/logs"
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors text-blue-900"
        >
          <NotepadText className="w-5 h-5" />
          <span>Logs</span>
        </Link>

        {/* SYNC STATUS */}
        <div className="flex items-center gap-2">
          {syncStatus === "error" ? (
            <span className="text-red-600 font-semibold animate-pulse">Not connected to Tally</span>
          ) : (
            <span className="text-xs text-blue-700">Last synced: {lastSync ? new Date(lastSync).toLocaleTimeString() : "-"}</span>
          )}
          <button
            onClick={fetchSyncStatus}
            className="ml-2 px-2 py-1 rounded bg-blue-200 hover:bg-blue-300 text-blue-900 flex items-center gap-1 text-xs font-medium border border-blue-300"
            title="Sync Now"
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw className={syncStatus === "syncing" ? "animate-spin w-4 h-4" : "w-4 h-4"} />
            Sync Now
          </button>
        </div>

        <div className="text-blue-800 font-medium">
          Welcome, {user?.name || user?.username || "User"}
        </div>
      </div>
    </div>
  );
}
