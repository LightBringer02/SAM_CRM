import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Shield, Plus, Trash2, Edit2, Save, X, Users, Check } from "lucide-react";

// All available permissions in the system
const ALL_PERMISSIONS = [
  { id: "view_dashboard", name: "View Dashboard", category: "Dashboard" },
  { id: "view_vouchers", name: "View Vouchers", category: "Vouchers" },
  { id: "edit_vouchers", name: "Edit Vouchers", category: "Vouchers" },
  { id: "delete_vouchers", name: "Delete Vouchers", category: "Vouchers" },
  { id: "export_vouchers", name: "Export Vouchers", category: "Vouchers" },
  { id: "view_inventory", name: "View Inventory", category: "Inventory" },
  { id: "manage_inventory", name: "Manage Inventory", category: "Inventory" },
  { id: "view_ledgers", name: "View Ledgers", category: "Ledgers" },
  { id: "manage_ledgers", name: "Manage Ledgers", category: "Ledgers" },
  { id: "view_reports", name: "View Reports", category: "Reports" },
  { id: "export_reports", name: "Export Reports", category: "Reports" },
  { id: "view_employees", name: "View Employees", category: "Employees" },
  { id: "manage_employees", name: "Manage Employees", category: "Employees" },
  { id: "view_users", name: "View Users", category: "Users" },
  { id: "manage_users", name: "Manage Users", category: "Users" },
  { id: "view_settings", name: "View Settings", category: "Settings" },
  { id: "manage_settings", name: "Manage Settings", category: "Settings" },
  { id: "view_logs", name: "View Logs", category: "System" },
  { id: "manage_backups", name: "Manage Backups", category: "System" },
  { id: "manage_queue", name: "Manage Queue", category: "System" },
];

// Default roles with their permissions
const DEFAULT_ROLES = [
  {
    id: "root",
    name: "Root",
    description: "Full system access - cannot be modified",
    permissions: ALL_PERMISSIONS.map(p => p.id),
    isSystem: true,
    canDelete: false
  },
  {
    id: "admin",
    name: "Admin",
    description: "Administrative access",
    permissions: ALL_PERMISSIONS.filter(p => !["manage_backups", "manage_queue"].includes(p.id)).map(p => p.id),
    isSystem: true,
    canDelete: false
  },
  {
    id: "manager",
    name: "Manager",
    description: "Management level access",
    permissions: ["view_dashboard", "view_vouchers", "edit_vouchers", "view_inventory", "view_ledgers", "view_reports", "export_reports", "view_employees"],
    isSystem: true,
    canDelete: false
  },
  {
    id: "staff",
    name: "Staff",
    description: "Staff level access",
    permissions: ["view_dashboard", "view_vouchers", "view_inventory", "view_ledgers"],
    isSystem: true,
    canDelete: false
  },
  {
    id: "user",
    name: "User",
    description: "Basic user access",
    permissions: ["view_dashboard"],
    isSystem: true,
    canDelete: false
  }
];

// Get roles from localStorage or use defaults
function getRolesFromStorage() {
  try {
    const stored = localStorage.getItem("system_roles");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to ensure system roles exist
      const systemRoleIds = DEFAULT_ROLES.map(r => r.id);
      const customRoles = parsed.filter(r => !systemRoleIds.includes(r.id));
      return [...DEFAULT_ROLES, ...customRoles];
    }
  } catch (err) {
    console.error("Failed to load roles:", err);
  }
  return DEFAULT_ROLES;
}

// Save roles to localStorage
function saveRolesToStorage(roles) {
  try {
    localStorage.setItem("system_roles", JSON.stringify(roles));
    return true;
  } catch (err) {
    console.error("Failed to save roles:", err);
    return false;
  }
}

