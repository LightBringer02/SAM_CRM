/**
 * Backup Management Page
 * ROOT-only interface for backup and restore operations
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar,
  HardDrive,
  Play,
  Pause,
  Settings,
  Eye
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api';

// Status colors
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  deleted: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

export default function BackupManagement() {
  const [backups, setBackups] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showScheduleSettings, setShowScheduleSettings] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState({
    enabled: true,
    intervalHours: 24,
    backupType: 'full'
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Get auth headers
  const getHeaders = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
      'x-user-id': user.id?.toString() || user.userId?.toString() || '0',
      'x-user-role': user.role || user.userRole || 'user',
      'x-username': user.username || user.name || 'Unknown'
    };
  };

  // Fetch backup status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/backup/status`, { headers: getHeaders() });
      setStatus(res.data.data);
      if (res.data.data?.scheduler?.config) {
        setScheduleConfig(res.data.data.scheduler.config);
      }
    } catch (err) {
      console.error('Failed to fetch backup status:', err);
    }
  }, []);

  // Fetch backups list
  const fetchBackups = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/backup/list`, { headers: getHeaders() });
      setBackups(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchBackups()])
      .finally(() => setLoading(false));
  }, [fetchStatus, fetchBackups]);

  // Create backup
  const createBackup = async (immediate = true) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await axios.post(`${API_BASE}/backup/create`, {
        backupType: 'full',
        description: 'Manual backup from UI',
        immediate
      }, { headers: getHeaders() });
      
      setSuccess(res.data.message);
      await fetchBackups();
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete backup
  const deleteBackup = async (id) => {
    if (!confirm('Delete this backup permanently?')) return;
    
    setActionLoading(true);
    try {
      await axios.delete(`${API_BASE}/backup/${id}`, { headers: getHeaders() });
      setSuccess('Backup deleted');
      await fetchBackups();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Preview restore
  const previewRestore = async (id) => {
    try {
      const res = await axios.post(`${API_BASE}/backup/${id}/preview`, {}, { headers: getHeaders() });
      setPreviewData(res.data.data);
      setSelectedBackup(id);
      setShowPreview(true);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Execute restore
  const executeRestore = async (id) => {
    if (!confirm('This will replace all current data with backup data. Continue?')) return;
    
    setActionLoading(true);
    setShowPreview(false);
    try {
      const res = await axios.post(`${API_BASE}/backup/${id}/restore`, {
        createBackupFirst: true,
        immediate: true
      }, { headers: getHeaders() });
      
      setSuccess(`Restore completed: ${res.data.data.totalRows} rows restored`);
      await fetchBackups();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Update schedule
  const updateSchedule = async () => {
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/backup/schedule/update`, scheduleConfig, { headers: getHeaders() });
      setSuccess('Schedule updated');
      setShowScheduleSettings(false);
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle scheduler
  const toggleScheduler = async (action) => {
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/backup/schedule/${action}`, {}, { headers: getHeaders() });
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Handle file upload for restore
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.endsWith('.json')) {
        setError('Please upload a valid JSON backup file');
        return;
      }
      setUploadFile(file);
      setShowUploadModal(true);
    }
  };

  // Restore from uploaded file
  const restoreFromUpload = async () => {
    if (!uploadFile) return;
    
    setActionLoading(true);
    setShowUploadModal(false);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          // Validate backup structure
          if (!backupData.tables && !backupData.data) {
            setError('Invalid backup file format');
            setActionLoading(false);
            return;
          }
          
          // Send to API for restore
          const res = await axios.post(`${API_BASE}/backup/restore-upload`, {
            backupData,
            createBackupFirst: true
          }, { headers: getHeaders() });
          
          setSuccess(`Restore from upload completed: ${res.data.data?.totalRows || 'unknown'} rows restored`);
          await fetchBackups();
        } catch (parseErr) {
          setError('Failed to parse backup file: ' + parseErr.message);
        } finally {
          setActionLoading(false);
          setUploadFile(null);
        }
      };
      reader.onerror = () => {
        setError('Failed to read file');
        setActionLoading(false);
      };
      reader.readAsText(uploadFile);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      setActionLoading(false);
    }
  };

  // Format bytes - with sanity check for unreasonably large values
  const formatBytes = (bytes) => {
    // Parse as number
    const numBytes = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    
    // Validate
    if (numBytes === null || numBytes === undefined || isNaN(numBytes) || numBytes <= 0) {
      return '0 B';
    }
    
    // Sanity check: if value is larger than 10 TB, it's likely an error
    const MAX_REASONABLE_SIZE = 10 * 1024 * 1024 * 1024 * 1024; // 10 TB
    if (numBytes > MAX_REASONABLE_SIZE) {
      return 'N/A';
    }
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    if (i < 0 || i >= sizes.length) return '0 B';
    return parseFloat((numBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Database className="w-8 h-8 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Backup Management</h1>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchBackups(); }}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex justify-between">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex justify-between">
          <p className="text-green-700 dark:text-green-300">{success}</p>
          <button onClick={() => setSuccess(null)} className="text-sm underline">Dismiss</button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Backups</span>
            <HardDrive className="w-4 h-4 text-gray-400" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.stats?.total || 0}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Completed</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.stats?.completed || 0}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Size</span>
            <Database className="w-4 h-4 text-purple-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatBytes(status?.stats?.totalSizeBytes || 0)}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Scheduler</span>
            <Calendar className="w-4 h-4 text-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status?.scheduler?.isRunning ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="font-semibold text-gray-900 dark:text-white">
              {status?.scheduler?.isRunning ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Actions</h2>
        
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => createBackup(true)}
            disabled={actionLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Create Backup Now
          </button>

          <button
            onClick={() => createBackup(false)}
            disabled={actionLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Clock className="w-4 h-4" /> Queue Backup
          </button>

          <div className="border-l border-gray-200 dark:border-gray-700 mx-2" />

          <button
            onClick={() => toggleScheduler(status?.scheduler?.isRunning ? 'stop' : 'start')}
            disabled={actionLoading}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              status?.scheduler?.isRunning 
                ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                : 'bg-green-600 text-white hover:bg-green-700'
            } disabled:opacity-50`}
          >
            {status?.scheduler?.isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {status?.scheduler?.isRunning ? 'Stop Scheduler' : 'Start Scheduler'}
          </button>

          <button
            onClick={() => setShowScheduleSettings(true)}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" /> Schedule Settings
          </button>

          <div className="border-l border-gray-200 dark:border-gray-700 mx-2" />

          {/* Upload Restore Button */}
          <label className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 cursor-pointer flex items-center gap-2">
            <Upload className="w-4 h-4" /> Restore from File
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Backups List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Backup History</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No backups found
                  </td>
                </tr>
              ) : (
                backups.map((backup) => (
                  <tr key={backup.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">{backup.name}</p>
                      {backup.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{backup.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {backup.backup_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[backup.status]}`}>
                        {backup.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatBytes(backup.size_bytes)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(backup.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {backup.status === 'completed' && (
                          <>
                            <button
                              onClick={() => {
                                // Download backup as JSON file
                                window.open(`${API_BASE}/backup/${backup.id}/download`, '_blank');
                              }}
                              className="p-1 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                              title="Download Backup"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => previewRestore(backup.id)}
                              className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                              title="Preview Restore"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => executeRestore(backup.id)}
                              className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                              title="Restore"
                            >
                              <Upload className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => deleteBackup(backup.id)}
                          className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
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

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Restore Preview
            </h3>
            
            <div className="mb-4">
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Snapshot:</strong> {previewData.snapshotName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Created: {new Date(previewData.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="mb-4">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">Tables to Restore:</h4>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-700">
                      <th className="px-3 py-2 text-left">Table</th>
                      <th className="px-3 py-2 text-right">Backup Rows</th>
                      <th className="px-3 py-2 text-right">Current Rows</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.tables?.map((table) => (
                      <tr key={table.name} className="border-t border-gray-200 dark:border-gray-600">
                        <td className="px-3 py-2">{table.name}</td>
                        <td className="px-3 py-2 text-right">{table.backupRows}</td>
                        <td className="px-3 py-2 text-right">{table.currentRows}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {previewData.warnings?.length > 0 && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200 mb-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-medium">Warnings</span>
                </div>
                <ul className="text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside">
                  {previewData.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={() => executeRestore(selectedBackup)}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Restore Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Settings Modal */}
      {showScheduleSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Auto-Backup Schedule
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={scheduleConfig.enabled}
                    onChange={(e) => setScheduleConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-gray-700 dark:text-gray-300">Enable automatic backups</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Backup Interval (hours)
                </label>
                <input
                  type="number"
                  min="1"
                  value={scheduleConfig.intervalHours}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, intervalHours: parseInt(e.target.value) || 24 }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Backup Type
                </label>
                <select
                  value={scheduleConfig.backupType}
                  onChange={(e) => setScheduleConfig(prev => ({ ...prev, backupType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="full">Full Backup</option>
                  <option value="incremental">Incremental</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowScheduleSettings(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={updateSchedule}
                disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Restore Confirmation Modal */}
      {showUploadModal && uploadFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Restore from Uploaded File
            </h3>
            
            <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Selected File:</p>
              <p className="font-medium text-gray-900 dark:text-white">{uploadFile.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Size: {(uploadFile.size / 1024).toFixed(2)} KB
              </p>
            </div>

            <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm">This will replace all current data with the backup data. A backup of current data will be created first.</span>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowUploadModal(false); setUploadFile(null); }}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={restoreFromUpload}
                disabled={actionLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" /> Restore Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
