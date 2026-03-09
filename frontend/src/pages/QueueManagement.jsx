/**
 * Queue Management Page
 * ROOT-only interface for managing the job queue
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  ListTodo, 
  Play, 
  Pause, 
  Square, 
  RefreshCw, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Server,
  Zap
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000') + '/api';

// Job status colors
const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
};

const STATUS_ICONS = {
  pending: Clock,
  processing: RefreshCw,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Square
};

export default function QueueManagement() {
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedJob, setExpandedJob] = useState(null);
  const [jobLogs, setJobLogs] = useState({});
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(false);

  // Get auth headers
  const getHeaders = () => {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
      'x-user-id': user.id?.toString() || user.userId?.toString() || '0',
      'x-user-role': user.role || user.userRole || 'user',
      'x-username': user.username || user.name || 'Unknown'
    };
  };

  // Fetch queue status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/queue/status`, { headers: getHeaders() });
      setStatus(res.data.data);
    } catch (err) {
      console.error('Failed to fetch queue status:', err);
    }
  }, []);

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const res = await axios.get(`${API_BASE}/queue/jobs`, { 
        headers: getHeaders(),
        params 
      });
      setJobs(res.data.data || []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, [filter]);

  // Fetch job logs
  const fetchJobLogs = async (jobId) => {
    try {
      const res = await axios.get(`${API_BASE}/queue/jobs/${jobId}`, { headers: getHeaders() });
      setJobLogs(prev => ({ ...prev, [jobId]: res.data.data.logs || [] }));
    } catch (err) {
      console.error('Failed to fetch job logs:', err);
    }
  };

  // Load data
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStatus(), fetchJobs()])
      .finally(() => setLoading(false));
  }, [fetchStatus, fetchJobs]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStatus();
      fetchJobs();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchJobs]);

  // Worker controls
  const controlWorker = async (action) => {
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/queue/worker/${action}`, {}, { headers: getHeaders() });
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Flush queue
  const flushQueue = async () => {
    if (!confirm('Cancel all pending jobs?')) return;
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/queue/flush`, {}, { headers: getHeaders() });
      await fetchJobs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Cancel job
  const cancelJob = async (jobId) => {
    try {
      await axios.post(`${API_BASE}/queue/jobs/${jobId}/cancel`, {}, { headers: getHeaders() });
      await fetchJobs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  // Enqueue job
  const enqueueJob = async (type, payload = {}) => {
    setActionLoading(true);
    try {
      await axios.post(`${API_BASE}/queue/enqueue/${type}`, payload, { headers: getHeaders() });
      await fetchJobs();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle job details
  const toggleJobDetails = (jobId) => {
    if (expandedJob === jobId) {
      setExpandedJob(null);
    } else {
      setExpandedJob(jobId);
      if (!jobLogs[jobId]) {
        fetchJobLogs(jobId);
      }
    }
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
          <ListTodo className="w-8 h-8 text-purple-600" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white glass-text">Queue Management</h1>
        </div>
        <button
          onClick={() => { fetchStatus(); fetchJobs(); }}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button onClick={() => setError(null)} className="text-sm underline mt-1">Dismiss</button>
        </div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Worker Status */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Worker</span>
            <Server className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${status?.worker?.isRunning ? 'bg-green-500' : 'bg-gray-400'}`} />
            <span className="font-semibold text-gray-900 dark:text-white">
              {status?.worker?.isRunning ? (status?.worker?.isPaused ? 'Paused' : 'Running') : 'Stopped'}
            </span>
          </div>
        </div>

        {/* Queue Stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Pending</span>
            <Clock className="w-4 h-4 text-yellow-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.queue?.pending || 0}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Completed</span>
            <CheckCircle className="w-4 h-4 text-green-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.queue?.completed || 0}
          </span>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Failed</span>
            <XCircle className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {status?.queue?.failed || 0}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Controls</h2>
        
        <div className="flex flex-wrap gap-3">
          {/* Worker Controls */}
          <div className="flex gap-2 border-r border-gray-200 dark:border-gray-700 pr-4">
            <button
              onClick={() => controlWorker('start')}
              disabled={actionLoading || status?.worker?.isRunning}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4" /> Start
            </button>
            <button
              onClick={() => controlWorker(status?.worker?.isPaused ? 'resume' : 'pause')}
              disabled={actionLoading || !status?.worker?.isRunning}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Pause className="w-4 h-4" /> {status?.worker?.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={() => controlWorker('stop')}
              disabled={actionLoading || !status?.worker?.isRunning}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Square className="w-4 h-4" /> Stop
            </button>
          </div>

          {/* Queue Actions */}
          <div className="flex gap-2 border-r border-gray-200 dark:border-gray-700 pr-4">
            <button
              onClick={() => enqueueJob('fetch', { fetchType: 'all' })}
              disabled={actionLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Zap className="w-4 h-4" /> Fetch All
            </button>
            <button
              onClick={() => enqueueJob('sync')}
              disabled={actionLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Sync
            </button>
            <button
              onClick={() => enqueueJob('backup')}
              disabled={actionLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Server className="w-4 h-4" /> Backup
            </button>
          </div>

          {/* Danger Zone */}
          <button
            onClick={flushQueue}
            disabled={actionLoading}
            className="px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Flush Queue
          </button>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Jobs</h2>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No jobs found
            </div>
          ) : (
            jobs.map((job) => {
              const StatusIcon = STATUS_ICONS[job.status] || AlertCircle;
              const isExpanded = expandedJob === job.id;

              return (
                <div key={job.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer"
                    onClick={() => toggleJobDetails(job.id)}
                  >
                    <div className="flex items-center gap-4">
                      <StatusIcon className={`w-5 h-5 ${job.status === 'processing' ? 'animate-spin' : ''}`} />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{job.task_type}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                        {job.status}
                      </span>
                      {(job.status === 'pending' || job.status === 'processing') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); cancelJob(job.id); }}
                          className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-4 pb-4 bg-gray-50 dark:bg-gray-700/30">
                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Job ID:</span>
                          <p className="font-mono text-xs text-gray-900 dark:text-white">{job.id}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Attempts:</span>
                          <p className="text-gray-900 dark:text-white">{job.attempts} / {job.max_attempts}</p>
                        </div>
                        {job.started_at && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Started:</span>
                            <p className="text-gray-900 dark:text-white">{new Date(job.started_at).toLocaleString()}</p>
                          </div>
                        )}
                        {job.completed_at && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Completed:</span>
                            <p className="text-gray-900 dark:text-white">{new Date(job.completed_at).toLocaleString()}</p>
                          </div>
                        )}
                      </div>

                      {job.error_message && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg mb-4">
                          <p className="text-sm text-red-700 dark:text-red-300">{job.error_message}</p>
                        </div>
                      )}

                      {jobLogs[job.id] && jobLogs[job.id].length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logs</h4>
                          <div className="bg-gray-900 rounded-lg p-3 max-h-48 overflow-y-auto">
                            {jobLogs[job.id].map((log, i) => (
                              <div key={i} className="text-xs font-mono mb-1">
                                <span className={`${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-gray-400'}`}>
                                  [{log.level}]
                                </span>
                                <span className="text-gray-300 ml-2">{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
