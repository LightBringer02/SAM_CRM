import { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { 
  Server, 
  Database, 
  Users, 
  Settings, 
  Save, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  Power,
  PowerOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Cloud,
  CloudOff
} from "lucide-react";
import axios from "axios";

// Use relative paths for API calls - works with both Vite proxy (dev) and cloud deployment
// Only use full URL if explicitly set in environment

export default function SystemConfig() {
  const { user, isRoot, getAuthHeaders } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("service");
  const [syncResult, setSyncResult] = useState(null);
  
  // Test connection states
  const [testingTally, setTestingTally] = useState(false);
  const [testingLiveServer, setTestingLiveServer] = useState(false);
  const [testingDatabase, setTestingDatabase] = useState(false);
  const [tallyTestResult, setTallyTestResult] = useState(null);
  const [liveServerTestResult, setLiveServerTestResult] = useState(null);
  const [databaseTestResult, setDatabaseTestResult] = useState(null);
  
  // Configuration state
  const [config, setConfig] = useState({
    tallyUrl: "http://localhost:9000",
    liveServerUrl: "",
    database: {
      host: "localhost",
      port: 5432,
      name: "crm_database",
      user: "postgres",
      password: ""
    },
    limits: {
      maxAdmins: 5,
      maxTotalUsers: 200
    },
    backendMode: "LOCAL",
    serviceEnabled: true,
    lastUpdated: null,
    updatedBy: null
  });

  // Access control - ROOT only
  if (!isRoot()) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Only ROOT users can access System Configuration
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Current role: {user?.role || "Unknown"}
          </p>
        </div>
      </div>
    );
  }

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/system-config/full`, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        // Merge with defaults to ensure all fields exist
        setConfig(prev => ({
          ...prev,
          ...response.data.data,
          database: { ...prev.database, ...(response.data.data.database || {}) },
          limits: { ...prev.limits, ...(response.data.data.limits || {}) }
        }));
      }
      setMessage(null);
    } catch (err) {
      console.error("Failed to load config:", err);
      // Don't show error on initial load - use defaults silently
      if (err.response?.status !== 401) {
        setMessage({ type: "info", text: "Using default configuration. Save to persist changes." });
      }
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Clean up config before saving - remove deprecated fields
      const cleanConfig = { ...config };
      if (cleanConfig.limits) {
        delete cleanConfig.limits.maxUsersPerAdmin;
      }

      // Save config
      const response = await axios.put(`/api/system-config`, cleanConfig, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setConfig(prev => ({
          ...prev,
          ...response.data.data,
          database: { ...prev.database, ...(response.data.data.database || {}) },
          limits: { ...prev.limits, ...(response.data.data.limits || {}) }
        }));
        
        // Configuration saved successfully
        setMessage({ type: "success", text: "Configuration saved successfully!" });

        // Only try to reload database pool if we're in LOCAL mode or database config changed
        // In LIVE/cloud mode, database reload may not be available from frontend
        if (cleanConfig.backendMode === 'LOCAL') {
          try {
            await axios.post(`/api/database/reload`, {}, {
              headers: getAuthHeaders(),
              timeout: 5000 // 5 second timeout
            });
          } catch (reloadErr) {
            // Silently ignore reload errors - config is already saved
          }
        }
      }
    } catch (err) {
      console.error("Failed to save config:", err);
      // Provide clearer error message for cloud deployments
      const errorMsg = err.response?.data?.error || err.message || "Failed to save configuration";
      if (errorMsg.includes('EROFS') || errorMsg.includes('read-only') || errorMsg.includes('permission') || errorMsg.includes('EACCES')) {
        setMessage({ type: "error", text: "Cannot save config on cloud: File system is read-only. Set configuration using environment variables on your cloud platform." });
      } else if (err.code === 'ERR_NETWORK' || errorMsg.includes('Network Error')) {
        setMessage({ type: "error", text: "Network error: Cannot reach the backend server. Make sure the backend is running and accessible." });
      } else {
        setMessage({ type: "error", text: errorMsg });
      }
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!window.confirm("Are you sure you want to reset all configuration to defaults?")) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const response = await axios.post(`/api/system-config/reset`, {}, {
        headers: getAuthHeaders()
      });
      if (response.data.success) {
        setConfig(response.data.data);
        setMessage({ type: "success", text: "Configuration reset to defaults!" });
      }
    } catch (err) {
      console.error("Failed to reset config:", err);
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to reset configuration" });
    } finally {
      setSaving(false);
    }
  };

  const updateBackendMode = async (mode) => {
    setConfig(prev => ({ ...prev, backendMode: mode }));
  };

  const toggleService = async () => {
    const newEnabled = !config.serviceEnabled;
    setConfig(prev => ({ ...prev, serviceEnabled: newEnabled }));
    
    try {
      await axios.put(`/api/system-config/service-toggle`, 
        { enabled: newEnabled },
        { headers: getAuthHeaders() }
      );
      setMessage({ 
        type: "success", 
        text: newEnabled ? "Service enabled for all users" : "Service disabled - only ROOT can access" 
      });
    } catch (err) {
      // Revert on error
      setConfig(prev => ({ ...prev, serviceEnabled: !newEnabled }));
      setMessage({ type: "error", text: err.response?.data?.error || "Failed to toggle service" });
    }
  };

  // Test Tally connection
  const testTallyConnection = async (url, setTesting, setResult) => {
    setTesting(true);
    setResult(null);
    try {
      const response = await axios.post(`/api/sync/test-tally`, 
        { url },
        { headers: getAuthHeaders() }
      );
      setResult(response.data);
    } catch (err) {
      setResult({ 
        success: false, 
        connected: false, 
        error: err.response?.data?.error || err.message 
      });
    } finally {
      setTesting(false);
    }
  };

  // Test Database connection
  const testDatabaseConnection = async () => {
    setTestingDatabase(true);
    setDatabaseTestResult(null);
    try {
      const response = await axios.post(`/api/sync/test-database`, 
        config.database,
        { headers: getAuthHeaders() }
      );
      setDatabaseTestResult(response.data);
    } catch (err) {
      setDatabaseTestResult({ 
        success: false, 
        connected: false, 
        error: err.response?.data?.error || err.message 
      });
    } finally {
      setTestingDatabase(false);
    }
  };

  const triggerSync = async () => {
    setSyncing(true);
    setMessage(null);
    setSyncResult(null);
    
    try {
      const response = await axios.post(`/api/sync/trigger`, {}, {
        headers: getAuthHeaders()
      });
      
      if (response.data.success) {
        setSyncResult(response.data.data.syncResult);
        setMessage({ 
          type: "success", 
          text: response.data.message || "Sync completed successfully!" 
        });
      }
    } catch (err) {
      console.error("Sync failed:", err);
      setMessage({ 
        type: "error", 
        text: err.response?.data?.error || "Sync operation failed" 
      });
      if (err.response?.data?.data?.syncResult) {
        setSyncResult(err.response.data.data.syncResult);
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading configuration...</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "service", name: "Service Control", icon: Power },
    { id: "tally", name: "Tally Connection", icon: Server },
    { id: "database", name: "Database", icon: Database },
    { id: "limits", name: "User Limits", icon: Users },
    { id: "backend", name: "Backend Mode", icon: Settings }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white glass-text">
            System Configuration
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          ROOT-only system settings. Configure Tally connection, database, limits, and backend mode.
        </p>
        {config.lastUpdated && (
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(config.lastUpdated).toLocaleString()} by {config.updatedBy || "Unknown"}
          </p>
        )}
      </div>

      {/* Message Alert */}
      {message && (
        <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
          message.type === "success" 
            ? "bg-green-100 text-green-800 border border-green-200" 
            : message.type === "info"
            ? "bg-blue-100 text-blue-800 border border-blue-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}>
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : message.type === "info" ? (
            <AlertTriangle className="w-5 h-5" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span>{message.text}</span>
          <button 
            onClick={() => setMessage(null)}
            className="ml-auto text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? "text-purple-600 border-b-2 border-purple-600"
                : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        
        {/* Service Control Tab */}
        {activeTab === "service" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Service Control Panel
            </h2>
            
            {/* Service Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-xl border-2 transition-all ${
                config.serviceEnabled 
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20" 
                  : "border-red-500 bg-red-50 dark:bg-red-900/20"
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {config.serviceEnabled ? (
                      <Power className="w-10 h-10 text-green-600" />
                    ) : (
                      <PowerOff className="w-10 h-10 text-red-600" />
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                        Service Status
                      </h3>
                      <p className={`text-sm ${config.serviceEnabled ? "text-green-600" : "text-red-600"}`}>
                        {config.serviceEnabled ? "Running - All users can access" : "Stopped - ROOT only access"}
                      </p>
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleService}
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                    config.serviceEnabled
                      ? "bg-red-600 hover:bg-red-700 text-white"
                      : "bg-green-600 hover:bg-green-700 text-white"
                  }`}
                >
                  {config.serviceEnabled ? "Stop Service" : "Start Service"}
                </button>
              </div>

              {/* Manual Sync */}
              <div className="p-6 rounded-xl border-2 border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20">
                <div className="flex items-center gap-3 mb-4">
                  <RefreshCw className={`w-10 h-10 text-blue-600 ${syncing ? "animate-spin" : ""}`} />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                      Data Sync
                    </h3>
                    <p className="text-sm text-blue-600">
                      Sync data from Tally to Database
                    </p>
                  </div>
                </div>
                <button
                  onClick={triggerSync}
                  disabled={syncing}
                  className="w-full py-3 px-4 rounded-lg font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {syncing ? "Syncing..." : "Trigger Sync Now"}
                </button>
                {syncResult && (
                  <div className="mt-3 p-3 bg-white dark:bg-gray-700 rounded-lg text-sm">
                    <p className={syncResult.success ? "text-green-600" : "text-red-600"}>
                      {syncResult.message}
                    </p>
                    <p className="text-gray-500 mt-1">
                      Items synced: {syncResult.itemsSynced} | Duration: {syncResult.duration}ms
                    </p>
                    {syncResult.timestamp && (
                      <p className="text-gray-400 text-xs mt-1">
                        {new Date(syncResult.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Status Summary */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Current System Status</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  {config.serviceEnabled ? (
                    <Wifi className="w-4 h-4 text-green-500" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-500" />
                  )}
                  <span className="text-gray-600 dark:text-gray-300">
                    Service: {config.serviceEnabled ? "ON" : "OFF"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    Mode: {config.backendMode}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    DB: {config.database?.host}:{config.database?.port}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="text-gray-600 dark:text-gray-300">
                    Max Users: {config.limits?.maxTotalUsers}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tally Connection Tab */}
        {activeTab === "tally" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Tally Connection Settings
            </h2>
            
            <div className="grid gap-6">
              {/* Local Tally URL */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Local Tally URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.tallyUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, tallyUrl: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="http://localhost:9000"
                  />
                  <button
                    onClick={() => testTallyConnection(config.tallyUrl, setTestingTally, setTallyTestResult)}
                    disabled={testingTally}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingTally ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    {testingTally ? "Testing..." : "Test Connection"}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Used when backend mode is set to LOCAL
                </p>
                {tallyTestResult && (
                  <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                    tallyTestResult.connected 
                      ? "bg-green-100 text-green-800 border border-green-200" 
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}>
                    {tallyTestResult.connected ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span>{tallyTestResult.connected ? tallyTestResult.message : tallyTestResult.error}</span>
                  </div>
                )}
              </div>

              {/* Live Server URL */}
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Live Server URL
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.liveServerUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, liveServerUrl: e.target.value }))}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="https://api.example.com"
                  />
                  <button
                    onClick={() => testTallyConnection(config.liveServerUrl, setTestingLiveServer, setLiveServerTestResult)}
                    disabled={testingLiveServer || !config.liveServerUrl}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {testingLiveServer ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wifi className="w-4 h-4" />
                    )}
                    {testingLiveServer ? "Testing..." : "Test Connection"}
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Used when backend mode is set to LIVE
                </p>
                {liveServerTestResult && (
                  <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                    liveServerTestResult.connected 
                      ? "bg-green-100 text-green-800 border border-green-200" 
                      : "bg-red-100 text-red-800 border border-red-200"
                  }`}>
                    {liveServerTestResult.connected ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span>{liveServerTestResult.connected ? liveServerTestResult.message : liveServerTestResult.error}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === "database" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Database Connection Settings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Host
                </label>
                <input
                  type="text"
                  value={config.database?.host || ""}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    database: { ...prev.database, host: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="localhost"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Port
                </label>
                <input
                  type="number"
                  value={config.database?.port || ""}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    database: { ...prev.database, port: parseInt(e.target.value) || 3306 }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="3306"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Database Name
                </label>
                <input
                  type="text"
                  value={config.database?.name || ""}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    database: { ...prev.database, name: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="crm_database"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={config.database?.user || ""}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    database: { ...prev.database, user: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="root"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={config.database?.password || ""}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    database: { ...prev.database, password: e.target.value }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Test Database Connection Button */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={testDatabaseConnection}
                disabled={testingDatabase}
                className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {testingDatabase ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Database className="w-5 h-5" />
                )}
                {testingDatabase ? "Testing Connection..." : "Test Database Connection"}
              </button>
              
              {databaseTestResult && (
                <div className={`mt-4 p-4 rounded-lg ${
                  databaseTestResult.connected 
                    ? "bg-green-100 text-green-800 border border-green-200" 
                    : "bg-red-100 text-red-800 border border-red-200"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {databaseTestResult.connected ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span className="font-semibold">
                      {databaseTestResult.connected ? "Connection Successful!" : "Connection Failed"}
                    </span>
                  </div>
                  {databaseTestResult.connected ? (
                    <div className="text-sm">
                      <p>Database: {databaseTestResult.database}</p>
                      <p>User: {databaseTestResult.user}</p>
                      <p>Server Time: {new Date(databaseTestResult.timestamp).toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-sm">{databaseTestResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Limits Tab */}
        {activeTab === "limits" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              User Creation Limits
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Admins
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.limits?.maxAdmins || 5}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    limits: { ...prev.limits, maxAdmins: parseInt(e.target.value) || 1 }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum number of admin accounts allowed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Total Users Limit
                </label>
                <input
                  type="number"
                  min="1"
                  value={config.limits?.maxTotalUsers || 200}
                  onChange={(e) => setConfig(prev => ({ 
                    ...prev, 
                    limits: { ...prev.limits, maxTotalUsers: parseInt(e.target.value) || 1 }
                  }))}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Maximum total users in the system
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Backend Mode Tab */}
        {activeTab === "backend" && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Backend Mode Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* LOCAL Mode */}
              <button
                onClick={() => updateBackendMode("LOCAL")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  config.backendMode === "LOCAL"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Server className={`w-10 h-10 mb-3 ${
                  config.backendMode === "LOCAL" ? "text-purple-600" : "text-gray-400"
                }`} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">LOCAL</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect to local Tally instance
                </p>
                {config.backendMode === "LOCAL" && (
                  <CheckCircle className="w-5 h-5 text-purple-600 mt-3" />
                )}
              </button>

              {/* LIVE Mode */}
              <button
                onClick={() => updateBackendMode("LIVE")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  config.backendMode === "LIVE"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <Server className={`w-10 h-10 mb-3 ${
                  config.backendMode === "LIVE" ? "text-green-600" : "text-gray-400"
                }`} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">LIVE</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Connect to live server endpoint
                </p>
                {config.backendMode === "LIVE" && (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-3" />
                )}
              </button>

              {/* OFFLINE Mode */}
              <button
                onClick={() => updateBackendMode("OFFLINE")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  config.backendMode === "OFFLINE"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <WifiOff className={`w-10 h-10 mb-3 ${
                  config.backendMode === "OFFLINE" ? "text-orange-600" : "text-gray-400"
                }`} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">OFFLINE</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Work offline, sync to DB only
                </p>
                {config.backendMode === "OFFLINE" && (
                  <CheckCircle className="w-5 h-5 text-orange-600 mt-3" />
                )}
              </button>

              {/* DUMMY_DATA Mode */}
              <button
                onClick={() => updateBackendMode("DUMMY_DATA")}
                className={`p-6 rounded-xl border-2 transition-all ${
                  config.backendMode === "DUMMY_DATA"
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
              >
                <AlertTriangle className={`w-10 h-10 mb-3 ${
                  config.backendMode === "DUMMY_DATA" ? "text-yellow-600" : "text-gray-400"
                }`} />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">DUMMY DATA</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Use mock data for testing
                </p>
                {config.backendMode === "DUMMY_DATA" && (
                  <CheckCircle className="w-5 h-5 text-yellow-600 mt-3" />
                )}
              </button>
            </div>

            {config.backendMode === "DUMMY_DATA" && (
              <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">Warning: Dummy Data Mode</span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  All API endpoints will return mock data. No real Tally or database connections will be made.
                </p>
              </div>
            )}

            {config.backendMode === "OFFLINE" && (
              <div className="mt-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <WifiOff className="w-5 h-5" />
                  <span className="font-medium">Offline Mode Active</span>
                </div>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  Tally connection is disabled. Sync will only update data between CRM and PostgreSQL database.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 mt-6">
        <button
          onClick={resetConfig}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RotateCcw className="w-5 h-5" />
          Reset to Defaults
        </button>
        <button
          onClick={saveConfig}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
