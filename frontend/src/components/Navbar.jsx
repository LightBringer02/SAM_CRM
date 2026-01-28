
import { useLocation, Link } from "react-router-dom";
import { ListTodo, NotepadText, RefreshCw, Wifi, WifiOff, Sun, Moon, Clock } from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { useEffect, useState, useRef } from "react";

// Use environment variable for API URL, fallback to localhost
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function Navbar() {
  const location = useLocation();
  const { user } = useAuth();
  const { dark, setDark } = useTheme();
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | success | error
  const [tallyStatus, setTallyStatus] = useState("checking"); // checking | live | offline
  const [lastSync, setLastSync] = useState(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    const saved = localStorage.getItem("autoSyncEnabled");
    return saved === "true";
  });
  const [nextAutoSync, setNextAutoSync] = useState(null);
  const intervalRef = useRef();
  const autoSyncRef = useRef();
  const countdownRef = useRef();

  // Check Tally connection status
  const checkTallyStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sync/status`);
      if (!res.ok) throw new Error("Backend not available");
      const data = await res.json();
      if (data.success && data.data) {
        // Use direct tallyConnected value (real-time check) not lastSync value
        const isLive = data.data.tallyConnected || data.data.lastSync?.tallyConnected || false;
        setTallyStatus(isLive ? "live" : "offline");
        if (data.data.lastSync?.timestamp) {
          setLastSync(data.data.lastSync.timestamp);
        }
      } else {
        setTallyStatus("offline");
      }
    } catch {
      setTallyStatus("offline");
    }
  };

  // Trigger actual sync with Tally and database
  // Uses /api/sync/navbar-sync for all users (no admin required)
  const triggerSync = async (isAutoSync = false) => {
    setSyncStatus("syncing");
    if (!isAutoSync) setSyncMessage("");
    try {
      const res = await fetch(`${API_BASE}/api/sync/navbar-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user?.id?.toString() || "",
          "x-user-role": user?.role || "user",
          "x-username": user?.username || user?.name || "user"
        }
      });
      const data = await res.json();
      if (data.success) {
        setSyncStatus("success");
        setLastSync(new Date().toISOString());
        setTallyStatus(data.tallyConnected ? "live" : "offline");
        setSyncMessage(isAutoSync ? "Auto-synced" : (data.message || "Sync completed"));
        // Only reload on manual sync
        if (!isAutoSync) {
          setTimeout(() => {
            setSyncMessage("");
            window.location.reload();
          }, 1500);
        } else {
          setTimeout(() => setSyncMessage(""), 3000);
        }
      } else {
        setSyncStatus("error");
        setSyncMessage(data.error || "Sync failed");
      }
    } catch (err) {
      setSyncStatus("error");
      setSyncMessage("Sync failed: " + err.message);
    }
  };

  // Toggle auto-sync
  const toggleAutoSync = () => {
    const newValue = !autoSyncEnabled;
    setAutoSyncEnabled(newValue);
    localStorage.setItem("autoSyncEnabled", newValue.toString());
    if (newValue) {
      setNextAutoSync(60);
    } else {
      setNextAutoSync(null);
    }
  };

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncEnabled) {
      // Set initial countdown
      setNextAutoSync(60);
      
      // Countdown timer
      countdownRef.current = setInterval(() => {
        setNextAutoSync(prev => {
          if (prev <= 1) return 60;
          return prev - 1;
        });
      }, 1000);
      
      // Auto-sync every 60 seconds
      autoSyncRef.current = setInterval(() => {
        if (syncStatus !== "syncing") {
          triggerSync(true);
        }
      }, 60000);
    }
    
    return () => {
      if (autoSyncRef.current) clearInterval(autoSyncRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoSyncEnabled, syncStatus]);

  useEffect(() => {
    checkTallyStatus();
    intervalRef.current = setInterval(checkTallyStatus, 30000); // Check every 30 seconds
    return () => clearInterval(intervalRef.current);
  }, []);

  const titles = {
    "/": "Dashboard",
    "/dashboard": "Dashboard",
    "/inventory": "Inventory",
    "/vouchers": "Vouchers",
    "/ledgers": "Ledgers",
    "/communication": "Communication",
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
    <div className="h-14 bg-sky-100 dark:bg-gray-800 text-blue-900 dark:text-gray-100 border-b border-blue-300 dark:border-gray-700 flex items-center justify-between px-6 transition-all duration-300" style={{minHeight: 56, height: 56, alignItems: 'center'}}>
      <h2 className="text-lg font-semibold text-blue-900 dark:text-gray-100">
        {pageTitle}
      </h2>

      <div className="flex items-center gap-4">
        <Link
          to="/todos"
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors text-blue-900 dark:text-gray-100"
        >
          <ListTodo className="w-5 h-5" />
          <span>Todos</span>
        </Link>

        <Link
          to="/logs"
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors text-blue-900 dark:text-gray-100"
        >
          <NotepadText className="w-5 h-5" />
          <span>Logs</span>
        </Link>

        {/* TALLY STATUS & SYNC */}
        <div className="flex items-center gap-3">
          {/* Tally Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            tallyStatus === "live" 
              ? "bg-green-100 text-green-700 border border-green-300" 
              : tallyStatus === "offline"
              ? "bg-red-100 text-red-700 border border-red-300"
              : "bg-gray-100 text-gray-600 border border-gray-300"
          }`}>
            {tallyStatus === "live" ? (
              <>
                <Wifi className="w-4 h-4" />
                <span>Tally Live</span>
              </>
            ) : tallyStatus === "offline" ? (
              <>
                <WifiOff className="w-4 h-4" />
                <span>Tally Offline</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Checking...</span>
              </>
            )}
          </div>

          {/* Last Sync Time */}
          <span className="text-xs text-blue-700 dark:text-blue-300">
            {lastSync ? `Synced: ${new Date(lastSync).toLocaleTimeString()}` : "Not synced"}
          </span>

          {/* Sync Message */}
          {syncMessage && (
            <span className={`text-xs ${syncStatus === "success" ? "text-green-600" : "text-red-600"}`}>
              {syncMessage}
            </span>
          )}

          {/* Auto-Sync Toggle */}
          <button
            onClick={toggleAutoSync}
            className={`px-2 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-medium transition-colors ${
              autoSyncEnabled
                ? "bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700"
                : "bg-gray-100 text-gray-600 border border-gray-300 dark:bg-gray-700 dark:text-gray-400 dark:border-gray-600"
            }`}
            title={autoSyncEnabled ? "Disable auto-sync (1 min)" : "Enable auto-sync (1 min)"}
          >
            <Clock className="w-3.5 h-3.5" />
            {autoSyncEnabled ? (
              <span>Auto: {nextAutoSync}s</span>
            ) : (
              <span>Auto-Sync</span>
            )}
          </button>

          {/* Sync Button */}
          <button
            onClick={() => triggerSync(false)}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors ${
              syncStatus === "syncing"
                ? "bg-blue-100 text-blue-600 cursor-wait"
                : "bg-blue-500 hover:bg-blue-600 text-white"
            }`}
            title="Sync with Tally and Database"
            disabled={syncStatus === "syncing"}
          >
            <RefreshCw className={`w-4 h-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} />
            {syncStatus === "syncing" ? "Syncing..." : "Sync Now"}
          </button>
        </div>

        {/* Dark/Light Mode Toggle with Sun/Moon Animation */}
        <button
          onClick={() => setDark(!dark)}
          className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center transition-all duration-500 hover:scale-110 shadow-md hover:shadow-lg border border-blue-200 dark:border-gray-600"
          title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label="Toggle dark mode"
        >
          {/* Sun Icon - visible in dark mode */}
          <Sun 
            className={`w-5 h-5 absolute transition-all duration-500 ease-in-out ${
              dark 
                ? "text-yellow-400 rotate-0 scale-100 opacity-100" 
                : "text-yellow-400 rotate-90 scale-0 opacity-0"
            }`} 
          />
          {/* Moon Icon - visible in light mode */}
          <Moon 
            className={`w-5 h-5 absolute transition-all duration-500 ease-in-out ${
              dark 
                ? "text-blue-400 -rotate-90 scale-0 opacity-0" 
                : "text-blue-600 rotate-0 scale-100 opacity-100"
            }`} 
          />
        </button>

        <div className="text-blue-800 dark:text-blue-200 font-medium">
          Welcome, {user?.name || user?.username || "User"}
        </div>
      </div>
    </div>
  );
}
