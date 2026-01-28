import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { 
  MessageSquare, 
  Mail, 
  Phone, 
  Send, 
  Save, 
  Trash2, 
  Plus, 
  Search, 
  RefreshCw,
  ArrowLeft,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  Edit2,
  X
} from "lucide-react";

// WhatsApp Icon SVG
const WhatsAppIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Tab configuration
const TABS = [
  { key: "whatsapp", name: "WhatsApp", icon: WhatsAppIcon, color: "green" },
  { key: "email", name: "Email", icon: Mail, color: "blue" }
];

// Draft Message Component
function DraftEditor({ type, draft, onSave, onCancel, onSend }) {
  const [formData, setFormData] = useState({
    recipient: draft?.recipient || "",
    subject: draft?.subject || "",
    message: draft?.message || "",
    recipientName: draft?.recipientName || ""
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const isValid = type === "whatsapp" 
    ? formData.recipient.trim() && formData.message.trim()
    : formData.recipient.trim() && formData.subject.trim() && formData.message.trim();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {draft?.id ? "Edit Draft" : "New Message"}
        </h3>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {type === "whatsapp" ? "Phone Number" : "Email Address"} *
            </label>
            <input
              type={type === "whatsapp" ? "tel" : "email"}
              name="recipient"
              value={formData.recipient}
              onChange={handleChange}
              placeholder={type === "whatsapp" ? "+91 98765 43210" : "example@email.com"}
              className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Recipient Name
            </label>
            <input
              type="text"
              name="recipientName"
              value={formData.recipientName}
              onChange={handleChange}
              placeholder="John Doe"
              className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {type === "email" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Subject *
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Email subject..."
              className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Message *
          </label>
          <textarea
            name="message"
            value={formData.message}
            onChange={handleChange}
            rows={6}
            placeholder="Type your message here..."
            className="w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={() => onSave({ ...draft, ...formData })}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition"
          >
            <Save className="w-4 h-4" />
            Save Draft
          </button>
          <button
            onClick={() => onSend(formData)}
            disabled={!isValid}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
              isValid
                ? type === "whatsapp"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// Draft List Component
function DraftList({ type, drafts, onSelect, onDelete, onNewDraft }) {
  const [search, setSearch] = useState("");

  const filteredDrafts = drafts.filter(d =>
    (d.recipient || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.recipientName || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.subject || "").toLowerCase().includes(search.toLowerCase()) ||
    (d.message || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search drafts..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <button
            onClick={onNewDraft}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white transition ${
              type === "whatsapp" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
        {filteredDrafts.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No drafts found</p>
          </div>
        ) : (
          filteredDrafts.map(draft => (
            <div
              key={draft.id}
              className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition flex items-start justify-between gap-3"
              onClick={() => onSelect(draft)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {draft.recipientName || draft.recipient || "No recipient"}
                  </span>
                  {draft.status === "sent" && (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  )}
                  {draft.status === "failed" && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                </div>
                {type === "email" && draft.subject && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{draft.subject}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-500 truncate">{draft.message}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {new Date(draft.updatedAt || draft.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(draft.id);
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Sent Messages History
function SentHistory({ type, messages }) {
  if (messages.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <Send className="w-12 h-12 mx-auto mb-3 text-gray-400 opacity-50" />
        <p className="text-gray-500 dark:text-gray-400">No sent messages yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Sent Messages</h3>
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
        {messages.map(msg => (
          <div key={msg.id} className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-gray-900 dark:text-white">
                {msg.recipientName || msg.recipient}
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                msg.status === "sent" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {msg.status}
              </span>
            </div>
            {type === "email" && msg.subject && (
              <p className="text-sm text-gray-600 dark:text-gray-400">{msg.subject}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-500 truncate">{msg.message}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(msg.sentAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Main Communication Page
export default function Communication() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("whatsapp");
  const [drafts, setDrafts] = useState({ whatsapp: [], email: [] });
  const [sentMessages, setSentMessages] = useState({ whatsapp: [], email: [] });
  const [editingDraft, setEditingDraft] = useState(null);
  const [loading, setLoading] = useState(false);

  // Handle URL params for auto-fill (from ledgers/vouchers)
  useEffect(() => {
    const type = searchParams.get('type');
    const name = searchParams.get('name');
    const phone = searchParams.get('phone');
    const email = searchParams.get('email');
    
    if (type && (name || phone || email)) {
      // Set active tab based on type
      if (type === 'whatsapp' || type === 'email') {
        setActiveTab(type);
      }
      
      // Create pre-filled draft
      setEditingDraft({
        recipient: type === 'whatsapp' ? (phone || '') : (email || ''),
        recipientName: name || '',
        subject: type === 'email' ? `Regarding your account` : '',
        message: `Hello ${name || ''},\n\n`,
      });
    }
  }, [searchParams]);

  // Load drafts from localStorage on mount
  useEffect(() => {
    const savedDrafts = localStorage.getItem("communication_drafts");
    const savedSent = localStorage.getItem("communication_sent");
    if (savedDrafts) setDrafts(JSON.parse(savedDrafts));
    if (savedSent) setSentMessages(JSON.parse(savedSent));
  }, []);

  // Save drafts to localStorage
  const saveDraftsToStorage = (newDrafts) => {
    localStorage.setItem("communication_drafts", JSON.stringify(newDrafts));
    setDrafts(newDrafts);
  };

  const saveSentToStorage = (newSent) => {
    localStorage.setItem("communication_sent", JSON.stringify(newSent));
    setSentMessages(newSent);
  };

  const handleSaveDraft = (draft) => {
    const newDrafts = { ...drafts };
    const typeKey = activeTab;
    
    if (draft.id) {
      // Update existing
      newDrafts[typeKey] = newDrafts[typeKey].map(d => 
        d.id === draft.id ? { ...draft, updatedAt: new Date().toISOString() } : d
      );
    } else {
      // Create new
      newDrafts[typeKey] = [
        ...newDrafts[typeKey],
        { ...draft, id: Date.now().toString(), createdAt: new Date().toISOString(), status: "draft" }
      ];
    }
    
    saveDraftsToStorage(newDrafts);
    setEditingDraft(null);
  };

  const handleDeleteDraft = (draftId) => {
    const newDrafts = { ...drafts };
    newDrafts[activeTab] = newDrafts[activeTab].filter(d => d.id !== draftId);
    saveDraftsToStorage(newDrafts);
  };

  const handleSendMessage = async (formData) => {
    setLoading(true);
    
    try {
      if (activeTab === "whatsapp") {
        // Open WhatsApp with pre-filled message
        const phone = formData.recipient.replace(/\D/g, "");
        const message = encodeURIComponent(formData.message);
        const whatsappUrl = `https://wa.me/${phone}?text=${message}`;
        window.open(whatsappUrl, "_blank");
        
        // Record as sent
        const newSent = { ...sentMessages };
        newSent.whatsapp = [
          { ...formData, id: Date.now().toString(), status: "sent", sentAt: new Date().toISOString() },
          ...newSent.whatsapp
        ];
        saveSentToStorage(newSent);
      } else {
        // Open email client with pre-filled message
        const subject = encodeURIComponent(formData.subject);
        const body = encodeURIComponent(formData.message);
        const mailtoUrl = `mailto:${formData.recipient}?subject=${subject}&body=${body}`;
        window.location.href = mailtoUrl;
        
        // Record as sent
        const newSent = { ...sentMessages };
        newSent.email = [
          { ...formData, id: Date.now().toString(), status: "sent", sentAt: new Date().toISOString() },
          ...newSent.email
        ];
        saveSentToStorage(newSent);
      }
      
      // Remove from drafts if it was a draft
      if (editingDraft?.id) {
        handleDeleteDraft(editingDraft.id);
      }
      setEditingDraft(null);
    } catch (err) {
      console.error("Failed to send message:", err);
      alert("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentTab = TABS.find(t => t.key === activeTab);

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Communication</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Send messages via WhatsApp or Email</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key);
                  setEditingDraft(null);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition ${
                  isActive
                    ? tab.color === "green"
                      ? "bg-green-600 text-white"
                      : "bg-blue-600 text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.name}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Draft Editor or List */}
          <div>
            {editingDraft !== null ? (
              <DraftEditor
                type={activeTab}
                draft={editingDraft}
                onSave={handleSaveDraft}
                onCancel={() => setEditingDraft(null)}
                onSend={handleSendMessage}
              />
            ) : (
              <DraftList
                type={activeTab}
                drafts={drafts[activeTab]}
                onSelect={setEditingDraft}
                onDelete={handleDeleteDraft}
                onNewDraft={() => setEditingDraft({})}
              />
            )}
          </div>

          {/* Right: Sent History */}
          <div>
            <SentHistory type={activeTab} messages={sentMessages[activeTab]} />
          </div>
        </div>

        {/* API Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
            {activeTab === "whatsapp" ? "WhatsApp Integration" : "Email Integration"}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {activeTab === "whatsapp" 
              ? "Messages are sent via WhatsApp Web API (wa.me). Click 'Send' to open WhatsApp with your pre-filled message. For bulk messaging, consider integrating WhatsApp Business API."
              : "Messages are sent via your default email client (mailto:). Click 'Send' to open your email application with the pre-filled message."
            }
          </p>
        </div>
      </div>
    </div>
  );
}
