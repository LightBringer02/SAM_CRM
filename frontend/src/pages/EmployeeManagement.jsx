import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, UserPlus, Trash2, Edit2, Save, X, Phone, Mail,
  Building, Briefcase, IndianRupee, User, Search, Filter, Target
} from "lucide-react";

// Get employees from localStorage
function getEmployeesFromStorage() {
  try {
    const stored = localStorage.getItem("crm_employees");
    if (stored) return JSON.parse(stored);
  } catch (err) {
    console.error("Failed to load employees:", err);
  }
  return [];
}

// Save employees to localStorage
function saveEmployeesToStorage(employees) {
  try {
    localStorage.setItem("crm_employees", JSON.stringify(employees));
    return true;
  } catch (err) {
    console.error("Failed to save employees:", err);
    return false;
  }
}

const DEPARTMENTS = ["Sales", "Operations", "Finance", "HR", "IT", "Marketing", "Admin", "Other"];
const DESIGNATIONS = ["Manager", "Executive", "Senior Executive", "Team Lead", "Intern", "Trainee", "Director", "Other"];

export default function EmployeeManagement() {
  const { user, isAdminOrHigher, users } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [targetData, setTargetData] = useState({ monthlyTarget: "", incentiveRate: "" });
  const [message, setMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    designation: "",
    salary: "",
    joiningDate: "",
    address: "",
    emergencyContact: "",
    notes: "",
    isUser: false,
    userId: null,
    createUserAccount: false,
    userRole: "user"
  });

  const canManage = isAdminOrHigher();

  useEffect(() => {
    setEmployees(getEmployeesFromStorage());
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      department: "",
      designation: "",
      salary: "",
      joiningDate: "",
      address: "",
      emergencyContact: "",
      notes: "",
      isUser: false,
      userId: null,
      createUserAccount: false,
      userRole: "user"
    });
  };

  const handleCreateEmployee = () => {
    if (!formData.name.trim()) {
      setMessage({ type: "error", text: "Employee name is required" });
      return;
    }

    let userId = formData.userId;
    
    // Create user account if requested
    if (formData.createUserAccount && !formData.userId) {
      if (!formData.email) {
        setMessage({ type: "error", text: "Email is required to create user account" });
        return;
      }
      
      // Generate username from email
      const username = formData.email.split("@")[0];
      const existingUsers = JSON.parse(localStorage.getItem("users") || "[]");
      
      // Check if username already exists
      if (existingUsers.some(u => u.username === username)) {
        setMessage({ type: "error", text: `Username "${username}" already exists. Please use a different email or link to existing user.` });
        return;
      }
      
      // Create new user with temp password
      const tempPassword = localStorage.getItem("adminTempPassword") || "TempPassword@123";
      const newUser = {
        id: Date.now(),
        username: username,
        name: formData.name,
        email: formData.email,
        password: tempPassword,
        role: formData.userRole || "user",
        createdAt: new Date().toLocaleDateString(),
        isNewUser: true,
        isEmployee: true
      };
      
      const updatedUsers = [...existingUsers, newUser];
      localStorage.setItem("users", JSON.stringify(updatedUsers));
      
      userId = newUser.id;
      setMessage({ type: "success", text: `User account created! Username: ${username}, Temp Password: ${tempPassword}` });
    }

    const newEmployee = {
      id: Date.now().toString(),
      ...formData,
      salary: parseFloat(formData.salary) || 0,
      monthlyTarget: 0,
      incentiveRate: 0,
      isUser: !!userId,
      userId: userId,
      createdAt: new Date().toISOString(),
      createdBy: user?.id
    };

    const updatedEmployees = [...employees, newEmployee];
    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setShowCreateModal(false);
      resetForm();
      setMessage({ type: "success", text: `Employee "${newEmployee.name}" created successfully!` });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: "error", text: "Failed to save employee" });
    }
  };

  const handleUpdateEmployee = () => {
    if (!selectedEmployee) return;

    const updatedEmployees = employees.map(emp =>
      emp.id === selectedEmployee.id
        ? {
            ...emp,
            ...formData,
            salary: parseFloat(formData.salary) || 0,
            // Keep existing target/incentive values
            monthlyTarget: emp.monthlyTarget || 0,
            incentiveRate: emp.incentiveRate || 0,
            updatedAt: new Date().toISOString()
          }
        : emp
    );

    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setShowEditModal(false);
      setSelectedEmployee(null);
      resetForm();
      setMessage({ type: "success", text: "Employee updated successfully!" });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: "error", text: "Failed to update employee" });
    }
  };

  const handleDeleteEmployee = (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!window.confirm(`Are you sure you want to delete "${emp?.name}"?`)) return;

    const updatedEmployees = employees.filter(e => e.id !== empId);
    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setMessage({ type: "success", text: "Employee deleted successfully!" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setFormData({
      name: emp.name || "",
      email: emp.email || "",
      phone: emp.phone || "",
      department: emp.department || "",
      designation: emp.designation || "",
      salary: emp.salary?.toString() || "",
      joiningDate: emp.joiningDate || "",
      address: emp.address || "",
      emergencyContact: emp.emergencyContact || "",
      notes: emp.notes || "",
      isUser: emp.isUser || false,
      userId: emp.userId || null
    });
    setShowEditModal(true);
  };

  // Open target/incentive modal for an employee
  const openTargetModal = (emp) => {
    setSelectedEmployee(emp);
    setTargetData({
      monthlyTarget: emp.monthlyTarget?.toString() || "",
      incentiveRate: emp.incentiveRate?.toString() || ""
    });
    setShowTargetModal(true);
  };

  // Save target and incentive
  const handleSaveTarget = () => {
    if (!selectedEmployee) return;

    const updatedEmployees = employees.map(emp =>
      emp.id === selectedEmployee.id
        ? {
            ...emp,
            monthlyTarget: parseFloat(targetData.monthlyTarget) || 0,
            incentiveRate: parseFloat(targetData.incentiveRate) || 0,
            updatedAt: new Date().toISOString()
          }
        : emp
    );

    if (saveEmployeesToStorage(updatedEmployees)) {
      setEmployees(updatedEmployees);
      setShowTargetModal(false);
      setSelectedEmployee(null);
      setTargetData({ monthlyTarget: "", incentiveRate: "" });
      setMessage({ type: "success", text: "Target and incentive updated!" });
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ type: "error", text: "Failed to update target" });
    }
  };

  // ESC key handler for back navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (showCreateModal) {
          setShowCreateModal(false);
        } else if (showEditModal) {
          setShowEditModal(false);
        } else if (showTargetModal) {
          setShowTargetModal(false);
        } else {
          navigate(-1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, showCreateModal, showEditModal, showTargetModal]);

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = !search || 
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase()) ||
      emp.phone?.includes(search);
    const matchesDept = !filterDept || emp.department === filterDept;
    return matchesSearch && matchesDept;
  });

  const EmployeeModal = ({ isEdit = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isEdit ? "Edit Employee" : "Add New Employee"}
          </h2>
          <button onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="col-span-2 md:col-span-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Employee name"
            />
          </div>
          
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="email@example.com"
            />
          </div>
          
          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="+91 98765 43210"
            />
          </div>
          
          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Department</label>
            <select
              value={formData.department}
              onChange={(e) => setFormData({...formData, department: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select Department</option>
              {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
            </select>
          </div>
          
          {/* Designation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Designation</label>
            <select
              value={formData.designation}
              onChange={(e) => setFormData({...formData, designation: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            >
              <option value="">Select Designation</option>
              {DESIGNATIONS.map(des => <option key={des} value={des}>{des}</option>)}
            </select>
          </div>
          
          {/* Salary */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Salary (₹)</label>
            <input
              type="number"
              value={formData.salary}
              onChange={(e) => setFormData({...formData, salary: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Monthly salary"
            />
          </div>
          
          {/* Joining Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Joining Date</label>
            <input
              type="date"
              value={formData.joiningDate}
              onChange={(e) => setFormData({...formData, joiningDate: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
            />
          </div>
          
          {/* Address */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={2}
              placeholder="Full address"
            />
          </div>
          
          {/* Emergency Contact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Emergency Contact</label>
            <input
              type="text"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({...formData, emergencyContact: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              placeholder="Emergency contact details"
            />
          </div>
          
          {/* Link to User */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to System User</label>
            <select
              value={formData.userId || ""}
              onChange={(e) => setFormData({...formData, userId: e.target.value || null, isUser: !!e.target.value, createUserAccount: false})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              disabled={formData.createUserAccount}
            >
              <option value="">No linked user</option>
              {users?.map(u => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
            </select>
          </div>
          
          {/* Create User Account Option */}
          {!isEdit && !formData.userId && (
            <div className="col-span-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.createUserAccount}
                  onChange={(e) => setFormData({...formData, createUserAccount: e.target.checked})}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <div>
                  <span className="font-medium text-gray-900 dark:text-white">Create System User Account</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Creates a login account for this employee using their email as username
                  </p>
                </div>
              </label>
              
              {formData.createUserAccount && (
                <div className="mt-3 flex items-center gap-4">
                  <label className="text-sm text-gray-600 dark:text-gray-400">User Role:</label>
                  <select
                    value={formData.userRole}
                    onChange={(e) => setFormData({...formData, userRole: e.target.value})}
                    className="px-3 py-1 border rounded-lg text-sm dark:bg-gray-700 dark:border-gray-600"
                  >
                    <option value="user">User</option>
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                  </select>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    (Email required for user creation)
                  </span>
                </div>
              )}
            </div>
          )}
          
          {/* Notes */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({...formData, notes: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              rows={2}
              placeholder="Additional notes"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={isEdit ? handleUpdateEmployee : handleCreateEmployee}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isEdit ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/employees")}
            className="p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Management</h1>
            <p className="text-gray-500 dark:text-gray-400">Add, edit, and manage employee information</p>
          </div>
        </div>
        
        {canManage && (
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Employee
          </button>
        )}
      </div>

      {/* Message */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
                placeholder="Search employees..."
              />
            </div>
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        </div>
      </div>

      {/* Employee Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.length === 0 ? (
          <div className="col-span-full p-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-xl">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No employees found</p>
          </div>
        ) : (
          filteredEmployees.map(emp => (
            <div key={emp.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {emp.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{emp.name}</h3>
                      <p className="text-sm text-gray-500">{emp.designation || "Staff"}</p>
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openTargetModal(emp)} 
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Set Target & Incentive"
                      >
                        <Target className="w-4 h-4 text-green-600" />
                      </button>
                      <button onClick={() => openEditModal(emp)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Edit Employee">
                        <Edit2 className="w-4 h-4 text-blue-600" />
                      </button>
                      <button onClick={() => handleDeleteEmployee(emp.id)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" title="Delete Employee">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="mt-4 space-y-2 text-sm">
                  {emp.department && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Building className="w-4 h-4" />
                      <span>{emp.department}</span>
                    </div>
                  )}
                  {emp.email && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Mail className="w-4 h-4" />
                      <span>{emp.email}</span>
                    </div>
                  )}
                  {emp.phone && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <Phone className="w-4 h-4" />
                      <span>{emp.phone}</span>
                    </div>
                  )}
                  {emp.salary > 0 && (
                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <IndianRupee className="w-4 h-4" />
                      <span>₹{emp.salary.toLocaleString('en-IN')}/month</span>
                    </div>
                  )}
                </div>
                
                {/* Target and Incentive */}
                {(emp.monthlyTarget > 0 || emp.incentiveRate > 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Monthly Target:</span>
                      <span className="font-semibold text-gray-900 dark:text-white">₹{(emp.monthlyTarget || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-500">Incentive Rate:</span>
                      <span className="font-semibold text-green-600">{emp.incentiveRate || 0}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showCreateModal && <EmployeeModal isEdit={false} />}
      {showEditModal && <EmployeeModal isEdit={true} />}
      
      {/* Target & Incentive Modal */}
      {showTargetModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg w-full max-w-md p-6 m-4">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Set Target & Incentive</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedEmployee.name}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowTargetModal(false)} 
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Monthly Target (₹)
                </label>
                <input
                  type="number"
                  value={targetData.monthlyTarget}
                  onChange={(e) => setTargetData({...targetData, monthlyTarget: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-green-500"
                  placeholder="Enter monthly sales target"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">The sales amount employee needs to achieve per month</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Incentive Rate (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={targetData.incentiveRate}
                  onChange={(e) => setTargetData({...targetData, incentiveRate: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-green-500"
                  placeholder="Enter incentive percentage"
                />
                <p className="text-xs text-gray-500 mt-1">Percentage of sales amount above target as incentive</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowTargetModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTarget}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Target
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