export default function RolesPage() {
  const { user, isRoot, isAdminOrHigher } = useAuth();
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

  // Check access and load roles
  useEffect(() => {
    // Check if user has admin or higher access
    const userRole = user?.role?.toLowerCase();
    const hasAccess = userRole === 'root' || userRole === 'admin';
    
    if (!user) {
      navigate("/login");
      return;
    }
    
    if (!hasAccess) {
      navigate("/dashboard");
      return;
    }
    
    // Load roles
    const loadedRoles = getRolesFromStorage();
    setRoles(loadedRoles);
    setLoading(false);
  }, [user, navigate]);

  // Create new role
  const handleCreateRole = () => {
    if (!newRoleName.trim()) {
      setMessage({ type: "error", text: "Role name is required" });
      return;
    }
    
    const roleId = newRoleName.toLowerCase().replace(/\s+/g, "_");
    if (roles.some(r => r.id === roleId)) {
      setMessage({ type: "error", text: "A role with this name already exists" });
      return;
    }

    const newRole = {
      id: roleId,
      name: newRoleName.trim(),
      description: newRoleDesc.trim() || `Custom role: ${newRoleName}`,
      permissions: newRolePerms,
      isSystem: false,
      canDelete: true,
      createdAt: new Date().toISOString()
    };

    const updatedRoles = [...roles, newRole];
    if (saveRolesToStorage(updatedRoles)) {
      setRoles(updatedRoles);
      setShowCreateModal(false);
      setNewRoleName("");
      setNewRoleDesc("");
      setNewRolePerms([]);
      setMessage({ type: "success", text: `Role "${newRole.name}" created successfully!` });
    } else {
      setMessage({ type: "error", text: "Failed to save role" });
    }
  };

  // Delete role
  const handleDeleteRole = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || !role.canDelete) {
      setMessage({ type: "error", text: "This role cannot be deleted" });
      return;
    }

    if (!window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      return;
    }

    const updatedRoles = roles.filter(r => r.id !== roleId);
    if (saveRolesToStorage(updatedRoles)) {
      setRoles(updatedRoles);
      if (selectedRole?.id === roleId) {
        setSelectedRole(null);
      }
      setMessage({ type: "success", text: `Role "${role.name}" deleted successfully!` });
    } else {
      setMessage({ type: "error", text: "Failed to delete role" });
    }
  };

  // Start editing role permissions
  const handleEditRole = (role) => {
    if (role.id === "root") {
      setMessage({ type: "error", text: "Root role permissions cannot be modified" });
      return;
    }
    setEditingRole(role);
    setEditingPerms([...role.permissions]);
  };

  // Save edited permissions
  const handleSavePermissions = () => {
    if (!editingRole) return;

    const updatedRoles = roles.map(r => 
      r.id === editingRole.id 
        ? { ...r, permissions: editingPerms, updatedAt: new Date().toISOString() }
        : r
    );

    if (saveRolesToStorage(updatedRoles)) {
      setRoles(updatedRoles);
      setEditingRole(null);
      setEditingPerms([]);
      setMessage({ type: "success", text: `Permissions updated for "${editingRole.name}"!` });
    } else {
      setMessage({ type: "error", text: "Failed to save permissions" });
    }
  };

  // Toggle permission
  const togglePermission = (permId, permsArray, setPermsArray) => {
    if (permsArray.includes(permId)) {
      setPermsArray(permsArray.filter(p => p !== permId));
    } else {
      setPermsArray([...permsArray, permId]);
    }
  };

  // Group permissions by category
  const groupedPermissions = ALL_PERMISSIONS.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  // Helper to check if current user is root
  const userIsRoot = user?.role?.toLowerCase() === 'root';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 dark:bg-[#0f172a] min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-sky-600 dark:text-sky-400" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Roles & Permissions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Manage user roles and their permissions</p>
          </div>
        </div>
        {userIsRoot && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition"
          >
            <Plus className="w-5 h-5" />
            Create Role
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
          message.type === "success" 
            ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300"
            : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
        }`}>
          {message.type === "success" ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {roles.map(role => (
          <div
            key={role.id}
            className={`p-4 rounded-lg border cursor-pointer transition ${
              selectedRole?.id === role.id
                ? "border-sky-500 bg-sky-50 dark:bg-sky-900/20"
                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1e1f22] hover:border-sky-300 dark:hover:border-sky-700"
            }`}
            onClick={() => setSelectedRole(role)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <h3 className="font-semibold text-gray-900 dark:text-white">{role.name}</h3>
                {role.isSystem && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded">
                    System
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {role.id !== "root" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditRole(role); }}
                    className="p-1 text-gray-500 hover:text-sky-600 dark:hover:text-sky-400"
                    title="Edit Permissions"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                )}
                {role.canDelete && userIsRoot && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteRole(role.id); }}
                    className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                    title="Delete Role"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{role.description}</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              {role.permissions.length} permission{role.permissions.length !== 1 ? "s" : ""}
            </p>
          </div>
        ))}
      </div>

      {/* Selected Role Details */}
      {selectedRole && (
        <div className="bg-white dark:bg-[#1e1f22] rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {selectedRole.name} - Permissions
            </h2>
            {selectedRole.id !== "root" && (
              <button
                onClick={() => handleEditRole(selectedRole)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded-lg hover:bg-sky-200 dark:hover:bg-sky-900/50"
              >
                <Edit2 className="w-4 h-4" />
                Edit Permissions
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(groupedPermissions).map(([category, perms]) => (
              <div key={category} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                <div className="space-y-1">
                  {perms.map(perm => (
                    <div key={perm.id} className="flex items-center gap-2 text-sm">
                      {selectedRole.permissions.includes(perm.id) ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <X className="w-4 h-4 text-gray-300 dark:text-gray-600" />
                      )}
                      <span className={selectedRole.permissions.includes(perm.id) 
                        ? "text-gray-900 dark:text-white" 
                        : "text-gray-400 dark:text-gray-500"
                      }>
                        {perm.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setEditingRole(null)}>
          <div className="bg-white dark:bg-[#1e1f22] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Permissions: {editingRole.name}
              </h2>
              <button onClick={() => setEditingRole(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                    <div className="space-y-2">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingPerms.includes(perm.id)}
                            onChange={() => togglePermission(perm.id, editingPerms, setEditingPerms)}
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditingRole(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePermissions}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
              >
                <Save className="w-4 h-4" />
                Save Permissions
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white dark:bg-[#1e1f22] rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Role</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Name</label>
                  <input
                    type="text"
                    value={newRoleName}
                    onChange={e => setNewRoleName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g., Accountant"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={newRoleDesc}
                    onChange={e => setNewRoleDesc(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500"
                    placeholder="e.g., Access to financial reports"
                  />
                </div>
              </div>

              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(groupedPermissions).map(([category, perms]) => (
                  <div key={category} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">{category}</h4>
                    <div className="space-y-2">
                      {perms.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newRolePerms.includes(perm.id)}
                            onChange={() => togglePermission(perm.id, newRolePerms, setNewRolePerms)}
                            className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{perm.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRole}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Create Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
