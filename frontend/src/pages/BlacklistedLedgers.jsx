import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  ShieldAlert, Ban, Plus, Trash2, ArrowLeft, Search, AlertCircle, 
  CheckCircle, User, Calendar, FileText, RefreshCw
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export default function BlacklistedLedgers() {
  const { user, isAdminOrHigher, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [blacklist, setBlacklist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ledgerSuggestions, setLedgerSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newEntry, setNewEntry] = useState({ ledgerName: "", reason: "" });
  const [addLoading, setAddLoading] = useState(false);

  const canManage = isAdminOrHigher() || hasPermission('manage_blacklist');

  useEffect(() => {
    if (!canManage) {
      navigate('/ledgers');
      return;
    }
    loadBlacklist();
  }, [canManage, navigate]);

  const loadBlacklist = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/api/blacklist`, {
        headers: {
          'x-user-id': user?.id?.toString() || '',
          'x-user-role': user?.role || 'user'
        }
      });
      setBlacklist(res.data?.ledgers || []);
    } catch (err) {
      // Fallback to localStorage
      const stored = localStorage.getItem('crm_blacklisted_ledgers');
      setBlacklist(stored ? JSON.parse(stored) : []);
      console.error('Failed to load blacklist from API:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchLedgers = async (value) => {
    if (value.length < 2) {
      setLedgerSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    
    try {
      const res = await axios.get(`${API_BASE}/api/ledgers/list/sundry-debtors?search=${value}&limit=20`);
      const ledgers = res.data?.ledgers || [];
      // Filter out already blacklisted ledgers
      const filtered = ledgers.filter(l => 
        !blacklist.some(b => b.name.toLowerCase() === l.name.toLowerCase())
      );
      setLedgerSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } catch (err) {
      console.error('Failed to search ledgers:', err);
    }
  };

  const handleAddBlacklist = async () => {
    if (!newEntry.ledgerName.trim()) {
      setMessage({ type: 'error', text: 'Ledger name is required' });
      return;
    }

    setAddLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/blacklist/add`, {
        ledgerName: newEntry.ledgerName,
        reason: newEntry.reason || 'No reason provided'
      }, {
        headers: {
          'x-user-id': user?.id?.toString() || '',
          'x-user-role': user?.role || 'user'
        }
      });

      if (res.data?.success) {
        setMessage({ type: 'success', text: `${newEntry.ledgerName} has been blacklisted` });
        setShowAddModal(false);
        setNewEntry({ ledgerName: '', reason: '' });
        loadBlacklist();
        
        // Also update localStorage for offline use
        const updated = [...blacklist, res.data.entry];
        localStorage.setItem('crm_blacklisted_ledgers', JSON.stringify(updated));
      } else {
        setMessage({ type: 'error', text: res.data?.error || 'Failed to add to blacklist' });
      }
    } catch (err) {
      // Fallback to localStorage
      const entry = {
        id: Date.now().toString(),
        name: newEntry.ledgerName,
        reason: newEntry.reason || 'No reason provided',
        addedBy: user?.username || 'admin',
        addedAt: new Date().toISOString()
      };
      const updated = [...blacklist, entry];
      localStorage.setItem('crm_blacklisted_ledgers', JSON.stringify(updated));
      setBlacklist(updated);
      setMessage({ type: 'success', text: `${newEntry.ledgerName} has been blacklisted (offline mode)` });
      setShowAddModal(false);
      setNewEntry({ ledgerName: '', reason: '' });
    } finally {
      setAddLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleRemoveBlacklist = async (entry) => {
    if (!confirm(`Remove ${entry.name} from blacklist?`)) return;

    try {
      await axios.delete(`${API_BASE}/api/blacklist/remove/${entry.id}`, {
        headers: {
          'x-user-id': user?.id?.toString() || '',
          'x-user-role': user?.role || 'user'
        }
      });
      
      setMessage({ type: 'success', text: `${entry.name} removed from blacklist` });
      loadBlacklist();
      
      // Update localStorage
      const updated = blacklist.filter(b => b.id !== entry.id);
      localStorage.setItem('crm_blacklisted_ledgers', JSON.stringify(updated));
    } catch (err) {
      // Fallback to localStorage only
      const updated = blacklist.filter(b => b.id !== entry.id);
      localStorage.setItem('crm_blacklisted_ledgers', JSON.stringify(updated));
      setBlacklist(updated);
      setMessage({ type: 'success', text: `${entry.name} removed from blacklist (offline mode)` });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const filteredBlacklist = blacklist.filter(entry =>
    entry.name.toLowerCase().includes(search.toLowerCase()) ||
    (entry.reason || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/ledgers')}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 glass-text">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="w-7 h-7 text-red-600" />
            Blacklisted Ledgers
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage ledgers that are blocked from order creation
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add to Blacklist
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search blacklisted ledgers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
      </div>

      {/* Blacklist Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500">Loading blacklist...</p>
          </div>
        ) : filteredBlacklist.length === 0 ? (
          <div className="p-12 text-center">
            <Ban className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {search ? 'No matching blacklisted ledgers found' : 'No ledgers are blacklisted yet'}
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Blacklisted ledgers cannot be used when creating orders
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Ledger Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Added By</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-300">Added At</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700 dark:text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {filteredBlacklist.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Ban className="w-4 h-4 text-red-500" />
                      <span className="font-medium text-gray-900 dark:text-white">{entry.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate">
                    {entry.reason || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <User className="w-3 h-3" />
                      {entry.addedBy || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {formatDate(entry.addedAt)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleRemoveBlacklist(entry)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition"
                      title="Remove from blacklist"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Add to Blacklist Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAddModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />
                Add to Blacklist
              </h2>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="relative">
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Ledger Name *
                </label>
                <input
                  type="text"
                  value={newEntry.ledgerName}
                  onChange={(e) => {
                    setNewEntry({ ...newEntry, ledgerName: e.target.value });
                    searchLedgers(e.target.value);
                  }}
                  onFocus={() => newEntry.ledgerName.length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  placeholder="Type to search ledgers..."
                  autoComplete="off"
                />
                {showSuggestions && ledgerSuggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {ledgerSuggestions.map((ledger, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => {
                          setNewEntry({ ...newEntry, ledgerName: ledger.name });
                          setShowSuggestions(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      >
                        {ledger.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                  Reason for Blacklisting
                </label>
                <textarea
                  value={newEntry.reason}
                  onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                  rows={3}
                  placeholder="Why is this ledger being blacklisted?"
                />
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <strong>Warning:</strong> Once blacklisted, this ledger cannot be selected when creating new orders.
                </p>
              </div>
            </div>
            <div className="p-6 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBlacklist}
                disabled={addLoading || !newEntry.ledgerName.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Ban className="w-4 h-4" />
                {addLoading ? 'Adding...' : 'Add to Blacklist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
