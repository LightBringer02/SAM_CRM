import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { Shield, Plus, Trash2, Edit2, Save, X, Users, Check, Eye, PenLine, FilePlus, Trash } from "lucide-react";

// ── Pages with CRUD permissions ──────────────────────────────────────
const PERMISSION_PAGES = [
  { id: "dashboard", name: "Dashboard" },
  { id: "vouchers", name: "Vouchers" },
  { id: "orders", name: "Orders" },
  { id: "ledgers", name: "Ledgers" },
  { id: "inventory", name: "Inventory" },
  { id: "employees", name: "Employees" },
  { id: "communication", name: "Communication" },
  { id: "reports", name: "Reports" },
  { id: "queue_management", name: "Queue Management" },
  { id: "backup_management", name: "Backup Management" },
];

const OPERATIONS = [
  { id: "view", name: "View", icon: Eye },
  { id: "create", name: "Create", icon: FilePlus },
  { id: "edit", name: "Edit", icon: PenLine },
  { id: "delete", name: "Delete", icon: Trash },
];

// Extra permissions not tied to a page CRUD
const EXTRA_PERMISSIONS = [
  { id: "view_rates", name: "View Item Rates" },
  { id: "manage_users", name: "Manage Users" },
  { id: "manage_roles", name: "Manage Roles" },
  { id: "view_logs", name: "View System Logs" },
  { id: "generate_invoice", name: "Generate Invoice from Orders" },
  { id: "export_data", name: "Export / Print Data" },
];

// Generate all permission IDs
function getAllPermissionIds() {
  const ids = [];
  PERMISSION_PAGES.forEach(page => {
    OPERATIONS.forEach(op => { ids.push(`${page.id}_${op.id}`); });
  });
  EXTRA_PERMISSIONS.forEach(p => ids.push(p.id));
  return ids;
}

const ALL_PERMISSION_IDS = getAllPermissionIds();

// Default roles
const DEFAULT_ROLES = [
  {
    id: "root", name: "Root", description: "Full system access — cannot be modified",
    permissions: ALL_PERMISSION_IDS, isSystem: true, canDelete: false, hidden: true,
  },
  {
    id: "admin", name: "Admin", description: "Full business access",
    permissions: ALL_PERMISSION_IDS.filter(p => !p.startsWith("queue_management_") && !p.startsWith("backup_management_")),
    isSystem: true, canDelete: false,
  },
  {
    id: "manager", name: "Manager", description: "Management level access",
    permissions: [
      "dashboard_view", "vouchers_view", "vouchers_create", "vouchers_edit",
      "orders_view", "orders_create", "ledgers_view", "inventory_view",
      "employees_view", "communication_view", "communication_create",
      "reports_view", "view_rates", "export_data",
    ],
    isSystem: true, canDelete: false,
  },
  {
    id: "staff", name: "Staff", description: "Staff level access",
    permissions: [
      "dashboard_view", "vouchers_view", "orders_view", "ledgers_view",
      "inventory_view", "communication_view",
    ],
    isSystem: true, canDelete: false,
  },
  {
    id: "user", name: "User", description: "Basic user access",
    permissions: ["dashboard_view"], isSystem: true, canDelete: false,
  },
];

// ── Storage helpers ──────────────────────────────────────────────────
function getRolesFromStorage() {
  try {
    const stored = localStorage.getItem("system_roles");
    if (stored) {
      const parsed = JSON.parse(stored);
      const systemRoleIds = DEFAULT_ROLES.map(r => r.id);
      const customRoles = parsed.filter(r => !systemRoleIds.includes(r.id));
      return [...DEFAULT_ROLES, ...customRoles];
    }
  } catch (err) { console.error("Failed to load roles:", err); }
  return DEFAULT_ROLES;
}

function saveRolesToStorage(roles) {
  try { localStorage.setItem("system_roles", JSON.stringify(roles)); return true; }
  catch (err) { console.error("Failed to save roles:", err); return false; }
}

