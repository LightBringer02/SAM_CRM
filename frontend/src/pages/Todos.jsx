import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import axios from "axios";
import {
  Plus, Trash2, Edit2, Save, X, CheckCircle, Clock, AlertCircle,
  Calendar, User, Filter, Search, Bell, ArrowUpDown, ChevronDown,
  Phone, Mail, MessageSquare, Target, Users, FileText, Building
} from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Storage keys
const TODOS_KEY = "crm_todos";
const FOLLOWUPS_KEY = "crm_followups";

// Priority levels
const PRIORITIES = [
  { value: "high", label: "High", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { value: "low", label: "Low", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
];

// Task categories
const CATEGORIES = [
  { value: "general", label: "General", icon: FileText },
  { value: "sales", label: "Sales", icon: Target },
  { value: "customer", label: "Customer", icon: Users },
  { value: "vendor", label: "Vendor", icon: Building },
  { value: "follow_up", label: "Follow-up", icon: Bell }
];

// Follow-up types
const FOLLOWUP_TYPES = [
  { value: "call", label: "Phone Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "message", label: "Message", icon: MessageSquare }
];

// Get todos from storage
function getTodosFromStorage() {
  try {
    const stored = localStorage.getItem(TODOS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save todos to storage
function saveTodosToStorage(todos) {
  try {
    localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
    return true;
  } catch {
    return false;
  }
}

// Get followups from storage
function getFollowupsFromStorage() {
  try {
    const stored = localStorage.getItem(FOLLOWUPS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save followups to storage
function saveFollowupsToStorage(followups) {
  try {
    localStorage.setItem(FOLLOWUPS_KEY, JSON.stringify(followups));
    return true;
  } catch {
    return false;
  }
}

// Format date for display
function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// Check if date is overdue
function isOverdue(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

// Check if date is today
function isToday(dateStr) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export default function Todos() {
  const { user, isAdminOrHigher } = useAuth();
  const [activeTab, setActiveTab] = useState("todos");
  const [users, setUsers] = useState([]);
  
  // Todos state
  const [todos, setTodos] = useState([]);
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [todoForm, setTodoForm] = useState({
    title: "", description: "", priority: "medium", category: "general", dueDate: "", assignedTo: ""
  });
  
  // Followups state
  const [followups, setFollowups] = useState([]);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [editingFollowup, setEditingFollowup] = useState(null);
  const [followupForm, setFollowupForm] = useState({
    title: "", contactName: "", contactPhone: "", contactEmail: "", type: "call",
    scheduledDate: "", scheduledTime: "", notes: "", relatedTo: "", priority: "medium"
  });
  
  // Filters
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setTodos(getTodosFromStorage());
    setFollowups(getFollowupsFromStorage());
    // Load users for task assignment
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/users`);
      const data = res.data?.users || res.data || [];
      setUsers(data.filter(u => u.role !== 'root'));
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const resetTodoForm = () => {
    setTodoForm({ title: "", description: "", priority: "medium", category: "general", dueDate: "", assignedTo: "" });
    setEditingTodo(null);
  };

  const resetFollowupForm = () => {
    setFollowupForm({ title: "", contactName: "", contactPhone: "", contactEmail: "", type: "call", scheduledDate: "", scheduledTime: "", notes: "", relatedTo: "", priority: "medium" });
    setEditingFollowup(null);
  };

  const handleSaveTodo = () => {
    if (!todoForm.title.trim()) { setMessage({ type: "error", text: "Title is required" }); return; }
    if (editingTodo) {
      const updated = todos.map(t => t.id === editingTodo.id ? { ...t, ...todoForm, updatedAt: new Date().toISOString() } : t);
      saveTodosToStorage(updated); setTodos(updated); setMessage({ type: "success", text: "Task updated!" });
    } else {
      const newTodo = { id: Date.now().toString(), ...todoForm, status: "pending", createdAt: new Date().toISOString(), createdBy: user?.id };
      const updated = [...todos, newTodo];
      saveTodosToStorage(updated); setTodos(updated); setMessage({ type: "success", text: "Task created!" });
    }
    setShowTodoModal(false); resetTodoForm(); setTimeout(() => setMessage(null), 3000);
  };

  const toggleTodoStatus = (id) => {
    const updated = todos.map(t => t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed", completedAt: t.status === "completed" ? null : new Date().toISOString() } : t);
    saveTodosToStorage(updated); setTodos(updated);
  };

  const deleteTodo = (id) => { if (!window.confirm("Delete this task?")) return; const updated = todos.filter(t => t.id !== id); saveTodosToStorage(updated); setTodos(updated); };

  const handleSaveFollowup = () => {
    if (!followupForm.title.trim()) { setMessage({ type: "error", text: "Title is required" }); return; }
    if (editingFollowup) {
      const updated = followups.map(f => f.id === editingFollowup.id ? { ...f, ...followupForm, updatedAt: new Date().toISOString() } : f);
      saveFollowupsToStorage(updated); setFollowups(updated); setMessage({ type: "success", text: "Follow-up updated!" });
    } else {
      const newFollowup = { id: Date.now().toString(), ...followupForm, status: "pending", createdAt: new Date().toISOString(), createdBy: user?.id };
      const updated = [...followups, newFollowup];
      saveFollowupsToStorage(updated); setFollowups(updated); setMessage({ type: "success", text: "Follow-up scheduled!" });
    }
    setShowFollowupModal(false); resetFollowupForm(); setTimeout(() => setMessage(null), 3000);
  };

  const completeFollowup = (id) => {
    const updated = followups.map(f => f.id === id ? { ...f, status: "completed", completedAt: new Date().toISOString() } : f);
    saveFollowupsToStorage(updated); setFollowups(updated);
  };

  const deleteFollowup = (id) => { if (!window.confirm("Delete this follow-up?")) return; const updated = followups.filter(f => f.id !== id); saveFollowupsToStorage(updated); setFollowups(updated); };

  const filteredTodos = todos.filter(t => {
    const matchesSearch = !search || t.title?.toLowerCase().includes(search.toLowerCase()) || t.description?.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = !filterPriority || t.priority === filterPriority;
    const matchesStatus = !filterStatus || t.status === filterStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  }).sort((a, b) => { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate) - new Date(b.dueDate); });

  const filteredFollowups = followups.filter(f => {
    const matchesSearch = !search || f.title?.toLowerCase().includes(search.toLowerCase()) || f.contactName?.toLowerCase().includes(search.toLowerCase());
    const matchesPriority = !filterPriority || f.priority === filterPriority;
    const matchesStatus = !filterStatus || f.status === filterStatus;
    return matchesSearch && matchesPriority && matchesStatus;
  }).sort((a, b) => { if (!a.scheduledDate) return 1; if (!b.scheduledDate) return -1; return new Date(a.scheduledDate) - new Date(b.scheduledDate); });

  const todoStats = { total: todos.length, pending: todos.filter(t => t.status === "pending").length, completed: todos.filter(t => t.status === "completed").length, overdue: todos.filter(t => t.status === "pending" && isOverdue(t.dueDate)).length, dueToday: todos.filter(t => t.status === "pending" && isToday(t.dueDate)).length };
  const followupStats = { total: followups.length, pending: followups.filter(f => f.status === "pending").length, completed: followups.filter(f => f.status === "completed").length, dueToday: followups.filter(f => f.status === "pending" && isToday(f.scheduledDate)).length };

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tasks & Follow-ups</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your tasks and schedule follow-ups</p>
        </div>
      </div>

      {message && <div className={`mb-4 p-3 rounded-lg ${message.type === "error" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{message.text}</div>}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab("todos")} className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "todos" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"}`}>
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4" />Tasks{todoStats.pending > 0 && <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">{todoStats.pending}</span>}</div>
        </button>
        <button onClick={() => setActiveTab("followups")} className={`px-4 py-2 rounded-lg font-medium transition ${activeTab === "followups" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"}`}>
          <div className="flex items-center gap-2"><Bell className="w-4 h-4" />Follow-ups{followupStats.pending > 0 && <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">{followupStats.pending}</span>}</div>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {activeTab === "todos" ? (<>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Total Tasks</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{todoStats.total}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{todoStats.pending}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Due Today</p><p className="text-2xl font-bold text-blue-600">{todoStats.dueToday}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Overdue</p><p className="text-2xl font-bold text-red-600">{todoStats.overdue}</p></div>
        </>) : (<>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Total Follow-ups</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{followupStats.total}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-yellow-600">{followupStats.pending}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Due Today</p><p className="text-2xl font-bold text-blue-600">{followupStats.dueToday}</p></div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-green-600">{followupStats.completed}</p></div>
        </>)}
      </div>

      <div className="flex flex-wrap gap-4 mb-6 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-4 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700 w-64" /></div>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"><option value="">All Priorities</option>{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700"><option value="">All Status</option><option value="pending">Pending</option><option value="completed">Completed</option></select>
        </div>
        <button onClick={() => activeTab === "todos" ? setShowTodoModal(true) : setShowFollowupModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Plus className="w-4 h-4" />{activeTab === "todos" ? "Add Task" : "Schedule Follow-up"}</button>
      </div>

      {activeTab === "todos" ? (
        <div className="space-y-3">
          {filteredTodos.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700"><CheckCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No tasks found. Create your first task!</p></div>
          ) : filteredTodos.map(todo => (
            <div key={todo.id} className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 flex items-center gap-4 ${todo.status === "completed" ? "opacity-60" : ""}`}>
              <button onClick={() => toggleTodoStatus(todo.id)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition ${todo.status === "completed" ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-500"}`}>{todo.status === "completed" && <CheckCircle className="w-4 h-4" />}</button>
              <div className="flex-1">
                <h3 className={`font-medium ${todo.status === "completed" ? "line-through text-gray-500" : "text-gray-900 dark:text-white"}`}>{todo.title}</h3>
                {todo.description && <p className="text-sm text-gray-500 mt-1">{todo.description}</p>}
                <div className="flex gap-3 mt-2 text-xs flex-wrap">
                  <span className={`px-2 py-0.5 rounded ${PRIORITIES.find(p => p.value === todo.priority)?.color}`}>{PRIORITIES.find(p => p.value === todo.priority)?.label}</span>
                  <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600">{CATEGORIES.find(c => c.value === todo.category)?.label}</span>
                  {todo.dueDate && <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${isOverdue(todo.dueDate) && todo.status !== "completed" ? "bg-red-100 text-red-700" : isToday(todo.dueDate) ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}><Calendar className="w-3 h-3" />{formatDate(todo.dueDate)}</span>}
                  {todo.assignedTo && <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 flex items-center gap-1"><User className="w-3 h-3" />{users.find(u => u.id === todo.assignedTo)?.name || users.find(u => u.id === todo.assignedTo)?.email || 'Assigned'}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingTodo(todo); setTodoForm(todo); setShowTodoModal(true); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                <button onClick={() => deleteTodo(todo.id)} className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredFollowups.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700"><Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No follow-ups scheduled. Create your first follow-up!</p></div>
          ) : filteredFollowups.map(followup => {
            const TypeIcon = FOLLOWUP_TYPES.find(t => t.value === followup.type)?.icon || Phone;
            return (
              <div key={followup.id} className={`bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 ${followup.status === "completed" ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${followup.status === "completed" ? "bg-green-100" : "bg-blue-100"}`}><TypeIcon className={`w-5 h-5 ${followup.status === "completed" ? "text-green-600" : "text-blue-600"}`} /></div>
                  <div className="flex-1">
                    <h3 className={`font-medium ${followup.status === "completed" ? "line-through text-gray-500" : "text-gray-900 dark:text-white"}`}>{followup.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{followup.contactName}{followup.contactPhone && ` • ${followup.contactPhone}`}</p>
                    <div className="flex gap-3 mt-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${PRIORITIES.find(p => p.value === followup.priority)?.color}`}>{PRIORITIES.find(p => p.value === followup.priority)?.label}</span>
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700">{FOLLOWUP_TYPES.find(t => t.value === followup.type)?.label}</span>
                      {followup.scheduledDate && <span className={`px-2 py-0.5 rounded flex items-center gap-1 ${isOverdue(followup.scheduledDate) && followup.status !== "completed" ? "bg-red-100 text-red-700" : isToday(followup.scheduledDate) ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}><Clock className="w-3 h-3" />{formatDate(followup.scheduledDate)} {followup.scheduledTime && `at ${followup.scheduledTime}`}</span>}
                    </div>
                    {followup.notes && <p className="text-xs text-gray-500 mt-2 italic">{followup.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    {followup.status !== "completed" && <button onClick={() => completeFollowup(followup.id)} className="p-2 hover:bg-green-100 rounded-lg" title="Mark Complete"><CheckCircle className="w-4 h-4 text-green-500" /></button>}
                    <button onClick={() => { setEditingFollowup(followup); setFollowupForm(followup); setShowFollowupModal(true); }} className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                    <button onClick={() => deleteFollowup(followup.id)} className="p-2 hover:bg-red-100 rounded-lg"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showTodoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowTodoModal(false); resetTodoForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingTodo ? "Edit Task" : "Create Task"}</h2>
              <button onClick={() => { setShowTodoModal(false); resetTodoForm(); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Title *</label><input type="text" value={todoForm.title} onChange={(e) => setTodoForm({...todoForm, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="What needs to be done?" /></div>
              <div><label className="block text-sm font-medium mb-1">Description</label><textarea value={todoForm.description} onChange={(e) => setTodoForm({...todoForm, description: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" rows={3} placeholder="Additional details..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Priority</label><select value={todoForm.priority} onChange={(e) => setTodoForm({...todoForm, priority: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Category</label><select value={todoForm.category} onChange={(e) => setTodoForm({...todoForm, category: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">{CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Due Date</label><input type="date" value={todoForm.dueDate} onChange={(e) => setTodoForm({...todoForm, dueDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
                <div><label className="block text-sm font-medium mb-1">Assign To</label><select value={todoForm.assignedTo} onChange={(e) => setTodoForm({...todoForm, assignedTo: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"><option value="">Unassigned</option>{users.map(u => <option key={u.id} value={u.id}>{u.name || u.email} ({u.role})</option>)}</select></div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowTodoModal(false); resetTodoForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveTodo} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" />{editingTodo ? "Update" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showFollowupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { setShowFollowupModal(false); resetFollowupForm(); }}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{editingFollowup ? "Edit Follow-up" : "Schedule Follow-up"}</h2>
              <button onClick={() => { setShowFollowupModal(false); resetFollowupForm(); }} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Title *</label><input type="text" value={followupForm.title} onChange={(e) => setFollowupForm({...followupForm, title: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Follow-up reason..." /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Contact Name</label><input type="text" value={followupForm.contactName} onChange={(e) => setFollowupForm({...followupForm, contactName: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Contact name" /></div>
                <div><label className="block text-sm font-medium mb-1">Phone</label><input type="tel" value={followupForm.contactPhone} onChange={(e) => setFollowupForm({...followupForm, contactPhone: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" placeholder="Phone number" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Type</label><select value={followupForm.type} onChange={(e) => setFollowupForm({...followupForm, type: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">{FOLLOWUP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">Priority</label><select value={followupForm.priority} onChange={(e) => setFollowupForm({...followupForm, priority: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600">{PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Scheduled Date</label><input type="date" value={followupForm.scheduledDate} onChange={(e) => setFollowupForm({...followupForm, scheduledDate: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
                <div><label className="block text-sm font-medium mb-1">Time</label><input type="time" value={followupForm.scheduledTime} onChange={(e) => setFollowupForm({...followupForm, scheduledTime: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Notes</label><textarea value={followupForm.notes} onChange={(e) => setFollowupForm({...followupForm, notes: e.target.value})} className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600" rows={3} placeholder="Additional notes..." /></div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => { setShowFollowupModal(false); resetFollowupForm(); }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSaveFollowup} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"><Save className="w-4 h-4" />{editingFollowup ? "Update" : "Schedule"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
