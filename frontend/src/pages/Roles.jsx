import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// Dummy permissions list (replace with API fetch if needed)
const ALL_PERMISSIONS = [
  "View Vouchers",
  "Edit Vouchers",
  "Delete Vouchers",
  "Export PDF",
  "Manage Employees",
  "View Reports",
  "Manage Inventory",
  "Settings Access",
];

export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePerms, setNewRolePerms] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [editingPerms, setEditingPerms] = useState([]);
  const [assignEmpId, setAssignEmpId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // Check admin access (replace with real auth check)
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "admin") {
      navigate("/dashboard");
    }
  }, [navigate]);

  // Fetch roles and employees (replace with API calls)
  useEffect(() => {
    async function fetchData() {
      try {
        // Replace with your API endpoints
        const rolesRes = await axios.get("/api/roles");
        setRoles(rolesRes.data || []);
        const empRes = await axios.get("/api/employees");
        setEmployees(empRes.data || []);
      } catch (err) {
        setError("Failed to fetch roles or employees");
      }
    }
    fetchData();
  }, []);

  // Create new role
  async function handleCreateRole() {
    if (!newRoleName.trim()) return setError("Role name required");
    try {
      await axios.post("/api/roles", { name: newRoleName, permissions: newRolePerms });
      setNewRoleName("");
      setNewRolePerms([]);
      setError("");
      // Refresh roles
      const rolesRes = await axios.get("/api/roles");
      setRoles(rolesRes.data || []);
    } catch (err) {
      setError("Failed to create role");
    }
  }

  // Delete role
  async function handleDeleteRole(roleId) {
    if (!window.confirm("Delete this role?")) return;
    try {
      await axios.delete(`/api/roles/${roleId}`);
      setError("");
      setRoles(roles.filter(r => r.id !== roleId));
    } catch (err) {
      setError("Failed to delete role");
    }
  }

  // Edit role permissions
  async function handleUpdateRole() {
    if (!editingRole) return;
    try {
      await axios.put(`/api/roles/${editingRole.id}`, { permissions: editingPerms });
      setEditingRole(null);
      setEditingPerms([]);
      setError("");
      // Refresh roles
      const rolesRes = await axios.get("/api/roles");
      setRoles(rolesRes.data || []);
    } catch (err) {
      setError("Failed to update role");
    }
  }

  // Assign role to employee
  async function handleAssignRole() {
    if (!assignEmpId || !assignRoleId) return setError("Select employee and role");
    try {
      await axios.post(`/api/employees/${assignEmpId}/assign-role`, { roleId: assignRoleId });
      setAssignEmpId("");
      setAssignRoleId("");
      setError("");
      // Optionally refresh employees
      const empRes = await axios.get("/api/employees");
      setEmployees(empRes.data || []);
    } catch (err) {
      setError("Failed to assign role");
    }
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4 text-blue-800">Roles & Permissions</h1>
      {error && <div className="text-red-600 font-bold mb-4">{error}</div>}
      {/* Create Role */}
      <div className="mb-6 border p-4 rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Create New Role</h2>
        <input
          className="border px-3 py-2 rounded mr-2"
          placeholder="Role Name"
          value={newRoleName}
          onChange={e => setNewRoleName(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 my-2">
          {ALL_PERMISSIONS.map(perm => (
            <label key={perm} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={newRolePerms.includes(perm)}
                onChange={e => {
                  setNewRolePerms(
                    e.target.checked
                      ? [...newRolePerms, perm]
                      : newRolePerms.filter(p => p !== perm)
                  );
                }}
              />
              <span>{perm}</span>
            </label>
          ))}
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={handleCreateRole}>Create Role</button>
      </div>
      {/* Roles List */}
      <div className="mb-6 border p-4 rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Existing Roles</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-blue-100">
              <th className="px-3 py-2 text-left">Role Name</th>
              <th className="px-3 py-2 text-left">Permissions</th>
              <th className="px-3 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map(role => (
              <tr key={role.id} className="border-b">
                <td className="px-3 py-2 font-semibold">{role.name}</td>
                <td className="px-3 py-2">
                  {role.permissions && role.permissions.length > 0 ? role.permissions.join(", ") : "-"}
                </td>
                <td className="px-3 py-2">
                  <button className="bg-yellow-500 text-white px-2 py-1 rounded mr-2" onClick={() => {setEditingRole(role);setEditingPerms(role.permissions || []);}}>Edit</button>
                  <button className="bg-red-600 text-white px-2 py-1 rounded" onClick={() => handleDeleteRole(role.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Edit Role Modal */}
      {editingRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)" }}>
          <div className="bg-white border p-6 rounded shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Edit Role: {editingRole.name}</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={editingPerms.includes(perm)}
                    onChange={e => {
                      setEditingPerms(
                        e.target.checked
                          ? [...editingPerms, perm]
                          : editingPerms.filter(p => p !== perm)
                      );
                    }}
                  />
                  <span>{perm}</span>
                </label>
              ))}
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded mr-2" onClick={handleUpdateRole}>Update</button>
            <button className="bg-gray-400 text-white px-4 py-2 rounded" onClick={() => setEditingRole(null)}>Cancel</button>
          </div>
        </div>
      )}
      {/* Assign Role to Employee */}
      <div className="mb-6 border p-4 rounded bg-gray-50">
        <h2 className="text-lg font-semibold mb-2">Assign Role to Employee</h2>
        <select className="border px-3 py-2 rounded mr-2" value={assignEmpId} onChange={e => setAssignEmpId(e.target.value)}>
          <option value="">Select Employee</option>
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
        <select className="border px-3 py-2 rounded mr-2" value={assignRoleId} onChange={e => setAssignRoleId(e.target.value)}>
          <option value="">Select Role</option>
          {roles.map(role => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
        <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={handleAssignRole}>Assign</button>
      </div>
    </div>
  );
}