// ── Component ────────────────────────────────────────────────────────
export default function RolesPage() {
  const { user, isRoot, isAdminOrHigher } = useAuth();
  const { currentTheme } = useTheme();
  const navigate = useNavigate();

  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [editingPerms, setEditingPerms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newRolePerms, setNewRolePerms] = useState([]);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  const userIsRoot = user?.role?.toLowerCase() === "root";
  const userIsAdminOrHigher = user?.role?.toLowerCase() === "admin" || userIsRoot;

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!userIsAdminOrHigher) { navigate("/dashboard"); return; }
    setRoles(getRolesFromStorage());
    setLoading(false);
  }, [user, navigate, userIsAdminOrHigher]);

  // Hide root from non-root users
  const visibleRoles = roles.filter(r => !(r.id === "root" && !userIsRoot));

  const handleCreateRole = () => {
    if (!newRoleName.trim()) { setMessage({ type: "error", text: "Role name is required" }); return; }
    const roleId = newRoleName.toLowerCase().replace(/\s+/g, "_");
    if (roles.some(r => r.id === roleId)) { setMessage({ type: "error", text: "Role already exists" }); return; }
    const newRole = { id: roleId, name: newRoleName.trim(), description: newRoleDesc.trim() || `Custom role: ${newRoleName}`, permissions: newRolePerms, isSystem: false, canDelete: true, createdAt: new Date().toISOString() };
    const updated = [...roles, newRole];
    if (saveRolesToStorage(updated)) {
      setRoles(updated); setShowCreateModal(false); setNewRoleName(""); setNewRoleDesc(""); setNewRolePerms([]);
      setMessage({ type: "success", text: `Role "${newRole.name}" created!` });
    }
  };

  const handleDeleteRole = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role?.canDelete) return;
    if (!window.confirm(`Delete role "${role.name}"?`)) return;
    const updated = roles.filter(r => r.id !== roleId);
    if (saveRolesToStorage(updated)) { setRoles(updated); if (selectedRole?.id === roleId) setSelectedRole(null); setMessage({ type: "success", text: `Deleted.` }); }
  };

  const handleEditRole = (role) => {
    if (role.id === "root") { setMessage({ type: "error", text: "Root role cannot be modified" }); return; }
    setEditingRole(role); setEditingPerms([...role.permissions]);
  };

  const handleSavePermissions = () => {
    if (!editingRole) return;
    const updated = roles.map(r => r.id === editingRole.id ? { ...r, permissions: editingPerms, updatedAt: new Date().toISOString() } : r);
    if (saveRolesToStorage(updated)) { setRoles(updated); setEditingRole(null); setEditingPerms([]); setMessage({ type: "success", text: `Permissions updated for "${editingRole.name}"!` }); }
  };

  const togglePerm = (permId, arr, setArr) => setArr(arr.includes(permId) ? arr.filter(p => p !== permId) : [...arr, permId]);

  const togglePageAll = (pageId, arr, setArr) => {
    const pp = OPERATIONS.map(op => `${pageId}_${op.id}`);
    setArr(pp.every(p => arr.includes(p)) ? arr.filter(p => !pp.includes(p)) : [...new Set([...arr, ...pp])]);
  };

  // ── Permission Matrix Component ──────────────────────────────────
  const PermissionMatrix = ({ perms, setPerms, readOnly = false }) => (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left py-2 px-3 font-semibold" style={{ color: currentTheme?.text }}>Page</th>
              {OPERATIONS.map(op => {
                const Icon = op.icon;
                return (
                  <th key={op.id} className="text-center py-2 px-2 font-medium" style={{ color: currentTheme?.textMuted }}>
                    <div className="flex flex-col items-center gap-0.5"><Icon className="w-3.5 h-3.5" /><span className="text-[10px]">{op.name}</span></div>
                  </th>
                );
              })}
              <th className="text-center py-2 px-2 font-medium" style={{ color: currentTheme?.textMuted }}><span className="text-[10px]">All</span></th>
            </tr>
          </thead>
          <tbody>
            {PERMISSION_PAGES.map(page => {
              const pp = OPERATIONS.map(op => `${page.id}_${op.id}`);
              const allChecked = pp.every(p => perms.includes(p));
              const someChecked = pp.some(p => perms.includes(p));
              return (
                <tr key={page.id} className="border-t" style={{ borderColor: currentTheme?.border }}>
                  <td className="py-2 px-3 font-medium" style={{ color: currentTheme?.text }}>{page.name}</td>
                  {OPERATIONS.map(op => {
                    const permId = `${page.id}_${op.id}`;
                    return (
                      <td key={op.id} className="text-center py-2 px-2">
                        <input type="checkbox" checked={perms.includes(permId)} onChange={() => !readOnly && togglePerm(permId, perms, setPerms)} disabled={readOnly}
                          className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer disabled:cursor-default disabled:opacity-60" />
                      </td>
                    );
                  })}
                  <td className="text-center py-2 px-2">
                    <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={() => !readOnly && togglePageAll(page.id, perms, setPerms)} disabled={readOnly}
                      className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 cursor-pointer disabled:cursor-default disabled:opacity-60" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 pt-4 border-t" style={{ borderColor: currentTheme?.border }}>
        <h4 className="text-sm font-semibold mb-2" style={{ color: currentTheme?.text }}>Extra Permissions</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {EXTRA_PERMISSIONS.map(p => (
            <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer py-1">
              <input type="checkbox" checked={perms.includes(p.id)} onChange={() => !readOnly && togglePerm(p.id, perms, setPerms)} disabled={readOnly}
                className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 disabled:cursor-default disabled:opacity-60" />
              <span style={{ color: currentTheme?.text }}>{p.name}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600" /></div>;

  return (
    <div className="p-6 min-h-screen" style={{ color: currentTheme?.text }}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8" style={{ color: currentTheme?.primary }} />
          <div className="glass-text">
            <h1 className="text-2xl font-bold" style={{ color: currentTheme?.text }}>Roles & Permissions</h1>
            <p className="text-sm" style={{ color: currentTheme?.textMuted }}>Manage roles and page-level CRUD permissions</p>
          </div>
        </div>
        {userIsAdminOrHigher && (
          <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg" style={{ backgroundColor: currentTheme?.primary }}>
            <Plus className="w-5 h-5" /> Create Role
          </button>
        )}
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${message.type === "success" ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"}`}>
          {message.type === "success" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {visibleRoles.map(role => (
          <div key={role.id} className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedRole?.id === role.id ? "ring-2" : "hover:shadow-md"}`}
            style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: selectedRole?.id === role.id ? currentTheme?.primary : currentTheme?.border }}
            onClick={() => setSelectedRole(role)}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" style={{ color: currentTheme?.primary }} />
                <h3 className="font-semibold" style={{ color: currentTheme?.text }}>{role.name}</h3>
                {role.isSystem && <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: `${currentTheme?.primary}18`, color: currentTheme?.primary }}>System</span>}
              </div>
              <div className="flex gap-1">
                {role.id !== "root" && userIsAdminOrHigher && (
                  <button onClick={e => { e.stopPropagation(); handleEditRole(role); }} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10" title="Edit Permissions">
                    <Edit2 className="w-4 h-4" style={{ color: currentTheme?.textMuted }} />
                  </button>
                )}
                {role.canDelete && userIsAdminOrHigher && (
                  <button onClick={e => { e.stopPropagation(); handleDeleteRole(role.id); }} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20" title="Delete Role">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm mt-1" style={{ color: currentTheme?.textMuted }}>{role.description}</p>
            <p className="text-xs mt-2" style={{ color: currentTheme?.textMuted }}>{role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}</p>
          </div>
        ))}
      </div>

      {selectedRole && (
        <div className="rounded-xl border p-6 mb-6" style={{ backgroundColor: currentTheme?.surfaceAlt, borderColor: currentTheme?.border }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: currentTheme?.text }}>{selectedRole.name} — Permissions</h2>
            {selectedRole.id !== "root" && userIsAdminOrHigher && (
              <button onClick={() => handleEditRole(selectedRole)} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg" style={{ backgroundColor: `${currentTheme?.primary}18`, color: currentTheme?.primary }}>
                <Edit2 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>
          <PermissionMatrix perms={selectedRole.permissions} setPerms={() => {}} readOnly />
        </div>
      )}

      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingRole(null)}>
          <div className="bg-white dark:bg-[#1e1f22] rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: currentTheme?.border }}>
              <h2 className="text-lg font-semibold" style={{ color: currentTheme?.text }}>Edit: {editingRole.name}</h2>
              <button onClick={() => setEditingRole(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh]"><PermissionMatrix perms={editingPerms} setPerms={setEditingPerms} /></div>
            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: currentTheme?.border }}>
              <button onClick={() => setEditingRole(null)} className="px-4 py-2 rounded-lg" style={{ color: currentTheme?.text }}>Cancel</button>
              <button onClick={handleSavePermissions} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg" style={{ backgroundColor: currentTheme?.primary }}>
                <Save className="w-4 h-4" /> Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-[#1e1f22] rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: currentTheme?.border }}>
              <h2 className="text-lg font-semibold" style={{ color: currentTheme?.text }}>Create New Role</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[65vh]">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: currentTheme?.text }}>Role Name</label>
                  <input type="text" value={newRoleName} onChange={e => setNewRoleName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }} placeholder="e.g., Accountant" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: currentTheme?.text }}>Description</label>
                  <input type="text" value={newRoleDesc} onChange={e => setNewRoleDesc(e.target.value)} className="w-full px-3 py-2 border rounded-lg" style={{ backgroundColor: currentTheme?.surface, borderColor: currentTheme?.border, color: currentTheme?.text }} placeholder="e.g., Financial reports access" />
                </div>
              </div>
              <h4 className="font-semibold mb-2" style={{ color: currentTheme?.text }}>Permissions</h4>
              <PermissionMatrix perms={newRolePerms} setPerms={setNewRolePerms} />
            </div>
            <div className="p-4 border-t flex justify-end gap-2" style={{ borderColor: currentTheme?.border }}>
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 rounded-lg" style={{ color: currentTheme?.text }}>Cancel</button>
              <button onClick={handleCreateRole} className="flex items-center gap-2 px-4 py-2 text-white rounded-lg" style={{ backgroundColor: currentTheme?.primary }}>
                <Plus className="w-4 h-4" /> Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
