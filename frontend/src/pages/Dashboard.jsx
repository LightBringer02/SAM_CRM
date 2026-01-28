import { useAuth } from "../auth";
import { useState, useEffect } from "react";
import { FileText, Edit3, Trash2, Clock, ChevronRight, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

// Draft voucher storage key
const DRAFTS_STORAGE_KEY = 'voucher_drafts';

// Get drafts from localStorage
const getDrafts = () => {
  try {
    const drafts = localStorage.getItem(DRAFTS_STORAGE_KEY);
    return drafts ? JSON.parse(drafts) : [];
  } catch {
    return [];
  }
};

// Save drafts to localStorage
const saveDrafts = (drafts) => {
  localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
};

// Sample drafts for demonstration
const sampleDrafts = [
  {
    id: 'draft-1',
    type: 'sales',
    party_name: 'ABC Traders',
    amount: 15000,
    date: new Date().toISOString().split('T')[0],
    narration: 'Sales invoice - pending approval',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    status: 'draft'
  },
  {
    id: 'draft-2',
    type: 'purchase',
    party_name: 'XYZ Suppliers',
    amount: 8500,
    date: new Date().toISOString().split('T')[0],
    narration: 'Purchase order - awaiting confirmation',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    status: 'draft'
  },
  {
    id: 'draft-3',
    type: 'receipt',
    party_name: 'LMN Enterprise',
    amount: 25000,
    date: new Date().toISOString().split('T')[0],
    narration: 'Receipt against invoice #1234',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    status: 'draft'
  }
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState([]);

  // Load drafts on mount
  useEffect(() => {
    let storedDrafts = getDrafts();
    // If no drafts exist, initialize with sample drafts
    if (storedDrafts.length === 0) {
      storedDrafts = sampleDrafts;
      saveDrafts(storedDrafts);
    }
    setDrafts(storedDrafts);
  }, []);

  // Delete a draft
  const deleteDraft = (id) => {
    const updatedDrafts = drafts.filter(d => d.id !== id);
    saveDrafts(updatedDrafts);
    setDrafts(updatedDrafts);
  };

  // Format time ago
  const timeAgo = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  // Get type color
  const getTypeColor = (type) => {
    switch(type) {
      case 'sales': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'purchase': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'receipt': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'payment': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-sky-700 dark:text-sky-400">Dashboard Overview</h1>

      {user && (
        <div className="bg-white dark:bg-gray-800 rounded shadow p-3 border border-gray-200 dark:border-gray-700 flex items-center gap-4 max-w-xl">
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100">Welcome, {user.name || user.username}!</span>
          <span className="text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-3 ml-3">{user.role}</span>
          {user.email && (
            <span className="text-xs text-gray-500 dark:text-gray-400 border-l border-gray-300 dark:border-gray-600 pl-3 ml-3">{user.email}</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
          <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Quick Stats</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300 mt-2">Coming Soon</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
          <p className="text-green-600 dark:text-green-400 text-sm font-medium">Analytics</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300 mt-2">Coming Soon</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 border border-purple-200 dark:border-purple-800">
          <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Reports</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-300 mt-2">Coming Soon</p>
        </div>
      </div>

      {/* Drafts Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Draft Vouchers</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full">
              {drafts.length}
            </span>
          </div>
          <button
            onClick={() => navigate('/vouchers?action=new')}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
          >
            <Plus className="w-4 h-4" />
            New Draft
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p>No draft vouchers</p>
            <p className="text-sm mt-1">Create a new voucher and save as draft</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {drafts.map(draft => (
              <div 
                key={draft.id}
                className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${getTypeColor(draft.type)}`}>
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">{draft.party_name}</span>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded ${getTypeColor(draft.type)}`}>
                        {draft.type.charAt(0).toUpperCase() + draft.type.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                      <span>₹{draft.amount?.toLocaleString('en-IN')}</span>
                      <span>•</span>
                      <span>{draft.narration}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                    <Clock className="w-3 h-3" />
                    {timeAgo(draft.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navigate(`/vouchers?draft=${draft.id}`)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition"
                      title="Edit Draft"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteDraft(draft.id)}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => navigate(`/vouchers?draft=${draft.id}`)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
                      title="Continue Editing"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
