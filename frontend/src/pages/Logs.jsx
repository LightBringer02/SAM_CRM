import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import {
  FileText, Search, Filter, Download, Trash2, AlertCircle, CheckCircle,
  Info, AlertTriangle, User, Calendar, Clock, RefreshCw, ChevronDown, Shield
} from "lucide-react";

// Log types and colors
const LOG_TYPES = {
  info: { label: "Info", color: "bg-blue-100 text-blue-700", icon: Info },
  success: { label: "Success", color: "bg-green-100 text-green-700", icon: CheckCircle },
  warning: { label: "Warning", color: "bg-yellow-100 text-yellow-700", icon: AlertTriangle },
  error: { label: "Error", color: "bg-red-100 text-red-700", icon: AlertCircle },
  auth: { label: "Auth", color: "bg-purple-100 text-purple-700", icon: Shield },
  system: { label: "System", color: "bg-gray-100 text-gray-700", icon: FileText }
};

// Helper to add log entry (can be called from anywhere)
export function addLog(type, action, details = "", userId = null) {
  const logs = JSON.parse(localStorage.getItem("crm_logs") || "[]");
  const newLog = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    type,
    action,
    details,
    userId: userId || JSON.parse(localStorage.getItem("user") || "{}")?.id || "unknown",
    userName: JSON.parse(localStorage.getItem("user") || "{}")?.name || "System"
  };
  logs.unshift(newLog);
  // Keep only last 1000 logs
  if (logs.length > 1000) logs.splice(1000);
  localStorage.setItem("crm_logs", JSON.stringify(logs));
}

export default function Logs() {
  const { user, isAdminOrHigher, isRoot } = useAuth();
  const navigate = useNavigate();
  
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Check admin access
  useEffect(() => {
    if (!isAdminOrHigher) {
      navigate("/dashboard");
    }
  }, [isAdminOrHigher, navigate]);

  // Load logs
  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = () => {
    const storedLogs = JSON.parse(localStorage.getItem("crm_logs") || "[]");
    const users = JSON.parse(localStorage.getItem("users") || "[]");
    
    // Filter out root user logs for non-root users
    const filteredStoredLogs = isRoot() 
      ? storedLogs 
      : storedLogs.filter(log => {
          // Find the user who created this log
          const logUser = users.find(u => u.id === log.userId);
          // If user found and is root, hide this log from non-root users
          return !logUser || logUser.role !== 'root';
        });
    
    setLogs(filteredStoredLogs);
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesSearch = !search || 
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = !filterType || log.type === filterType;
    
    const matchesDate = !filterDate || log.timestamp.slice(0, 10) === filterDate;
    
    return matchesSearch && matchesType && matchesDate;
  });

  // Clear all logs (root only)
  const clearAllLogs = () => {
    if (!isRoot) return;
    if (confirm("Are you sure you want to clear all logs? This action cannot be undone.")) {
      localStorage.setItem("crm_logs", "[]");
      setLogs([]);
      addLog("system", "Logs Cleared", "All system logs were cleared");
      loadLogs();
    }
  };

  // Export logs
  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `crm_logs_${new Date().toISOString().slice(0, 10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
  };

  // Access denied message
  if (!isAdminOrHigher) {
    return (
      <div className="p-6 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
          <p className="text-gray-500">You don't have permission to view system logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="glass-text">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">System Logs</h1>
          <p className="text-gray-500 dark:text-gray-400">View activity logs and system events</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadLogs} className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={exportLogs} className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center gap-2 hover:bg-green-700">
            <Download className="w-4 h-4" /> Export
          </button>
          {isRoot && (
            <button onClick={clearAllLogs} className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700">
              <Trash2 className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Object.entries(LOG_TYPES).map(([type, config]) => {
          const count = logs.filter(l => l.type === type).length;
          const Icon = config.icon;
          return (
            <button
              key={type}
              onClick={() => setFilterType(filterType === type ? "" : type)}
              className={`p-4 rounded-xl border ${filterType === type ? "ring-2 ring-blue-500" : ""} bg-white dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-all`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${config.color.split(" ")[0]} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${config.color.split(" ")[1]}`} />
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-500">{config.label}</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{count}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">All Types</option>
            {Object.entries(LOG_TYPES).map(([type, config]) => (
              <option key={type} value={type}>{config.label}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-4 py-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600"
          />
          {(search || filterType || filterDate) && (
            <button onClick={() => { setSearch(""); setFilterType(""); setFilterDate(""); }} className="px-4 py-2 text-blue-600 hover:underline">
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Timestamp</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">Details</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 dark:text-gray-300">User</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No logs found</p>
                    <p className="text-sm">Logs will appear here as actions are performed</p>
                  </td>
                </tr>
              ) : filteredLogs.slice(0, 100).map(log => {
                const logType = LOG_TYPES[log.type] || LOG_TYPES.info;
                const Icon = logType.icon;
                const { date, time } = formatTime(log.timestamp);
                return (
                  <tr key={log.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{date}</span>
                        <Clock className="w-4 h-4 ml-2" />
                        <span>{time}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${logType.color}`}>
                        <Icon className="w-3 h-3" />
                        {logType.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{log.action}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-[300px] truncate">{log.details || "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{log.userName}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredLogs.length > 100 && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700 text-center text-sm text-gray-500">
            Showing 100 of {filteredLogs.length} logs
          </div>
        )}
      </div>
    </div>
  );
}
